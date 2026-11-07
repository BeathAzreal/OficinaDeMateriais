import { abrirPainel } from '../dialogo'
import type { App } from '../app'
import { h } from '../dom'
import { ClienteRede } from '../../rede/cliente'
import { codigoDoConvite, OFICINA_ONLINE } from '../../rede/convite'
import { MISSOES_REDE,PROTOCOLO_REDE,type CredencialRede } from '../../rede/contrato'
import { paginaRede,botaoRede } from './pagina'
import { CHAVE_SESSAO,SessaoRede,sairParaArcade } from './sessao'

export function telaRede(app:App){
 const erro=h('p',{class:'rede-erro',role:'alert'}),nome=h('input',{maxLength:24,placeholder:'Seu apelido',required:true,'aria-label':'Seu apelido'}),codigo=h('input',{maxLength:6,placeholder:'Ex.: ABC234','aria-label':'Código para entrar',autocomplete:'off',on:{input:e=>{const el=e.target as HTMLInputElement;el.value=el.value.toUpperCase().replace(/[^A-Z2-9]/g,'')}}})
 const missao=h('select',{'aria-label':'Missão do duelo'},...MISSOES_REDE.map(m=>h('option',{value:m.id},m.titulo))),dificuldade=h('select',{'aria-label':'Dificuldade do duelo'},h('option',{value:'aprendiz'},'Aprendiz'),h('option',{value:'profissional'},'Profissional'))
 const convite=codigoDoConvite(location.href)
 codigo.value=convite
 const verificarAbortar=new AbortController()
 let conectado=false,ocupado=false,vivo=true,online=false
 const entrarSessao=(c:CredencialRede)=>new SessaoRede(app,c,()=>telaRede(app)).iniciar()
 const acao=async(tipo:'criar'|'entrar')=>{
  if(ocupado||!conectado)return
  if(!nome.value.trim()){erro.textContent='Digite seu apelido.';nome.focus();return}
  if(tipo==='entrar'&&codigo.value.length!==6){erro.textContent='Digite os seis caracteres do código.';codigo.focus();return}
  ocupado=true;atualizar();erro.textContent=''
  try{const c=tipo==='criar'?await ClienteRede.criar(nome.value,{processo:'mig',missaoId:missao.value,dificuldade:dificuldade.value as 'aprendiz'|'profissional'}):await ClienteRede.entrar(codigo.value,nome.value);if(vivo)entrarSessao(c)}catch(e){erro.textContent=(e as Error).message}finally{ocupado=false;atualizar()}
 }
 const criar=botaoRede('Criar sala',()=>void acao('criar'),true),entrar=botaoRede('Entrar por código',()=>void acao('entrar'))
 const atualizar=()=>{criar.disabled=entrar.disabled=!conectado||ocupado}
 const info=h('p',{class:'rede-conexao',role:'status'},'Conectando à oficina online…')
 const abrirOnline=h('a',{class:'rede-link-online',href:OFICINA_ONLINE+'/?rede=1'+(convite?'&sala='+convite:''),hidden:true},'Abrir oficina online')
 const tentar=botaoRede('Tentar novamente',()=>void verificar())
 tentar.hidden=true
 const caixa=h('section',{class:'rede-caixa'},info,
  h('p',{},convite?`Convite para a sala ${convite}. Informe seu apelido e entre.`:'Crie uma sala e envie o convite. A outra pessoa entra pelo navegador, mesmo em outra rede.'),
  h('label',{},'SEU APELIDO',nome),
  h('div',{class:'rede-opcoes'},h('label',{},'MISSÃO',missao),h('label',{},'DIFICULDADE',dificuldade)),criar,
  h('div',{class:'rede-entrar'},h('label',{},'CÓDIGO DA SALA',codigo),entrar),erro,abrirOnline,tentar,
  botaoRede('Como jogar online',()=>void abrirPainel('Duelo online no navegador',h('section',{class:'rede-caixa'},
   h('p',{},'Abra a oficina online nos dois dispositivos. Um jogador cria a sala e copia o convite; o outro abre o link e informa seu apelido. Também é possível entrar com o código de seis caracteres.'),
   h('p',{},'Não precisa instalar o jogo, abrir arquivo .bat ou manter um computador como servidor. Cada jogador precisa de internet e de um navegador compatível com o 3D.'),
   h('p',{},'Os dois confirmam prontidão e têm três minutos para entregar. A nota é calculada no servidor. Pausar não para o relógio da partida.'),
   h('p',{},'A disputa online está disponível para MIG/MAG. TIG e eletrodo continuam no treino.'),
   h('a',{href:OFICINA_ONLINE+'/?rede=1'},'Abrir oficina online')))),
  botaoRede('Voltar ao Arcade',()=>sairParaArcade(app)))
 const tela=paginaRede('DUELO ONLINE','ARCADE / DOIS COMPUTADORES',caixa)
 void app.ir(a=>{const limpar=tela(a);return()=>{vivo=false;verificarAbortar.abort();limpar?.()}},'Versus · Duelo online')
 atualizar()
 async function verificar(){
  conectado=false;tentar.hidden=true;abrirOnline.hidden=true;erro.textContent='';atualizar()
  info.textContent='Conectando à oficina online…'
  try{
   if(!['http:','https:'].includes(location.protocol))throw Error('O arquivo offline não hospeda salas. Abra a oficina online para jogar com outra pessoa.')
   const dados=await ClienteRede.verificar(location.origin,verificarAbortar.signal);if(!vivo)return
   online=dados.modo==='internet';conectado=true
   info.textContent=online?'Online · sala privada para dois · sem instalação':'Conectado ao servidor local · sala privada para dois'
   atualizar()
   try{const salvo=JSON.parse(sessionStorage.getItem(CHAVE_SESSAO)??'null') as CredencialRede|null;if(salvo?.protocolo===PROTOCOLO_REDE && typeof salvo.token==='string' && /^[A-Z2-9]{6}$/.test(salvo.codigo) && (!convite||salvo.codigo===convite))entrarSessao(salvo)}catch{/* sem sessão anterior */}
  }catch(e){if(vivo){info.textContent='Não foi possível conectar';erro.textContent=(e as Error).message;abrirOnline.hidden=false;tentar.hidden=location.protocol==='file:'}}
 }
 void verificar()
}
