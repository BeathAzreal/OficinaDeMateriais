import { MATERIAIS, type MaterialId } from './material'

/*
 * Brasagem forte com maçarico oxiacetilênico (H105). O metal de base NÃO
 * funde: a chama aquece a junta até a faixa de trabalho da liga, e a liga,
 * derretida pelo calor da PEÇA (não da chama), corre por capilaridade para
 * dentro da folga entre as chapas sobrepostas, puxada para onde está mais
 * quente. Temperaturas de liga, fluxo e metal de base são as de catálogo
 * (AWS A5.8, fichas de fabricantes); calor, escoamento e desgaste do fluxo
 * são números do jogo. O campo de calor é o do TIG (H92): condução no plano
 * e perda para o resto da peça, em subpassos fixos.
 */

export type LigaId = 'cu-p' | 'prata-45' | 'latao'
export type FluxoId = 'branco' | 'borax'
export type ChamaId = 'neutra' | 'oxidante' | 'carburante'

export interface Liga {
  id: LigaId
  nome: string
  norma: string
  /** Começa a fundir (°C). */
  solidusC: number
  /** Toda líquida (°C). */
  liquidusC: number
  /** Faixa de trabalho recomendada (°C): a peça precisa estar aqui para a liga correr. */
  trabalhoC: [number, number]
  /** Acima disto a liga se estraga: o zinco ferve (poros, fumaça branca) ou o fósforo queima (°C). */
  superaquecimentoC: number
  /** A liga tem zinco (ferve quando superaquecida). */
  zinco: boolean
  /** Liga com fósforo: limpa o cobre sozinha, mas forma fosfeto frágil no aço. */
  fosforo: boolean
  /** Fluxo que a liga pede (no cobre, a de fósforo dispensa). */
  fluxo: FluxoId
  /** Diâmetro da vareta (mm). */
  varetaMm: number
  /** Cor da liga solidificada. */
  cor: string
}

export const LIGAS: Record<LigaId, Liga> = {
  'cu-p': {
    id: 'cu-p', nome: 'Cobre-fósforo (Cu-7P)', norma: 'AWS BCuP-2',
    solidusC: 710, liquidusC: 795, trabalhoC: [735, 840], superaquecimentoC: 870,
    zinco: false, fosforo: true, fluxo: 'branco', varetaMm: 2, cor: '#c98b62',
  },
  'prata-45': {
    id: 'prata-45', nome: 'Prata 45 % (Ag-Cu-Zn)', norma: 'AWS BAg-5',
    solidusC: 663, liquidusC: 743, trabalhoC: [745, 845], superaquecimentoC: 870,
    zinco: true, fosforo: false, fluxo: 'branco', varetaMm: 1.6, cor: '#d9d9d6',
  },
  latao: {
    id: 'latao', nome: 'Latão (Cu-Zn-Sn)', norma: 'AWS RBCuZn-A',
    solidusC: 888, liquidusC: 899, trabalhoC: [910, 955], superaquecimentoC: 980,
    zinco: true, fosforo: false, fluxo: 'borax', varetaMm: 2.4, cor: '#d6b04a',
  },
}

export interface Fluxo {
  nome: string
  /** Faixa em que o fluxo derrete e limpa o óxido (°C). Abaixo, é pasta ou pó que só protege. */
  ativoC: [number, number]
  /** Quanto dura ativo, limpando, com chama neutra (s). Número do jogo. */
  vidaS: number
}

export const FLUXOS: Record<FluxoId, Fluxo> = {
  branco: { nome: 'Fluxo branco (AWS FB3-A)', ativoC: [565, 870], vidaS: 60 },
  borax: { nome: 'Fluxo de bórax (AWS FB3-D)', ativoC: [760, 1150], vidaS: 90 },
}

/** Chama: calor relativo e quanto oxida a superfície. */
export const CHAMAS: Record<ChamaId, { nome: string; calor: number; oxida: number; resumo: string }> = {
  neutra: { nome: 'Neutra', calor: 1, oxida: 1, resumo: 'Dardo bem definido, sem pena: a chama de trabalho da brasagem.' },
  oxidante: { nome: 'Oxidante', calor: 1.1, oxida: 3, resumo: 'Oxigênio sobrando: mais quente e ruidosa, oxida a peça. Levemente oxidante só no latão (segura o zinco).' },
  carburante: { nome: 'Carburante', calor: 0.85, oxida: 0.4, resumo: 'Acetileno sobrando (pena em volta do dardo): mais fria, deixa fuligem.' },
}

/**
 * Bico do maçarico: potência que chega à peça com a chama no ponto (W) e
 * comprimento do dardo (mm). Números do jogo, na ordem dos bicos de
 * brasagem oxiacetilênica (1 = chapa fina, 5 = tubo grosso de cobre).
 */
export const BICOS = [
  { n: 1, potenciaW: 1100, dardoMm: 2 },
  { n: 2, potenciaW: 1800, dardoMm: 2.5 },
  { n: 3, potenciaW: 2700, dardoMm: 3 },
  { n: 4, potenciaW: 4300, dardoMm: 3.5 },
  { n: 5, potenciaW: 6200, dardoMm: 4 },
] as const

/** Metal de base na brasagem: fusão (°C) e se é aço (o fósforo da liga fragiliza). */
export const BASE_BRASAGEM: Partial<Record<MaterialId, { fusaoC: number; ferroso: boolean; oxidaDesdeC: number }>> = {
  'aco-carbono': { fusaoC: 1510, ferroso: true, oxidaDesdeC: 400 },
  'aco-galvanizado': { fusaoC: 1510, ferroso: true, oxidaDesdeC: 400 },
  'inox-austenitico': { fusaoC: 1400, ferroso: true, oxidaDesdeC: 450 },
  cobre: { fusaoC: 1083, ferroso: false, oxidaDesdeC: 300 },
}

/** Zinco do galvanizado: derrete e, acima de 907 °C, ferve e some da superfície. */
export const ZINCO = { fusaoC: 420, ebulicaoC: 907 } as const

export const BRASAGEM = {
  ambienteC: 25,
  /** Distância boa do bico à peça: a ponta do dardo fica a 5–15 mm (mm). */
  distanciaMinMm: 0,
  distanciaMaxMm: 60,
  /** Acima disto a chama mal aquece. */
  distanciaLongeMm: 35,
  /** A vareta derrete na própria chama quando recebe esta fração do calor do centro da chama. */
  varetaNaChama: 0.35,
  /** Vareta que derrete na peça quente (mm de vareta por segundo, com a peça no liquidus + 30 °C). */
  fusaoVaretaMmS: 10,
  /** Velocidade da liga correndo pela folga certa, com a peça quente (mm/s). Número do jogo. */
  capilarMmS: 25,
  /** Folga ideal (mm) e quanto ela tolera (desvio no logaritmo). */
  folgaIdealMm: 0.075,
  folgaTolerancia: 0.45,
  /** Acima desta folga a capilaridade não segura a liga: sobram vazios (mm). */
  folgaSeguraMm: 0.15,
  /** Seção do filete na borda (mm²): abaixo, falta; acima do máximo a liga escorre. */
  fileteBomMm2: [0.4, 2.5] as [number, number],
  fileteMaxMm2: 4,
  /** Fluxo acima da faixa ativa: queima em tantos segundos. */
  queimaFluxoS: 0.8,
  /** Oxidação por segundo (fração) a 400 °C acima de onde o metal começa a oxidar, sem fluxo e com chama neutra. */
  oxidacao: 0.6,
  varetaInicialMm: 250,
} as const

const NX = 150, NY = 90, DX = 1, DY = 0.5, Y0 = -25
const PASSO = 1 / 120

export interface PecaBrasagemBase {
  material: MaterialId
  espessuraMm: number
  /** Comprimento da sobreposição medido da borda para dentro (mm). */
  sobreposicaoMm: number
  folgaMm: number
  inicioMm: number
  fimMm: number
}

export interface PreparoBrasagem {
  liga: LigaId
  fluxo: boolean
  bico: number
  chama: ChamaId
}

export type EventoBrasagem = 'vareta-na-chama' | 'liga-embolou' | 'fluxo-queimou' | 'zinco-ferveu' | 'furo'

/** Fração da capilaridade pela folga: máxima perto de 0,075 mm, cai para folga apertada ou larga. */
export function fatorFolga(folgaMm: number): number {
  const r = Math.log(folgaMm / BRASAGEM.folgaIdealMm)
  return Math.exp(-(r * r) / (2 * BRASAGEM.folgaTolerancia ** 2))
}

/** Mobilidade da liga pela temperatura: zero no solidus, cheia 20 °C acima do liquidus. */
export function mobilidade(l: Liga, temperaturaC: number): number {
  return Math.max(0, Math.min(1, (temperaturaC - l.solidusC) / (l.liquidusC + 20 - l.solidusC)))
}

/** A liga dispensa fluxo neste metal (fósforo no cobre). */
export function autoFluxante(l: Liga, material: MaterialId): boolean {
  return l.fosforo && material === 'cobre'
}

export class ModeloBrasagem {
  /** Subida de temperatura acima do ambiente (K). */
  readonly temperatura = new Float64Array(NX * NY)
  readonly maxima = new Float64Array(NX * NY)
  private readonly aux = new Float64Array(NX * NY)
  /** Fluxo que resta (0–1) e óxido na superfície (0–1). */
  readonly fluxo = new Float64Array(NX * NY)
  readonly oxido = new Float64Array(NX * NY)
  /** Liga na folga, em fração do volume da célula: líquida e já solidificada; poros do zinco fervido. */
  readonly liquida = new Float64Array(NX * NY)
  readonly solida = new Float64Array(NX * NY)
  readonly poros = new Float64Array(NX * NY)
  private readonly fluxoLiga = new Float64Array(NX * NY)
  /** Filete na borda da chapa de cima (mm² de seção), por mm de junta. */
  readonly filete = new Float64Array(NX)
  /** Liga que embolou (não molhou) e que escorreu, por mm de junta (mm³). */
  readonly embolada = new Float64Array(NX)
  readonly escorrida = new Float64Array(NX)
  readonly material
  readonly base
  readonly liga: Liga
  readonly preparo: PreparoBrasagem
  xMm = 75
  yMm = -2
  /** Distância do bico à peça (mm). */
  distanciaMm = 15
  /** Chama sobre a peça (botão segurado ou caneta encostada); solta, o maçarico se afasta. */
  naPeca = false
  /** Ponta da vareta, na borda da chapa de cima. */
  varetaXMm = 90
  encostarVareta = false
  varetaRestanteMm: number = BRASAGEM.varetaInicialMm
  tempoChamaS = 0
  sentido = 1
  velocidadeMmS = 0
  /** Contagens de eventos. */
  varetaNaChama = 0
  emboladas = 0
  fluxoQueimado = 0
  zincoFerveu = 0
  furos: { xMm: number; yMm: number }[] = []
  /** Liga derretida e consumida (mm de vareta). */
  ligaUsadaMm = 0
  private resto = 0
  private xAnterior = 75
  private naChamaAntes = false
  private ultimaQueima = -Infinity

  constructor(readonly peca: PecaBrasagemBase, preparo: PreparoBrasagem) {
    const termico = MATERIAIS[peca.material].tig ?? MATERIAIS['aco-carbono'].tig!
    const base = BASE_BRASAGEM[peca.material]
    if (!base) throw new Error(`${MATERIAIS[peca.material].nome} não vai à brasagem no jogo.`)
    this.material = termico
    this.base = base
    this.preparo = { ...preparo }
    this.liga = LIGAS[preparo.liga]
    // Fluxo pincelado nas duas faces e na folga antes de montar (até 15 mm da borda).
    if (preparo.fluxo) for (let j = 0; j < NY; j++) { const y = Y0 + (j + 0.5) * DY; if (y > -peca.sobreposicaoMm - 3 && y < 15) for (let i = 0; i < NX; i++) this.fluxo[j * NX + i] = 1 }
  }

  get fluxoDaLiga(): Fluxo { return FLUXOS[this.liga.fluxo] }
  get bico() { return BICOS[Math.max(0, Math.min(BICOS.length - 1, this.preparo.bico - 1))] }
  /** Espessura que recebe o calor: na sobreposição, as duas chapas. */
  espessuraEm(y: number): number { return y < 0 ? 2 * this.peca.espessuraMm : this.peca.espessuraMm }
  /** Linha da sobreposição (dentro da folga). */
  naSobreposicao(y: number): boolean { return y < 0 && y >= -this.peca.sobreposicaoMm }

  private indice(x: number, y: number): number {
    const i = Math.round(x / DX - 0.5), j = Math.round((y - Y0) / DY - 0.5)
    if (i < 0 || i >= NX || j < 0 || j >= NY) return -1
    return j * NX + i
  }
  static readonly grade = { NX, NY, DX, DY, Y0 }
  /** Temperatura da peça (°C). */
  temperaturaC(x: number, y: number): number {
    const k = this.indice(x, y)
    return BRASAGEM.ambienteC + (k < 0 ? 0 : this.temperatura[k])
  }
  maximaC(x: number, y: number): number {
    const k = this.indice(x, y)
    return BRASAGEM.ambienteC + (k < 0 ? 0 : this.maxima[k])
  }

  /** Largura da chama (desvio padrão, mm) e fração do calor que chega à peça pela distância. */
  get chama(): { sigmaMm: number; eficiencia: number; dardoNaPeca: boolean } {
    const dardo = this.bico.dardoMm
    const livre = this.distanciaMm - dardo
    // Dardo encostado: calor concentrado num ponto (superaquece). Longe: espalha e perde.
    const sigmaMm = Math.max(1.6, 2.2 + 0.32 * Math.max(0, livre) + 0.6 * this.bico.n)
    const eficiencia = this.distanciaMm <= 0 ? 0.6 : Math.exp(-Math.max(0, this.distanciaMm - 15) / 25) * (livre < 0 ? 1.1 : 1)
    return { sigmaMm, eficiencia, dardoNaPeca: livre < 0 }
  }
  get potenciaW(): number {
    if (!this.naPeca || this.distanciaMm > BRASAGEM.distanciaMaxMm) return 0
    return this.bico.potenciaW * CHAMAS[this.preparo.chama].calor * this.chama.eficiencia
  }

  /** Fração da folga cheia de liga numa coluna x (0–1). */
  preenchimentoEm(x: number): number {
    const i = Math.round(x / DX - 0.5)
    if (i < 0 || i >= NX) return 0
    let cheio = 0, n = 0
    for (let j = 0; j < NY; j++) {
      const y = Y0 + (j + 0.5) * DY
      if (!this.naSobreposicao(y)) continue
      n++
      cheio += Math.min(1, this.solida[j * NX + i] + this.liquida[j * NX + i]) * (1 - this.poros[j * NX + i])
    }
    return n ? cheio / n : 0
  }
  /** Até onde a liga entrou na folga a partir da borda (mm). */
  profundidadeEm(x: number): number {
    const i = Math.round(x / DX - 0.5)
    if (i < 0 || i >= NX) return 0
    let d = 0
    for (let j = NY - 1; j >= 0; j--) {
      const y = Y0 + (j + 0.5) * DY
      if (!this.naSobreposicao(y)) continue
      if (this.solida[j * NX + i] + this.liquida[j * NX + i] > 0.3) d = -y + DY / 2
    }
    return d
  }
  /** Fluxo que resta num ponto (0–1). */
  fluxoEm(x: number, y: number): number {
    const k = this.indice(x, y)
    return k < 0 ? 0 : this.fluxo[k]
  }
  fileteEm(x: number): number {
    const i = Math.round(x / DX - 0.5)
    return i < 0 || i >= NX ? 0 : this.filete[i]
  }
  /** Superfície limpa para a liga molhar nesta célula. */
  private limpa(k: number, tC: number): boolean {
    // O fósforo reduz o óxido de cobre sozinho; só a chama oxidante cria óxido demais para ele.
    if (autoFluxante(this.liga, this.peca.material)) return this.preparo.chama !== 'oxidante' || this.oxido[k] < 0.95
    const [a0, a1] = this.fluxoDaLiga.ativoC
    const fluxoAtivo = this.fluxo[k] > 0.05 && tC >= a0 && tC <= a1
    return fluxoAtivo && this.oxido[k] < 0.5
  }
  /** A liga molha e corre nesta célula: superfície limpa e peça na temperatura. */
  molha(x: number, y: number): boolean {
    const k = this.indice(x, y)
    if (k < 0) return false
    const t = BRASAGEM.ambienteC + this.temperatura[k]
    return mobilidade(this.liga, t) > 0 && this.limpa(k, t)
  }
  /** Calor relativo da chama num ponto (1 no centro). */
  chamaEm(x: number, y: number): number {
    if (this.potenciaW <= 0) return 0
    const s = this.chama.sigmaMm
    return Math.exp(-((x - this.xMm) ** 2 + (y - this.yMm) ** 2) / (2 * s * s))
  }

  avancar(dt: number, depositar?: (x: number, volumeMm3: number, tipo: 'filete' | 'bolinha') => void, eventos?: (e: EventoBrasagem) => void): void {
    if (!(dt > 0)) return
    const dx = this.xMm - this.xAnterior
    this.xAnterior = this.xMm
    if (this.naPeca && Math.abs(dx) < 5) {
      this.velocidadeMmS = 0.8 * this.velocidadeMmS + 0.2 * Math.abs(dx / dt)
      if (Math.abs(dx / dt) > 0.4) this.sentido = dx > 0 ? 1 : -1
    } else if (!this.naPeca) this.velocidadeMmS = 0
    this.resto += dt
    while (this.resto >= PASSO) {
      this.resto -= PASSO
      this.passo(PASSO, depositar, eventos)
    }
  }

  private passo(dt: number, depositar?: (x: number, volumeMm3: number, tipo: 'filete' | 'bolinha') => void, eventos?: (e: EventoBrasagem) => void): void {
    const P = this.potenciaW
    if (P > 0) { this.tempoChamaS += dt; this.aquecer(P * dt) }
    this.conduzir(dt)
    this.superficie(dt, eventos)
    this.vareta(dt, depositar, eventos)
    this.escoar(dt)
  }

  private aquecer(q: number): void {
    const s = this.chama.sigmaMm
    const i0 = Math.round(this.xMm / DX - 0.5), j0 = Math.round((this.yMm - Y0) / DY - 0.5)
    const ri = Math.ceil((3 * s) / DX), rj = Math.ceil((3 * s) / DY)
    // A gaussiana inteira (também a parte fora da peça): chama fora da borda perde calor.
    const total = 2 * Math.PI * s * s / (DX * DY)
    for (let j = j0 - rj; j <= j0 + rj; j++) for (let i = i0 - ri; i <= i0 + ri; i++) {
      if (i < 0 || i >= NX || j < 0 || j >= NY) continue
      const x = (i + 0.5) * DX - this.xMm, y = Y0 + (j + 0.5) * DY - this.yMm
      const k = j * NX + i
      const cap = this.material.rhoC * DX * DY * this.espessuraEm(Y0 + (j + 0.5) * DY)
      this.temperatura[k] += (q * Math.exp(-(x * x + y * y) / (2 * s * s))) / total / cap
      if (this.temperatura[k] > this.maxima[k]) this.maxima[k] = this.temperatura[k]
    }
  }

  private conduzir(dt: number): void {
    const { alfa, perda } = this.material
    const limite = (0.8 * Math.min(DX, DY) ** 2) / (4 * alfa)
    const n = Math.max(1, Math.ceil(dt / limite)), h = dt / n
    const T = this.temperatura, A = this.aux
    for (let s = 0; s < n; s++) {
      for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
        const k = j * NX + i, t = T[k]
        // Bordas da grade isoladas: a peça continua além dela, mas o calor que sai pelas bordas é pouco.
        const l = i > 0 ? T[k - 1] : t, r = i < NX - 1 ? T[k + 1] : t
        const b = j > 0 ? T[k - NX] : t, c = j < NY - 1 ? T[k + NX] : t
        A[k] = t + h * (alfa * ((l - 2 * t + r) / (DX * DX) + (b - 2 * t + c) / (DY * DY)) - perda * t)
      }
      T.set(A)
    }
  }

  /** Fluxo (derrete, se gasta, queima), óxido, zinco que ferve e metal de base que funde. */
  private superficie(dt: number, eventos?: (e: EventoBrasagem) => void): void {
    const [a0, a1] = this.fluxoDaLiga.ativoC
    const oxida = BRASAGEM.oxidacao * CHAMAS[this.preparo.chama].oxida
    const fusao = this.base.fusaoC
    let queimou = false, ferveu = false
    for (let k = 0; k < NX * NY; k++) {
      // O pico também conta o calor que chegou por condução, não só onde a chama bateu.
      if (this.temperatura[k] > this.maxima[k]) this.maxima[k] = this.temperatura[k]
      const t = BRASAGEM.ambienteC + this.temperatura[k]
      if (t < 200) continue
      let ativo = false
      if (this.fluxo[k] > 0) {
        if (t > a1) { this.fluxo[k] = Math.max(0, this.fluxo[k] - dt / BRASAGEM.queimaFluxoS); if (this.fluxo[k] <= 0) queimou = true }
        // Ativo, o fluxo se gasta dissolvendo óxido: a chama oxidante o gasta mais depressa.
        else if (t >= a0) { this.fluxo[k] = Math.max(0, this.fluxo[k] - (dt * CHAMAS[this.preparo.chama].oxida) / this.fluxoDaLiga.vidaS); ativo = this.fluxo[k] > 0.05 }
      }
      const t0 = this.base.oxidaDesdeC
      if (ativo) this.oxido[k] = Math.max(0, this.oxido[k] - dt * 2)
      else if (t > t0) {
        // Ainda pasta ou pó, o fluxo protege do ar; sem ele (ou queimado), o metal quente oxida.
        const protegido = this.fluxo[k] > 0.05 ? 0.08 : 1
        this.oxido[k] = Math.min(1, this.oxido[k] + dt * oxida * protegido * ((t - t0) / 400))
      }
      // Liga com zinco superaquecida: o zinco ferve e deixa poros.
      if (this.liga.zinco && this.liquida[k] > 0.05 && t > this.liga.superaquecimentoC) {
        this.poros[k] = Math.min(0.9, this.poros[k] + dt * 0.5 * ((t - this.liga.superaquecimentoC) / 50 + 0.2))
        ferveu = true
      }
      if (t >= fusao) {
        const i = k % NX, j = (k - i) / NX
        const x = (i + 0.5) * DX, y = Y0 + (j + 0.5) * DY
        if (!this.furos.some((f) => Math.abs(f.xMm - x) < 4)) { this.furos.push({ xMm: x, yMm: y }); eventos?.('furo') }
      }
    }
    // Conta episódios: o fluxo que queima de novo depois de 2 s conta outra vez.
    if (queimou && this.tempoChamaS - this.ultimaQueima > 2) { this.fluxoQueimado++; eventos?.('fluxo-queimou') }
    if (queimou) this.ultimaQueima = this.tempoChamaS
    if (ferveu && !this.zincoFerveu) eventos?.('zinco-ferveu')
    if (ferveu) this.zincoFerveu += dt
  }

  /**
   * A vareta encostada na borda da chapa de cima. Derrete pelo calor da peça
   * (acima do solidus); se a própria chama está em cima dela e a peça está
   * fria, derrete na chama e cai em bolinhas que não molham.
   */
  private vareta(dt: number, depositar?: (x: number, volumeMm3: number, tipo: 'filete' | 'bolinha') => void, eventos?: (e: EventoBrasagem) => void): void {
    const tocando = this.encostarVareta && this.varetaRestanteMm > 0
    const x = this.varetaXMm, y = 0.25
    const t = this.temperaturaC(x, y)
    const naChama = tocando && this.chamaEm(x, y) > BRASAGEM.varetaNaChama
    if (!tocando) { this.naChamaAntes = false; return }
    const area = Math.PI * (this.liga.varetaMm / 2) ** 2
    const pelaPeca = Math.max(0, Math.min(1.5, (t - this.liga.solidusC) / (this.liga.liquidusC + 30 - this.liga.solidusC)))
    if (pelaPeca > 0) {
      const mm = Math.min(this.varetaRestanteMm, BRASAGEM.fusaoVaretaMmS * pelaPeca * dt)
      this.varetaRestanteMm -= mm
      this.ligaUsadaMm += mm
      this.pingar(x, area * mm, depositar, eventos)
      // Liga fria entrando tira um pouco de calor da borda.
      const k = this.indice(x, y)
      if (k >= 0) this.temperatura[k] = Math.max(0, this.temperatura[k] - (area * mm * 0.004) / (this.material.rhoC * DX * DY * this.espessuraEm(y)))
    } else if (naChama) {
      // Derretendo na chama, sobre metal frio: a liga não molha e fica em bolinhas.
      if (!this.naChamaAntes) { this.varetaNaChama++; eventos?.('vareta-na-chama') }
      const mm = Math.min(this.varetaRestanteMm, 6 * this.chamaEm(x, y) * dt)
      this.varetaRestanteMm -= mm
      this.ligaUsadaMm += mm
      const i = Math.round(x / DX - 0.5)
      if (i >= 0 && i < NX) this.embolada[i] += area * mm
      depositar?.(x, area * mm, 'bolinha')
    }
    this.naChamaAntes = naChama && pelaPeca <= 0
  }

  /** Liga derretida na borda: molha e vira filete; onde não molha, embola. */
  private pingar(x: number, volume: number, depositar?: (x: number, volumeMm3: number, tipo: 'filete' | 'bolinha') => void, eventos?: (e: EventoBrasagem) => void): void {
    const i = Math.round(x / DX - 0.5)
    if (i < 0 || i >= NX) return
    if (this.molha(x, 0.25) || this.molha(x, -0.25)) {
      this.filete[i] += volume / DX
      depositar?.(x, volume, 'filete')
    } else {
      if (this.embolada[i] < 0.5 && volume > 0) { this.emboladas++; eventos?.('liga-embolou') }
      this.embolada[i] += volume
      depositar?.(x, volume, 'bolinha')
    }
  }

  /**
   * Capilaridade: o filete da borda entra na folga e a liga líquida corre
   * para as células vizinhas que molham, mais depressa para as mais quentes.
   * Onde a peça esfria abaixo do solidus, a liga trava (solidifica).
   */
  private escoar(dt: number): void {
    const L = this.peca.sobreposicaoMm
    const folga = fatorFolga(this.peca.folgaMm)
    const capCelula = this.peca.folgaMm * DX * DY // mm³ de liga numa célula cheia
    // Folga larga: a capilaridade não segura a coluna de liga e ficam vazios.
    const enche = Math.max(0.3, Math.min(1, 1 - (this.peca.folgaMm - BRASAGEM.folgaSeguraMm) / 0.3))
    const borda = Math.round((-DY / 2 - Y0) / DY - 0.5) // linha logo dentro da folga
    const jMin = Math.max(0, Math.round((-L + DY / 2 - Y0) / DY - 0.5))
    const T = this.temperatura, liq = this.liquida, sol = this.solida, F = this.fluxoLiga
    // 1) Do filete para a folga, e o filete se espalha ao longo da borda quente.
    for (let i = 0; i < NX; i++) {
      if (this.filete[i] <= 0) continue
      const x = (i + 0.5) * DX
      const k = borda * NX + i
      const tC = BRASAGEM.ambienteC + T[k]
      const m = mobilidade(this.liga, tC)
      if (m > 0 && this.limpa(k, tC)) {
        const livre = Math.max(0, enche - liq[k] - sol[k])
        const entra = Math.min(this.filete[i] * DX, livre * capCelula, BRASAGEM.capilarMmS * folga * m * dt * this.peca.folgaMm * DX * 4)
        this.filete[i] -= entra / DX
        liq[k] += entra / capCelula
      }
      // Espalha ao longo da borda onde molha (a liga corre para o lado mais quente).
      for (const v of [i - 1, i + 1]) {
        if (v < 0 || v >= NX) continue
        const tv = BRASAGEM.ambienteC + T[borda * NX + v]
        if (!(mobilidade(this.liga, tv) > 0 && this.limpa(borda * NX + v, tv)) || m <= 0) continue
        const dif = this.filete[i] - this.filete[v] + 0.02 * Math.max(0, tv - tC)
        if (dif > 0) { const passa = Math.min(dif / 3, 2 * m * dt * this.filete[i]); this.filete[i] -= passa; this.filete[v] += passa }
      }
      // Filete grande demais escorre pela chapa de baixo.
      if (this.filete[i] > BRASAGEM.fileteMaxMm2 && m > 0.5) { const sai = (this.filete[i] - BRASAGEM.fileteMaxMm2) * Math.min(1, dt * 2); this.filete[i] -= sai; this.escorrida[i] += sai * DX }
      void x
    }
    // 2) Na folga: a liga líquida avança para as vizinhas que molham.
    F.fill(0)
    const rapidez = BRASAGEM.capilarMmS * folga / DY
    for (let j = jMin; j <= borda; j++) for (let i = 0; i < NX; i++) {
      const k = j * NX + i
      if (liq[k] <= 1e-4) continue
      const tC = BRASAGEM.ambienteC + T[k]
      const m = mobilidade(this.liga, tC)
      if (m <= 0) { sol[k] += liq[k]; liq[k] = 0; continue }
      const vizinhos = [i > 0 ? k - 1 : -1, i < NX - 1 ? k + 1 : -1, j > jMin ? k - NX : -1, j < borda ? k + NX : -1]
      let pesos = 0
      const w: number[] = []
      for (const v of vizinhos) {
        if (v < 0) { w.push(0); continue }
        const tv = BRASAGEM.ambienteC + T[v]
        const livre = enche - liq[v] - sol[v]
        const ok = livre > 0.02 && mobilidade(this.liga, tv) > 0 && this.limpa(v, tv)
        const p = ok ? livre * (1 + Math.max(0, tv - tC) / 40) : 0
        w.push(p); pesos += p
      }
      if (pesos <= 0) continue
      const sai = Math.min(liq[k] * 0.95, liq[k] * rapidez * m * dt * 4)
      vizinhos.forEach((v, n) => { if (v >= 0 && w[n] > 0) F[v] += (sai * w[n]) / pesos })
      F[k] -= sai
    }
    for (let j = jMin; j <= borda; j++) for (let i = 0; i < NX; i++) {
      const k = j * NX + i
      if (!F[k]) continue
      liq[k] = Math.max(0, liq[k] + F[k])
      const excesso = liq[k] + sol[k] - enche
      if (excesso > 0) liq[k] = Math.max(0, liq[k] - excesso)
    }
    // 3) Liga parada na folga solidifica quando a peça esfria.
    for (let j = jMin; j <= borda; j++) for (let i = 0; i < NX; i++) {
      const k = j * NX + i
      if (liq[k] > 0 && BRASAGEM.ambienteC + T[k] < this.liga.solidusC) { sol[k] += liq[k]; liq[k] = 0 }
    }
  }

  novaVareta(): void { this.varetaRestanteMm = BRASAGEM.varetaInicialMm }
}
