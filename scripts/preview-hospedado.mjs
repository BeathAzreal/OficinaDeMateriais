// Prévia local do mesmo Worker publicado; SQLite substitui apenas o transporte D1.
import {createServer} from 'node:http'
import {DatabaseSync} from 'node:sqlite'
import {readFileSync} from 'node:fs'
import worker from '../dist-hospedado/index.js'
const sqlite=new DatabaseSync(':memory:')
sqlite.exec(readFileSync('servidor/migracoes/0000_salas.sql','utf8'))
const DB={prepare(sql){let valores=[];return{bind(...v){valores=v;return this},async first(){return sqlite.prepare(sql).get(...valores)??null},async run(){const r=sqlite.prepare(sql).run(...valores);return{meta:{changes:Number(r.changes)}}}}}}
const servidor=createServer(async(req,res)=>{
 try{
  let tamanho=0;const partes=[]
  for await(const parte of req){tamanho+=parte.length;if(tamanho>1024*1024){res.writeHead(413);res.end();return}partes.push(parte)}
  const r=new Request(`http://${req.headers.host}${req.url}`,{method:req.method,headers:req.headers,...(['GET','HEAD'].includes(req.method)?{}:{body:Buffer.concat(partes)})})
  const resposta=await worker.fetch(r,{DB})
  res.writeHead(resposta.status,Object.fromEntries(resposta.headers));res.end(Buffer.from(await resposta.arrayBuffer()))
 }catch(e){console.error(e.message);res.writeHead(500);res.end('Falha na prévia.')}
})
const host=process.env.OFICINA_PREVIEW_HOST??'127.0.0.1'
servidor.listen(5198,host,()=>console.log(`Prévia do Worker: http://${host}:5198/`))
process.on('SIGINT',()=>servidor.close(()=>{sqlite.close();process.exit(0)}))
