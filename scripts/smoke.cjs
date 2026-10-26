// Development-only Electron integration test. Not included in installed builds.
const { app, BrowserWindow, dialog } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
app.setAppPath(root);
process.argv.push('--smoke');
require('../out/main/index.js');
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(fn, label, seconds = 30) {
  for (let i = 0; i < seconds * 5; i++) { const value = await fn(); if (value) return value; await wait(200); }
  throw new Error(`Timed out waiting for ${label}`);
}
async function main() {
  await app.whenReady();
  const window = await until(() => BrowserWindow.getAllWindows()[0], 'window');
  window.webContents.on('preload-error', (_event, file, error) => console.error('Preload error', file, error));
  window.webContents.on('did-fail-load', (_event, code, reason) => console.error('Load error', code, reason));
  window.webContents.on('render-process-gone', (_event, details) => console.error('Renderer gone', details));
  window.webContents.on('console-message', event => { if (event.level === 'error') console.error('Renderer:', event.message); });
  await until(() => !window.webContents.isLoading(), 'page load');
  await until(() => window.webContents.executeJavaScript('Boolean(window.desktop && document.querySelector(".app"))'), 'React and preload');
  const errors = [];
  window.webContents.on('console-message', event => { if (event.level === 'error') { errors.push(event.message); console.error('Renderer:', event.message); } });
  const evaluate = async code => {
    try { return await window.webContents.executeJavaScript(code); }
    catch (error) { throw new Error(`Renderer test failed for ${code.slice(0, 200)}: ${error.message}`); }
  };
  const screenshot = async name => {
    await wait(300);
    const image = await window.webContents.capturePage();
    await fs.writeFile(path.join(root, '.test-output', `${name}.png`), image.toPNG());
  };
  await fs.mkdir(path.join(root, '.test-output'), { recursive: true });
  await screenshot('01-empty');
  assert.equal(await evaluate('document.querySelector(".primary").disabled'), true);
  const fixture = path.join(root, 'tests/fixtures/example.heic');
  const output = await fs.mkdtemp(path.join(root, '.test-output', 'ui-output-'));
  await evaluate(`(async()=>window.desktop.saveSettings({...(await window.desktop.snapshot()).settings, outputMode: 'custom', outputPath: ${JSON.stringify(output)}, recycleOriginals: false}))()`);
  await evaluate(`window.desktop.add([${JSON.stringify(fixture)}])`);
  await until(() => evaluate('document.querySelectorAll(".file-row").length === 1'), 'queue row');
  await screenshot('02-queued');
  await evaluate('document.querySelector(".conversion-actions .primary").click()');
  await until(() => evaluate('(async()=> {const s=await window.desktop.snapshot();return s.finishedAt && !s.running})()'), 'batch completion', 90);
  const complete = await evaluate('window.desktop.snapshot()');
  assert.equal(complete.photos[0].status, 'done', complete.photos[0].error);
  assert.equal(complete.photos[0].warning, undefined);
  await screenshot('03-complete');
  await evaluate('document.querySelector(".advanced-button").click()');
  await until(() => evaluate('document.querySelector("dialog").open'), 'settings dialog');
  await screenshot('04-settings');
  await evaluate('document.querySelector(".dialog-header .icon-button").click()');
  // Test virtualization against a synthetic 10,000-item snapshot; no fake files are converted.
  const large = { ...complete, photos: Array.from({ length: 10000 }, (_, i) => ({ ...complete.photos[0], id: `virtual-${i}`, name: `IMG_${String(i).padStart(5,'0')}.heic`, status: 'queued', outputPath: undefined, outputSize: undefined })), batchIds: [], startedAt: 0, finishedAt: 0 };
  window.webContents.send('state', large);
  await until(() => evaluate('document.querySelector(".count").textContent === "10000"'), '10,000-photo snapshot');
  await wait(400);
  const rendered = await until(() => evaluate('document.querySelectorAll(".file-row").length'), 'virtual rows');
  console.log(`Virtual rows: ${rendered}`);
  assert.ok(rendered > 0 && rendered < 30, `Expected virtualization, got ${rendered} rendered rows`);
  await screenshot('05-large-queue');
  window.webContents.send('state', complete);
  // Narrow layout: every important action must stay inside the viewport.
  window.setSize(760, 620);
  await wait(500);
  const overflow = await evaluate('document.documentElement.scrollWidth > window.innerWidth');
  assert.equal(overflow, false, 'Horizontal overflow at minimum size');
  await screenshot('06-compact');
  window.setSize(1120, 800);
  await evaluate('(async()=>window.desktop.saveSettings({...(await window.desktop.snapshot()).settings, theme: "light"}))()');
  await wait(300);
  await screenshot('07-light');
  await evaluate('(async()=>window.desktop.saveSettings({...(await window.desktop.snapshot()).settings, theme: "dark"}))()');
  // Real mixed batch: a damaged HEIC must not stop good photos.
  await evaluate(`window.desktop.remove(${JSON.stringify(complete.photos.map(p => p.id))})`);
  const batchDirectory = await fs.mkdtemp(path.join(root, '.test-output', 'ui-batch-'));
  const mixed = [path.join(batchDirectory, 'good-a.heic'), path.join(batchDirectory, 'good-b.heic'), path.join(batchDirectory, 'damaged.heic')];
  await fs.copyFile(fixture, mixed[0]); await fs.copyFile(fixture, mixed[1]);
  const corrupt = Buffer.alloc(32); corrupt.writeUInt32BE(32); corrupt.write('ftyp', 4); corrupt.write('heic', 8); await fs.writeFile(mixed[2], corrupt);
  await evaluate(`window.desktop.add(${JSON.stringify([...mixed, mixed[0]])})`);
  assert.equal((await evaluate('window.desktop.snapshot()')).photos.length, 3, 'Paths should be deduplicated');
  await evaluate('window.desktop.start()');
  await until(() => evaluate('(async()=>!(await window.desktop.snapshot()).running)()'), 'mixed batch', 90);
  const mixedState = await evaluate('window.desktop.snapshot()');
  assert.equal(mixedState.photos.filter(p => p.status === 'done').length, 2);
  assert.equal(mixedState.photos.filter(p => p.status === 'error').length, 1);
  await screenshot('08-errors');
  const failedId = mixedState.photos.find(p => p.status === 'error').id;
  await evaluate(`window.desktop.retry([${JSON.stringify(failedId)}])`);
  assert.equal((await evaluate('window.desktop.snapshot()')).photos.find(p => p.id === failedId).status, 'queued');
  await evaluate(`window.desktop.remove(${JSON.stringify(mixedState.photos.map(p => p.id))})`);
  const cancellation = [];
  for (let i = 0; i < 6; i++) { const file = path.join(batchDirectory, `stop-${i}.heic`); await fs.copyFile(fixture, file); cancellation.push(file); }
  await evaluate(`window.desktop.add(${JSON.stringify(cancellation)})`);
  await evaluate('window.desktop.start()');
  await evaluate('window.desktop.cancel()');
  await until(() => evaluate('(async()=>!(await window.desktop.snapshot()).running)()'), 'safe cancellation', 90);
  const stopped = await evaluate('window.desktop.snapshot()');
  assert.ok(stopped.photos.some(p => p.status === 'cancelled'), 'Unstarted photos should be resumable');
  assert.ok(stopped.photos.every(p => ['done', 'cancelled'].includes(p.status)), 'Active photos should finish safely');
  assert.equal((await fs.readdir(output)).some(name => name.startsWith('.heic2jpg-')), false, 'No temporary files should remain');
  await screenshot('09-stopped');
  assert.equal(errors.length, 0, errors.join('\n'));
  const report = { realConversion: true, metadataWarnings: complete.photos[0].warning || null, virtualQueueSize: 10000, renderedRows: rendered, minimumLayoutOverflow: overflow, mixedBatch: { saved: 2, errors: 1 }, retry: true, cancellation: { finished: stopped.photos.filter(p => p.status === 'done').length, resumable: stopped.photos.filter(p => p.status === 'cancelled').length }, rendererErrors: errors, screenshots: 9, output: complete.photos[0].outputPath };
  await fs.writeFile(path.join(root, '.test-output/ui-report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  app.exit(0);
}
main().catch(async error => { console.error(error); await fs.writeFile(path.join(root, '.test-output/smoke-error.txt'), error.stack || String(error)); app.exit(1); });
