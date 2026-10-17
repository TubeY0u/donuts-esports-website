import test from 'node:test';
import assert from 'node:assert/strict';
import { parseDACHCSMatches } from '../scraper.js';

// Echte Zeilen von dachcs.de (Saison 6): "Spk" statt "Spielklasse", teils mit "· Phase 2"
const html = `<div>18.10.2026 18.10. 20:00 CHRONgg Oblivion - BO3 Spk 4 Gruppe F - DIEDONUTS Details
27.09.2026 27.09. 22:46 BASILEA BALLERS Main 1 BO3 Spk 4 Gruppe F 2 DIEDONUTS Details
25.10.2026 25.10. 16:00 DIEDONUTS NXT - BO3 Spk 8 · Phase 2 Gruppe B - Pros auf Wish Details</div>`;

test('DACH CS Saison-6-Zeilen mit "Spk" werden erkannt', () => {
  const main = parseDACHCSMatches(html, 'DIEDONUTS', { saison: 'DACH CS Masters Saison 6', spielklasse: 'Spielklasse 4', gruppe: 'Gruppe F', url: 'u' });
  assert.equal(main.upcoming.length, 1);
  assert.equal(main.upcoming[0].team1, 'CHRONgg Oblivion');
  assert.deepEqual(main.recent.map(r => [r.opponent, r.score, r.result]), [['BASILEA BALLERS Main', '2:1', 'win']]);
  const nxt = parseDACHCSMatches(html, 'DIEDONUTS NXT', { saison: 'DACH CS Masters Saison 6', spielklasse: 'Spielklasse 8', gruppe: 'Gruppe B', url: 'u' });
  assert.equal(nxt.upcoming.length, 1);
  assert.equal(nxt.upcoming[0].team2, 'Pros auf Wish');
});
