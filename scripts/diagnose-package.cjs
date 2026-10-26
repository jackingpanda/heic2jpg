// Local-only diagnostic for a maintainer-owned test instance. No installed-user profile is used.
const {spawn}=require('node:child_process');const fs=require('node:fs/promises');const path=require('node:path');
const root=path.resolve(__dirname,'..'), release=path.resolve(process.argv[2]||path.join(root,'release/v1.2.0'));
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function main(){
  const directory=await fs.mkdtemp(path.join(root,'.test-output','diagnostic-'));const input=path.join(directory,'Sample.heic');await fs.copyFile(path.join(root,'tests/fixtures/example.heic'),input);
  const child=spawn(path.join(release,'win-unpacked/HEIC2JPG.exe'),['--qa','--remote-debugging-address=127.0.0.1','--remote-debugging-port=9337','--convert',input],{windowsHide:true});let errors='';child.stderr.on('data',x=>errors+=x);
  let socket;
  try{
    let target;for(let i=0;i<150;i++){try{const list=await(await fetch('http://127.0.0.1:9337/json/list')).json();target=list.find(t=>t.url.includes('view=progress'));if(target)break}catch{}await wait(200)}
    if(!target)throw new Error('No progress renderer found. '+errors);
    socket=new WebSocket(target.webSocketDebuggerUrl);await new Promise((r,j)=>{socket.addEventListener('open',r,{once:true});socket.addEventListener('error',j,{once:true})});
    let id=0;const evaluate=expression=>new Promise(resolve=>{const call=++id;const listener=e=>{const data=JSON.parse(e.data);if(data.id===call){socket.removeEventListener('message',listener);resolve(data.result)}};socket.addEventListener('message',listener);socket.send(JSON.stringify({id:call,method:'Runtime.evaluate',params:{expression,awaitPromise:true,returnByValue:true}}))});
    for(let i=0;i<50;i++){const value=await evaluate('window.quickProgress.snapshot()');if(i%5===0||value.result?.value?.phase==='complete')console.log(JSON.stringify(value));if(value.result?.value?.phase==='complete')break;await wait(1000)}
    console.log('stderr:',errors);
  }finally{socket?.close();child.kill()}
}
main().catch(e=>{console.error(e);process.exitCode=1});
