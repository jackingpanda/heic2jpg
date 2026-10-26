const { spawn } = require('node:child_process');
const fs = require('node:fs/promises');
const path = require('node:path');
const sharp = require('sharp');
const assert = require('node:assert/strict');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const exec = promisify(execFile);
const exiftool = require('exiftool-vendored.exe');
const root = path.resolve(__dirname, '..');
const releaseDirectory = path.resolve(process.argv[2] || path.join(root, 'release'));
async function main() {
  const directory = await fs.mkdtemp(path.join(root, '.test-output', 'packaged-'));
  const input = path.join(directory, 'packaged photo.heic');
  const output = path.join(directory, 'packaged photo.jpg');
  await fs.copyFile(path.join(root, 'tests/fixtures/example.heic'), input);
  await exec(exiftool, ['-overwrite_original', '-Make=Apple', '-Model=Packaged metadata test', '-DateTimeOriginal=2024:06:07 12:34:56', input], { windowsHide: true });
  const process = spawn(path.join(releaseDirectory, 'win-unpacked/HEIC2JPG.exe'), ['--qa', '--convert', input], { windowsHide: true });
  let stderr = '';
  process.stderr.on('data', chunk => { stderr += chunk; });
  try {
    let ready = false;
    for (let i = 0; i < 450; i++) {
      try { await fs.access(output); ready = true; break; } catch {}
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    assert.ok(ready, `Packaged output was not created. ${stderr}`);
    const info = await sharp(output).metadata();
    assert.equal(info.format, 'jpeg'); assert.equal(info.width, 1280); assert.equal(info.height, 854);
    await sharp(output).stats();
    const { stdout } = await exec(exiftool, ['-j', '-Make', '-Model', '-DateTimeOriginal', output], { windowsHide: true });
    const [tags] = JSON.parse(stdout);
    assert.equal(tags.Make, 'Apple'); assert.equal(tags.Model, 'Packaged metadata test'); assert.equal(tags.DateTimeOriginal, '2024:06:07 12:34:56');
    const report = { packagedConversion: true, packagedMetadata: true, executable: path.join(releaseDirectory, 'win-unpacked/HEIC2JPG.exe'), dimensions: [info.width, info.height], output, stderr };
    await fs.writeFile(path.join(root, '.test-output/package-report.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
  } finally { process.kill(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
