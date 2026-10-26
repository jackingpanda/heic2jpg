const fs = require('node:fs/promises');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
async function main() {
  const history = require('../releases/history.json');
  const pkg = require('../package.json');
  if (history[0].version !== pkg.version) throw new Error('The first release entry must match package.json.');
  const versions = new Set();
  for (const release of history) {
    if (!/^\d+\.\d+\.\d+$/.test(release.version) || versions.has(release.version)) throw new Error('Release versions must be unique stable semantic versions.');
    versions.add(release.version);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(release.date) || !release.summary) throw new Error('Each release needs a date and summary.');
    for (const key of ['added', 'changed', 'fixed', 'security', 'notes']) if (!Array.isArray(release[key]) || release[key].some(s => typeof s !== 'string' || !s.trim())) throw new Error(`Invalid ${key} entries.`);
  }
  const render = release => {
    let text = `## [${release.version}] - ${release.date}\n\n${release.summary}\n`;
    for (const key of ['added', 'changed', 'fixed', 'security', 'notes']) if (release[key].length) text += `\n### ${key === 'notes' ? 'Important notes' : key[0].toUpperCase() + key.slice(1)}\n\n${release[key].map(line => `- ${line}`).join('\n')}\n`;
    return text;
  };
  const changelog = '# Changelog\n\nUser-facing changes follow semantic versioning. This file is generated from `releases/history.json`; edit that source and run `npm run release:notes`.\n\n' + history.map(render).join('\n') + '\n' + history.map(r => `[${r.version}]: https://github.com/jackingpanda/heic2jpg/releases/tag/v${r.version}`).join('\n') + '\n';
  const current = `# HEIC2JPG ${pkg.version}\n\n` + render(history[0]).replace(/^## .*\n\n/, '') + '\nDownload the Windows installer below. Update an existing installation by closing HEIC2JPG (including the tray icon) and running the new installer in the same location.\n\nPersonal, non-commercial use only. See LICENSE and THIRD_PARTY_NOTICES.md.\n';
  for (const [file, content] of [['CHANGELOG.md', changelog], ['releases/current.md', current]]) {
    const target = path.join(root, file);
    if (process.argv.includes('--check')) { if (await fs.readFile(target, 'utf8').catch(() => '') !== content) throw new Error(`${file} is out of date. Run npm run release:notes.`); }
    else await fs.writeFile(target, content);
  }
  console.log(`Release ${pkg.version} notes ${process.argv.includes('--check') ? 'validated' : 'generated'}.`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
