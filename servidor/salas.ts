const randomBytes=(n:number)=>globalThis.crypto.getRandomValues(new Uint8Array(n))
const randomUUID=()=>globalThis.crypto.randomUUID()
import { avaliarRegistroRede } from './avaliar'
import { PROTOCOLO_REDE,MODELO_REDE,configuracaoRede,type ConfigRede,type ComandoRede,type CredencialRede,type SalaRede,type JogadorRede,type FaseRede } from '../src/rede/contrato'

export class ErroSala extends Error {constructor(mensagem:string,readonly status=400){super(mensagem)}}
interface JogadorInterno extends JogadorRede {token:string;desconectadoEm:number|null;ultimoPulso?:number}
interface SalaInterna {codigo:string;config:ConfigRede;fase:FaseRede;rodada:number;jogadores:JogadorInterno[];criadaEm:number;inicioEm:number|null;fimEm:number|null;motivo:string;vencedorId:string|null}
export class Salas {
 private salas=new Map<string,SalaInterna>()
 constructor(readonly agora=()=>Date.now(),readonly tempos={contagem:5000,partida:180000,queda:30000,expiracao:1800000}){}
 private nome(d:unknown){if(typeof d!=='string' || !d.trim() || d.trim().length>24 || /[\x00-\x1f]/.test(d))throw new ErroSala('Use um apelido de 1 a 24 caracteres.');return d.trim()}
 private novoJogador(nome:unknown,anfitriao:boolean):JogadorInterno{return{id:randomUUID(),nome:this.nome(nome),anfitriao,conectado:false,desconectadoEm:this.agora(),estado:'preparando',revanche:false,entrega:null,token:Array.from(randomBytes(32),v=>v.toString(16).padStart(2,'0')).join('')}}
 private credencial(s:SalaInterna,j:JogadorInterno):CredencialRede{return{codigo:s.codigo,jogadorId:j.id,token:j.token,protocolo:PROTOCOLO_REDE}}
 private obter(codigo:string){const s=this.salas.get(codigo.toUpperCase());if(!s)throw new ErroSala('Sala não encontrada ou expirada.',404);return s}
 private autenticar(s:SalaInterna,token:string){const j=s.jogadores.find(j=>j.token===token);if(!j)throw new ErroSala('Acesso à sala não autorizado.',403);return j}
 criar(nome:unknown,config:ConfigRede,protocolo:unknown){
  this.compativel(protocolo);if(this.salas.size>=64)throw new ErroSala('O servidor está com muitas salas. Tente depois.',503)
  try{configuracaoRede(config)}catch(e){throw new ErroSala((e as Error).message)}
  const j=this.novoJogador(nome,true),alfabeto='ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let codigo='';do{codigo=[...randomBytes(6)].map(v=>alfabeto[v%alfabeto.length]).join('')}while(this.salas.has(codigo))
  const s:SalaInterna={codigo,config:{processo:'mig',missaoId:config.missaoId,dificuldade:config.dificuldade},fase:'espera',rodada:1,jogadores:[j],criadaEm:this.agora(),inicioEm:null,fimEm:null,motivo:'',vencedorId:null}
  this.salas.set(codigo,s);return this.credencial(s,j)
 }
 entrar(codigo:string,nome:unknown,protocolo:unknown){
  this.compativel(protocolo);const s=this.obter(codigo)
  if(s.fase!=='espera' || s.jogadores.length>=2)throw new ErroSala('Esta sala já está completa ou em partida.',409)
  const j=this.novoJogador(nome,false);s.jogadores.push(j);return this.credencial(s,j)
 }
 private compativel(p:unknown){if(p!==PROTOCOLO_REDE)throw new ErroSala('Versão de rede diferente. Recarregue o jogo pelo endereço do servidor.',409)}
 conectar(codigo:string,token:string,conectado:boolean){const s=this.obter(codigo),j=this.autenticar(s,token);j.conectado=conectado;j.desconectadoEm=conectado?null:this.agora();if(s.fase==='espera'&&s.jogadores.length===2&&s.jogadores.every(x=>x.estado==='pronto'&&x.conectado))this.contar(s)}
 estado(codigo:string,token:string):SalaRede{
  const s=this.obter(codigo),eu=this.autenticar(s,token)
  return {codigo:s.codigo,config:{...s.config},fase:s.fase,rodada:s.rodada,protocolo:PROTOCOLO_REDE,modelo:MODELO_REDE,agora:this.agora(),inicioEm:s.inicioEm,fimEm:s.fimEm,motivo:s.motivo,vencedorId:s.vencedorId,
   jogadores:s.jogadores.map(j=>({id:j.id,nome:j.nome,anfitriao:j.anfitriao,conectado:j.conectado,estado:j.estado,revanche:j.revanche,entrega:s.fase==='resultado'||j===eu?j.entrega:null}))}
 }
 comando(codigo:string,token:string,dados:ComandoRede){
  const s=this.obter(codigo),j=this.autenticar(s,token)
  if(!dados || typeof dados!=='object')throw new ErroSala('Comando inválido.')
  if(dados.tipo==='sair'){
   if(s.fase==='espera' && !j.anfitriao){s.jogadores=s.jogadores.filter(x=>x!==j);s.jogadores.forEach(x=>x.estado='preparando');return}
   j.estado='abandonou';j.conectado=false
   if(s.fase==='espera'||s.fase==='contagem'){s.fase='encerrada';s.motivo=`${j.nome} saiu da sala.`}
   else if(s.fase==='partida'){this.finalizar(s,`${j.nome} abandonou a disputa.`,s.jogadores.find(x=>x!==j)?.id??null)}
   return
  }
  if(dados.rodada!==s.rodada)throw new ErroSala('Esta mensagem pertence a outra rodada.',409)
  if(dados.tipo==='pronto'){
   if(s.fase!=='espera' || typeof dados.pronto!=='boolean')throw new ErroSala('Não é possível mudar a prontidão agora.',409)
   j.estado=dados.pronto?'pronto':'preparando'
   if(s.jogadores.length===2 && s.jogadores.every(x=>x.estado==='pronto'&&x.conectado))this.contar(s)
  }else if(dados.tipo==='entregar'){
   if(j.entrega)return // Retransmissão não muda uma entrega já aceita.
   if(s.fase!=='partida' || !s.inicioEm || this.agora()<s.inicioEm || this.agora()>(s.fimEm??0)+5000 || j.estado==='abandonou')throw new ErroSala('A partida não está recebendo entregas.',409)
   try{j.entrega=avaliarRegistroRede(s.config,dados.eventos,this.tempos.partida,this.agora()-s.inicioEm)}catch(e){throw new ErroSala((e as Error).message)}
   j.estado='entregou'
   if(s.jogadores.every(x=>x.entrega))this.finalizar(s,'As duas soldas foram avaliadas pelo servidor.')
  }else if(dados.tipo==='revanche'){
   if(s.fase!=='resultado' || s.jogadores.some(x=>x.estado==='abandonou'||!x.conectado))throw new ErroSala('A revanche precisa dos dois jogadores conectados.',409)
   j.revanche=true
   if(s.jogadores.every(x=>x.revanche)){
    s.rodada++;s.vencedorId=null;s.motivo=''
    for(const x of s.jogadores){x.entrega=null;x.revanche=false;x.estado='pronto'}
    this.contar(s)
   }
  }else throw new ErroSala('Comando desconhecido.')
 }
 private contar(s:SalaInterna){s.fase='contagem';s.inicioEm=this.agora()+this.tempos.contagem;s.fimEm=s.inicioEm+this.tempos.partida}
 private finalizar(s:SalaInterna,motivo:string,vencedor?:string|null){
  s.fase='resultado';s.motivo=motivo
  if(vencedor!==undefined){s.vencedorId=vencedor;return}
  const [a,b]=s.jogadores
  if(!!a?.entrega!==!!b?.entrega){s.vencedorId=a?.entrega?a.id:b.id;return}
  const pa=a?.entrega?.resultado.total??0,pb=b?.entrega?.resultado.total??0
  s.vencedorId=pa===pb?null:pa>pb?a.id:b.id
 }
 atualizar(){
  const agora=this.agora()
  for(const [codigo,s] of this.salas){
   if(agora-s.criadaEm>this.tempos.expiracao){this.salas.delete(codigo);continue}
   if(s.fase==='contagem' && agora>=(s.inicioEm??Infinity)){s.fase='partida';s.jogadores.forEach(j=>j.estado='soldando')}
   if(s.fase==='partida' && agora>(s.fimEm??Infinity)+5000){for(const j of s.jogadores)if(!j.entrega)j.estado='tempo-esgotado';this.finalizar(s,'Prazo encerrado. Tentativas sem entrega valem zero.')}
   if(s.fase==='partida' && s.jogadores.every(j=>!j.conectado&&j.desconectadoEm!==null&&agora-j.desconectadoEm>this.tempos.queda)){s.fase='encerrada';s.motivo='Os dois jogadores perderam a conexão.'}
   for(const j of [...s.jogadores])if(j.desconectadoEm!==null && agora-j.desconectadoEm>this.tempos.queda && !j.conectado && !['resultado','encerrada'].includes(s.fase))this.comando(codigo,j.token,{tipo:'sair'})
  }
 }
 codigos(){return [...this.salas.keys()]}
 // Somente o adaptador de armazenamento do servidor lê este formato, que contém tokens.
 guardar(codigo:string){return JSON.stringify({protocolo:PROTOCOLO_REDE,sala:this.obter(codigo)})}
 restaurar(dados:string){
  const registro=JSON.parse(dados) as {protocolo:string;sala:SalaInterna}
  if(registro.protocolo!==PROTOCOLO_REDE)throw new ErroSala('Esta sala usa outra versão. Crie uma nova sala.',409)
  this.salas.set(registro.sala.codigo,registro.sala)
 }
 pulso(codigo:string,token:string){
  const s=this.obter(codigo);this.autenticar(s,token)
  for(const j of s.jogadores)if(j.conectado&&j.ultimoPulso!==undefined&&this.agora()-j.ultimoPulso>10000){j.conectado=false;j.desconectadoEm=j.ultimoPulso}
  this.atualizar()
  const j=this.autenticar(this.obter(codigo),token)
  // Um retorno depois do W/O não reabre a partida.
  if(j.estado==='abandonou')return
  j.ultimoPulso=this.agora();this.conectar(codigo,token,true)
 }
}
