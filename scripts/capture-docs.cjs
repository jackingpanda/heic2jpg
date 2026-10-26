const { app, BrowserWindow, shell } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
app.setAppPath(root); process.argv.push('--smoke');
require('../out/main/index.js');
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(fn, label, seconds = 60) { for (let i=0; i<seconds*5; i++) { const value=await fn(); if(value) return value; await wait(200); } throw new Error(`Timed out: ${label}`); }
async function main() {
  await app.whenReady();
  const window = await until(() => BrowserWindow.getAllWindows().find(w=>w.getTitle()==='HEIC2JPG'), 'main window');
  await until(() => window.webContents.executeJavaScript('Boolean(window.desktop && document.querySelector(".app"))'), 'renderer');
  const errors=[]; window.webContents.on('console-message', event=>{if(event.level==='error') errors.push(event.message)});
  const evaluate = code=>window.webContents.executeJavaScript(code);
  const directory=path.join(root,'docs/images'); await fs.mkdir(directory,{recursive:true});
  async function capture(file) { await wait(400); await fs.writeFile(path.join(directory,file),(await window.webContents.capturePage()).toPNG()); }
  await evaluate('(async()=>{const s=await window.desktop.snapshot(); await window.desktop.saveSettings({...s.settings,quality:95,outputMode:"same",conflict:"skip",prefix:"",suffix:"",theme:"dark",recycleOriginals:false,autoCheckUpdates:false})})()');
  await capture('main-window.png');
  await evaluate('Array.from(document.querySelectorAll(".title-actions button")).find(b=>b.getAttribute("aria-label")==="About and updates").click()');
  await until(()=>evaluate('document.querySelector(".help-dialog").open'),'About');
  await capture('about-updates.png');
  await evaluate('Array.from(document.querySelectorAll(".help-tabs button")).find(b=>b.textContent==="Report a problem").click()');
  await capture('report-form.png');
  await evaluate('Array.from(document.querySelectorAll(".help-tabs button")).find(b=>b.textContent==="Release notes").click()');
  await capture('release-notes.png');
  await evaluate('document.querySelector(".help-header .icon-button").click()');
  const photos=await fs.mkdtemp(path.join(root,'.test-output','tutorial-photos-'));
  for(let i=1;i<=2;i++) await fs.copyFile(path.join(root,'tests/fixtures/example.heic'),path.join(photos,`Sample-0${i}.heic`));
  await evaluate(`window.desktop.add([${JSON.stringify(photos)}])`);
  await capture('queue-ready.png');
  await evaluate('document.querySelector(".conversion-actions .primary").click()');
  await until(()=>evaluate('(async()=>{const s=await window.desktop.snapshot();return s.finishedAt&&!s.running})()'),'conversion',120);
  const state=await evaluate('window.desktop.snapshot()'); assert.equal(state.photos.filter(p=>p.status==='done').length,2);
  await capture('queue-complete.png');
  await evaluate('document.querySelector(".advanced-button").click()'); await capture('settings.png');
  await evaluate('document.querySelector(".dialog-header .icon-button").click()');
  // The own test folder contains only public fixtures and their generated JPEGs.
  if(process.argv.includes('--open-explorer')) await shell.openPath(photos);
  await fs.writeFile(path.join(root,'.test-output/docs-report.json'),JSON.stringify({rendererErrors:errors,photos,screenCount:7,conversion:true},null,2));
  assert.equal(errors.length,0,errors.join('\n'));
  console.log(`Documentation screenshots saved. Tutorial folder: ${photos}`); app.exit(0);
}
main().catch(error=>{console.error(error);app.exit(1)});
