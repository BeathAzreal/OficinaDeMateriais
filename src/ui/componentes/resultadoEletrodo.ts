import { h } from '../dom'
import { abrirPainel } from '../dialogo'
import { conceito } from './pontuacao'
import type { avaliarEletrodo, aprovacaoEletrodo } from '../../pontuacao/eletrodo'
import type { InspecaoEletrodo } from '../../pontuacao/defeitosEletrodo'

type Resultado=ReturnType<typeof avaliarEletrodo>
/** Mesmo fluxo do MIG: tentativa encerrada, placar, critérios e próxima tentativa. */
export function resultadoEletrodo(r:Resultado,inspecao:InspecaoEletrodo,modo:string,aprovacao:ReturnType<typeof aprovacaoEletrodo>,op:{nova:()=>void;pecas:()=>void;camada:(oculta:boolean)=>void;corte?:()=>void}){
  const minimo=aprovacao.exigencia,pct=(f:number)=>`${Math.round(f*100)} %`
  const letra=conceito(r.nota,aprovacao.aprovada,1000)
  // H90: Fácil é só nota; Difícil aprova com o mínimo em cada item.
  const selo=minimo===null
    ?h('p',{class:'selo selo-livre'},'Modo Fácil — pontuação pura, sem aprovação')
    :aprovacao.aprovada
      ?h('p',{class:'selo selo-ok'},`✔ Aprovada — pelo menos ${pct(minimo)} em cada item e na nota`)
      :h('p',{class:'selo selo-falha'},'✖ Não aprovada — '+[aprovacao.abaixo.length?`abaixo de ${pct(minimo)} em: ${aprovacao.abaixo.join(', ')}`:'',aprovacao.escoria?'remova a escória para a inspeção':''].filter(Boolean).join('; '))
  const totalBase=r.itens.reduce((s,i)=>s+i.pontos,0),ajuste=totalBase-Math.round(totalBase*r.fator)
  const titulo=h('h2',{tabindex:'-1'},'RESULTADO DA TENTATIVA')
  const crosta=h('button',{type:'button','aria-pressed':'false',on:{click:()=>{
    const oculta=crosta.getAttribute('aria-pressed')!=='true'
    crosta.setAttribute('aria-pressed',String(oculta));op.camada(oculta)
    crosta.textContent=oculta?'Mostrar escória':'Ver metal sem escória'
  }}},'Ver metal sem escória')
  const detalhes=()=>abrirPainel('Avaliação da tentativa',h('section',{class:'resultado-smaw'},
    h('p',{},'Nota automática do jogo, de 0 a 1000. Critérios geométricos adaptados ao eletrodo revestido.'),
    h('ul',{},...r.itens.map(i=>h('li',{},h('strong',{},`${i.nome}: ${i.pontos}/${i.maximo}`),h('small',{},i.explicacao)))),
    h('p',{},`Modo ${modo} (H88): referência ISO 5817 nível ${r.nivel}. Ajuste por preenchimento: −${ajuste}. Escória remanescente: −${r.penalidadeEscoria}. Defeitos: −${r.penalidadeDefeitos}. Total limitado a 0–1000.`),
    h('p',{},r.criterioISO),h('p',{},r.dicas),h('small',{},r.limites)))
  // H85: o que se vê no cordão, onde está, por que aconteceu e como corrigir. Não entra na nota.
  const mm=(v:number)=>String(Math.round(v))
  const onde=(d:InspecaoEletrodo['defeitos'][number])=>d.fimMm-d.inicioMm<1?`em ${mm(d.inicioMm)} mm`:d.trechos>1?`em ${d.trechos} trechos, entre ${mm(d.inicioMm)} e ${mm(d.fimMm)} mm`:`de ${mm(d.inicioMm)} a ${mm(d.fimMm)} mm`
  const calor=`Calor médio dos passes: ${inspecao.aporteMedioKJmm.toFixed(2).replace('.',',')} kJ/mm (bom perto de ${inspecao.aporteAlvoKJmm.toFixed(2).replace('.',',')}) · ${inspecao.passes} passe(s) no meio do trecho.`
  const listaDefeitos=()=>abrirPainel('Defeitos encontrados',h('section',{class:'resultado-smaw'},
    h('p',{},calor),
    inspecao.defeitos.length?h('ul',{class:'p15-defeitos'},...inspecao.defeitos.map(d=>h('li',{'data-grave':String(d.grave)},
      h('strong',{},`${d.nome}${d.quantidade>d.trechos?` (${d.quantidade}×)`:''} · ${onde(d)}`),
      h('small',{},`Causa: ${d.causa}`),h('small',{},`Como corrigir: ${d.corrigir}`)))):h('p',{},'Nenhum defeito visível no trecho exigido.'),
    h('small',{},'Inspeção visual didática do jogo: os defeitos também aparecem desenhados no cordão. Não mexe na nota e não é norma.')))
  const graves=inspecao.defeitos.filter(d=>d.grave).length
  const resumoDefeitos=inspecao.defeitos.length
    ?`${inspecao.defeitos.length} defeito(s)${graves?`, ${graves} pedindo reparo`:''}: ${inspecao.defeitos.map(d=>d.nome).join(', ')}. Ver causa e correção.`
    :'Nenhum defeito visível no trecho.'
  const painel=h('aside',{class:'p15-painel p15-resultado','aria-label':'Resultado da tentativa'},
    titulo,h('div',{class:'placar'},
      h('span',{class:`conceito conceito-${letra}`,'aria-label':`Conceito ${letra}`},letra),
      h('div',{},h('span',{class:'placar-rotulo'},`PONTUAÇÃO · ${modo.toUpperCase()}`),h('div',{},h('span',{class:'placar-numero'},String(r.nota)),h('span',{class:'placar-max'},' / 1000')))),
    selo,
    h('ul',{class:'barras-categorias','aria-label':'Notas por categoria'},...r.itens.map(i=>h('li',{},
      h('div',{class:'barra-cabeca'},h('span',{},i.nome),h('strong',{},`${i.pontos}/${i.maximo}`)),
      h('div',{class:'barra-trilho',role:'meter','aria-label':i.nome,'aria-valuemin':'0','aria-valuemax':String(i.maximo),'aria-valuenow':String(i.pontos)},h('div',{class:'barra-valor',style:`width:${100*i.pontos/i.maximo}%`}),
        minimo!==null?h('div',{class:'barra-minimo',title:`Mínimo do Difícil: ${pct(minimo)}`,style:`left:${minimo*100}%`}):null)))),
    h('p',{class:'p15-descontos'},ajuste||r.penalidadeEscoria||r.penalidadeDefeitos?`Descontos: preenchimento −${ajuste} · escória −${r.penalidadeEscoria} · defeitos −${r.penalidadeDefeitos}`:'Sem descontos adicionais.'),
    h('div',{class:'p15-botoes-resultado'},
      h('button',{type:'button',on:{click:detalhes}},'Detalhes da avaliação'),
      op.corte?h('button',{type:'button',title:'Corte transversal: passes e fusão entre eles',on:{click:op.corte}},'Corte'):null,
      h('button',{type:'button',class:'p15-botao-defeitos','data-graves':String(graves),title:resumoDefeitos,'aria-label':resumoDefeitos,on:{click:listaDefeitos}},`Defeitos (${inspecao.defeitos.length})`)),
    h('small',{},'Inspecione em 360° com o botão do meio. + / − controlam o zoom. A tentativa está encerrada.'),
    crosta,h('div',{class:'p15-proxima'},
      h('button',{type:'button',class:'primario',on:{click:op.nova}},'Nova tentativa'),
      h('button',{type:'button',on:{click:op.pecas}},'Escolher outra peça')))
  return {painel,focar:()=>titulo.focus()}
}
