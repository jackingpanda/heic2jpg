const fs=require('node:fs/promises');const path=require('node:path');const crypto=require('node:crypto');
const target=path.resolve(__dirname,'../tests/fixtures/example.heic');
const expected='7f8b363e4936c0666a25f64f3a92fda10bd8e5453be4592530b65a55dd98f3f2';
async function main(){
  let bytes;try{bytes=await fs.readFile(target)}catch{const response=await fetch('https://raw.githubusercontent.com/strukturag/libheif/master/examples/example.heic');if(!response.ok)throw new Error(`Public test fixture download failed (${response.status})`);bytes=Buffer.from(await response.arrayBuffer())}
  if(crypto.createHash('sha256').update(bytes).digest('hex')!==expected)throw new Error('The public fixture checksum changed. Review the upstream sample before updating the pinned checksum.');
  await fs.mkdir(path.dirname(target),{recursive:true});await fs.writeFile(target,bytes);console.log('Public HEIC test fixture verified.');
}
main().catch(error=>{console.error(error);process.exitCode=1});
