// Fail packaging before publication if source changes caused an inconsistent ASAR.
const fs=require('node:fs');const path=require('node:path');const crypto=require('node:crypto');const asar=require('@electron/asar');
module.exports=async function verifyArchive(context){
  const archive=path.join(context.appOutDir,'resources','app.asar');
  const pkg=JSON.parse(asar.extractFile(archive,'package.json').toString('utf8'));
  if(pkg.name!=='heic2jpg'||pkg.version!==require('../package.json').version)throw new Error('Packaged application metadata is inconsistent. Do not edit source files while packaging.');
  for(const file of [pkg.main,'out/preload/index.js','out/preload/progress.js','out/renderer/index.html'])if(!asar.extractFile(archive,path.normalize(file)).length)throw new Error(`Missing packaged entry: ${file}`);
  let checked=0;
  for(const item of asar.listPackage(archive)){
    const file=path.normalize(item.replace(/^[/\\]+/,''));const stat=asar.statFile(archive,file);
    if(stat.files||stat.link||stat.unpacked||!stat.integrity)continue;
    const bytes=asar.extractFile(archive,file);
    const digest=crypto.createHash('sha256').update(bytes).digest('hex');
    if(bytes.length!==stat.size||digest!==stat.integrity.hash)throw new Error(`ASAR integrity mismatch: ${file}. Freeze source files and rebuild.`);
    checked++;
  }
  console.log(`Verified packaged ASAR metadata and ${checked} file hashes.`);
};
