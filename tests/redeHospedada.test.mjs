import {DatabaseSync} from 'node:sqlite'
import {readFileSync} from 'node:fs'
import {describe,it,expect} from 'vitest'
import {SalasHospedadas} from '../servidor/hospedado'
import {PROTOCOLO_REDE} from '../src/rede/contrato'
const config={processo:'mig',missaoId:'suporte-carbono',dificuldade:'aprendiz'}
const eventos={versao:1,t0:15000,lista:[['a',5,5],['p',0,0],['i',0,10,0],['m',10000,140,0],['f',10001,140,0]]}
function preparar(){
 const sqlite=new DatabaseSync(':memory:');sqlite.exec(readFileSync(new URL('../servidor/migracoes/0000_salas.sql',import.meta.url),'utf8'))
 const db={prepare(sql){let valores=[];return{bind(...v){valores=v;return this},async first(){return sqlite.prepare(sql).get(...valores)??null},async run(){const r=sqlite.prepare(sql).run(...valores);return{meta:{changes:Number(r.changes)}}}}}}
 let agora=100000
 const pedir=async(caminho,dados,token,opcoes={})=>{
  const r=await new SalasHospedadas(db,()=>agora).responder(new Request('https://oficina.test'+caminho,{method:dados===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},...(dados===undefined?{}:{body:JSON.stringify(dados)}),...opcoes}))
  return{status:r.status,dados:await r.json()}
 }
 return{sqlite,pedir,avancar:n=>agora+=n}
}
async function dupla(t){const a=(await t.pedir('/api/salas',{nome:'Alice',config,protocolo:PROTOCOLO_REDE})).dados,b=(await t.pedir(`/api/salas/${a.codigo}/entrar`,{nome:'Bruno',protocolo:PROTOCOLO_REDE})).dados;return{a,b,caminho:`/api/salas/${a.codigo}`}}
describe('salas hospedadas em armazenamento compartilhado',()=>{
 it('preserva dois jogadores entre instâncias, resolve prontidão concorrente e avalia entregas no servidor',async()=>{
  const t=preparar();try{
   const {a,b,caminho}=await dupla(t);expect(a.transporte).toBe('consulta')
   await Promise.all([t.pedir(caminho+'/estado',undefined,a.token),t.pedir(caminho+'/estado',undefined,b.token)])
   const prontos=await Promise.all([t.pedir(caminho+'/comandos',{tipo:'pronto',rodada:1,pronto:true},a.token),t.pedir(caminho+'/comandos',{tipo:'pronto',rodada:1,pronto:true},b.token)])
   expect(prontos.every(r=>r.status===200)).toBe(true)
   expect((await t.pedir(caminho+'/estado',undefined,a.token)).dados.fase).toBe('contagem')
   t.avancar(17000)
   await t.pedir(caminho+'/comandos',{tipo:'entregar',rodada:1,eventos},a.token)
   const privado=await t.pedir(caminho+'/estado',undefined,b.token);expect(privado.dados.jogadores[0].entrega).toBeNull();expect(JSON.stringify(privado)).not.toContain(a.token)
   const final=await t.pedir(caminho+'/comandos',{tipo:'entregar',rodada:1,eventos},b.token)
   expect(final.status).toBe(200);expect(final.dados.fase).toBe('resultado');expect(final.dados.jogadores.every(j=>j.entrega.resultado.total>=0&&j.entrega.resultado.total<=1000)).toBe(true)
  }finally{t.sqlite.close()}
 })
 it('persiste a saída de visitante, bloqueia tokens falsos e chamadas de outro site',async()=>{
  const t=preparar();try{const {a,b,caminho}=await dupla(t)
   expect((await t.pedir(caminho+'/estado',undefined,'f'.repeat(64))).status).toBe(403)
   expect((await t.pedir(caminho+'/comandos',{tipo:'sair'},b.token)).status).toBe(200)
   expect((await t.pedir(caminho+'/estado',undefined,a.token)).dados.jogadores).toHaveLength(1)
   expect((await t.pedir('/api/salas',{nome:'X',config,protocolo:PROTOCOLO_REDE},undefined,{headers:{Origin:'https://outro.test'}})).status).toBe(403)
  }finally{t.sqlite.close()}
 })
 it('queda prolongada decide W/O depois da restauração e sala expira',async()=>{
  const t=preparar();try{const {a,b,caminho}=await dupla(t)
   for(const j of[a,b])await t.pedir(caminho+'/comandos',{tipo:'pronto',rodada:1,pronto:true},j.token)
   t.avancar(20000);await t.pedir(caminho+'/estado',undefined,b.token)
   t.avancar(12000);const r=await t.pedir(caminho+'/estado',undefined,b.token)
   expect(r.dados.fase).toBe('resultado');expect(r.dados.vencedorId).toBe(b.jogadorId)
   t.avancar(1800000);expect((await t.pedir(caminho+'/estado',undefined,b.token)).status).toBe(404)
  }finally{t.sqlite.close()}
 })
 it('limita a criação pública de salas sem guardar o endereço IP',async()=>{
  const t=preparar();try{for(let n=0;n<20;n++)expect((await t.pedir('/api/salas',{nome:'X',config,protocolo:PROTOCOLO_REDE})).status).toBe(201)
   expect((await t.pedir('/api/salas',{nome:'X',config,protocolo:PROTOCOLO_REDE})).status).toBe(429)
   expect(JSON.stringify(t.sqlite.prepare('SELECT * FROM limites').all())).not.toContain('local')
  }finally{t.sqlite.close()}
 })
})
