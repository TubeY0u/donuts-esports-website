import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { collectTwitch } from '../scripts/update-twitch.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const walk = dir => fs.readdirSync(dir,{withFileTypes:true})
  .filter(e => !e.name.startsWith('.') && !e.name.startsWith('_backup-') && e.name !== 'node_modules')
  .flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);
function context() {
  const document = { addEventListener() {}, querySelectorAll() { return []; }, querySelector() { return null; }, getElementById() { return null; } };
  const ctx = vm.createContext({ URL, document, window: {location: {origin:'https://donuts-esports.de'}}, console, requestAnimationFrame() {} });
  vm.runInContext(read('js/security.js'), ctx);
  return ctx;
}
const attack = '\"><img src=x onerror="globalThis.PWNED=1"><svg onload="globalThis.PWNED=1">';
test('URL allowlist rejects executable schemes, controls and credentials', () => {
  const {safeUrl,escapeHtml}=context().window.DonutsSecurity;
  for(const url of ['javascript:alert(1)','JaVaScRiPt:alert(1)','java\nscript:alert(1)','data:text/html,<script>alert(1)</script>','vbscript:msgbox(1)','https://trusted.example@evil.example/','file:///etc/passwd','http://example.com/',null]) assert.equal(safeUrl(url),'#');
  assert.equal(safeUrl('https://www.faceit.com/de/players/A'),'https://www.faceit.com/de/players/A');
  assert.equal(safeUrl('/assets/logo.png'),'https://donuts-esports.de/assets/logo.png');
  assert(!escapeHtml(attack).includes('<img'));
});
test('match renderers treat hostile external fields as text', () => {
  const ctx=context();
  const file=fs.readdirSync(path.join(root,'js/pages')).find(f=>f.startsWith('matches-'));
  const source=read('js/pages/'+file).split('// ── Tabs')[0];
  vm.runInContext(source,ctx);
  ctx.m={team1:attack,team2:attack,opponent:attack,caster:attack,competition:attack,time:attack,score:attack,date:'2026-09-21',faceitUrl:'javascript:alert(1)',isLive:true,mapScores:[attack]};
  ctx.standings=[{team:attack,pos:attack,played:attack,wins:attack,losses:attack,rd:attack,points:attack}];
  for(const expr of ['renderUpcomingCard(m,"main")','renderResultRow(m,"main")','renderStandings(standings,"main")']) {
    const html=vm.runInContext(expr,ctx);
    assert(!html.includes('<img'),expr);
    assert(!html.includes('href="javascript:'),expr);
    assert(html.includes('&lt;'),expr);
  }
});
test('leaderboard and map renderers escape names and attribute values', () => {
  const ctx=context(); const targets={};
  ctx.document.getElementById=id=>targets[id]||null;
  let source=read('js/roster.js').replace(/^import .*;\r?\n/m,'').replace(/\binit\(\);\s*$/,'');
  vm.runInContext(source,ctx);
  targets['elo-lb-list']={innerHTML:''};
  ctx.players=[{nickname:attack,teamSlug:attack,elo:2000,level:attack}];
  vm.runInContext('renderLeaderboard(players)',ctx);
  assert(!targets['elo-lb-list'].innerHTML.includes('<img'));
  ctx.mapEl={style:{},innerHTML:''};ctx.maps={[attack]:{played:12,wins:6,winRate:attack}};
  vm.runInContext('renderMapStats(mapEl,maps)',ctx);
  assert(!ctx.mapEl.innerHTML.includes('<img'));
  assert(ctx.mapEl.innerHTML.includes('&quot;'));
});
test('every page enforces external scripts only and has no inline event handlers', () => {
  const pages=walk(root).filter(f=>f.endsWith('.html'));
  assert.equal(pages.length,11);
  for(const file of pages){
    const html=fs.readFileSync(file,'utf8');
    assert(html.includes("script-src 'self'"),file);
    assert(html.includes("object-src 'none'"),file);
    assert(html.includes("base-uri 'none'"),file);
    assert(!/\son[a-z]+\s*=/i.test(html),file);
    for(const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
      assert(/\bsrc=|application\/ld\+json/.test(m[1])||!m[2].trim(),file);
      const src=m[1].match(/\bsrc="([^"]+)"/)?.[1];
      if(src) assert(fs.existsSync(path.join(root,src)),src);
    }
  }
});
test('browser code contains no access tokens or public CORS relay', () => {
  for(const file of walk(path.join(root,'js'))) {
    assert(!/twitch-token\.json|TWITCH_TOKEN|access_token|corsproxy|allorigins|codetabs/.test(fs.readFileSync(file,'utf8')),file);
  }
  assert.deepEqual(JSON.parse(read('data/twitch-token.json')),{});
});
test('Twitch collection exports only approved public fields and revokes token', async () => {
  const calls=[];
  const status=await collectTwitch({clientId:'test-id',clientSecret:'test-secret',request:async(url,options)=>{
    calls.push({url,options});
    if(url.endsWith('/token')) return {ok:true,json:async()=>({access_token:'test-private-token'})};
    if(url.endsWith('/revoke')) return {ok:true};
    return {ok:true,json:async()=>({data:[{user_login:'tube_y0u',viewer_count:42,access_token:'must-not-export'},{user_login:attack,viewer_count:12}]})};
  }});
  assert.deepEqual(status.data,[{user_login:'tube_y0u',viewer_count:42}]);
  assert(!JSON.stringify(status).includes('token'));
  assert(calls.at(-1).url.endsWith('/revoke'));
  assert.equal(calls.at(-1).options.body.get('token'),'test-private-token');
});
test('Twitch token is revoked on downstream failure', async () => {
  let revoked=false;
  await assert.rejects(collectTwitch({clientId:'id',clientSecret:'secret',request:async url=>{
    if(url.endsWith('/token')) return {ok:true,json:async()=>({access_token:'test-token'})};
    if(url.endsWith('/revoke')) {revoked=true;return {ok:true};}
    return {ok:false,status:503};
  }}));
  assert(revoked);
});
