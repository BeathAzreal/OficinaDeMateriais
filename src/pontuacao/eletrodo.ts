import type { Acionamento15 } from '../modelo/acionamento15'
import type { PecaEletrodo } from '../missoes/pecasEletrodo'
import { DepositoEletrodo, alvoEletrodo, trechoEletrodo } from '../modelo/depositoEletrodo'
import type { Dificuldade } from '../missoes/catalogo'
import { exigenciaDe } from './regras'

export type NivelISO = 'B' | 'C' | 'D'
/** ISO 5817:2023, tabela 1, itens 1.9/1.10. Só h/b; ver docs/AVALIACAO-SMAW.md. */
export function limiteReforcoISO(b:number,filete:boolean,nivel:NivelISO):number{
  return Math.min(filete?{B:3,C:4,D:5}[nivel]:{B:5,C:7,D:10}[nivel],1+{B:.1,C:.15,D:.25}[nivel]*Math.max(0,b))
}

/** H79: somente o perfil conectado à emenda; depósitos em outras faces não o substituem. */
function perfilAvaliado(c:DepositoEletrodo,x:number){
  const a=alvoEletrodo(c.peca),passo=c.dy
  let e=0,d=0
  if(c.espessura(x,0)<.1)return null
  while(e>-c.alcanceY && c.espessura(x,e-passo)>.1)e-=passo
  while(d<c.alcanceY && c.espessura(x,d+passo)>.1)d+=passo
  const he=c.altura(x,e),hd=c.altura(x,d)
  let h=-Infinity
  for(let y=e;y<=d;y+=passo){
    const base=a.filete?he+(hd-he)*(y-e)/Math.max(passo,d-e):a.raiz?-c.peca.espessuraMm:0
    h=Math.max(h,c.altura(x,y)-base)
  }
  return {h:Math.max(0,h),b:a.filete?Math.hypot(d-e,hd-he):d-e}
}

/** A nota é didática (0–1000); as comparações ISO são parciais e explicitamente separadas. */
/** Ajustes da nota pelo modo escolhido (H88). Sem ajuste, valem os valores da v1.6. */
export interface AjusteNotaEletrodo {
  /** Preenchimento a partir do qual a nota não é reduzida (v1.6: 0,8). */
  preenchimentoCheio:number
  /** Desconto máximo pela escória que restar (v1.6: 200). */
  escoriaMax:number
  /** Pontos tirados pelos defeitos encontrados (calculado por descontoDefeitos). */
  descontoDefeitos:number
}

/**
 * H88: os dois modos do eletrodo. Fácil: nível D da ISO 5817, metade do
 * preenchimento já vale a nota inteira de perfil, escória e defeitos custam
 * pouco. Difícil: nível B, quase todo o preenchimento é exigido e cada defeito
 * grave custa 100 pontos.
 */
export const MODOS_ELETRODO={
  aprendiz:{nivel:'D' as NivelISO,preenchimentoCheio:.6,escoriaMax:100,porGrave:25,maxGraves:75,porLeve:0,maxLeves:0},
  profissional:{nivel:'B' as NivelISO,preenchimentoCheio:.9,escoriaMax:200,porGrave:100,maxGraves:300,porLeve:15,maxLeves:90},
} as const

/** Pontos que os defeitos tiram no modo escolhido: graves e leves, cada grupo com teto. */
export function descontoDefeitos(modo:keyof typeof MODOS_ELETRODO,defeitos:readonly {grave:boolean}[]){
  const r=MODOS_ELETRODO[modo],graves=defeitos.filter(d=>d.grave).length,leves=defeitos.length-graves
  return Math.min(r.maxGraves,graves*r.porGrave)+Math.min(r.maxLeves,leves*r.porLeve)
}

export function avaliarEletrodo(p:PecaEletrodo,c:DepositoEletrodo,m:Acionamento15,nivel:NivelISO='C',ajuste?:AjusteNotaEletrodo){
  const alvo=alvoEletrodo(p)
  let total=0,cobertos=0,somaPreenchimento=0,sequencia=0,maior=0,medidas=0,dentro=0,desvioPior=-Infinity
  let pior={h:0,b:0,limite:0},alinhado=0,metal=0
  for(let j=0;j<c.ny;j++)for(let i=0;i<c.nx;i++){
    const v=c.metal[j*c.nx+i]*c.dx*c.dy
    metal+=v
    if(c.x(i)>=p.inicioMm && c.x(i)<=p.fimMm && Math.abs(c.y(j))<=alvo.faixa)alinhado+=v
  }
  for(let x=p.inicioMm+.5;x<p.fimMm;x++){
    total++
    const trecho=trechoEletrodo(c,x)
    somaPreenchimento+=trecho.progresso
    if(trecho.coberto){cobertos++;sequencia++;maior=Math.max(maior,sequencia)}else sequencia=0
    const perfil=trecho.coberto?perfilAvaliado(c,x):null
    if(!perfil)continue
    // Uma raiz de 2 mm não é reforço na face de uma chapa de 12 mm.
    const limite=alvo.raiz?4:limiteReforcoISO(perfil.b,alvo.filete,nivel),desvio=perfil.h-limite
    medidas++;if(desvio<=1e-8)dentro++
    if(desvio>desvioPior){desvioPior=desvio;pior={...perfil,limite}}
  }
  const executado=m.tempoArcoS>0 && metal>0,cobertura=total?cobertos/total:0,preenchimento=total?somaPreenchimento/total:0
  const limpeza=m.escoria.gerada>0?Math.max(0,1-m.escoria.cobertura/m.escoria.gerada):0
  const inspecaoPendente=executado && m.escoria.cobertura>.01
  const itens=[
    {nome:p.sobreChapa?'Cordão na largura e altura':'União das duas bordas',maximo:300,fracao:cobertura,explicacao:`${Math.round(cobertura*100)}% dos ${p.fimMm-p.inicioMm} mm solicitados atingem o perfil-alvo ${p.sobreChapa?'em toda a largura do cordão':'nas duas bordas e no centro'}.`},
    {nome:'Preenchimento e perfil',maximo:400,fracao:.5*preenchimento+.5*(total?dentro/total:0),explicacao:inspecaoPendente?'Perfil estimado pelo jogo. Há escória: a inspeção visual ISO não está liberada.':`${Math.round(preenchimento*100)}% do preenchimento-alvo. `+(alvo.raiz?'Passe de raiz: camada-alvo 2 mm, teto didático 4 mm; não é o reforço final ISO.':medidas?`Comparação parcial ISO 5817 · ${alvo.filete?'503':'502'} · ${nivel}: h=${pior.h.toFixed(2)} mm, b=${pior.b.toFixed(2)} mm, limite h=${pior.limite.toFixed(2)} mm.`:'A face ainda não foi preenchida para comparar o reforço ISO.')},
    {nome:'Metal na região solicitada',maximo:150,fracao:metal?alinhado/metal:0,explicacao:'Metal entre INÍCIO e FIM, próximo à emenda. Depósitos fora desse trecho não preenchem o objetivo.'},
    {nome:p.sobreChapa?'Continuidade do cordão':'Continuidade da união',maximo:150,fracao:total?maior/total:0,explicacao:'Maior trecho unido sem lacunas, medido sobre a mesma superfície 3D.'},
  ].map(i=>({...i,pontos:executado?Math.round(i.fracao*i.maximo):0}))
  const fator=Math.min(1,preenchimento/(ajuste?.preenchimentoCheio??.8))
  const penalidadeEscoria=inspecaoPendente?Math.round((ajuste?.escoriaMax??200)*(1-limpeza)):0
  const penalidadeDefeitos=executado?Math.round(ajuste?.descontoDefeitos??0):0
  const nota=executado?Math.max(0,Math.min(1000,Math.round(itens.reduce((a,i)=>a+i.pontos,0)*fator)-penalidadeEscoria-penalidadeDefeitos)):0
  const arco=m.tempoFaixaS,tempo=arco.curto+arco.adequado+arco.longo
  return {nota,penalidadeEscoria,penalidadeDefeitos,nivel,itens,cobertura,preenchimento,limpeza,inspecaoPendente,fator,medidas,dentro,pior,
    criterioISO:inspecaoPendente?'Remova a escória antes da inspeção.':alvo.raiz?'Avaliação do passe de raiz; não exige encher todo o chanfro nem declara aprovação ISO.':!medidas?'Complete a união das bordas e o preenchimento da face; o reforço ainda não pode ser comparado.':dentro===medidas?'Dimensão h/b dentro do limite selecionado, nas seções preenchidas.':'Há seções fora do limite dimensional selecionado.',
    dicas:`${alvo.descricao}. Arco adequado: ${tempo?Math.round(arco.adequado/tempo*100):0}% do tempo. Eletrodo grudou ${m.grudadas} vez(es). Técnica e metas de preenchimento são critérios didáticos.`,
    limites:'Verificação parcial: não avalia transição suave, trincas, porosidade, fusão, penetração ou inclusões internas. Não declara conformidade global nem qualifica soldador.'}
}

/**
 * H90 no eletrodo (v1.9): Fácil é só nota, sem aprovação; Difícil exige pelo
 * menos 20 % dos pontos em cada um dos quatro itens da avaliação e também na
 * nota final (escória e defeitos descontam dela), com a escória removida.
 */
export function aprovacaoEletrodo(r:{itens:readonly {nome:string;pontos:number;maximo:number}[];nota:number;inspecaoPendente:boolean},modo:Dificuldade){
  const exigencia=exigenciaDe(modo)
  if(exigencia===null)return {exigencia,aprovada:true,abaixo:[] as string[],escoria:false}
  const abaixo=r.itens.filter(i=>i.maximo>0 && i.pontos<exigencia*i.maximo-1e-9).map(i=>i.nome)
  if(r.nota<exigencia*1000-1e-9)abaixo.push('Nota final')
  return {exigencia,aprovada:abaixo.length===0 && !r.inspecaoPendente,abaixo,escoria:r.inspecaoPendente}
}
