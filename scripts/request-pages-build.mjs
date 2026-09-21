// Commits made with GITHUB_TOKEN do not automatically trigger Pages builds.
const repository = process.env.GITHUB_REPOSITORY;
if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository || '') || !process.env.GH_TOKEN) {
  throw new Error('Missing GitHub repository context');
}
const res = await fetch(`https://api.github.com/repos/${repository}/pages/builds`, {
  method: 'POST', redirect: 'error', signal: AbortSignal.timeout(15000),
  headers: { Authorization: `Bearer ${process.env.GH_TOKEN}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
});
if (!res.ok) throw new Error(`GitHub Pages build request failed (${res.status})`);
console.log('GitHub Pages build requested.');
