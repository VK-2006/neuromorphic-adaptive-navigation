const http=require('http');
const fs=require('fs');
const path=require('path');
const {spawn}=require('child_process');

const ROOT=path.resolve(__dirname,'..');
const FRONT=path.join(ROOT,'frontend');
const PUBLIC=path.join(FRONT,'public');

function typeFor(file){
  const ext=path.extname(file).toLowerCase();
  return ({
    '.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8',
    '.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8',
    '.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon',
    '.webp':'image/webp','.jpg':'image/jpeg','.jpeg':'image/jpeg'
  })[ext]||'application/octet-stream';
}
function safe(root,rel){
  const base=path.resolve(root);
  const full=path.resolve(root,'.'+rel);
  return (full===base||full.startsWith(base+path.sep))?full:null;
}
const server=http.createServer((req,res)=>{
  const u=new URL(req.url,'http://127.0.0.1');
  if(u.pathname.startsWith('/api/')){
    res.writeHead(401,{'content-type':'application/json'});
    res.end(JSON.stringify({success:false,message:'Local browser harness: authentication required'}));
    return;
  }
  if(u.pathname.startsWith('/socket.io/')){
    res.writeHead(200,{'content-type':'text/javascript; charset=utf-8'});
    res.end("window.io=window.io||function(){return{connected:false,on:function(){return this},emit:function(){return this},disconnect:function(){}}};");
    return;
  }
  let file=null;
  if(u.pathname==='/'||u.pathname==='/index.html')file=path.join(PUBLIC,'index.html');
  else if(u.pathname==='/manifest.json'||u.pathname==='/service-worker.js')file=path.join(FRONT,u.pathname.slice(1));
  else if(u.pathname.startsWith('/assets/'))file=safe(FRONT,u.pathname);
  else if(u.pathname.endsWith('.html'))file=safe(PUBLIC,u.pathname);
  if(!file||!fs.existsSync(file)||!fs.statSync(file).isFile()){
    res.writeHead(404,{'content-type':'text/plain; charset=utf-8'});
    res.end('Not found');
    return;
  }
  res.writeHead(200,{'content-type':typeFor(file),'cache-control':'no-store'});
  fs.createReadStream(file).pipe(res);
});

server.listen(0,'127.0.0.1',()=>{
  const {port}=server.address();
  const base=`http://127.0.0.1:${port}`;
  console.log(`LOCAL V7 HARNESS: ${base}`);
  const child=spawn(process.execPath,[path.join(__dirname,'browser_v7_smoke.js'),base],{
    cwd:ROOT,stdio:'inherit',env:{...process.env,NAVORA_LOCAL_BROWSER_HARNESS:'1'}
  });
  child.on('exit',code=>server.close(()=>process.exit(code??1)));
  child.on('error',err=>{console.error(err);server.close(()=>process.exit(1))});
});
