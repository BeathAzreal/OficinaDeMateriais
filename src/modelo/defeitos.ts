import type { Cordao } from './cordao'
import { analisarFusao, indiceDeformacao, suavizar, type PontoFusao } from './fusao'
import { INFO_JUNTA, juntaDe } from './juntas'
import { GASES, MATERIAIS } from './material'
import { DEFEITOS } from './parametros'
import type { Percurso } from './percurso'
import { correnteA, dbcpDe, type ContextoProcesso } from './processo'
import { larguraFuroMm, LIMIARES_PENETRACAO } from './consumoChapa'
import type { EventoTentativa, PontoRegistro } from './simulacao'

/*
 * Defeitos VISÍVEIS previstos pelo modelo (H50–H57), Alpha v1.4.
 *
 * Tudo é calculado depois, a partir do que a simulação já guarda (cordão,
 * percurso, registro e eventos): o mesmo registro dá sempre os mesmos
 * defeitos, no replay e em qualquer taxa de quadros. Não há simulação de
 * metal líquido: são regras simples, com a DIREÇÃO que a prática ensina
 * (o que piora o quê); os números são do jogo (DEFEITOS em parametros.ts).
 *
 * As posições de gotas, respingos e poros vêm de um sorteio FIXO por
 * fatia (hash), não de Math.random: repetir a tentativa repete o desenho.
 */

export type TipoDefeito = 'escorrimento' | 'gotejamento' | 'caimento' | 'mordedura' | 'sobreposicao' | 'respingos' | 'cratera' | 'porosidade' | 'penetracao-excessiva' | 'raiz-afundada' | 'furo' | 'humping'

export const NOME_DEFEITO: Record<TipoDefeito, string> = {
  escorrimento: 'Cordão escorrido (embarrigado)',
  gotejamento: 'Gotas penduradas (sobrecabeça)',
  caimento: 'Cordão caído para a chapa de baixo',
  mordedura: 'Mordedura na borda',
  sobreposicao: 'Sobreposição (metal sobre a chapa sem fundir)',
  respingos: 'Respingos presos na chapa',
  cratera: 'Cratera no fim do cordão',
  porosidade: 'Porosidade prevista',
  'penetracao-excessiva': 'Penetração excessiva (metal passou e pendurou no avesso)',
  'raiz-afundada': 'Raiz afundada (a poça caiu e a face ficou côncava)',
  furo: 'Furo (a chapa varou)',
  humping: 'Cordão em corcovas (humping)',
}

/** Causa típica e correção, em poucas palavras (a didática completa fica com quem exibe). */
export const CONSELHO_DEFEITO: Record<TipoDefeito, string> = {
  escorrimento: 'Poça grande demais para a vertical: baixe a corrente ou ande mais rápido; descendo, o metal corre à frente do arco.',
  gotejamento: 'Na sobrecabeça a poça precisa ser pequena: menos alimentação, avanço mais rápido.',
  caimento: 'Na horizontal o metal cai para a chapa de baixo: poça menor e tocha um pouco apontada para a chapa de cima.',
  mordedura: 'Tensão alta, avanço rápido demais ou calor demais na borda: baixe a tensão ou o avanço.',
  sobreposicao: 'Devagar demais para o calor (ou arco curto): o metal se acumula e deita sobre a chapa sem fundir. Ande mais rápido; se o arco estiver curto, suba a tensão.',
  respingos: 'Arco fora do equilíbrio (tensão × alimentação) ou CO₂ puro: equilibre a máquina.',
  cratera: 'Ao terminar, segure a tocha parada um instante antes de fechar o arco para encher a cratera.',
  porosidade: 'Gás mal protegido: arco longo, distância bico-peça grande ou superfície não limpa (óxido do alumínio, zinco do galvanizado).',
  'penetracao-excessiva': 'Calor demais para a espessura: o metal atravessou e ficou pendurado do outro lado. Ande mais rápido ou baixe a alimentação.',
  'raiz-afundada': 'A poça ficou pesada demais e caiu pela raiz: a face afunda. Menos corrente, avanço mais rápido ou curto-circuito em vez de spray.',
  furo: 'O calor atravessou a chapa e abriu um buraco. Em chapa fina: curto-circuito, avanço constante e sem parar a tocha no lugar.',
  humping: 'Rápido demais com corrente alta: a poça estica e o metal se junta em corcovas, com pescoços estreitos entre elas. Ande mais devagar ou baixe a alimentação.',
}

/**
 * H94 (v2.0): níveis de passar da chapa, pelo índice de fusão F (o calor já
 * relativo à espessura). Da raiz aparente (normal) ao metal pendurado no
 * avesso, à raiz afundada e ao furo. Números do jogo.
 */
export const PENETRACAO = {
  /** Raiz começa a aparecer no avesso (ainda adequado). */
  raizAparente: 1.6,
  /** Metal passa e pendura no avesso. */
  excesso: 2.1,
  /** Altura máxima do metal pendurado no avesso (mm). */
  penduradoMaxMm: 1.6,
  /** A poça cai: a face afunda. */
  afunda: 2.35,
  /** Metal no avesso que já é defeito (mm), na ordem do limite de raiz da ISO 5817. */
  limiteAvessoMm: 1,
}

/**
 * H98 (v2.0): humping. Com avanço rápido E corrente alta, a poça fica longa
 * e fina e o metal se junta em corcovas. Banaee et al. (2023) citam o
 * humping como limite da velocidade alta; a regra (produto das duas
 * tendências) e os números são do jogo.
 */
export const HUMPING = {
  /** Velocidade relativa (à de referência da junta) em que começa e a faixa até o máximo. */
  vRelInicio: 1.5,
  vRelFaixa: 0.8,
  /** Corrente em que começa, por mm de diâmetro do arame (A/mm), e a faixa até o máximo (A/mm). */
  correnteInicioAPorMm: 190,
  correnteFaixaAPorMm: 70,
  /** Distância entre corcovas (mm). */
  passoCorcovaMm: 7,
}

export interface OcorrenciaDefeito {
  tipo: TipoDefeito
  inicioMm: number
  fimMm: number
  /** Maior valor da grandeza no trecho e o limiar usado (critério do jogo). */
  valor: number
  limiar: number
  unidade: string
}

/** Gota pendurada ou respingo preso: posição na junta (x ao longo, n de lado) e raio. */
export interface Bolinha {
  xMm: number
  nMm: number
  raioMm: number
  /** Respingo: de que lado do cordão e a que distância da borda (mm); serve a qualquer junta. */
  lado?: -1 | 1
  distMm?: number
}

export interface Poro {
  xMm: number
  nMm: number
  /** Altura no corte (mm; 0 = face da chapa, negativo = dentro da chapa). */
  wMm: number
  raioMm: number
  /** Aberto na superfície do cordão (aparece no 3D). */
  superficie: boolean
}

export interface AnaliseDefeitos {
  /** H101: consumo térmico dos cordões fora da junta, sem agregá-los ao cordão avaliado. */
  consumosSoltos?: { centro: Float32Array; analise: AnaliseDefeitos }[]
  n: number
  passoMm: number
  /** −1…1: o perfil pende para o lado −n ou +n (horizontal, H50). */
  caimento: Float32Array
  /** 0…1: ondas de metal escorrido (vertical, H50). */
  rolos: Float32Array
  /** 0…1: tendência a gotejar (sobrecabeça, H50). */
  gotejamento: Float32Array
  /** Profundidade da mordedura em cada borda (mm, H52). */
  mordeduraMenos: Float32Array
  mordeduraMais: Float32Array
  /** 0…1: sobreposição em cada borda (H53). */
  sobreposicaoMenos: Float32Array
  sobreposicaoMais: Float32Array
  /** 0…1: profundidade relativa da cratera (H55). */
  cratera: Float32Array
  /** 0…1: risco de porosidade (H57). */
  porosidade: Float32Array
  /** Índice de fusão F por fatia (calor; cores de oxidação, H56). */
  calor: Float32Array
  /** Escamas (H56): fase em ciclos e sentido do avanço quando a tocha passou. */
  escamaFase: Float32Array
  escamaDir: Int8Array
  gotas: Bolinha[]
  respingos: Bolinha[]
  poros: Poro[]
  /** H94: metal no avesso da junta (mm): raiz aparente e, com calor demais, pendurado. */
  penetracaoMm: Float32Array
  /** H94: 0…1, quanto a face afundou porque a poça caiu pela raiz. */
  afundamento: Float32Array
  /** H94: largura do furo na fatia (mm); 0 sem furo. */
  furoMm: Float32Array
  /** H94: gotas grandes penduradas no avesso. */
  gotasAvesso: Bolinha[]
  /** H101: largura (mm) da faixa do avesso onde o metal vazou (calor acima do limite de vazar); 0 = só a raiz no meio. */
  larguraAvessoMm: Float32Array
  /** H98: 0…1, tendência a corcovas (avanço rápido com corrente alta). */
  humping: Float32Array
  /** Empeno angular previsto das chapas (graus, H57). */
  empenoGraus: number
  /** Mordedura a partir da qual vira ocorrência (mm). */
  limiteMordeduraMm: number
  ocorrencias: OcorrenciaDefeito[]
}

export interface EntradaDefeitos {
  cordao: Cordao
  percurso: Percurso
  contexto: ContextoProcesso
  /** Escamas (H56); sem ele, não há escamas. */
  registro?: readonly PontoRegistro[]
  /** Fins de passe (crateras, H55); sem eles, não há crateras. */
  eventos?: readonly EventoTentativa[]
  /** Já calculada por quem chama (evita refazer). */
  fusao?: PontoFusao[]
}

const lim01 = (v: number) => (v <= 0 ? 0 : v >= 1 ? 1 : v)

/** Sorteio fixo em [0, 1) para a fatia i e o canal k (mesma entrada → mesmo número). */
export function sorteioFixo(i: number, k: number): number {
  let h = (Math.imul(i + 1, 0x9e3779b1) ^ Math.imul(k + 7, 0x85ebca6b)) >>> 0
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d) >>> 0
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b) >>> 0
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

/** Mordedura que já conta como defeito (mm): 10 % da espessura, no mínimo 0,2 mm (ordem de grandeza da ISO 5817, nível C). */
export function limiteMordeduraMm(ctx: ContextoProcesso): number {
  return Math.max(0.2, 0.1 * ctx.espessuraMm)
}

export function analisarDefeitos(e: EntradaDefeitos): AnaliseDefeitos {
  const { cordao, percurso, contexto: ctx } = e
  const n = cordao.nPosicoes
  const passo = cordao.passoMm
  const fusao = e.fusao ?? analisarFusao(cordao, percurso, ctx)
  const junta = juntaDe(ctx)
  const vRef = INFO_JUNTA[junta].velocidadeReferenciaMms
  const novo = () => new Float32Array(n)
  const a: AnaliseDefeitos = {
    n,
    passoMm: passo,
    caimento: novo(),
    rolos: novo(),
    gotejamento: novo(),
    mordeduraMenos: novo(),
    mordeduraMais: novo(),
    sobreposicaoMenos: novo(),
    sobreposicaoMais: novo(),
    cratera: novo(),
    porosidade: novo(),
    calor: novo(),
    penetracaoMm: novo(),
    afundamento: novo(),
    furoMm: novo(),
    gotasAvesso: [],
    larguraAvessoMm: novo(),
    humping: novo(),
    escamaFase: novo(),
    escamaDir: new Int8Array(n),
    gotas: [],
    respingos: [],
    poros: [],
    empenoGraus: 0,
    limiteMordeduraMm: limiteMordeduraMm(ctx),
    ocorrencias: [],
  }

  const secoes = Array.from({ length: n }, (_, i) => cordao.secao(i))
  const comCordao = secoes.filter((s) => s.larguraMm >= 1)
  if (cordao.soltos.length) a.consumosSoltos = cordao.soltos.map(solto => ({
    centro: Float32Array.from({ length: solto.nPosicoes }, (_, i) => solto.secao(i).yCentroMm),
    analise: analisarDefeitos({ cordao: solto, percurso: solto.termico, contexto: { ...ctx, junta: 'topo', aberturaMm: 0 } }),
  }))
  if (comCordao.length === 0) return a
  // Seção típica do cordão: as pontas afinam e não devem parecer "rápidas demais".
  const areas = comCordao.map((s) => s.areaMm2).sort((x, y) => x - y)
  const areaMediana = areas[Math.floor(areas.length / 2)]
  // Velocidade local pela permanência da tocha (H20), com o mesmo espalhamento do metal (H4).
  const permanencia = suavizar(percurso.copiaDasPermanencias(), passo)

  // H35/H104: óxido do alumínio ou zinco do galvanizado deixados na junta.
  const material = MATERIAIS[ctx.material]
  const sujo = material.exigeLimpeza && !ctx.oxidoRemovido ? material.limpeza?.porosidade ?? 0 : 0
  const dbcp = dbcpDe(ctx)
  const porosidadeBase = sujo + (dbcp >= 20 ? 0.2 : dbcp > 17 ? 0.1 : 0) + (ctx.gas === 'ar' && !GASES.ar.materiais.includes(ctx.material) ? 0.15 : 0)
  const respingoGas = ctx.gas === 'co2' ? 1.6 : 1
  const respingoDbcp = dbcp >= 20 ? 0.1 : 0
  const lim = LIMIARES_PENETRACAO[ctx.material]
  // H98: corrente de cada fatia pelos ajustes de quando a tocha passou (sem registro, sem humping).
  const corrente = e.registro ? correntePorFatia(n, passo, e.registro, ctx) : null
  const iInicio = HUMPING.correnteInicioAPorMm * ctx.diametroArameMm
  const iFaixa = HUMPING.correnteFaixaAPorMm * ctx.diametroArameMm

  for (let i = 0; i < n; i++) {
    const s = secoes[i]
    const F = fusao[i]?.indice ?? 0
    a.calor[i] = F
    if (s.larguraMm < 1) continue
    const f = cordao.fisica(i)
    const instab = f.instabilidade
    // H50: tamanho da poça = metal acima da face (o que enche o chanfro pesa menos) × calor.
    const reforco = s.areaReforcoMm2 ?? s.areaMm2
    const areaPoca = reforco + 0.3 * Math.max(0, s.areaMm2 - reforco)
    const P = (areaPoca / DEFEITOS.areaPocaRefMm2) * (0.6 + 0.4 * Math.min(2, F))
    const afinamento = lim01(s.areaMm2 / (0.5 * areaMediana))
    const vRel = permanencia[i] > 0 ? Math.min(4, passo / (permanencia[i] / 1000) / vRef) : 4

    // Gravidade (H50).
    a.gotejamento[i] = lim01((P * f.cabeca - 1.0) / 0.6)
    const desc = lim01((P * Math.max(0, f.descida) - 0.9) / 0.6)
    const sub = lim01((P * Math.max(0, -f.descida) - 1.0) / 0.6)
    a.rolos[i] = Math.max(desc, sub)
    const caim = Math.sign(f.lado) * lim01((P * Math.abs(f.lado) - 0.9) / 1.0)
    a.caimento[i] = caim

    // Mordedura (H52): arco longo, avanço rápido, calor demais; na horizontal, o lado de cima.
    const u = 0.35 * lim01(instab / 0.8) + 0.3 * lim01((vRel - 1.3) / 0.7) * afinamento + 0.35 * lim01((F - 2) / 0.6)
    const base = DEFEITOS.mordeduraMaxMm * u
    const extraCima = DEFEITOS.mordeduraCaimentoMm * Math.abs(caim)
    // Gravidade para +n (caim > 0): a borda de cima é a −n.
    a.mordeduraMenos[i] = base + (caim > 0 ? extraCima : 0)
    a.mordeduraMais[i] = base + (caim < 0 ? extraCima : 0)

    // Sobreposição (H53): devagar e frio; descendo, o metal corre à frente; na horizontal, a borda de baixo.
    // Arco curto (arame demais para o calor) e devagar também deita o metal sem fundir.
    // H100: arco curto e frio (tensão baixa, arame batendo) deita o metal sem molhar as bordas em qualquer velocidade.
    const o = lim01((0.7 - vRel) / 0.4) * lim01((2.1 - F) / 0.6) + 0.5 * lim01(-instab / 0.8) * lim01((0.9 - vRel) / 0.5) + 0.6 * lim01(-instab / 0.8) * lim01((0.8 - F) / 0.4) + 0.6 * desc
    a.sobreposicaoMenos[i] = lim01(o + (caim < 0 ? 0.6 * Math.abs(caim) : 0))
    a.sobreposicaoMais[i] = lim01(o + (caim > 0 ? 0.6 * Math.abs(caim) : 0))

    // Porosidade (H57).
    const p = lim01(porosidadeBase + 0.5 * lim01((instab - 0.2) / 0.6) + 0.15 * f.cabeca)
    a.porosidade[i] = p

    // H94: passar da chapa, em níveis. No filete não há avesso livre: só o furo conta.
    if (INFO_JUNTA[junta].familia !== 'filete') {
      // H101: estágios pelo material (o alumínio quase não avisa antes de cair).
      const raiz = 0.3 * lim01((F - lim.raizAparente) / (lim.excesso - lim.raizAparente))
      const excesso = lim01((F - lim.excesso) / (lim.furo - lim.excesso))
      a.penetracaoMm[i] = raiz + PENETRACAO.penduradoMaxMm * excesso
      a.afundamento[i] = lim01((F - lim.afunda) / (lim.furo - lim.afunda))
      if (excesso > 0.3 && sorteioFixo(i, 60) < 0.4 * excesso * passo) {
        a.gotasAvesso.push({ xMm: s.xMm, nMm: s.yCentroMm + (sorteioFixo(i, 61) - 0.5) * 0.4 * s.larguraMm, raioMm: 0.5 + 0.9 * excesso * (0.6 + 0.6 * sorteioFixo(i, 62)) })
      }
    }
    // H98: humping, só onde a tocha passou rápido e com corrente alta.
    if (corrente && corrente[i] > 0) a.humping[i] = lim01((vRel - HUMPING.vRelInicio) / HUMPING.vRelFaixa) * lim01((corrente[i] - iInicio) / iFaixa)

    // H101: o buraco nasce no meio da poça (o ponto mais quente) e alarga com o calor.
    a.furoMm[i] = larguraFuroMm(F, s.larguraMm, lim.furo)
    if (INFO_JUNTA[junta].familia !== 'filete') a.larguraAvessoMm[i] = larguraFuroMm(F, s.larguraMm, lim.excesso)

    // Objetos com sorteio fixo por fatia.
    const meia = s.larguraMm / 2
    if (a.gotejamento[i] > 0.15 && sorteioFixo(i, 1) < 0.35 * a.gotejamento[i] * passo) {
      a.gotas.push({ xMm: s.xMm, nMm: s.yCentroMm + (sorteioFixo(i, 3) - 0.5) * 0.5 * s.larguraMm, raioMm: (0.5 + 0.7 * sorteioFixo(i, 2)) * (0.6 + 0.6 * a.gotejamento[i]) })
    }
    const densidade = Math.max(0, respingoGas * (1 + 1.5 * Math.abs(instab)) + respingoDbcp - 1.15) * DEFEITOS.respingosPorMm
    const esperado = densidade * passo
    for (let k = 0; k < 2; k++) {
      if (sorteioFixo(i, 10 + k) >= esperado - k) continue
      const lado: -1 | 1 = sorteioFixo(i, 20 + k) < 0.5 ? -1 : 1
      const dist = 0.5 + 10 * sorteioFixo(i, 30 + k) ** 2
      a.respingos.push({ xMm: s.xMm + (sorteioFixo(i, 40 + k) - 0.5) * passo, nMm: s.yCentroMm + lado * (meia + dist), raioMm: 0.2 + 0.35 * sorteioFixo(i, 50 + k), lado, distMm: dist })
    }
    if (p > 0.2 && sorteioFixo(i, 60) < 0.5 * p * passo * 2) {
      const topo = Math.max(0.3, s.alturaMm)
      a.poros.push({
        xMm: s.xMm,
        nMm: s.yCentroMm + (sorteioFixo(i, 61) - 0.5) * 0.6 * s.larguraMm,
        wMm: -0.5 * ctx.espessuraMm * sorteioFixo(i, 62) + 0.7 * topo * sorteioFixo(i, 63),
        raioMm: 0.12 + 0.3 * sorteioFixo(i, 64) * p,
        superficie: p > 0.5 && sorteioFixo(i, 65) < 0.3 * p,
      })
    }
  }

  if (e.registro) escamas(a, e.registro)
  if (e.eventos) crateras(a, cordao, e.eventos)

  // Empeno (H57): do índice de deformação (H36), só onde há cordão.
  const D = indiceDeformacao(fusao.filter((p) => p.estado !== 'sem-cordao'), ctx)
  a.empenoGraus = Math.min(DEFEITOS.empenoMaxGraus, DEFEITOS.empenoPorD * D)

  a.ocorrencias = ocorrencias(a, secoes)
  return a
}

/** H98: corrente (A) com que a tocha passou por cada fatia (a última passada vale; 0 onde não passou). */
function correntePorFatia(n: number, passo: number, registro: readonly PontoRegistro[], ctx: ContextoProcesso): Float32Array {
  const r = new Float32Array(n)
  for (let k = 0; k + 1 < registro.length; k++) {
    const p = registro[k]
    const q = registro[k + 1]
    if (q.tempoArcoMs <= p.tempoArcoMs) continue
    const I = correnteA(p.ajustes, ctx)
    const i0 = Math.max(0, Math.round(Math.min(p.x, q.x) / passo - 0.5))
    const i1 = Math.min(n - 1, Math.round(Math.max(p.x, q.x) / passo - 0.5))
    for (let i = i0; i <= i1; i++) r[i] = I
  }
  return r
}

/** H56: fase das escamas pelo tempo de arco em que a tocha passou por cada fatia (a última passada vale). */
function escamas(a: AnaliseDefeitos, registro: readonly PontoRegistro[]): void {
  const passo = a.passoMm
  const visto = new Uint8Array(a.n)
  for (let k = 0; k + 1 < registro.length; k++) {
    const p = registro[k]
    const q = registro[k + 1]
    const dt = q.tempoArcoMs - p.tempoArcoMs
    if (dt <= 0 || q.x === p.x) continue
    const dir = q.x > p.x ? 1 : -1
    const i0 = Math.max(0, Math.ceil(Math.min(p.x, q.x) / passo - 0.5))
    const i1 = Math.min(a.n - 1, Math.floor(Math.max(p.x, q.x) / passo - 0.5))
    for (let i = i0; i <= i1; i++) {
      const x = (i + 0.5) * passo
      const t = p.tempoArcoMs + ((x - p.x) / (q.x - p.x)) * dt
      a.escamaFase[i] = t / DEFEITOS.intervaloEscamaMs
      a.escamaDir[i] = dir
      visto[i] = 1
    }
  }
  // Fatias com metal espalhado mas sem passagem da tocha: copia a vizinha mais próxima.
  let ultimo = -1
  for (let i = 0; i < a.n; i++) {
    if (visto[i]) ultimo = i
    else if (ultimo >= 0) {
      a.escamaFase[i] = a.escamaFase[ultimo] + ((i - ultimo) * passo * a.escamaDir[ultimo]) / 1.2
      a.escamaDir[i] = a.escamaDir[ultimo]
    }
  }
  let primeiro = -1
  for (let i = a.n - 1; i >= 0; i--) {
    if (visto[i]) primeiro = i
    else if (primeiro >= 0 && a.escamaDir[i] === 0) {
      a.escamaFase[i] = a.escamaFase[primeiro] - ((primeiro - i) * passo * a.escamaDir[primeiro]) / 1.2
      a.escamaDir[i] = a.escamaDir[primeiro]
    }
  }
}

/**
 * H55: cada fim de passe deixa uma cratera, a menos que a tocha tenha ficado
 * parada ali um instante antes de fechar o arco, ou que outro passe tenha
 * coberto o lugar depois.
 */
function crateras(a: AnaliseDefeitos, cordao: Cordao, eventos: readonly EventoTentativa[]): void {
  const pontos: { t: number; x: number }[] = []
  for (const ev of eventos) {
    if (ev.tipo === 'ajustes' || ev.tipo === 'posicao') continue
    if (ev.tipo === 'inicio') pontos.length = 0
    pontos.push({ t: ev.t, x: ev.x })
    if (ev.tipo !== 'fim') continue
    const fim = ev
    // Permanência a até 0,5 mm do fim nos últimos 600 ms com o arco aberto.
    let parado = 0
    let dir = 0
    for (let k = pontos.length - 1; k > 0; k--) {
      const p = pontos[k - 1]
      const q = pontos[k]
      if (q.t < fim.t - 600) break
      if (dir === 0 && Math.abs(q.x - p.x) > 0.3) dir = Math.sign(q.x - p.x)
      if (Math.abs(p.x - fim.x) <= 0.5 && Math.abs(q.x - fim.x) <= 0.5) parado += q.t - Math.max(p.t, fim.t - 600)
    }
    pontos.length = 0
    const c0 = lim01(1 - parado / DEFEITOS.enchimentoCrateraMs)
    if (c0 <= 0) continue
    const i = cordao.indiceEm(fim.x)
    const s = cordao.secao(i)
    // Coberta por um passe depois deste.
    if (s.larguraMm < 1.5 || s.tUltimoDepositoMs > fim.t + 1) continue
    const xc = fim.x - (dir || 1) * 0.8
    const r = Math.ceil(3 / a.passoMm)
    for (let k = Math.max(0, i - r); k <= Math.min(a.n - 1, i + r); k++) {
      const x = (k + 0.5) * a.passoMm
      a.cratera[k] = Math.max(a.cratera[k], c0 * Math.exp(-(((x - xc) / 1.2) ** 2)))
    }
  }
}

function ocorrencias(a: AnaliseDefeitos, secoes: { xMm: number; larguraMm: number }[]): OcorrenciaDefeito[] {
  const lista: OcorrenciaDefeito[] = []
  const trechos = (tipo: TipoDefeito, valor: (i: number) => number, limiar: number, unidade: string, minimoMm = 1) => {
    let ini = -1
    let maior = 0
    for (let i = 0; i <= a.n; i++) {
      const v = i < a.n && secoes[i].larguraMm >= 1 ? valor(i) : 0
      if (v > limiar) {
        if (ini < 0) {
          ini = i
          maior = 0
        }
        maior = Math.max(maior, v)
      } else if (ini >= 0) {
        if ((i - ini) * a.passoMm >= minimoMm) lista.push({ tipo, inicioMm: ini * a.passoMm, fimMm: i * a.passoMm, valor: maior, limiar, unidade })
        ini = -1
      }
    }
  }
  trechos('escorrimento', (i) => a.rolos[i], 0.25, 'índice 0–1')
  trechos('gotejamento', (i) => a.gotejamento[i], 0.2, 'índice 0–1')
  trechos('caimento', (i) => Math.abs(a.caimento[i]), 0.3, 'índice 0–1')
  trechos('mordedura', (i) => Math.max(a.mordeduraMenos[i], a.mordeduraMais[i]), a.limiteMordeduraMm, 'mm')
  trechos('sobreposicao', (i) => Math.max(a.sobreposicaoMenos[i], a.sobreposicaoMais[i]), 0.3, 'índice 0–1')
  trechos('porosidade', (i) => a.porosidade[i], 0.3, 'índice 0–1')
  trechos('cratera', (i) => a.cratera[i], 0.3, 'índice 0–1', 0.5)
  trechos('penetracao-excessiva', (i) => a.penetracaoMm[i], PENETRACAO.limiteAvessoMm, 'mm no avesso')
  trechos('raiz-afundada', (i) => a.afundamento[i], 0.3, 'índice 0–1')
  trechos('furo', (i) => a.furoMm[i], 0, 'mm de largura', 0.5)
  trechos('humping', (i) => a.humping[i], 0.3, 'índice 0–1', 3)
  const comprimento = secoes.filter((s) => s.larguraMm >= 1).length * a.passoMm
  const por10 = comprimento > 0 ? (a.respingos.length / comprimento) * 10 : 0
  if (por10 > 2) {
    const xs = a.respingos.map((r) => r.xMm)
    lista.push({ tipo: 'respingos', inicioMm: Math.min(...xs), fimMm: Math.max(...xs), valor: por10, limiar: 2, unidade: 'por 10 mm' })
  }
  return lista.sort((x, y) => x.inicioMm - y.inicioMm)
}

/** Respingos presos por 10 mm de cordão. */
export function respingosPor10mm(a: AnaliseDefeitos, comprimentoComCordaoMm: number): number {
  return comprimentoComCordaoMm > 0 ? (a.respingos.length / comprimentoComCordaoMm) * 10 : 0
}

/**
 * Nota de superfície da fatia (0 a 1, H50–H55): cai aos poucos com cada
 * defeito visível; 1 sem defeitos.
 */
export function notaSuperficie(a: AnaliseDefeitos, i: number): number {
  const mm = Math.max(a.mordeduraMenos[i], a.mordeduraMais[i])
  const L = a.limiteMordeduraMm
  const perda =
    lim01((mm - 0.5 * L) / L) +
    Math.max(a.sobreposicaoMenos[i], a.sobreposicaoMais[i]) +
    0.7 * a.rolos[i] +
    0.8 * a.gotejamento[i] +
    0.6 * a.cratera[i] +
    0.5 * lim01((Math.abs(a.caimento[i]) - 0.3) / 0.7) +
    // H94: metal pendurado no avesso tira um pouco; face afundada tira mais; furo tira tudo.
    0.4 * lim01((a.penetracaoMm[i] - PENETRACAO.limiteAvessoMm) / 1) +
    0.7 * a.afundamento[i] +
    (a.furoMm[i] > 0 ? 1 : 0) +
    // H98: corcovas tiram como o escorrimento.
    0.7 * a.humping[i]
  return lim01(1 - perda)
}

/** Quanto da fusão prevista vale na fatia (H53, H57): poros e sobreposição tiram integridade. */
export function fatorIntegridade(a: AnaliseDefeitos, i: number): number {
  return (1 - 0.6 * a.porosidade[i]) * (1 - 0.4 * Math.max(a.sobreposicaoMenos[i], a.sobreposicaoMais[i])) * (1 - 0.5 * a.afundamento[i])
}

/**
 * Forma do domo com os defeitos (H50, H53): fator da altura no ponto r
 * (−1 borda −n … 1 borda +n). Sobreposição deixa a borda "enrolada" (mais
 * íngreme); o caimento pende o metal para um lado. Sem defeito: 1 − r².
 */
export function formaDomo(r: number, caimento: number, sobMenos: number, sobMais: number): number {
  const sob = r < 0 ? sobMenos : sobMais
  const p = 2 + 3 * sob
  const base = 1 - Math.abs(r) ** p
  return Math.max(0, base * (1 + 0.7 * caimento * r))
}
