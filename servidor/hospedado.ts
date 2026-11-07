import { Salas,ErroSala } from './salas'
import { PROTOCOLO_REDE,MODELO_REDE,type ComandoRede,type ConfigRede } from '../src/rede/contrato'

interface ResultadoD1 {meta:{changes:number}}
interface ConsultaD1 {
 bind(...valores:unknown[]):ConsultaD1
 first<T>():Promise<T|null>
 run():Promise<ResultadoD1>
}
export interface BancoSalas {prepare(sql:string):ConsultaD1}
interface LinhaSala {dados:string;revisao:number;expira_em:number}
const LIMITE_CORPO=1024*1024
const json=(d:unknown,status=200)=>new Response(JSON.stringify(d),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}})

async function corpo(r:Request){
 if(Number(r.headers.get('Content-Length'))>LIMITE_CORPO)throw new ErroSala('Tentativa muito grande.',413)
 const leitor=r.body?.getReader();if(!leitor)throw new ErroSala('Corpo da solicitação ausente.')
 let tamanho=0,texto='';const decodificador=new TextDecoder()
 try{for(;;){const {value,done}=await leitor.read();if(done)break;tamanho+=value.byteLength;if(tamanho>LIMITE_CORPO){await leitor.cancel();throw new ErroSala('Tentativa muito grande.',413)}texto+=decodificador.decode(value,{stream:true})}}finally{leitor.releaseLock()}
 try{return JSON.parse(texto+decodificador.decode())}catch{throw new ErroSala('Dados inválidos.')}
}

// D1 usa revisão para duas requisições simultâneas não sobrescreverem prontidão/entregas.
export class SalasHospedadas {
 constructor(readonly db:BancoSalas,readonly agora=()=>Date.now()){}
 private async alterar<T>(codigo:string,acao:(salas:Salas)=>T):Promise<T>{
  for(let tentativa=0;tentativa<8;tentativa++){
   const linha=await this.db.prepare('SELECT dados, revisao, expira_em FROM salas WHERE codigo = ?').bind(codigo).first<LinhaSala>()
   if(!linha||linha.expira_em<=this.agora())throw new ErroSala('Sala não encontrada ou expirada.',404)
   const salas=new Salas(this.agora);salas.restaurar(linha.dados)
   const resultado=acao(salas)
   const gravado=await this.db.prepare('UPDATE salas SET dados = ?, revisao = revisao + 1 WHERE codigo = ? AND revisao = ?').bind(salas.guardar(codigo),codigo,linha.revisao).run()
   if(gravado.meta.changes===1)return resultado
  }
  throw new ErroSala('A sala está ocupada. Tente novamente.',503)
 }
 private async limitar(ip:string){
  const janela=Math.floor(this.agora()/60000)
  const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(`${janela}:${ip}`))
  const chave=Array.from(new Uint8Array(hash),v=>v.toString(16).padStart(2,'0')).join('')
  const contador=await this.db.prepare('INSERT INTO limites (chave, janela, quantidade) VALUES (?, ?, 1) ON CONFLICT(chave) DO UPDATE SET quantidade = quantidade + 1 RETURNING quantidade').bind(chave,janela).first<{quantidade:number}>()
  if((contador?.quantidade??21)>20)throw new ErroSala('Muitas tentativas de acesso. Aguarde um minuto.',429)
 }
 async responder(r:Request){
  try{
   const url=new URL(r.url),caminho=url.pathname
   const origem=r.headers.get('Origin')
   if(origem&&origem!==url.origin)throw new ErroSala('Origem não autorizada.',403)
   if(caminho==='/api/rede/info'&&r.method==='GET')return json({protocolo:PROTOCOLO_REDE,modelo:MODELO_REDE,versao:'2.0',processos:['mig'],modo:'internet',transporte:'consulta',enderecos:[url.origin]})
   if(!['GET','POST'].includes(r.method))return json({erro:'Método não permitido.'},405)
   if(caminho==='/api/salas'&&r.method==='POST'){
    const d=await corpo(r);await this.limitar(r.headers.get('CF-Connecting-IP')??'local')
    // Limpa somente registros temporários; nunca guarda IP ou histórico de partidas.
    await this.db.prepare('DELETE FROM salas WHERE expira_em <= ?').bind(this.agora()).run()
    await this.db.prepare('DELETE FROM limites WHERE janela < ?').bind(Math.floor(this.agora()/60000)-1).run()
    const numero=await this.db.prepare('SELECT COUNT(*) AS n FROM salas').first<{n:number}>()
    if((numero?.n??0)>=64)throw new ErroSala('O servidor está com muitas salas. Tente depois.',503)
    for(let t=0;t<4;t++){
     const salas=new Salas(this.agora),c=salas.criar(d?.nome,d?.config as ConfigRede,d?.protocolo)
     const gravado=await this.db.prepare('INSERT OR IGNORE INTO salas (codigo, dados, revisao, expira_em) VALUES (?, ?, 0, ?)').bind(c.codigo,salas.guardar(c.codigo),this.agora()+1800000).run()
     if(gravado.meta.changes===1)return json({...c,transporte:'consulta'},201)
    }
    throw new ErroSala('Não foi possível criar uma sala. Tente novamente.',503)
   }
   const partes=/^\/api\/salas\/([A-Z2-9]{6})\/(entrar|estado|comandos)$/.exec(caminho)
   if(!partes)throw new ErroSala('Endereço não encontrado.',404)
   const [,codigo,acao]=partes
   if(acao==='entrar'&&r.method==='POST'){
    const d=await corpo(r);await this.limitar(r.headers.get('CF-Connecting-IP')??'local')
    const c=await this.alterar(codigo,salas=>{salas.atualizar();return salas.entrar(codigo,d?.nome,d?.protocolo)})
    return json({...c,transporte:'consulta'})
   }
   const token=/^Bearer ([a-f0-9]{64})$/.exec(r.headers.get('Authorization')??'')?.[1]
   if(!token)throw new ErroSala('Acesso à sala não autorizado.',403)
   if(acao==='estado'&&r.method==='GET')return json(await this.alterar(codigo,salas=>{salas.pulso(codigo,token);return salas.estado(codigo,token)}))
   if(acao==='comandos'&&r.method==='POST'){
    const d=await corpo(r)
    return json(await this.alterar(codigo,salas=>{salas.pulso(codigo,token);const antes=salas.estado(codigo,token);salas.comando(codigo,token,d as ComandoRede);return d?.tipo==='sair'?antes:salas.estado(codigo,token)}))
   }
   throw new ErroSala('Método não permitido.',405)
  }catch(e){return e instanceof ErroSala?json({erro:e.message},e.status):json({erro:'O servidor não conseguiu completar a solicitação. Tente novamente.'},503)}
 }
}
