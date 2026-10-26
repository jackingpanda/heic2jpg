// Stage one release, upload sequentially, then publish only the complete set.
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const yaml = require('js-yaml');
const repository = 'jackingpanda/heic2jpg';
const hash = (bytes, algorithm, encoding) => crypto.createHash(algorithm).update(bytes).digest(encoding);

async function loadArtifacts(directory, version) {
  const name = `HEIC2JPG-Setup-${version}.exe`;
  const names = [name, `${name}.blockmap`, 'latest.yml'];
  const artifacts = await Promise.all(names.map(async name => {
    const bytes = await fs.readFile(path.join(directory, name));
    if (!bytes.length) throw new Error(`Empty release artifact: ${name}`);
    return { name, bytes, sha256: hash(bytes, 'sha256', 'hex') };
  }));
  const manifest = yaml.load(artifacts[2].bytes.toString('utf8'));
  const checksum = hash(artifacts[0].bytes, 'sha512', 'base64');
  if (manifest?.version !== version || manifest.files?.length !== 1 || manifest.files[0].url !== name || manifest.files[0].size !== artifacts[0].bytes.length || manifest.files[0].sha512 !== checksum || manifest.path !== name || manifest.sha512 !== checksum) {
    throw new Error('Release manifest does not match the Windows installer. Nothing was published.');
  }
  return artifacts;
}

async function publishRelease({ version, notes, artifacts, request }) {
  const tag = `v${version}`;
  const matches = (await request('/releases?per_page=100')).filter(release => release.tag_name === tag);
  if (matches.length > 1) throw new Error('Multiple releases exist for this tag. Resolve them before publishing.');
  let release = matches[0];
  if (!release) release = await request('/releases', { method: 'POST', json: { tag_name: tag, name: `HEIC2JPG ${version}`, body: notes, draft: true, prerelease: false } });
  const expectedNames = artifacts.map(artifact => artifact.name);
  if (release.prerelease || release.assets.some(asset => !expectedNames.includes(asset.name))) throw new Error('Unexpected release state or assets; existing content was preserved.');
  async function verify(asset, artifact) {
    if (asset.state !== 'uploaded' || asset.size !== artifact.bytes.length) throw new Error(`Incomplete or different remote asset: ${artifact.name}`);
    const digest = asset.digest || `sha256:${hash(await request(`/releases/assets/${asset.id}`, { binary: true }), 'sha256', 'hex')}`;
    if (digest !== `sha256:${artifact.sha256}`) throw new Error(`Remote asset checksum mismatch: ${artifact.name}`);
  }
  for (const artifact of artifacts) {
    let asset = release.assets.find(asset => asset.name === artifact.name);
    if (!asset) {
      if (!release.draft) throw new Error('Published release is incomplete. Existing release was preserved.');
      asset = await request(`https://uploads.github.com/repos/${repository}/releases/${release.id}/assets?name=${encodeURIComponent(artifact.name)}`, { method: 'POST', bytes: artifact.bytes });
    }
    await verify(asset, artifact);
  }
  const complete = await request(`/releases/${release.id}`);
  if (complete.assets.length !== artifacts.length) throw new Error('Release asset set is incomplete. Draft was not published.');
  for (const artifact of artifacts) {
    const asset = complete.assets.find(asset => asset.name === artifact.name);
    if (!asset) throw new Error('Release asset set is incomplete. Draft was not published.');
    await verify(asset, artifact);
  }
  if (release.draft) release = await request(`/releases/${release.id}`, { method: 'PATCH', json: { draft: false, make_latest: 'true' } });
  return release.html_url;
}

async function main() {
  const root = path.resolve(__dirname, '..');
  const { version } = require('../package.json');
  const tag = `v${version}`;
  if (process.env.GITHUB_REF_TYPE && process.env.GITHUB_REF_TYPE !== 'tag') throw new Error('Release publication requires a version tag.');
  if (process.env.GITHUB_REF_NAME && process.env.GITHUB_REF_NAME !== tag) throw new Error('GitHub tag and package version differ.');
  const revision = ref => execFileSync('git', ['rev-parse', '--verify', ref], { cwd: root, encoding: 'utf8', windowsHide: true }).trim();
  if (revision('HEAD') !== revision(`refs/tags/${tag}^{commit}`)) throw new Error('HEAD must match the version tag.');
  const artifacts = await loadArtifacts(path.join(root, 'release'), version);
  const notes = await fs.readFile(path.join(root, 'releases/current.md'), 'utf8');
  const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
  if (!token) throw new Error('GH_TOKEN is required for release publication. Never commit it.');
  async function request(route, options = {}) {
    const headers = { Authorization: `Bearer ${token}`, Accept: options.binary ? 'application/octet-stream' : 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'HEIC2JPG-release-publisher' };
    let body;
    if (options.json) { headers['Content-Type'] = 'application/json'; body = JSON.stringify(options.json); }
    if (options.bytes) { headers['Content-Type'] = 'application/octet-stream'; body = options.bytes; }
    const url = route.startsWith('https://') ? route : `https://api.github.com/repos/${repository}${route}`;
    const response = await fetch(url, { method: options.method || 'GET', headers, body, signal: AbortSignal.timeout(180000) });
    if (!response.ok) throw new Error(`GitHub release request failed (${response.status}). A failed upload leaves a draft for a safe retry.`);
    return options.binary ? Buffer.from(await response.arrayBuffer()) : response.json();
  }
  console.log(await publishRelease({ version, notes, artifacts, request }));
}
module.exports = { loadArtifacts, publishRelease };
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
