// Real Electron test of Explorer/CLI routing and the small progress window.
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
app.setAppPath(root);
const fixture = path.join(root, 'tests/fixtures/example.heic');
const directory = path.join(root, '.test-output', `quick-${Date.now()}`);
process.argv.push('--smoke', '--convert', directory);
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(fn, label, seconds = 60) {
  for (let i = 0; i < seconds * 5; i++) { const result = await fn(); if (result) return result; await wait(200); }
  throw new Error(`Timed out: ${label}`);
}
async function main() {
  await fs.mkdir(directory, { recursive: true });
  const settingsDir = path.join(root, '.local-data/smoke');
  await fs.mkdir(settingsDir, { recursive: true });
  await fs.writeFile(path.join(settingsDir, 'settings.json'), JSON.stringify({ quality: 95, outputMode: 'same', preserveMetadata: true, silentMode: true, theme: 'dark', concurrency: 1 }));
  for (let i = 0; i < 3; i++) await fs.copyFile(fixture, path.join(directory, `photo-${i}.heic`));
  require('../out/main/index.js');
  await app.whenReady();
  const popup = await until(() => BrowserWindow.getAllWindows().find(w => w.getTitle().includes('Quick convert')), 'compact window');
  const errors = [];
  popup.webContents.on('console-message', event => { if (event.level === 'error') errors.push(event.message); });
  await until(() => popup.webContents.executeJavaScript('Boolean(window.quickProgress && document.querySelector(".quick-card"))'), 'progress UI');
  const evaluate = code => popup.webContents.executeJavaScript(code);
  const snapshot = () => evaluate('window.quickProgress.snapshot()');
  const capture = async name => { await wait(200); await fs.writeFile(path.join(root, '.test-output', `${name}.png`), (await popup.webContents.capturePage()).toPNG()); };
  assert.equal(await evaluate('typeof window.desktop'), 'undefined', 'The popup must not expose the full desktop API');
  // Small cached fixtures may finish before the UI observer attaches.
  await until(async () => ['converting', 'stopping', 'complete'].includes((await snapshot()).phase), 'real conversion');
  if ((await snapshot()).phase !== 'complete') await until(() => evaluate('document.querySelector(".quick-copy h1").textContent.includes("Converting photos") || document.querySelector(".quick-card").classList.contains("is-complete")'), 'visible conversion state');
  await capture('quick-01-converting');
  await until(async () => (await snapshot()).phase === 'complete', 'batch complete', 120);
  const first = await snapshot();
  assert.equal(first.photos.filter(p => p.status === 'done').length, 3);
  assert.equal(first.photos.filter(p => p.warning).length, 0);
  await capture('quick-02-complete');
  assert.equal(BrowserWindow.getAllWindows().filter(w => w.getTitle() === 'HEIC2JPG').length, 0, 'CLI conversion should not open the large app');
  // Repeating an Explorer command must requeue its existing records and respect skip mode.
  app.emit('second-instance', {}, [process.execPath, '--convert', directory]);
  await until(async () => (await snapshot()).phase !== 'complete', 'repeat request');
  await until(async () => (await snapshot()).phase === 'complete', 'repeat completes');
  const repeated = await snapshot();
  assert.equal(repeated.photos.length, 3); assert.ok(repeated.photos.every(p => p.status === 'skipped'));
  // Cancel during active work: finish current photo and stop remaining ones.
  const cancellation = path.join(directory, 'cancel'); await fs.mkdir(cancellation);
  for (let i = 0; i < 4; i++) await fs.copyFile(fixture, path.join(cancellation, `cancel-${i}.heic`));
  app.emit('second-instance', {}, [process.execPath, '--convert', cancellation]);
  await until(async () => (await snapshot()).phase === 'converting', 'cancel batch starts');
  await evaluate('window.quickProgress.cancel()');
  await until(async () => (await snapshot()).phase === 'complete', 'cancel finishes', 120);
  const stopped = await snapshot();
  assert.ok(stopped.photos.some(p => p.status === 'cancelled'));
  assert.ok(stopped.photos.every(p => ['done', 'cancelled'].includes(p.status)));
  await capture('quick-03-stopped');
  // Opening the app transfers review to the full UI and hides the compact window.
  await evaluate('window.quickProgress.openApp()');
  const full = await until(() => BrowserWindow.getAllWindows().find(w => w.getTitle() === 'HEIC2JPG'), 'full app');
  await until(() => full.webContents.executeJavaScript('Boolean(window.desktop && document.querySelector(".app"))'), 'full app loaded');
  assert.equal(popup.isVisible(), false);
  // Even with the main window open, the Explorer command must auto-convert only its selection.
  const only = path.join(directory, 'with-gui.heic'); await fs.copyFile(fixture, only);
  app.emit('second-instance', {}, [process.execPath, '--convert', only]);
  await until(async () => (await snapshot()).phase !== 'complete', 'GUI Explorer request');
  await until(async () => (await snapshot()).phase === 'complete', 'GUI Explorer conversion', 120);
  assert.equal((await snapshot()).photos.filter(p => p.status === 'done').length, 1);
  assert.equal((await fs.stat(path.join(directory, 'with-gui.jpg'))).size > 0, true);
  assert.equal(errors.length, 0, errors.join('\n'));
  await fs.rm(path.join(root, '.test-output/quick-error.txt'), { force: true });
  const report = { appVersion: require('../package.json').version, electron: process.versions.electron, popup: popup.getSize(), realConversions: 3, repeatedSelection: '3 skipped', safeStop: true, isolatedPreload: true, autoConvertWithMainApp: true, rendererErrors: errors };
  await fs.writeFile(path.join(root, '.test-output/quick-report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  app.exit(0);
}
main().catch(async error => { console.error(error); await fs.writeFile(path.join(root, '.test-output/quick-error.txt'), error.stack || String(error)); app.exit(1); });
