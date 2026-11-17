import { writeFileSync, mkdirSync } from 'node:fs';

const USER = 'MohammedDev69';
const token = process.env.GH_TOKEN;
if (!token) throw new Error('GH_TOKEN missing');

const H = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
const AMP = '&' + 'amp;';
const LT = '&' + 'lt;';
const GT = '&' + 'gt;';
const esc = (s) => String(s).replace(/&/g, AMP).replace(/</g, LT).replace(/>/g, GT).replace(/"/g, '&' + 'quot;');

// ---------- GraphQL: user stats ----------
const query = `query($login: String!) {
  user(login: $login) {
    contributionsCollection {
      totalCommitContributions
      restrictedContributionsCount
      totalPullRequestContributions
      totalIssueContributions
      totalPullRequestReviewContributions
    }
    repositories(first: 100, ownerAffiliations: OWNER) { totalCount nodes { stargazerCount } }
    followers { totalCount }
  }
}`;

const gRes = await fetch('https://api.github.com/graphql', {
  method: 'POST', headers: H, body: JSON.stringify({ query, variables: { login: USER } }),
});
const gJson = await gRes.json();
if (gJson.errors) throw new Error('GraphQL: ' + JSON.stringify(gJson.errors));
const u = gJson.data.user;
const cc = u.contributionsCollection;
const stars = u.repositories.nodes.reduce((a, r) => a + r.stargazerCount, 0);

const rows = [
  ['COMMITS (1Y)', cc.totalCommitContributions + cc.restrictedContributionsCount],
  ['PULL REQUESTS', cc.totalPullRequestContributions],
  ['ISSUES', cc.totalIssueContributions],
  ['CODE REVIEWS', cc.totalPullRequestReviewContributions],
  ['STARS EARNED', stars],
  ['REPOSITORIES', u.repositories.totalCount],
  ['FOLLOWERS', u.followers.totalCount],
];

// ---------- REST: language bytes across owned repos ----------
const rRes = await fetch(`https://api.github.com/users/${USER}/repos?per_page=100&type=owner`, { headers: H });
if (!rRes.ok) throw new Error('repos: ' + rRes.status);
const repos = await rRes.json();
const langBytes = {};
for (const r of repos) {
  if (r.fork) continue;
  const lRes = await fetch(`https://api.github.com/repos/${r.full_name}/languages`, { headers: H });
  if (!lRes.ok) continue;
  const langs = await lRes.json();
  for (const [name, bytes] of Object.entries(langs)) langBytes[name] = (langBytes[name] || 0) + bytes;
}
const totalBytes = Object.values(langBytes).reduce((a, b) => a + b, 0) || 1;
const topLangs = Object.entries(langBytes).sort((a, b) => b[1] - a[1]).slice(0, 6)
  .map(([name, bytes]) => [name, (bytes / totalBytes) * 100]);
const shades = ['#e8e8e8', '#bdbdbd', '#8a8a8a', '#5f5f5f', '#3f3f3f', '#2a2a2a'];

// ---------- SVG: stats card ----------
const W = 900, rowH = 46, headH = 78;
const Hs = headH + rows.length * rowH + 26;
const statsSvg = `<svg width="${W}" height="${Hs}" viewBox="0 0 ${W} ${Hs}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="GitHub stats">
  <rect x="1" y="1" width="${W - 2}" height="${Hs - 2}" rx="16" fill="#0d1117" stroke="#2a2e37" stroke-width="1.5"/>
  <text x="40" y="48" font-family="'JetBrains Mono','Cascadia Code',Consolas,monospace" font-size="21" font-weight="700" letter-spacing="3" fill="#e8e8e8">TRONEX</text>
  <text x="158" y="48" font-family="'JetBrains Mono','Cascadia Code',Consolas,monospace" font-size="15" letter-spacing="2" fill="#8a8a8a">/ GITHUB STATS</text>
  <circle cx="${W - 40}" cy="42" r="4" fill="#e8e8e8"/>
  <line x1="40" y1="66" x2="${W - 40}" y2="66" stroke="#1e222b" stroke-width="1.5"/>
  ${rows.map(([label, value], i) => {
    const y = headH + i * rowH;
    return `<text x="40" y="${y + 29}" font-family="'JetBrains Mono',Consolas,monospace" font-size="15" letter-spacing="2" fill="#8a8a8a">${esc(label)}</text>
  <text x="${W - 40}" y="${y + 30}" text-anchor="end" font-family="'JetBrains Mono',Consolas,monospace" font-size="20" font-weight="700" fill="#e8e8e8">${esc(value.toLocaleString('en-US'))}</text>
  ${i < rows.length - 1 ? `<line x1="40" y1="${y + rowH}" x2="${W - 40}" y2="${y + rowH}" stroke="#1a1e26" stroke-width="1"/>` : ''}`;
  }).join('\n  ')}
</svg>`;

// ---------- SVG: languages card ----------
const Lh = headH + topLangs.length * rowH + 26;
const maxPct = topLangs.length ? topLangs[0][1] : 100;
const langSvg = `<svg width="${W}" height="${Lh}" viewBox="0 0 ${W} ${Lh}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Top languages">
  <rect x="1" y="1" width="${W - 2}" height="${Lh - 2}" rx="16" fill="#0d1117" stroke="#2a2e37" stroke-width="1.5"/>
  <text x="40" y="48" font-family="'JetBrains Mono','Cascadia Code',Consolas,monospace" font-size="21" font-weight="700" letter-spacing="3" fill="#e8e8e8">LANGUAGES</text>
  <circle cx="${W - 40}" cy="42" r="4" fill="#e8e8e8"/>
  <line x1="40" y1="66" x2="${W - 40}" y2="66" stroke="#1e222b" stroke-width="1.5"/>
  ${topLangs.map(([name, pct], i) => {
    const y = headH + i * rowH;
    const bw = Math.max(6, Math.round((pct / maxPct) * 560));
    return `<text x="40" y="${y + 29}" font-family="'JetBrains Mono',Consolas,monospace" font-size="15" fill="#bdbdbd">${esc(name)}</text>
  <text x="${W - 40}" y="${y + 29}" text-anchor="end" font-family="'JetBrains Mono',Consolas,monospace" font-size="15" fill="#8a8a8a">${pct.toFixed(1)}%</text>
  <rect x="40" y="${y + 36}" width="820" height="4" rx="2" fill="#1a1e26"/>
  <rect x="40" y="${y + 36}" width="${bw}" height="4" rx="2" fill="${shades[i % shades.length]}"/>`;
  }).join('\n  ')}
</svg>`;

mkdirSync('dist', { recursive: true });
writeFileSync('dist/stats.svg', statsSvg);
writeFileSync('dist/languages.svg', langSvg);
console.log('stats.svg + languages.svg generated');
