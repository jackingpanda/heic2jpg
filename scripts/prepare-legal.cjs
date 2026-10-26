const fs = require('node:fs/promises');
const path = require('node:path');
const sharp = require('sharp');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'resources/legal');
const names = /^(license|licence|copying|notice|copyright)([._-].*)?$/i;
async function main() {
  if (path.relative(root, path.resolve(output)) !== path.join('resources', 'legal')) throw new Error('Unexpected generated-license directory.');
  await fs.rm(output, { recursive: true, force: true });
  await fs.mkdir(output, { recursive: true });
  const visited = new Set(), inventory = [];
  async function visit(name, includeDependencies = true) {
    if (visited.has(name)) return; visited.add(name);
    const directory = path.join(root, 'node_modules', name);
    let pkg; try { pkg = JSON.parse(await fs.readFile(path.join(directory, 'package.json'), 'utf8')); } catch { return; }
    const destination = path.join(output, name.replaceAll('/', '__'));
    await fs.mkdir(destination, { recursive: true });
    inventory.push({ name: pkg.name, version: pkg.version, license: pkg.license || pkg.licenses || 'See package notices', repository: pkg.repository || null });
    async function copyNotices(folder, relative = '', depth = 0) {
      for (const entry of await fs.readdir(folder, { withFileTypes: true })) {
        const source = path.join(folder, entry.name), target = path.join(destination, relative, entry.name);
        if (entry.isFile() && names.test(entry.name)) { await fs.mkdir(path.dirname(target), { recursive: true }); await fs.copyFile(source, target); }
        else if (entry.isDirectory() && depth < 2 && /^(licenses?|licences?|libheif|libheif-wasm|vendor|share|third.party)$/i.test(entry.name)) await copyNotices(source, path.join(relative, entry.name), depth + 1);
      }
    }
    await copyNotices(directory);
    if (includeDependencies) for (const dependency of Object.keys({ ...pkg.dependencies, ...pkg.optionalDependencies })) await visit(dependency);
  }
  for (const name of Object.keys(require('../package.json').dependencies)) await visit(name);
  await visit('app-builder-lib', false);
  await fs.mkdir(path.join(output, 'app-builder-lib'), { recursive: true });
  await fs.copyFile(path.join(root, 'legal/ELECTRON-BUILDER-MIT.txt'), path.join(output, 'app-builder-lib/LICENSE'));
  await fs.writeFile(path.join(output, 'dependencies.json'), JSON.stringify({ application: require('../package.json').version, imageLibraryVersions: sharp.versions, packages: inventory.sort((a,b) => a.name.localeCompare(b.name)) }, null, 2));
  for (const name of ['LICENSE', 'PRIVACY.md', 'THIRD_PARTY_NOTICES.md', 'THIRD_PARTY_SOURCES.md']) await fs.copyFile(path.join(root, name), path.join(output, name + '.txt'));
  for (const [name, url] of [['GPL-3.0.txt', 'https://raw.githubusercontent.com/gcc-mirror/gcc/master/COPYING3'], ['LGPL-3.0.txt', 'https://raw.githubusercontent.com/gcc-mirror/gcc/master/COPYING3.LIB'], ['LGPL-2.1.txt', 'https://raw.githubusercontent.com/gcc-mirror/gcc/master/COPYING.LIB']]) {
    const local = path.join(root, 'legal', name);
    let text; try { text = await fs.readFile(local); } catch { const response = await fetch(url); if (!response.ok) throw new Error(`License download failed: ${url}`); text = Buffer.from(await response.arrayBuffer()); await fs.writeFile(local, text); }
    await fs.writeFile(path.join(output, name), text);
  }
  console.log(`Prepared third-party license inventory (${inventory.length} packages).`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
