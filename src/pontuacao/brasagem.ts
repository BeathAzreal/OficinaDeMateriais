import type { Dificuldade } from '../missoes/catalogo'
import type { PecaBrasagem } from '../missoes/pecasBrasagem'
import type { AnaliseDefeitos } from '../modelo/defeitos'
import { autoFluxante, BRASAGEM, FLUXOS, ModeloBrasagem, ZINCO } from '../modelo/brasagem'

/*
 * Nota da brasagem (H105), de 0 a 1000, nos moldes da do TIG: cinco itens
 * medidos na peça e descontos por metal de base fundido, junta frágil e zinco
 * queimado. O que importa numa junta brasada é a liga DENTRO da folga, que
 * não se vê de fora: a nota mede a folga cheia (como um corte da peça), a
 * liga chegando ao fim da sobreposição, o filete na borda, a temperatura e a
 * limpeza do processo. Fácil só nota; Difícil aprova com 20 % em cada item e
 * na nota final (aprovacaoEletrodo).
 */

export const MODOS_BRASAGEM = {
  aprendiz: { porFuro: 60, maxFuros: 180, fragil: 300, porMmZinco: 8, maxZinco: 80 },
  profissional: { porFuro: 150, maxFuros: 450, fragil: 600, porMmZinco: 20, maxZinco: 200 },
} as const

/** Folga cheia de liga, abaixo disso é vazio (fração). */
const CHEIA = 0.6
/** Faixa queimada de zinco tolerada de cada lado (mm): o zinco sempre derrete um pouco perto da junta. */
const ZINCO_TOLERADO_MM = 3

const limitar = (v: number) => Math.max(0, Math.min(1, v))
const { NY, DY, Y0 } = ModeloBrasagem.grade

export interface TrechoBrasagem { preenchimento: number; profundidadeMm: number; fileteMm2: number; picoBordaC: number }

export function trechoBrasagem(m: ModeloBrasagem, x: number): TrechoBrasagem {
  return { preenchimento: m.preenchimentoEm(x), profundidadeMm: m.profundidadeEm(x), fileteMm2: m.fileteEm(x), picoBordaC: m.maximaC(x, 0.25) }
}

/** Largura (mm) da faixa em que o zinco do galvanizado ferveu, na coluna x (só a chapa à vista: y ≥ 0). */
export function zincoQueimadoMm(m: ModeloBrasagem, x: number): number {
  if (m.peca.material !== 'aco-galvanizado') return 0
  let n = 0
  for (let j = 0; j < NY; j++) {
    const y = Y0 + (j + 0.5) * DY
    if (y >= 0 && m.maximaC(x, y) >= ZINCO.ebulicaoC) n++
  }
  return n * DY
}

/** A liga com fósforo no aço forma fosfeto de ferro: a junta fica frágil. */
export function juntaFragil(m: ModeloBrasagem): boolean {
  return m.liga.fosforo && m.base.ferroso && m.ligaUsadaMm > 0
}

export function avaliarBrasagem(p: PecaBrasagem, m: ModeloBrasagem, modo: Dificuldade) {
  const [t0, t1] = m.liga.trabalhoC
  let total = 0, cheio = 0, ateFim = 0, comFilete = 0, naFaixa = 0, zinco = 0
  const picos: number[] = []
  for (let x = p.inicioMm + 0.5; x < p.fimMm; x++) {
    total++
    const t = trechoBrasagem(m, x)
    cheio += t.preenchimento
    if (t.profundidadeMm >= 0.9 * p.sobreposicaoMm && t.preenchimento >= CHEIA) ateFim++
    if (t.fileteMm2 >= 0.1 && t.fileteMm2 <= 3) comFilete++
    if (t.picoBordaC >= m.liga.liquidusC && t.picoBordaC <= m.liga.superaquecimentoC) naFaixa++
    // A uniformidade é medida onde a peça chegou a brasar; o resto já perde na fração.
    if (t.picoBordaC >= m.liga.solidusC) picos.push(t.picoBordaC)
    zinco = Math.max(zinco, zincoQueimadoMm(m, x))
  }
  const executado = m.tempoChamaS > 0
  const comprimento = p.fimMm - p.inicioMm
  const preenchimento = total ? cheio / total : 0
  const media = picos.reduce((a, b) => a + b, 0) / Math.max(1, picos.length)
  const desvio = Math.sqrt(picos.reduce((a, b) => a + (b - media) ** 2, 0) / Math.max(1, picos.length))
  // Liga gasta além do que a folga e um filete fino pediriam (mm³).
  const necessario = p.sobreposicaoMm * p.folgaMm * comprimento + 1 * comprimento
  const area = Math.PI * (m.liga.varetaMm / 2) ** 2
  const gasto = m.ligaUsadaMm * area
  const escorrida = m.escorrida.reduce((a, b) => a + b, 0)
  const desperdicio = gasto > 0 ? limitar((gasto - 1.6 * necessario) / (2 * necessario)) : 0
  const limpeza = limitar(1 - 0.12 * m.emboladas - 0.15 * m.varetaNaChama - 0.15 * m.fluxoQueimado - 0.5 * desperdicio - escorrida / (necessario + 1))
  const itens = [
    { nome: 'Folga preenchida', maximo: 350, fracao: preenchimento, explicacao: `${Math.round(preenchimento * 100)}% da folga entre as chapas cheia de liga, nos ${comprimento} mm do trecho (como num corte da peça). Poros contam como vazio.` },
    { nome: 'Liga até o fim', maximo: 150, fracao: total ? ateFim / total : 0, explicacao: `A liga correu os ${p.sobreposicaoMm} mm da sobreposição, da borda até o fim, em ${Math.round((total ? ateFim / total : 0) * 100)}% do trecho.` },
    { nome: 'Filete na borda', maximo: 150, fracao: total ? comFilete / total : 0, explicacao: 'Filete fino e contínuo de liga na borda da chapa de cima: mostra que a liga molhou as duas chapas.' },
    { nome: 'Temperatura de trabalho', maximo: 200, fracao: total ? (naFaixa / total) * limitar(1 - desvio / 250) : 0, explicacao: `Borda entre ${m.liga.liquidusC} °C (a liga corre) e ${m.liga.superaquecimentoC} °C (a liga se estraga), em ${Math.round((total ? naFaixa / total : 0) * 100)}% do trecho; faixa ideal ${t0}–${t1} °C. Variação de ±${Math.round(desvio)} °C ao longo da junta.` },
    // Limpeza só vale sobre a junta feita: sem liga na folga não há o que poupar.
    { nome: 'Limpeza e economia', maximo: 150, fracao: limpeza * limitar(preenchimento / 0.5), explicacao: `Liga embolada ${m.emboladas}×, vareta derretida na chama ${m.varetaNaChama}×, fluxo queimado ${m.fluxoQueimado}×, liga escorrida ${Math.round(escorrida)} mm³. Gasto: ${Math.round(m.ligaUsadaMm)} mm de vareta.` },
  ].map((i) => ({ ...i, pontos: executado ? Math.round(i.fracao * i.maximo) : 0 }))
  const regras = MODOS_BRASAGEM[modo]
  const penalidadeFuros = executado ? Math.min(regras.maxFuros, m.furos.length * regras.porFuro) : 0
  const penalidadeFragil = executado && juntaFragil(m) ? regras.fragil : 0
  const penalidadeZinco = executado ? Math.min(regras.maxZinco, Math.round(Math.max(0, zinco - ZINCO_TOLERADO_MM) * regras.porMmZinco)) : 0
  const nota = executado ? Math.max(0, Math.min(1000, itens.reduce((a, i) => a + i.pontos, 0) - penalidadeFuros - penalidadeFragil - penalidadeZinco)) : 0
  return {
    nota, itens, preenchimento, inspecaoPendente: false,
    descontos: { furos: penalidadeFuros, fragil: penalidadeFragil, zinco: penalidadeZinco },
    descricao: `Liga ${m.liga.nome} na folga de ${p.folgaMm.toLocaleString('pt-BR')} mm, sobreposição de ${p.sobreposicaoMm} mm`,
  }
}

export type ResultadoBrasagem = ReturnType<typeof avaliarBrasagem>

export interface DefeitoBrasagem { nome: string; onde: string; causa: string; corrigir: string; grave: boolean }

/** Trechos contínuos (mm) em que `falta(x)` é verdadeiro, dentro do trecho exigido. */
function trechos(p: PecaBrasagem, falta: (x: number) => boolean): [number, number][] {
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

/** O que a inspeção acharia na peça (e num corte), onde, por que e como corrigir. */
export function inspecionarBrasagem(p: PecaBrasagem, m: ModeloBrasagem): DefeitoBrasagem[] {
  const d: DefeitoBrasagem[] = []
  if (m.tempoChamaS <= 0) return d
  const semFluxo = !m.preparo.fluxo && !autoFluxante(m.liga, p.material)
  if (juntaFragil(m)) d.push({ nome: 'Junta frágil (fosfeto de ferro)', onde: 'em toda a junta', grave: true,
    causa: 'Liga de cobre-fósforo no aço: o fósforo forma fosfeto de ferro, duro e quebradiço, na interface.', corrigir: 'No aço use prata (com fluxo branco) ou latão (com bórax). Cobre-fósforo é só para cobre e latão.' })
  if (m.furos.length) d.push({ nome: `Metal de base fundido${m.furos.length > 1 ? ` (${m.furos.length}×)` : ''}`, onde: m.furos.map((f) => `${mm(f.xMm)} mm`).join(', '), grave: true,
    causa: `A peça passou de ${m.base.fusaoC} °C: na brasagem o metal de base nunca funde.`, corrigir: 'Afaste a chama, use um bico menor e não pare a chama num ponto: mova sempre.' })
  const vazios = trechos(p, (x) => m.preenchimentoEm(x) < CHEIA)
  if (vazios.length) d.push({ nome: 'Folga com vazios', onde: ondeTrechos(vazios), grave: true,
    causa: semFluxo
      ? `Sem fluxo, o óxido da superfície não deixa a liga molhar: ${FLUXOS[m.liga.fluxo].nome} é obrigatório com esta liga neste metal.`
      : p.folgaMm > BRASAGEM.folgaSeguraMm
        ? 'Folga larga demais: a capilaridade não segura a liga dentro dela.'
        : 'A liga travou antes de encher: a sobreposição estava abaixo do solidus (só a borda estava quente) ou o fluxo já tinha se gastado.',
    corrigir: semFluxo ? 'Pincele o fluxo nas duas faces antes de montar.' : 'Aqueça a sobreposição inteira por igual (a chama também sobre a chapa de cima) e só então encoste a vareta; a liga corre para o lado mais quente.' })
  const curta = trechos(p, (x) => m.preenchimentoEm(x) >= CHEIA && m.profundidadeEm(x) < 0.9 * p.sobreposicaoMm)
  if (curta.length) d.push({ nome: 'Liga não chegou ao fim da sobreposição', onde: ondeTrechos(curta), grave: false,
    causa: 'O lado de dentro da sobreposição estava mais frio que a borda: a liga para onde a peça esfria.', corrigir: 'Leve a chama um pouco para dentro, sobre a chapa de cima, antes de alimentar.' })
  if (m.emboladas) d.push({ nome: `Liga embolada (${m.emboladas}×)`, onde: 'na borda', grave: false,
    causa: semFluxo ? 'Sem fluxo, a liga não molha o metal oxidado e fica em bolas.' : 'A liga caiu em metal abaixo do solidus ou com o fluxo gasto: não molhou e ficou em bolas.',
    corrigir: 'Encoste a vareta só quando a peça (não a chama) estiver na cor de trabalho e o fluxo estiver transparente.' })
  if (m.varetaNaChama) d.push({ nome: `Vareta derretida na chama (${m.varetaNaChama}×)`, onde: 'na borda', grave: false,
    causa: 'A chama derreteu a vareta antes de a peça estar quente: a liga pinga em gotas sobre metal frio.', corrigir: 'Encoste a vareta do lado oposto à chama: é a peça quente que derrete a liga.' })
  if (m.fluxoQueimado) d.push({ nome: `Fluxo queimado (${m.fluxoQueimado}×)`, onde: 'na peça', grave: false,
    causa: `A peça passou de ${FLUXOS[m.liga.fluxo].ativoC[1]} °C: o fluxo escureceu e parou de limpar.`, corrigir: 'Mova a chama e afaste-a quando a peça passar do vermelho-cereja; um bico menor ajuda.' })
  let porosos = 0
  for (let x = p.inicioMm + 0.5; x < p.fimMm; x++) if (m.maximaC(x, 0.25) > m.liga.superaquecimentoC) porosos++
  if (m.liga.zinco && m.zincoFerveu > 0.3 && porosos) d.push({ nome: 'Poros de zinco fervido', onde: `${porosos} mm do trecho`, grave: porosos > 10,
    causa: `A liga passou de ${m.liga.superaquecimentoC} °C: o zinco dela ferveu (fumaça branca) e deixou poros.`, corrigir: 'Trabalhe no meio da faixa da liga e afaste a chama assim que ela correr.' })
  else if (!m.liga.zinco && porosos) d.push({ nome: 'Liga superaquecida', onde: `${porosos} mm do trecho`, grave: false,
    causa: `A liga passou de ${m.liga.superaquecimentoC} °C: o fósforo queima e a liga ataca o metal de base.`, corrigir: 'Afaste a chama assim que a liga correr.' })
  let zinco = 0
  for (let x = p.inicioMm + 0.5; x < p.fimMm; x++) zinco = Math.max(zinco, zincoQueimadoMm(m, x))
  if (zinco > ZINCO_TOLERADO_MM) d.push({ nome: 'Zinco queimado em volta da junta', onde: `faixa de ${mm(zinco)} mm`, grave: zinco > 10,
    causa: `A chapa passou de ${ZINCO.ebulicaoC} °C: o zinco ferveu e a chapa ficou sem proteção contra ferrugem nessa faixa.`, corrigir: 'Use liga de prata (abaixo de 907 °C) e calor concentrado na junta; repinte a faixa com tinta rica em zinco.' })
  const escorrida = m.escorrida.reduce((a, b) => a + b, 0)
  if (escorrida > 5) d.push({ nome: 'Liga escorrida', onde: 'na chapa de baixo', grave: false,
    causa: 'Vareta demais de uma vez: a folga encheu e a sobra escorreu pela chapa.', corrigir: 'Toques curtos de vareta: deixe a liga correr antes de pôr mais.' })
  return d.sort((a, b) => Number(b.grave) - Number(a.grave))
}

/**
 * O que a bancada 3D desenha depois: bolinhas da liga embolada e a cor de
 * oxidação da chapa pelo calor que ela viu (no formato da análise do eletrodo).
 */
export function analiseVisualBrasagem(m: ModeloBrasagem, n: number, passoMm: number): AnaliseDefeitos {
  const novo = () => new Float32Array(n)
  const a: AnaliseDefeitos = {
    n, passoMm, caimento: novo(), rolos: novo(), gotejamento: novo(), mordeduraMenos: novo(), mordeduraMais: novo(),
    sobreposicaoMenos: novo(), sobreposicaoMais: novo(), cratera: novo(), porosidade: novo(), calor: novo(),
    penetracaoMm: novo(), afundamento: novo(), furoMm: novo(), gotasAvesso: [], larguraAvessoMm: novo(), humping: novo(),
    escamaFase: novo(), escamaDir: new Int8Array(n), gotas: [], respingos: [], poros: [], empenoGraus: 0, limiteMordeduraMm: 1, ocorrencias: [],
  }
  for (let i = 0; i < n; i++) {
    const x = (i + 0.5) * passoMm
    // Cor de calor: começa a aparecer perto de 300 °C e fica forte acima de 700 °C.
    a.calor[i] = Math.max(0, (m.maximaC(x, 0.25) - 300) / 300)
    if (m.furos.some((f) => Math.abs(f.xMm - x) <= 1.5)) a.furoMm[i] = 2
  }
  for (let i = 0; i < m.embolada.length; i++) {
    const v = m.embolada[i]
    if (v < 0.3) continue
    const r = Math.min(1.8, Math.cbrt((3 * v) / (4 * Math.PI)))
    a.respingos.push({ xMm: i + 0.5, nMm: 1 + r, raioMm: r, lado: 1, distMm: 0.5 })
  }
  return a
}
