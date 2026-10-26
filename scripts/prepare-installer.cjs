// Generate a small, checked customization of electron-builder's MIT-licensed NSIS template.
// Upstream: electron-userland/electron-builder, packages/app-builder-lib/templates/nsis.
const fs = require('node:fs/promises');
const path = require('node:path');
async function main() {
  const root = path.resolve(__dirname, '..');
  const templates = path.join(root, 'node_modules/app-builder-lib/templates/nsis');
  const output = path.join(root, 'installer/generated');
  await fs.mkdir(output, { recursive: true });
  let script = await fs.readFile(path.join(templates, 'installer.nsi'), 'utf8');
  const include = '!include "installSection.nsh"';
  if (!script.includes(include)) throw new Error('NSIS template changed: review the installer generator before packaging.');
  if (!script.includes('!insertmacro customHeader')) throw new Error('NSIS customHeader hook is unavailable.');
  let section = await fs.readFile(path.join(templates, 'installSection.nsh'), 'utf8');
  const phases = [
    ['!insertmacro uninstallOldVersion SHELL_CONTEXT', 'Checking the previous installation', 'Preparing the installation and updating the previous version, if present.'],
    ['!insertmacro installApplicationFiles', 'Installing application files', 'Extracting HEIC2JPG and the offline image conversion tools.'],
    ['!insertmacro registryAddInstallInfo', 'Configuring Windows integration', 'Registering the application and creating Windows shortcuts.']
  ];
  section = section.replace('SetDetailsPrint none', 'SetDetailsPrint both');
  for (const [token, title, detail] of phases) {
    if (!section.includes(token)) throw new Error(`NSIS template changed: missing ${token}`);
    section = section.replace(token, `SetDetailsPrint both\nDetailPrint "${title}..."\n!insertmacro MUI_HEADER_TEXT "${title}" "${detail}"\n${token}`);
  }
  await fs.writeFile(path.join(output, 'installSection.nsh'), section);
  console.log('Prepared installer stage messages and visible installation details.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
