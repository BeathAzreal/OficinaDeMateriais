import type { FormatoJunta } from './junta'
import type { PosicaoPeca, TipoJunta } from './juntas'
import { GASES, type GasId, type MaterialId } from './material'
import { AJUSTES, DBCP, EQUILIBRIO, MODELO, MOVIMENTO, VELOCIDADE } from './parametros'

/**
 * Relações entre os ajustes da máquina e o modelo do cordão.
 * Funções puras: mesmos ajustes → mesmo resultado. Veja H1, H9, H10 e H11
 * em docs/HIPOTESES.md.
 */

/** Posições dos botões da máquina (1 a 10, unidades do jogo). */
export interface Ajustes {
  readonly alimentacao: number
  readonly tensao: number
}

export const AJUSTES_PADRAO: Ajustes = {
  alimentacao: AJUSTES.alimentacaoReferencia,
  tensao: AJUSTES.tensaoReferencia,
}

/**
 * O que a missão e a preparação definem além dos botões (H27, H35).
 * Fica fixo durante uma tentativa.
 */
export interface ContextoProcesso {
  readonly material: MaterialId
  readonly espessuraMm: number
  /** Abertura entre as bordas da junta de topo. */
  readonly aberturaMm: number
  readonly diametroArameMm: number
  readonly gas: GasId
  /** Óxido removido antes de soldar (só faz diferença no alumínio). */
  readonly oxidoRemovido: boolean
  /** Técnica de deslocamento (H38). Ausente = neutra (dados antigos). */
  readonly tecnica?: Tecnica
  /** Movimento da tocha (H39). Ausente = linha reta (dados antigos). */
  readonly movimento?: Movimento
  /** Formato da junta vista de cima (H41). Só dados antigos: a junta agora é sempre reta. */
  readonly formato?: FormatoJunta
  /** Tipo de junta (H46). Ausente = topo reto (dados antigos). */
  readonly junta?: TipoJunta
  /** Como a peça chega para soldar (H47). Ausente = plana. */
  readonly posicaoInicial?: PosicaoPeca
  /** A peça está presa na estrutura e não pode ser girada nem tombada (H47). */
  readonly posicaoFixa?: boolean
  /**
   * Distância bico de contato–peça, DBCP/CTWD (mm, H48). Ausente = 15 mm, o
   * valor em que o modelo foi calibrado (dados antigos ficam iguais).
   */
  readonly dbcpMm?: number
  /**
   * H103: a junta é a emenda de topo entre dois tubos (solda em volta). A
   * junta de 150 mm é a circunferência desenrolada: diâmetro externo ≈ 47,7
   * mm (tubo de 1½"). Ausente = chapas planas.
   */
  readonly tubo?: { readonly diametroMm: number }
}

/** H48: DBCP usada pelo modelo; valores fora da faixa do jogo voltam ao padrão. */
export function dbcpDe(ctx: ContextoProcesso): number {
  const d = ctx.dbcpMm
  return typeof d === 'number' && Number.isFinite(d) && d >= DBCP.minimoMm && d <= DBCP.maximoMm ? d : DBCP.referenciaMm
}

/** H38: inclinação da tocha no sentido do deslocamento. */
export type Tecnica = 'empurrando' | 'neutra' | 'puxando'
export const TECNICAS: Tecnica[] = ['empurrando', 'neutra', 'puxando']

/**
 * Ângulo de avanço (H38): inclinação da tocha no plano que contém a junta,
 * medida da normal à face. Positivo = empurrando (a tocha aponta para onde
 * vai). O jogo usa só três posições; 20° fica na faixa usual de 10–20° das
 * apostilas. Os fatores de forma e fusão são do jogo.
 */
export const INFO_TECNICA: Record<Tecnica, { nome: string; resumo: string; anguloAvancoGraus: number; forma: number; fusao: number }> = {
  empurrando: { nome: 'Empurrando', resumo: 'Tocha inclinada para a frente: cordão mais largo e baixo, menos fusão.', anguloAvancoGraus: 20, forma: 0.88, fusao: 0.9 },
  neutra: { nome: 'Neutra', resumo: 'Tocha a prumo: comportamento de referência.', anguloAvancoGraus: 0, forma: 1, fusao: 1 },
  puxando: { nome: 'Puxando', resumo: 'Tocha inclinada para trás: cordão mais alto e estreito, mais fusão.', anguloAvancoGraus: -20, forma: 1.12, fusao: 1.12 },
}

export function tecnicaDe(ctx: ContextoProcesso): Tecnica {
  return ctx.tecnica ?? 'neutra'
}

/** H39: oscilação lateral da tocha sobre a junta (tecimento). */
export type Movimento = 'reto' | 'zigue-zague' | 'meia-lua' | 'circulos'
export const MOVIMENTOS: Movimento[] = ['reto', 'zigue-zague', 'meia-lua', 'circulos']

/** k: espalhamento lateral σ = amplitude × k (H39). */
export const INFO_MOVIMENTO: Record<Movimento, { nome: string; resumo: string; k: number }> = {
  reto: { nome: 'Linha reta', resumo: 'A tocha segue a junta sem oscilar: cordão estreito, calor concentrado no centro.', k: 0 },
  'zigue-zague': { nome: 'Zigue-zague', resumo: 'Vaivém lateral contínuo: cordão mais largo e baixo, calor mais espalhado. Avance mais devagar.', k: 0.58 },
  'meia-lua': { nome: 'Meia-lua', resumo: 'Arcos com pausa nas pontas: o mais largo, cobre melhor as bordas, funde menos no centro.', k: 0.8 },
  circulos: { nome: 'Círculos', resumo: 'Pequenos círculos sobre a junta: largura intermediária entre zigue-zague e meia-lua.', k: 0.71 },
}

export function movimentoDe(ctx: ContextoProcesso): Movimento {
  return ctx.movimento ?? 'reto'
}

/** σ lateral que o movimento escolhido acrescenta a cada depósito (mm, H39). */
export function espalhamentoDoMovimento(ctx: ContextoProcesso): number {
  return MOVIMENTO.amplitudeMm * INFO_MOVIMENTO[movimentoDe(ctx)].k
}

/**
 * Deslocamento visual da tocha no instante t (só desenho, H39): o modelo usa
 * apenas o espalhamento médio, não a posição instantânea da oscilação.
 */
export function oscilacaoVisual(m: Movimento, tMs: number): { dx: number; dy: number } {
  const A = MOVIMENTO.amplitudeMm
  const fase = ((tMs / 1000) * MOVIMENTO.frequenciaVisualHz) % 1
  if (m === 'zigue-zague') return { dx: 0, dy: A * (fase < 0.5 ? 4 * fase - 1 : 3 - 4 * fase) }
  if (m === 'meia-lua') {
    // Meia volta de um lado a outro com pausa de 20 % em cada ponta.
    const meio = fase < 0.5 ? fase * 2 : (fase - 0.5) * 2
    const u = Math.min(1, Math.max(0, (meio - 0.2) / 0.6))
    const lado = fase < 0.5 ? -1 : 1
    const ang = Math.PI * u
    return { dx: -A * 0.4 * Math.sin(ang), dy: lado * A * Math.cos(ang) }
  }
  if (m === 'circulos') return { dx: A * 0.8 * Math.cos(2 * Math.PI * fase), dy: A * Math.sin(2 * Math.PI * fase) }
  return { dx: 0, dy: 0 }
}

/**
 * O contexto do modo livre das etapas 1–4: reproduz exatamente o modelo
 * antigo, cordão sobre chapa (sem fresta). Desde a v1.3 o metal enche a
 * fresta da junta de topo antes de virar reforço; com abertura 0 nada muda.
 */
export const CONTEXTO_PADRAO: ContextoProcesso = {
  material: 'aco-carbono',
  espessuraMm: 3,
  aberturaMm: 0,
  diametroArameMm: 1,
  gas: 'ar-co2',
  oxidoRemovido: true,
}

export function limitarAjustes(a: Ajustes): Ajustes {
  const limitar = (v: number, min: number) => Math.min(AJUSTES.maximo, Math.max(min, v))
  // H100: a tensão desce até 0 V (abaixo do botão 1); a alimentação continua de 1 a 10.
  return { alimentacao: limitar(a.alimentacao, AJUSTES.minimo), tensao: limitar(a.tensao, botaoDaTensao(MAQUINA.tensaoMinV)) }
}

/**
 * H1: volume de arame que a máquina empurra por segundo, RELATIVO (1 =
 * alimentação 5 com arame de 1,0 mm): velocidade do arame × seção do arame.
 * É conservação de massa: não depende da tensão nem da DBCP.
 */
export function volumeArameRelativo(a: Ajustes, ctx: ContextoProcesso = CONTEXTO_PADRAO): number {
  return (a.alimentacao / AJUSTES.alimentacaoReferencia) * ctx.diametroArameMm ** 2
}

/**
 * H28 (revista na v1.3) + H48: corrente RELATIVA (1 = alimentação 5, arame
 * de 1,0 mm, DBCP 15 mm). Numa fonte de tensão constante a corrente não é um
 * botão: é a que funde o arame na velocidade em que ele chega. Forma da
 * relação de fusão do eletrodo (Lesnewich, 1958): volume fundido = a·I +
 * b·L·I²/A — o arco (∝ I) mais o aquecimento resistivo do arame livre
 * (∝ L·I²/A, A = seção do arame). Normalizada na referência, com a fração
 * resistiva DBCP.fracaoResistiva (número do jogo):
 *   V = (1 − r)·i + r·(L/L₀)·i²/d²  →  i = raiz positiva.
 * Consequências (direção documentada; números do jogo): a corrente cresce
 * menos que a alimentação; mais DBCP → menos corrente para o mesmo arame.
 */
export function correnteRelativa(a: Ajustes, ctx: ContextoProcesso = CONTEXTO_PADRAO): number {
  const v = volumeArameRelativo(a, ctx)
  if (v <= 0) return 0
  const r = DBCP.fracaoResistiva
  const b = (r * (dbcpDe(ctx) / DBCP.referenciaMm)) / ctx.diametroArameMm ** 2
  return (-(1 - r) + Math.sqrt((1 - r) ** 2 + 4 * b * v)) / (2 * b)
}

/**
 * H1 + H29: volume depositado por segundo ∝ volume de arame × rendimento do
 * gás. Tensão e DBCP não entram, exceto (H100) abaixo de 14 V: com o arame
 * batendo, parte vira pedaço solto e respingo; sem arco, nada funde.
 */
export function taxaDeposicao(a: Ajustes, ctx: ContextoProcesso = CONTEXTO_PADRAO): number {
  return MODELO.taxaDeposicaoMm3s * volumeArameRelativo(a, ctx) * GASES[ctx.gas].rendimento * fatorDeposicaoTensao(a)
}

/** H100: 1 de 14 V para cima; de 0,6 a 1 com o arame batendo (10–14 V); 0 sem arco. */
export function fatorDeposicaoTensao(a: Ajustes): number {
  if (a.tensao >= AJUSTES.minimo) return 1
  const v = tensaoV(a.tensao)
  if (v < MAQUINA.tensaoArcoMinV) return 0
  return 0.6 + (0.4 * (v - MAQUINA.tensaoArcoMinV)) / (MAQUINA.tensaoAncoraV - MAQUINA.tensaoArcoMinV)
}

/**
 * H31: potência relativa do arco = corrente relativa × tensão relativa (a
 * forma U·I da energia do arco; o aporte por mm divide pela velocidade, H33).
 */
export function potenciaRelativa(a: Ajustes, ctx: ContextoProcesso = CONTEXTO_PADRAO): number {
  return correnteRelativa(a, ctx) * fatorTensaoPotencia(a)
}

/**
 * Tensão relativa na potência (H31). De 14 a 30 V é a posição do botão ÷ a
 * de referência, como sempre. H100: abaixo de 14 V o arco mal se sustenta e
 * o calor cai em linha até zero no limite em que o arco não se forma.
 */
export function fatorTensaoPotencia(a: Ajustes): number {
  if (a.tensao >= AJUSTES.minimo) return a.tensao / AJUSTES.tensaoReferencia
  const v = tensaoV(a.tensao)
  const f = (v - MAQUINA.tensaoArcoMinV) / (MAQUINA.tensaoAncoraV - MAQUINA.tensaoArcoMinV)
  return (AJUSTES.minimo / AJUSTES.tensaoReferencia) * Math.max(0, Math.min(1, f))
}

/** H9 + H38: forma da seção considerando também a técnica de deslocamento. */
export function razaoEfetiva(a: Ajustes, ctx: ContextoProcesso = CONTEXTO_PADRAO): number {
  return razaoAlturaLargura(a) * INFO_TECNICA[tecnicaDe(ctx)].forma
}

/**
 * H9: mais tensão → cordão mais achatado (razão altura/largura menor).
 * Interpolação linear entre os extremos do botão — forma escolhida para o
 * jogo, só a DIREÇÃO da tendência é o que se quer mostrar.
 */
export function razaoPelaTensao(a: Ajustes): number {
  const f = (a.tensao - AJUSTES.minimo) / (AJUSTES.maximo - AJUSTES.minimo)
  // H100: abaixo de 14 V continua subindo (cordão alto e estreito, "corda"), até o limite do jogo.
  return Math.min(MODELO.razaoTensaoBaixa, MODELO.razaoTensaoMinima + (MODELO.razaoTensaoMaxima - MODELO.razaoTensaoMinima) * f)
}

/**
 * H98: mais arame (e a corrente que vem com ele) → poça maior e mais
 * molhada, cordão mais achatado. Direção da Tabela 3 de Banaee et al. (2023):
 * na mesma velocidade, h/w caiu de 0,39 (1,8 m/min) para 0,28 (4,6 m/min).
 * Os coeficientes do artigo não são transferidos (outro arame, outra
 * máquina): o expoente e os limites são do jogo, mais suaves que o artigo.
 * 1 na alimentação de referência.
 */
export function fatorFormaAlimentacao(a: Ajustes): number {
  const r = Math.max(0.05, a.alimentacao / AJUSTES.alimentacaoReferencia)
  return Math.min(MODELO.formaAlimentacaoMax, Math.max(MODELO.formaAlimentacaoMin, r ** -MODELO.formaAlimentacaoExpoente))
}

/** H9 + H98: razão altura/largura pela tensão e pela alimentação. */
export function razaoAlturaLargura(a: Ajustes): number {
  return razaoPelaTensao(a) * fatorFormaAlimentacao(a)
}

export type CondicaoArco = 'curto' | 'equilibrado' | 'longo'

export interface EquilibrioArco {
  /** Tensão que o jogo considera equilibrada para esta alimentação. */
  tensaoEquilibrio: number
  /** tensão − tensão de equilíbrio, em pontos de botão. */
  desvio: number
  condicao: CondicaoArco
}

/**
 * H10 + H30: mais corrente pede mais tensão. Fora da tolerância o arco fica
 * "curto" ou "longo". Isso só gera aviso e efeito visual.
 */
export function equilibrioArco(a: Ajustes, ctx: ContextoProcesso = CONTEXTO_PADRAO): EquilibrioArco {
  const alimentacaoEquivalente = correnteRelativa(a, ctx) * AJUSTES.alimentacaoReferencia
  const reta = EQUILIBRIO.base + EQUILIBRIO.inclinacao * alimentacaoEquivalente
  // H93: acima da corrente de transição, com argônio, o arco certo é o do spray (~1 V acima do limiar).
  const spray = ctx.gas !== 'co2' && correnteA(a, ctx) >= MAQUINA.transicaoSprayA * ctx.diametroArameMm
  const tensaoEquilibrio = spray ? Math.max(reta, botaoDaTensao(MAQUINA.tensaoSprayV + 1)) : reta
  const desvio = a.tensao - tensaoEquilibrio
  const condicao: CondicaoArco =
    desvio < -EQUILIBRIO.tolerancia ? 'curto' : desvio > EQUILIBRIO.tolerancia ? 'longo' : 'equilibrado'
  return { tensaoEquilibrio, desvio, condicao }
}

/**
 * H11/H17: a meta do jogo é uma faixa fixa de ÁREA de seção — a que se obtém
 * com a alimentação de referência andando dentro da faixa-alvo de velocidade.
 */
export function areaAlvo(): { minMm2: number; maxMm2: number } {
  return {
    minMm2: MODELO.taxaDeposicaoMm3s / VELOCIDADE.alvoMaxMms,
    maxMm2: MODELO.taxaDeposicaoMm3s / VELOCIDADE.alvoMinMms,
  }
}

/** H11: a meta é um tamanho de seção fixo, então a faixa de velocidade acompanha a taxa de deposição. */
export function faixaVelocidadeAlvo(a: Ajustes, ctx: ContextoProcesso = CONTEXTO_PADRAO): { minMms: number; maxMms: number } {
  const fator = taxaDeposicao(a, ctx) / MODELO.taxaDeposicaoMm3s
  return { minMms: VELOCIDADE.alvoMinMms * fator, maxMms: VELOCIDADE.alvoMaxMms * fator }
}

/*
 * H93 (v2.0): a máquina em unidades reais. Por dentro o jogo continua com as
 * posições de botão de 1 a 10 (o que fica salvo nos registros não muda); o
 * painel mostra e regula em volts e m/min, numa escala linear de máquina de
 * oficina: 14–30 V e 1–15 m/min. Com arame de 1,0 mm, a referência (5 / 5,5)
 * vira 7,2 m/min e 22 V, perto de ~170 A. Números do jogo, não de catálogo.
 */
export const MAQUINA = {
  /** H100: o painel vai de 0 V; o botão 1 continua sendo 14 V (âncora da escala). */
  tensaoMinV: 0,
  tensaoAncoraV: 14,
  /** H100: abaixo disso o arco não se forma (o arame só bate na chapa); até a âncora, o arame bate e mergulha na poça. */
  tensaoArcoMinV: 10,
  tensaoMaxV: 30,
  passoV: 0.5,
  alimentacaoMinMMin: 1,
  alimentacaoMaxMMin: 15,
  passoMMin: 0.5,
  /** Corrente na alimentação de referência com arame de 1,0 mm (A). */
  correnteReferenciaA: 170,
  /** Corrente de transição para spray com arame de 1,0 mm e mistura com argônio (A); proporcional ao diâmetro. */
  transicaoSprayA: 190,
  /** Spray pede arco longo o bastante; curto-circuito só com tensão baixa. */
  tensaoSprayV: 24,
  tensaoCurtoMaxV: 22.5,
} as const

const escalaV = (MAQUINA.tensaoMaxV - MAQUINA.tensaoAncoraV) / (AJUSTES.maximo - AJUSTES.minimo)
const escalaM = (MAQUINA.alimentacaoMaxMMin - MAQUINA.alimentacaoMinMMin) / (AJUSTES.maximo - AJUSTES.minimo)
export const tensaoV = (botao: number): number => MAQUINA.tensaoAncoraV + (botao - AJUSTES.minimo) * escalaV
export const botaoDaTensao = (v: number): number => AJUSTES.minimo + (v - MAQUINA.tensaoAncoraV) / escalaV
export const alimentacaoMMin = (botao: number): number => MAQUINA.alimentacaoMinMMin + (botao - AJUSTES.minimo) * escalaM
export const botaoDaAlimentacao = (mMin: number): number => AJUSTES.minimo + (mMin - MAQUINA.alimentacaoMinMMin) / escalaM
const fmt = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
export const textoTensao = (botao: number): string => `${fmt(tensaoV(botao))} V`
export const textoAlimentacao = (botao: number): string => `${fmt(alimentacaoMMin(botao))} m/min`

/** H93: corrente estimada (A): a corrente relativa (H28/H48) na escala de uma máquina de oficina. */
export function correnteA(a: Ajustes, ctx: ContextoProcesso = CONTEXTO_PADRAO): number {
  // H100: sem arco não passa corrente (o arame só encosta e é empurrado).
  if (tensaoV(a.tensao) < MAQUINA.tensaoArcoMinV) return 0
  return MAQUINA.correnteReferenciaA * correnteRelativa(a, ctx)
}

export type ModoTransferencia = 'sem-arco' | 'arame-batendo' | 'curto-circuito' | 'globular' | 'spray'
export const NOME_TRANSFERENCIA: Record<ModoTransferencia, string> = { 'sem-arco': 'Sem arco', 'arame-batendo': 'Arame batendo', 'curto-circuito': 'Curto-circuito', globular: 'Globular', spray: 'Spray (aerossol)' }
export const EXPLICA_TRANSFERENCIA: Record<ModoTransferencia, string> = {
  'sem-arco': 'Tensão baixa demais para abrir o arco: o arame sai do bico, bate na chapa e empurra a tocha. Nada funde. Suba a tensão.',
  'arame-batendo': 'O arco quase não se sustenta: o arame mergulha na poça e bate na chapa aos trancos. Pouco calor, respingo grosso e um cordão alto e estreito que não funde as bordas. Suba a tensão.',
  'curto-circuito': 'Arame encosta na poça e funde em curtos: pouco calor, bom para chapa fina e fora da posição plana.',
  globular: 'Gotas grandes e irregulares caem pelo arco: mais respingo e cordão irregular. Suba a tensão e a alimentação para o spray (com argônio) ou desça para o curto-circuito.',
  spray: 'Gotas finas em jato, sem respingo e com muito calor: cordão liso e penetração funda. Fura chapa fina e escorre fora da posição plana.',
}

/**
 * H93: modo de transferência pelo par tensão × corrente e pelo gás. Spray só
 * com argônio na mistura, corrente acima da transição (proporcional ao
 * diâmetro do arame) e arco longo o bastante; CO₂ puro fica no globular.
 */
export function modoTransferencia(a: Ajustes, ctx: ContextoProcesso = CONTEXTO_PADRAO): ModoTransferencia {
  const v = tensaoV(a.tensao), i = correnteA(a, ctx)
  if (v < MAQUINA.tensaoArcoMinV) return 'sem-arco'
  if (v < MAQUINA.tensaoAncoraV) return 'arame-batendo'
  const transicao = MAQUINA.transicaoSprayA * ctx.diametroArameMm
  if (ctx.gas !== 'co2' && i >= transicao && v >= MAQUINA.tensaoSprayV) return 'spray'
  if (v <= MAQUINA.tensaoCurtoMaxV && i < transicao * 1.1) return 'curto-circuito'
  return 'globular'
}

/**
 * H93: o que o modo de transferência faz na solda (multiplica o calor que
 * funde e soma uma instabilidade mínima do arco: respingo, cordão irregular).
 */
export const EFEITO_TRANSFERENCIA: Record<ModoTransferencia, { calor: number; instabilidade: number }> = {
  // H100: o calor baixo já vem da potência (fatorTensaoPotencia); aqui só a instabilidade.
  'sem-arco': { calor: 1, instabilidade: 0 },
  'arame-batendo': { calor: 1, instabilidade: 0 },
  'curto-circuito': { calor: 1, instabilidade: 0 },
  globular: { calor: 1.05, instabilidade: 0.4 },
  spray: { calor: 1.25, instabilidade: 0 },
}

