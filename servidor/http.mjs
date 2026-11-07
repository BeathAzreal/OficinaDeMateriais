import { createServer,                                         } from 'node:http'
import { readFile,stat } from 'node:fs/promises'
import { resolve,sep,extname } from 'node:path'
import { networkInterfaces } from 'node:os'
import { Salas,ErroSala } from './salas'
import { PROTOCOLO_REDE,MODELO_REDE,                                 } from '../src/rede/contrato'

function lerJson(req                )                                {
 return new Promise((aceitar,rejeitar)=>{
  let tamanho=0,excesso=false;const partes         =[]
  req.on('data',(b       )=>{if(excesso)return;tamanho+=b.length;if(tamanho>1048576){excesso=true;partes.length=0;rejeitar(new ErroSala('Mensagem grande demais.',413))}else partes.push(b)})
  req.on('end',()=>{if(excesso)return;try{const o=JSON.parse(Buffer.concat(partes).toString('utf8'));if(!o||typeof o!=='object'||Array.isArray(o))throw Error();aceitar(o)}catch{rejeitar(new ErroSala('Mensagem JSON inválida.'))}})
  req.on('error',rejeitar)
 })
}
const mime                      ={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon','.woff2':'font/woff2','.ttf':'font/ttf'}
export function criarServidor(op                                                 ){
 const salas=op.salas??new Salas(),publico=resolve(op.publico)
 const fluxos=new Set                                                 ()
 const taxa=new Map                                 ()
 const json=(res               ,status       ,dado        )=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(dado))}
 const publicar=()=>{
  salas.atualizar()
  for(const f of fluxos){
   try{if(f.res.writableLength>1048576){f.res.destroy();continue}f.res.write(`data: ${JSON.stringify(salas.estado(f.codigo,f.token))}\n\n`)}
   catch{f.res.write(`event: erro\ndata: ${JSON.stringify({erro:'Sala encerrada ou expirada.'})}\n\n`);f.res.end();fluxos.delete(f)}
  }
 }
 const servidor=createServer(async(req,res)=>{
  try{
   const url=new URL(req.url??'/','http://servidor'),p=url.pathname
   if(p.startsWith('/api/')){
    const origem=req.headers.origin
    if(origem && new URL(origem).host!==req.headers.host && !op.origens?.includes(origem))throw new ErroSala('Origem não permitida.',403)
    const ip=req.socket.remoteAddress??'local',agora=Date.now(),anterior=taxa.get(ip)
    if(!anterior||agora-anterior.inicio>60000)taxa.set(ip,{inicio:agora,n:1})
    else if(++anterior.n>120)throw new ErroSala('Muitas solicitações. Aguarde um minuto.',429)
    salas.atualizar()
    if(p==='/api/rede/info'&&req.method==='GET'){json(res,200,{protocolo:PROTOCOLO_REDE,modelo:MODELO_REDE,versao:'2.0',processos:['mig'],enderecos:enderecos(req.socket.localPort??5197)});return}
    if(p==='/api/salas'&&req.method==='POST'){
     const d=await lerJson(req);json(res,201,salas.criar(d.nome,d.config              ,d.protocolo));publicar();return
    }
    const m=p.match(/^\/api\/salas\/([A-Z2-9]{6})\/(entrar|eventos|comandos|estado)$/i)
    if(!m)throw new ErroSala('Rota de rede não encontrada.',404)
    const codigo=m[1].toUpperCase(),acao=m[2],token=req.headers.authorization?.replace(/^Bearer /,'')??''
    if(acao==='entrar'&&req.method==='POST'){const d=await lerJson(req);json(res,200,salas.entrar(codigo,d.nome,d.protocolo));publicar();return}
    if(acao==='eventos'&&req.method==='GET'){
     salas.estado(codigo,token)
     // Apenas um fluxo ativo por credencial; reconexão não cria um terceiro jogador.
     for(const f of fluxos)if(f.codigo===codigo&&f.token===token){fluxos.delete(f);f.res.end()}
     salas.conectar(codigo,token,true)
     res.writeHead(200,{'Content-Type':'text/event-stream; charset=utf-8','Cache-Control':'no-cache, no-transform','Connection':'keep-alive','X-Accel-Buffering':'no'})
     res.write(': conectado\n\n')
     const f={codigo,token,res};fluxos.add(f);publicar()
     res.on('close',()=>{if(fluxos.delete(f)){try{salas.conectar(codigo,token,false)}catch{/* sala expirada */}publicar()}})
     return
    }
    if(acao==='estado'&&req.method==='GET'){json(res,200,salas.estado(codigo,token));return}
    if(acao==='comandos'&&req.method==='POST'){const d=await lerJson(req);salas.comando(codigo,token,d               );json(res,200,salas.estado(codigo,token));publicar();return}
    throw new ErroSala('Método não permitido.',405)
   }
   if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405);res.end();return}
   const nome=decodeURIComponent(p==='/'?'/index.html':p),arquivo=resolve(publico,'.'+nome)
   if(!arquivo.startsWith(publico+sep))throw new ErroSala('Arquivo não encontrado.',404)
   const info=await stat(arquivo).catch(()=>null)
   if(!info?.isFile())throw new ErroSala('Arquivo não encontrado.',404)
   const dados=await readFile(arquivo)
   res.writeHead(200,{'Content-Type':mime[extname(arquivo)]??'application/octet-stream','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin'})
   res.end(req.method==='HEAD'?undefined:dados)
  }catch(e){if(!res.headersSent)json(res,e instanceof ErroSala?e.status:500,{erro:e instanceof ErroSala?e.message:'O servidor não conseguiu concluir esta ação.'});else res.end()}
 })
 servidor.requestTimeout=15000;servidor.headersTimeout=15000
 const timer=setInterval(()=>{publicar();const agora=Date.now();for(const[ip,v]of taxa)if(agora-v.inicio>60000)taxa.delete(ip)},1000);timer.unref()
 servidor.on('close',()=>{clearInterval(timer);for(const f of fluxos)f.res.end();fluxos.clear()})
 return {servidor,salas,publicar,fechar:()=>{for(const f of fluxos)f.res.end();return new Promise      (ok=>servidor.close(()=>ok()))}}
}
export function enderecos(porta       ){
 const ips=new Set        ()
 for(const interfaces of Object.values(networkInterfaces()))for(const i of interfaces??[])if(i.family==='IPv4'&&!i.internal)ips.add(`http://${i.address}:${porta}/`)
 const locais=[...ips].sort((a,b)=>Number(/^http:\/\/(?:192\.168\.|10\.|172\.(?:1[6-9]|2\d|3[01])\.)/.test(b))-Number(/^http:\/\/(?:192\.168\.|10\.|172\.(?:1[6-9]|2\d|3[01])\.)/.test(a)))
 return [`http://localhost:${porta}/`,...locais]
}
