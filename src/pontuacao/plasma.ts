import type { Dificuldade } from '../missoes/catalogo'
import type { PecaPlasma } from '../missoes/pecasPlasma'
import type { AnaliseDefeitos } from '../modelo/defeitos'
import { furoQueFechaMm, type ModeloPlasma } from '../modelo/plasma'
import { analiseVisualTig, MODOS_TIG, type DefeitoTig } from './tig'

/*
 * Nota do plasma (H107), de 0 a 1000, nos moldes da do TIG: cinco itens
 * medidos na peça e desconto por furo. No keyhole, o item principal é a
 * penetração total (o furo passou pela seção); no microplasma, o cordão
 * estreito. Fácil só nota; Difícil aprova com 20 % em cada item e na nota.
 */

export function alvoPlasma(p: PecaPlasma) {
  return p.tecnica === 'keyhole'
    ? { larguraMin: 3, larguraMax: 7, descricao: 'Keyhole do início ao fim: penetração total numa passada, cordão de 3 a 7 mm, sem furo no fim' }
    : { larguraMin: 1.5, larguraMax: 4, descricao: 'Cordão estreito (1,5 a 4 mm) e contínuo, sem furar a chapa fina' }
}

const limitar = (v: number) => Math.max(0, Math.min(1, v))
function coeficienteVariacao(v: readonly number[]): number {
  if (v.length < 2) return 1
  const m = v.reduce((a, b) => a + b, 0) / v.length
  if (m <= 0) return 1
  return Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / v.length) / m
}

export function avaliarPlasma(p: PecaPlasma, m: ModeloPlasma, modo: Dificuldade) {
  const alvo = alvoPlasma(p)
  let total = 0, fundidos = 0, passantes = 0, estreitos = 0
  const larguras: number[] = []
  for (let x = p.inicioMm + 0.5; x < p.fimMm; x++) {
    total++
    const largura = m.larguraFundida(x)
    const fundido = m.fundiuEm(x, 0) && largura >= alvo.larguraMin
    if (fundido) { fundidos++; larguras.push(largura) }
    if (fundido && m.passouEm(x)) passantes++
    if (fundido && largura <= alvo.larguraMax) estreitos++
  }
  const comprimento = p.fimMm - p.inicioMm
  const cobertura = total ? fundidos / total : 0
  const executado = m.tempoArcoS > 0
  const keyhole = p.tecnica === 'keyhole'
  const reaberturas = Math.max(0, m.aberturasKeyhole - 1)
  const itens = [
    { nome: 'Fusão no trecho', maximo: 250, fracao: cobertura, explicacao: `${Math.round(cobertura * 100)}% dos ${comprimento} mm fundidos na linha da junta, com pelo menos ${alvo.larguraMin} mm de largura.` },
    keyhole
      ? { nome: 'Penetração total (keyhole)', maximo: 300, fracao: total ? passantes / total : 0, explicacao: `O keyhole atravessou ${Math.round(total ? (100 * passantes) / total : 0)}% do trecho. Onde não passou, a solda só fundiu por cima.` }
      : { nome: 'Cordão estreito', maximo: 300, fracao: total ? estreitos / total : 0, explicacao: `Cordão entre ${alvo.larguraMin} e ${alvo.larguraMax} mm: o arco concentrado do plasma funde só o necessário.` },
    { nome: 'Largura regular', maximo: 200, fracao: larguras.length ? cobertura * limitar(1 - coeficienteVariacao(larguras) / 0.35) : 0, explicacao: 'Mesma largura do início ao fim: corrente e avanço constantes.' },
    keyhole
      ? { nome: 'Keyhole estável', maximo: 100, fracao: m.aberturasKeyhole ? limitar(1 - 0.1 * reaberturas) : 0, explicacao: `O keyhole abriu ${m.aberturasKeyhole}×. Uma vez só é o ideal: fechar no meio (avanço rápido ou corrente baixa) deixa trechos sem penetrar.` }
      : { nome: 'Sem keyhole', maximo: 100, fracao: m.aberturasKeyhole ? 0 : 1, explicacao: m.aberturasKeyhole ? `O jato furou a chapa fina ${m.aberturasKeyhole}×: gás de plasma ou corrente altos demais para 1 mm.` : 'Fusão só por cima, como pede a chapa fina.' },
    { nome: 'Bocal e arco', maximo: 150, fracao: limitar(1 - 0.3 * m.arcosDuplos - 0.15 * m.crateras.length), explicacao: `Arco duplo (pelo bocal) ${m.arcosDuplos}×, crateras ${m.crateras.length}.` },
  ].map((i) => ({ ...i, pontos: executado ? Math.round(i.fracao * i.maximo) : 0 }))
  const regras = MODOS_TIG[modo]
  const penalidadeFuros = executado ? Math.min(regras.maxFuros, m.furos.length * regras.porFuro) : 0
  const nota = executado ? Math.max(0, Math.min(1000, itens.reduce((a, i) => a + i.pontos, 0) - penalidadeFuros)) : 0
  return { nota, itens, penalidadeFuros, penalidadeNiveis: 0, cobertura, passantes, inspecaoPendente: false, descricao: alvo.descricao }
}

export type ResultadoPlasma = ReturnType<typeof avaliarPlasma>

/** Raiz aparente onde o keyhole passou (o normal no keyhole) e os furos. */
export function analiseVisualPlasma(p: PecaPlasma, m: ModeloPlasma, n: number, passoMm: number): AnaliseDefeitos {
  const a = analiseVisualTig(p, m, n, passoMm)
  for (let i = 0; i < n; i++) {
    const x = (i + 0.5) * passoMm
    a.afundamento[i] = 0
    a.penetracaoMm[i] = m.passouEm(x) ? 0.3 : 0
    a.furoMm[i] = m.furos.some((f) => Math.abs(f.xMm - x) <= 1.5) ? 2.5 : 0
  }
  return a
}

function trechos(p: PecaPlasma, falta: (x: number) => boolean): [number, number][] {
  const r: [number, number][] = []
  let inicio: number | null = null
  for (let x = p.inicioMm + 0.5; x < p.fimMm; x++) {
    if (falta(x)) inicio ??= x
    else if (inicio !== null) { if (x - inicio >= 2) r.push([inicio, x]); inicio = null }
  }
  if (inicio !== null && p.fimMm - inicio >= 2) r.push([inicio, p.fimMm])
  return r
}
const mm = (v: number) => String(Math.round(v))
const ondeTrechos = (t: [number, number][]) => t.length === 1 ? `de ${mm(t[0][0])} a ${mm(t[0][1])} mm` : `em ${t.length} trechos, entre ${mm(t[0][0])} e ${mm(t[t.length - 1][1])} mm`

/** O que se vê na peça, onde, por que e como corrigir (do mais grave para o mais leve). */
export function inspecionarPlasma(p: PecaPlasma, m: ModeloPlasma): DefeitoTig[] {
  const d: DefeitoTig[] = []
  const alvo = alvoPlasma(p)
  const seguidos = m.furos.length >= 4
  if (m.furos.length) d.push({
    nome: seguidos ? `Corte em vez de solda (${m.furos.length} furos)` : `Furo na chapa${m.furos.length > 1 ? ` (${m.furos.length}×)` : ''}`,
    onde: m.furos.map((f) => `${mm(f.xMm)} mm`).join(', '), grave: true,
    causa: p.tecnica === 'melt-in'
      ? 'Na chapa fina, corrente ou gás de plasma altos demais: o jato atravessou a chapa.'
      : `O keyhole passou de ~${furoQueFechaMm(p.espessuraMm).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mm e a poça não fechou atrás: gás de plasma alto (o jato corta), tocha parada ou arco cortado de vez no fim.`,
    corrigir: p.tecnica === 'melt-in'
      ? `Gás de ${p.gasLMin.min}–${p.gasLMin.max} L/min e corrente de ${p.correnteA.min}–${p.correnteA.max} A.`
      : `Gás de ${p.gasLMin.min}–${p.gasLMin.max} L/min, avance sem parar (${p.avancoMmS.min}–${p.avancoMmS.max} mm/s) e no fim solte o pedal devagar (rampa de descida).`,
  })
  const semFusao = trechos(p, (x) => !(m.fundiuEm(x, 0) && m.larguraFundida(x) >= alvo.larguraMin))
  if (semFusao.length && m.tempoArcoS > 0) d.push({ nome: 'Falta de fusão', onde: ondeTrechos(semFusao), grave: true,
    causa: 'A tocha passou sem formar poça (avanço rápido, pedal baixo ou corrente baixa).', corrigir: 'Espere a poça antes de avançar e mantenha a corrente na faixa sugerida.' })
  if (p.tecnica === 'keyhole') {
    const semPenetrar = trechos(p, (x) => m.fundiuEm(x, 0) && !m.passouEm(x))
    if (semPenetrar.length) d.push({ nome: 'Falta de penetração', onde: ondeTrechos(semPenetrar), grave: true,
      causa: m.gasLMin < 0.8 ? 'Gás de plasma baixo: o jato não tem força para abrir o keyhole, só funde por cima.' : 'O keyhole não abriu ou fechou no caminho: corrente baixa ou avanço rápido.',
      corrigir: `Espere o keyhole abrir antes de avançar (o HUD avisa), gás de ${p.gasLMin.min}–${p.gasLMin.max} L/min e avanço de ${p.avancoMmS.min}–${p.avancoMmS.max} mm/s.` })
    if (m.aberturasKeyhole > 3) d.push({ nome: `Keyhole instável (abriu ${m.aberturasKeyhole}×)`, onde: 'ao longo do cordão', grave: false,
      causa: 'No limite: o furo abre e fecha (avanço quase rápido demais para a corrente).', corrigir: 'Um pouco mais de corrente ou um pouco menos de velocidade.' })
  }
  const largo = trechos(p, (x) => m.larguraFundida(x) > alvo.larguraMax)
  if (largo.length) d.push({ nome: 'Cordão largo', onde: ondeTrechos(largo), grave: false,
    causa: 'Calor demais para a peça (corrente alta, avanço lento ou bocal gasto abrindo o arco).', corrigir: 'Avance mais rápido ou baixe a corrente; troque o bocal se houve arco duplo.' })
  if (m.arcosDuplos) d.push({ nome: `Arco duplo (${m.arcosDuplos}×)`, onde: 'no bocal', grave: false,
    causa: 'O arco passou pelo bocal de cobre: bocal encostado na peça ou corrente acima do que o furo do bocal aguenta. O bocal se gasta e o arco abre.',
    corrigir: 'Mantenha o bocal a 3–6 mm da peça, corrente abaixo do limite do bocal e troque o bocal gasto.' })
  if (m.crateras.length) d.push({ nome: `Cratera no fim${m.crateras.length > 1 ? ` (${m.crateras.length}×)` : ''}`, onde: m.crateras.map((c) => `${mm(c.xMm)} mm`).join(', '), grave: false,
    causa: 'O arco foi cortado de uma vez com a poça grande.', corrigir: 'No fim, solte o pedal devagar.' })
  return d.sort((a, b) => Number(b.grave) - Number(a.grave))
}
