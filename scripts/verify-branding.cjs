const fs = require('node:fs');
const path = require('node:path');
const resedit = require('resedit');
function verify(executable, iconFile) {
  const resources = resedit.NtExecutableResource.from(resedit.NtExecutable.from(fs.readFileSync(executable), { ignoreCert: true }));
  const groups = resedit.Resource.IconGroupEntry.fromEntries(resources.entries);
  const expected = resedit.Data.IconFile.from(fs.readFileSync(iconFile)).icons;
  if (!groups.length) throw new Error('Windows executable has no application icon.');
  for (const group of groups) {
    const icons = group.getIconItemsFromEntries(resources.entries);
    if (icons.length !== expected.length || icons.some((icon, index) => !Buffer.from(icon.bin).equals(Buffer.from(expected[index].data.bin)))) throw new Error('Windows executable icon differs from the canonical application icon.');
  }
  console.log(`Verified ${expected.length} canonical Windows icon sizes in ${path.basename(executable)}.`);
}
module.exports = async context => {
  if (context.electronPlatformName === 'win32') verify(path.join(context.appOutDir, 'HEIC2JPG.exe'), path.resolve(__dirname, '../resources/icon.ico'));
};
module.exports.verify = verify;
if (require.main === module) verify(process.argv[2], path.resolve(__dirname, '../resources/icon.ico'));
