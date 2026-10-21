import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
const root=resolve('apps/mobile/build/web');
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript','.json':'application/json','.wasm':'application/wasm','.png':'image/png','.svg':'image/svg+xml','.ttf':'font/ttf','.woff2':'font/woff2'};
createServer(async(req,res)=>{try{const url=new URL(req.url,'http://localhost');let file=resolve(root,'.'+decodeURIComponent(url.pathname));if(file!==root&&!file.startsWith(root+sep)){res.writeHead(403).end();return;}try{if((await stat(file)).isDirectory())file=resolve(file,'index.html');}catch{if(extname(file)){res.writeHead(404).end();return;}file=resolve(root,'index.html');}const bytes=await readFile(file);res.writeHead(200,{'Content-Type':types[extname(file)]??'application/octet-stream','Cross-Origin-Opener-Policy':'same-origin','Cross-Origin-Embedder-Policy':'credentialless','Cache-Control':'no-cache'});res.end(bytes);}catch{res.writeHead(500).end('Web build unavailable');}}).listen(8080,'127.0.0.1',()=>console.log('QChat Flutter Web: http://localhost:8080'));
