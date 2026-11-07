import type { App,Tela } from '../app'
import type { CredencialRede,SalaRede } from '../../rede/contrato'
import { configuracaoRede } from '../../rede/contrato'
import { ClienteRede } from '../../rede/cliente'
import { linkDaSala } from '../../rede/convite'
import { telaExecucao } from '../telas/execucao'
import { telaCentralArcade } from '../telas/centralArcade'
import { h } from '../dom'
import { abrirPainel,confirmar } from '../dialogo'
import { montarPontuacao } from '../componentes/pontuacao'
import { montarInspecao } from '../componentes/inspecao'
import { paginaRede,botaoRede } from './pagina'

export const CHAVE_SESSAO='oficina-rede-2.0'
const STATUS={preparando:'Preparando',pronto:'Pronto',soldando:'Soldando',entregou:'Entregou a solda',abandonou:'Abandonou','tempo-esgotado':'Prazo encerrado'}
export class SessaoRede {
 private cliente:ClienteRede
 private vista=''
 private rodadaIniciada=0
 private ultima:SalaRede|null=null
 private chegouEm=0
 private saiu=false
 private conexao=true
 private mensagem='Conectado'
 private atualizarTela:(()=>void)|null=null
 private envioPendente:Parameters<ClienteRede['comando']>[0]|null=null
 private reenviando=false
 private recargaTratada=false
 constructor(private app:App,private credencial:CredencialRede,private iniciarNovamente:()=>void){this.cliente=new ClienteRede(credencial)}
 iniciar(){
  try{sessionStorage.setItem(CHAVE_SESSAO,JSON.stringify(this.credencial))}catch{/* a conexão não depende do armazenamento */}
  this.cliente.aoConexao=(ok,mensagem)=>{this.conexao=ok;this.mensagem=mensagem;this.atualizarTela?.();if(ok&&this.envioPendente)void this.enviarPendente()}
  this.cliente.aoEstado=s=>{this.ultima=s;this.chegouEm=Date.now();this.mostrar(s)}
  this.telaEspera('Conectando à sala…');void this.cliente.conectar()
 }
 private agora(){return (this.ultima?.agora??Date.now())+Date.now()-this.chegouEm}
 private guardarSaida(){this.app.guardaSaida=async()=>{
  if(this.saiu)return true
  if(this.ultima && !['resultado','encerrada'].includes(this.ultima.fase) && !await confirmar('Sair da sala?', 'Durante a disputa, sair conta como abandono.',{sim:'Sair da sala'}))return false
  await this.desconectar();return true
 }}
 private trocar(tipo:string,tela:Tela){
  this.vista=tipo;this.atualizarTela=null;this.app.guardaSaida=null
  void this.app.ir(app=>{const limpar=tela(app);this.guardarSaida();return()=>{this.atualizarTela=null;limpar?.()}},'Versus · Duelo online')
 }
 private mostrar(s:SalaRede){
  if(this.saiu)return
  if(s.fase==='partida'){
   const eu=s.jogadores.find(j=>j.id===this.credencial.jogadorId)!
   if(eu.entrega || this.envioPendente){if(this.vista!=='aguardando')this.telaEspera('Sua solda foi enviada');else this.atualizarTela?.();return}
   if(this.rodadaIniciada!==s.rodada){
    // Recarregar a página não pode dar uma nova tentativa na mesma rodada.
    let jaIniciada=false;try{jaIniciada=sessionStorage.getItem(CHAVE_SESSAO+'-rodada')===`${s.codigo}:${s.rodada}`}catch{/* sem armazenamento */}
    if(jaIniciada){if(!this.recargaTratada){this.recargaTratada=true;void this.interromperRecarga()}return}
    this.rodadaIniciada=s.rodada;try{sessionStorage.setItem(CHAVE_SESSAO+'-rodada',`${s.codigo}:${s.rodada}`)}catch{/* sem armazenamento */}
    this.executar(s)
   }else this.atualizarTela?.()
  }else if(s.fase==='resultado'){
   if(this.vista!=='resultado')this.resultado(s);else this.atualizarTela?.()
  }else if(s.fase==='encerrada'){
   if(this.vista!=='encerrada')this.telaEspera(s.motivo||'Sala encerrada',true);else this.atualizarTela?.()
  }else{
   if(!['sala','contagem'].includes(this.vista))this.sala();else this.atualizarTela?.()
  }
 }
 private sala(){
  const status=h('p',{class:'rede-conexao',role:'status'}),jogadores=h('div',{class:'rede-jogadores'}),contagem=h('p',{class:'rede-contagem','aria-live':'polite'})
  const codigo=h('input',{readOnly:true,'aria-label':'Código da sala',value:this.credencial.codigo,on:{focus:e=>(e.target as HTMLInputElement).select()}})
  const pronto=botaoRede('Pronto para soldar',()=>{const s=this.ultima,eu=s?.jogadores.find(j=>j.id===this.credencial.jogadorId);if(s&&eu)void this.comando({tipo:'pronto',rodada:s.rodada,pronto:eu.estado!=='pronto'})},true)
  const link=linkDaSala(this.credencial.codigo,location.origin)
  const convite=h('input',{readOnly:true,'aria-label':'Link de convite',value:link,on:{focus:e=>(e.target as HTMLInputElement).select()}})
  const avisoCopia=h('p',{class:'rede-conexao',role:'status'})
  const copiar=botaoRede('Copiar convite',()=>void(async()=>{
   try{await navigator.clipboard.writeText(link);avisoCopia.textContent='Convite copiado. Envie o link à outra pessoa.'}
   catch{convite.focus();convite.select();avisoCopia.textContent='Selecione e copie o link acima para compartilhar.'}
  })())
  const caixa=h('section',{class:'rede-caixa'},h('div',{class:'rede-codigo'},h('label',{},'CÓDIGO DA SALA',codigo)),
   h('div',{class:'rede-convite'},h('label',{},'CONVIDE A OUTRA PESSOA',convite),copiar),avisoCopia,
   h('p',{class:'rede-endereco'},this.credencial.transporte==='consulta'?'A outra pessoa abre o convite no navegador e informa o apelido. Vocês podem estar em redes diferentes.':'Compartilhe o convite com outro dispositivo da mesma rede local.'),
   jogadores,contagem,status,pronto,botaoRede('Sair da sala',()=>void this.sair()))
  this.trocar('sala',paginaRede('SALA DO DUELO','MIG/MAG / DOIS COMPUTADORES',caixa))
  const atualizar=()=>{
   const s=this.ultima;if(!s)return
   const eu=s.jogadores.find(j=>j.id===this.credencial.jogadorId),c=configuracaoRede(s.config)
   jogadores.replaceChildren(...s.jogadores.map(j=>h('div',{class:'rede-jogador'},h('strong',{},j.nome,j.id===this.credencial.jogadorId?' · você':''),h('span',{},`${STATUS[j.estado]}${j.conectado?'':' · reconectando'}`))))
   if(s.jogadores.length<2)jogadores.append(h('div',{class:'rede-jogador vazio'},'Aguardando o segundo jogador…'))
   const segundos=Math.max(0,Math.ceil(((s.inicioEm??0)-this.agora())/1000))
   contagem.textContent=s.fase==='contagem'?`COMEÇA EM ${segundos||'…'}`:`${c.missao.titulo} · ${s.config.dificuldade} · 3 minutos para entregar`
   pronto.disabled=!this.conexao||s.fase!=='espera';pronto.textContent=eu?.estado==='pronto'?'Cancelar prontidão':'Pronto para soldar'
   status.textContent=this.conexao?'Fonte padronizada para os dois. Confirme quando estiver pronto.':this.mensagem
  };this.atualizarTela=atualizar;atualizar()
 }
 private telaEspera(titulo:string,encerrada=false){
  const texto=h('p',{role:'status'}),placar=h('p',{class:'rede-nota'}),acoes=h('div',{class:'rede-acoes'})
  const cabecalho=h('h3',{},titulo)
  const caixa=h('section',{class:'rede-caixa'},cabecalho,texto,placar,acoes)
  this.trocar(encerrada?'encerrada':'aguardando',paginaRede('DUELO ONLINE',`SALA ${this.credencial.codigo}`,caixa))
  const atualizar=()=>{
   const s=this.ultima,eu=s?.jogadores.find(j=>j.id===this.credencial.jogadorId),outro=s?.jogadores.find(j=>j.id!==this.credencial.jogadorId)
   if(eu?.entrega)cabecalho.textContent='Solda avaliada pelo servidor'
   texto.textContent=this.envioPendente&&this.mensagem.startsWith('Não foi possível entregar:')?this.mensagem:!this.conexao?this.mensagem:eu?.entrega?`${outro?.nome??'O adversário'} ainda está concluindo a tentativa.`:'Aguardando confirmação do servidor…'
   placar.textContent=eu?.entrega?`${eu.entrega.resultado.total} / 1000`:''
   acoes.replaceChildren(...(this.envioPendente?[botaoRede('Tentar reenviar',()=>void this.enviarPendente(),true)]:[]),botaoRede('Sair da sala',()=>void this.sair()))
  };this.atualizarTela=atualizar;atualizar()
 }
 private executar(s:SalaRede){
  const c=configuracaoRede(s.config)
  const tela=telaExecucao({missao:c.missao,dificuldade:s.config.dificuldade,contexto:c.contexto,ajustes:c.ajustes,dispositivo:this.app.preferencias.dispositivo,preferencias:this.app.preferencias,oficial:false,
   rotulo:`Duelo online · Sala ${s.codigo}`,aoSair:()=>void this.sair(),aoConcluir:({eventos})=>{
    if(this.envioPendente)return
    this.envioPendente={tipo:'entregar',rodada:s.rodada,eventos};this.telaEspera('Enviando a solda para avaliação');void this.enviarPendente()
   }})
  this.trocar('execucao',app=>{
   const limpar=tela(app)
   const etiqueta=app.raiz.querySelector('.etiqueta');if(etiqueta)etiqueta.textContent='DUELO ONLINE — VALIDAÇÃO NO SERVIDOR'
   const aviso=h('div',{class:'rede-hud',role:'status'})
   app.raiz.querySelector('.area-peca')?.append(aviso)
   const atualizar=()=>{
    const estado=this.ultima,outro=estado?.jogadores.find(j=>j.id!==this.credencial.jogadorId)
    const falta=Math.max(0,Math.ceil(((estado?.fimEm??0)-this.agora())/1000))
    aviso.textContent=`${Math.floor(falta/60)}:${String(falta%60).padStart(2,'0')} · ${outro?.nome??'Adversário'}: ${outro?STATUS[outro.estado]:'conectando'}${this.conexao?'':' · reconectando'}`
   };this.atualizarTela=atualizar;atualizar()
   const timer=setInterval(atualizar,250)
   return()=>{clearInterval(timer);limpar?.()}
  })
 }
 private async enviarPendente(){
  if(!this.envioPendente||this.reenviando||this.saiu)return
  this.reenviando=true
  try{await this.cliente.comando(this.envioPendente);this.envioPendente=null}
  catch(e){this.mensagem=`Não foi possível entregar: ${(e as Error).message}`;this.atualizarTela?.()}
  finally{this.reenviando=false;this.atualizarTela?.()}
 }
 private resultado(s:SalaRede){
  this.envioPendente=null
  const vencedor=s.jogadores.find(j=>j.id===s.vencedorId),titulo=vencedor?`${vencedor.nome} venceu`:'Empate'
  const comparacao=h('div',{class:'rede-comparacao'})
  for(const j of s.jogadores){
   const detalhe=botaoRede('Ver avaliação',()=>{if(j.entrega)void abrirPainel(`Avaliação · ${j.nome}`,montarPontuacao(j.entrega.resultado))})
   const inspecionar=botaoRede('Inspecionar solda',()=>{if(j.entrega){const c=configuracaoRede(s.config),v=montarInspecao({missao:c.missao,dificuldade:s.config.dificuldade,contexto:c.contexto,ajustes:c.ajustes,preparo:c.preparo,eventos:j.entrega.eventos});void abrirPainel(`Solda · ${j.nome}`,v.elemento).finally(v.destruir)}})
   comparacao.append(h('article',{class:`rede-resultado-jogador${j.id===s.vencedorId?' vencedor':''}`},h('h3',{},j.nome),h('p',{class:'rede-nota'},`${j.entrega?.resultado.total??0} / 1000`),h('small',{},j.estado==='soldando'&&j.id===s.vencedorId?'Vitória por W/O':STATUS[j.estado]),...(j.entrega?[detalhe,inspecionar]:[])))
  }
  const aviso=h('p',{role:'status'}),revanche=botaoRede('Pedir revanche',()=>void this.comando({tipo:'revanche',rodada:s.rodada}),true)
  const caixa=h('section',{class:'rede-caixa rede-caixa-resultado'},h('h3',{},titulo),h('p',{},s.motivo),comparacao,aviso,h('div',{class:'rede-acoes'},revanche,botaoRede('Sair da sala',()=>void this.sair())))
  this.trocar('resultado',paginaRede('RESULTADO DO DUELO',`SALA ${s.codigo} / RODADA ${s.rodada}`,caixa))
  const atualizar=()=>{const estado=this.ultima,eu=estado?.jogadores.find(j=>j.id===this.credencial.jogadorId);revanche.disabled=!!eu?.revanche||!this.conexao||!!estado?.jogadores.some(j=>j.estado==='abandonou'||!j.conectado);aviso.textContent=estado?.jogadores.some(j=>j.estado==='abandonou')?'Um jogador saiu. Crie outra sala para disputar novamente.':eu?.revanche?'Aguardando o adversário aceitar a revanche.':!this.conexao?this.mensagem:'A maior nota vence. Notas iguais empatam.'}
  this.atualizarTela=atualizar;atualizar()
 }
 private async comando(c:Parameters<ClienteRede['comando']>[0]){try{await this.cliente.comando(c)}catch(e){this.app.avisar((e as Error).message)}}
 private async interromperRecarga(){
  await this.desconectar();this.app.guardaSaida=null;this.iniciarNovamente();this.app.avisar('A página foi recarregada durante a soldagem. A tentativa foi interrompida e a sala foi encerrada para você.')
 }
 private async desconectar(){
  if(this.saiu)return
  this.saiu=true
  try{await this.cliente.comando({tipo:'sair'})}catch{/* o servidor aplica o prazo de desconexão */}
  this.cliente.fechar();try{sessionStorage.removeItem(CHAVE_SESSAO);sessionStorage.removeItem(CHAVE_SESSAO+'-rodada')}catch{/* sem armazenamento */}
 }
 private async sair(){
  if(this.ultima&&!['resultado','encerrada','espera'].includes(this.ultima.fase)&&!await confirmar('Abandonar o duelo?',this.ultima.fase==='contagem'?'Isso cancela o início da rodada.':'A outra pessoa vencerá por abandono.',{sim:'Abandonar e sair'})){this.guardarSaida();return}
  await this.desconectar();this.app.guardaSaida=null;this.iniciarNovamente()
 }
}
export function sairParaArcade(app:App){telaCentralArcade(app)}
