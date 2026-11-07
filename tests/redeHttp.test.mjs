import {describe,it,expect} from 'vitest'
import {mkdtemp,writeFile,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {criarServidor} from '../servidor/http.mjs'
import {Salas} from '../servidor/salas'
import {PROTOCOLO_REDE} from '../src/rede/contrato'
                                                        
const registro={versao:1,t0:0,lista:[['a',5,5],['i',0,10,0],['m',1000,20,0],['f',1001,20,0]]}

describe('HTTP x1 com dois clientes independentes',()=>{
 it('serve o jogo, autentica dois fluxos e fecha a partida com notas do servidor',async()=>{
  const publico=await mkdtemp(join(tmpdir(),'soldagem-rede-'));await writeFile(join(publico,'index.html'),'<h1>Jogo de teste</h1>')
  let agora=100000;const salas=new Salas(()=>agora,{contagem:10,partida:3000,queda:30000,expiracao:1800000}),app=criarServidor({publico,salas})
  await new Promise      (ok=>app.servidor.listen(0,'127.0.0.1',ok));const porta=(app.servidor.address()                 ).port,base=`http://127.0.0.1:${porta}`
  const abortarA=new AbortController(),abortarB=new AbortController()
  const post=async(p       ,d        ,token        )=>fetch(base+p,{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:JSON.stringify(d)})
  try{
   expect(await(await fetch(base)).text()).toContain('Jogo de teste')
   expect((await(await fetch(base+'/api/rede/info')).json()).protocolo).toBe(PROTOCOLO_REDE)
   const r=await post('/api/salas',{nome:'PC A',protocolo:PROTOCOLO_REDE,config:{processo:'mig',missaoId:'suporte-carbono',dificuldade:'aprendiz'}});expect(r.status).toBe(201);const a=await r.json()                  
   const b=await(await post(`/api/salas/${a.codigo}/entrar`,{nome:'PC B',protocolo:PROTOCOLO_REDE})).json()                  
   expect((await fetch(`${base}/api/salas/${a.codigo}/estado`)).status).toBe(403)
   const fluxoA=await fetch(`${base}/api/salas/${a.codigo}/eventos`,{headers:{Authorization:`Bearer ${a.token}`},signal:abortarA.signal})
   const fluxoB=await fetch(`${base}/api/salas/${b.codigo}/eventos`,{headers:{Authorization:`Bearer ${b.token}`},signal:abortarB.signal})
   expect(fluxoA.headers.get('content-type')).toContain('text/event-stream');expect(fluxoB.ok).toBe(true)
   for(const c of[a,b])expect((await post(`/api/salas/${c.codigo}/comandos`,{tipo:'pronto',rodada:1,pronto:true},c.token)).ok).toBe(true)
   agora+=1500
   for(const c of[a,b])expect((await post(`/api/salas/${c.codigo}/comandos`,{tipo:'entregar',rodada:1,eventos:registro,nota:999999},c.token)).ok).toBe(true)
   const estado=await(await fetch(`${base}/api/salas/${a.codigo}/estado`,{headers:{Authorization:`Bearer ${a.token}`}})).json()
   expect(estado.fase).toBe('resultado');expect(estado.jogadores).toHaveLength(2)
   expect(estado.jogadores.every((j                                     )=>Number.isInteger(j.entrega.resultado.total)&&j.entrega.resultado.total>=0&&j.entrega.resultado.total<=1000)).toBe(true)
   const invasao=await fetch(base+'/api/rede/info',{headers:{Origin:'https://outra-origem.invalid'}});expect(invasao.status).toBe(403)
   expect((await fetch(base+'/servidor/index.ts')).status).toBe(404)
  }finally{abortarA.abort();abortarB.abort();await app.fechar();await rm(publico,{recursive:true,force:true})}
 },15000)
})
