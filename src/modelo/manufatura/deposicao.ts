import { SUBSTRATO } from './celula'

/*
 * Deposição da parede (H106-c). Modelo DIDÁTICO e simplificado, não
 * metalúrgico: guarda a altura do metal sobre o substrato num mapa de
 * células de 0,5 mm.
 *
 * - Volume: o arco deposita Q = rendimento × área do arame × alimentação
 *   (mm³/s). Mais velocidade do robô = menos metal por milímetro.
 * - Seção do cordão: parábola de área A = (2/3)·w·h. A razão w/h cresce com
 *   a temperatura de interpasse (peça quente molha mais e o cordão abre) e
 *   com a tocha baixa (arco curto, mais corrente); cai com a tocha alta.
 *   Esses números são do jogo; o que se ensina é a tendência.
 * - Camadas: o cordão novo assenta no topo JÁ SOLIDIFICADO embaixo da tocha
 *   (células tocadas há mais de TAU_POCA segundos). O mapa de alturas não
 *   representa material pendurado: o que transborda da parede vira coluna
 *   cheia, e a parede fica da largura do cordão.
 * - Não reaproveita as equações de cordão único nem de passes lado a lado
 *   do MIG/MAG: aqui o que importa é a altura que cada camada soma de
 *   verdade, comparada com o incremento que o programa manda subir.
 */

export const CELULA_MM = 0.5
/** Tempo depois do qual uma célula tocada pela poça conta como solidificada. */
export const TAU_POCA_S = 1.5

export const GEOMETRIA = {
  /** Razão largura/altura do cordão na peça fria, com a tocha na distância certa. */
  razaoFria: 2.6,
  /** Quanto a razão cresce por 100 °C de interpasse (até 900 °C). */
  razaoPor100C: 0.32,
  /** Velocidade abaixo da qual a poça para de estreitar (robô parado, ignição, cratera). */
  vMinimaMmS: 2,
  larguraMaxMm: 16,
  /** Seção mínima para o cordão ser contínuo: abaixo dela ele se parte em gotas. */
  secaoMinimaMm2: 4,
  /** Acima desta velocidade o cordão corcoveia (humping), qualquer que seja a seção. */
  vHumpingMmS: 14,
  /** Interpasse acima do qual a poça escorre pela lateral da parede. */
  colapsoC: 650,
}

/** Faixas da folga da tocha (mm acima/abaixo do topo, no TCP). */
export const FOLGA = {
  /** Tocha alta: arco longo e instável. */
  instavel: 6,
  /** Tão alta que o arco apaga. */
  perdeArco: 12,
  /** Tocha baixa: o arame mergulha na poça. */
  mergulho: -3,
}

export type DefeitoDeposito = 'descontinuo' | 'humping' | 'instavel' | 'mergulho' | 'escorrimento' | 'movj'

export interface EntradaDeposito {
  x: number
  y: number
  /** Altura do TCP (mm, base do robô). */
  z: number
  /** Volume depositado neste passo (mm³). */
  volume: number
  /** Velocidade do TCP neste passo (mm/s). */
  v: number
  /** Distância percorrida com o arco aberto desde o ARCON (mm), para padrões determinísticos. */
  s: number
  /** Tempo desde o ARCON (s). */
  tArco: number
  temperaturaC: number
  /** Caminho de MOVJ: velocidade e direção não controladas. */
  movj: boolean
  tempo: number
  /** Duração do passo (s). */
  dt: number
  /** Direção do percurso no plano (unitária; a última, com o robô parado). */
  ux: number
  uy: number
  /**
   * Largura do cordão em movimento. Com o robô parado (abertura do arco,
   * cratera, TIMER com arco) a poça não se abre além dela: o metal sobe
   * no ponto em vez de espalhar um disco largo nas pontas da parede.
   */
  larguraParadoMm?: number
}

export interface SaidaDeposito {
  folgaMm: number
  larguraMm: number
  alturaCordaoMm: number
  secaoMm2: number
  defeitos: DefeitoDeposito[]
  perdeuArco: boolean
}

export class Deposito {
  readonly nx: number
  readonly ny: number
  readonly x0 = SUBSTRATO.xMin
  readonly y0 = SUBSTRATO.yMin
  /** Altura do topo do metal sobre o substrato (mm). */
  readonly altura: Float32Array
  /** Altura antes da poça atual tocar a célula. */
  private readonly base: Float32Array
  /** Quanto a poça atual já somou na célula. */
  private readonly novo: Float32Array
  private readonly toque: Float64Array
  private readonly mobilidade: Float32Array
  private readonly liquidas = new Set<number>()
  /** Camada (contagem de ARCON) que tocou a célula por último: só para o desenho. */
  readonly camada: Uint16Array
  /** Volume total depositado (mm³). */
  volumeTotal = 0
  /** Mudou desde a última leitura (para o 3D refazer a malha). */
  versao = 0
  camadaAtual = 0

  constructor() {
    this.nx = Math.round((SUBSTRATO.xMax - SUBSTRATO.xMin) / CELULA_MM)
    this.ny = Math.round((SUBSTRATO.yMax - SUBSTRATO.yMin) / CELULA_MM)
    const n = this.nx * this.ny
    this.altura = new Float32Array(n)
    this.base = new Float32Array(n)
    this.novo = new Float32Array(n)
    this.toque = new Float64Array(n).fill(-1e9)
    this.camada = new Uint16Array(n)
    this.mobilidade = new Float32Array(n)
  }

  dentro(x: number, y: number): boolean {
    return x >= SUBSTRATO.xMin && x < SUBSTRATO.xMax && y >= SUBSTRATO.yMin && y < SUBSTRATO.yMax
  }

  private indice(x: number, y: number): number {
    const i = Math.floor((x - this.x0) / CELULA_MM), j = Math.floor((y - this.y0) / CELULA_MM)
    if (i < 0 || j < 0 || i >= this.nx || j >= this.ny) return -1
    return j * this.nx + i
  }

  alturaEm(x: number, y: number): number {
    const k = this.indice(x, y)
    return k < 0 ? 0 : this.altura[k]
  }

  /** Topo mais alto num raio (mm) em volta de (x, y), contando a poça atual. */
  topoNoRaio(x: number, y: number, raio: number): number {
    let topo = 0
    this.paraCadaCelula(x, y, raio, (k) => { if (this.altura[k] > topo) topo = this.altura[k] })
    return topo
  }

  /** Topo já solidificado embaixo da tocha: onde o cordão novo assenta. */
  assento(x: number, y: number, tempo: number): number {
    let topo = 0
    this.paraCadaCelula(x, y, 1, (k) => {
      const solido = tempo - this.toque[k] > TAU_POCA_S ? this.altura[k] : this.base[k]
      if (solido > topo) topo = solido
    })
    return topo
  }

  private paraCadaCelula(x: number, y: number, raio: number, f: (k: number, dx: number, dy: number) => void): void {
    const i0 = Math.max(0, Math.floor((x - raio - this.x0) / CELULA_MM)), i1 = Math.min(this.nx - 1, Math.floor((x + raio - this.x0) / CELULA_MM))
    const j0 = Math.max(0, Math.floor((y - raio - this.y0) / CELULA_MM)), j1 = Math.min(this.ny - 1, Math.floor((y + raio - this.y0) / CELULA_MM))
    for (let j = j0; j <= j1; j++) {
      const cy = this.y0 + (j + 0.5) * CELULA_MM - y
      for (let i = i0; i <= i1; i++) {
        const cx = this.x0 + (i + 0.5) * CELULA_MM - x
        if (cx * cx + cy * cy <= raio * raio) f(j * this.nx + i, cx, cy)
      }
    }
  }

  /** Geometria do cordão para as condições do momento (sem depositar). */
  static geometria(secaoMm2: number, temperaturaC: number, folgaMm: number, tArco: number, escorre: boolean): { largura: number; altura: number } {
    let razao = GEOMETRIA.razaoFria + GEOMETRIA.razaoPor100C * Math.min(9, Math.max(0, temperaturaC - 20) / 100)
    // Tocha alta: menos corrente pelo arame mais longo, cordão estreito e alto. Baixa: o contrário.
    razao *= Math.max(0.7, Math.min(1.3, 1 - 0.03 * folgaMm))
    // Primeiro instante do arco: o metal frio molha pouco (início alto e estreito).
    if (tArco < 0.8) razao *= 0.75 + 0.25 * (tArco / 0.8)
    if (escorre) razao *= 1.8
    // A = (2/3)·w·h e w = razão·h.
    const altura = Math.sqrt((1.5 * secaoMm2) / razao)
    return { largura: Math.min(GEOMETRIA.larguraMaxMm, razao * altura), altura }
  }

  /** Um passo de deposição. A folga é medida antes de somar o metal do passo. */
  depositar(e: EntradaDeposito): SaidaDeposito {
    const defeitos: DefeitoDeposito[] = []
    const assento = this.assento(e.x, e.y, e.tempo)
    const folga = e.z - assento
    if (folga > FOLGA.perdeArco) return { folgaMm: folga, larguraMm: 0, alturaCordaoMm: 0, secaoMm2: 0, defeitos: ['instavel'], perdeuArco: true }
    // Seção = volume por milímetro andado (robô parado conta como vMinima).
    const secaoMm2 = e.volume / (Math.max(GEOMETRIA.vMinimaMmS, e.v) * e.dt)
    const escorre = e.temperaturaC > GEOMETRIA.colapsoC
    if (escorre) defeitos.push('escorrimento')
    const geo = Deposito.geometria(secaoMm2, e.temperaturaC, folga, e.tArco, escorre)
    const largura = e.v < GEOMETRIA.vMinimaMmS && e.larguraParadoMm ? Math.min(geo.largura, e.larguraParadoMm) : geo.largura
    let volume = e.volume
    // Padrões determinísticos pela distância andada (nada de aleatório: a mesma entrada dá a mesma parede).
    if (e.v > GEOMETRIA.vHumpingMmS || (secaoMm2 < GEOMETRIA.secaoMinimaMm2 && e.v > GEOMETRIA.vMinimaMmS)) {
      defeitos.push(e.v > GEOMETRIA.vHumpingMmS ? 'humping' : 'descontinuo')
      const fase = (e.s / 6) % 1
      volume = fase < 0.5 ? volume / 0.5 : 0
    }
    if (folga > FOLGA.instavel || folga < FOLGA.mergulho || e.movj) {
      defeitos.push(e.movj ? 'movj' : folga > FOLGA.instavel ? 'instavel' : 'mergulho')
      volume *= 1 + 0.55 * Math.sin(e.s * 1.9) * Math.sin(e.s * 0.73 + 1)
    }
    if (volume > 0) this.carimbar(e.x, e.y, largura / 2, volume, e.tempo, e.ux, e.uy, e.temperaturaC)
    return { folgaMm: folga, larguraMm: largura, alturaCordaoMm: largura > 0 ? (1.5 * secaoMm2) / largura : 0, secaoMm2, defeitos, perdeuArco: false }
  }

  /**
   * Soma `volume` num disco de raio R com densidade ∝ √(1 − r²/R²): passando
   * em linha, isso dá a seção parabólica de largura 2R (H106-c).
   *
   * Cada célula assenta no topo sólido do EIXO do cordão na mesma altura do
   * percurso (direção ux, uy): ao lado da parede o metal que transborda vira
   * coluna cheia (a parede fica da largura do cordão); ao longo do eixo, um
   * vale da camada de baixo continua vale (não se enche de graça).
   */
  carimbar(x: number, y: number, raio: number, volume: number, tempo: number, ux: number, uy: number, temperaturaC = 25): void {
    const r = Math.max(raio, CELULA_MM)
    let soma = 0
    const celulas: number[] = [], pesos: number[] = [], assentos: number[] = []
    const cache = new Map<number, number>()
    this.paraCadaCelula(x, y, r, (k, dx, dy) => {
      const p = Math.sqrt(Math.max(0, 1 - (dx * dx + dy * dy) / (r * r)))
      if (p <= 0) return
      const ao = Math.round((dx * ux + dy * uy) / CELULA_MM)
      let a = cache.get(ao)
      if (a === undefined) { a = this.assento(x + ao * CELULA_MM * ux, y + ao * CELULA_MM * uy, tempo); cache.set(ao, a) }
      celulas.push(k); pesos.push(p); assentos.push(a); soma += p
    })
    if (soma <= 0) return
    const escala = volume / (soma * CELULA_MM * CELULA_MM)
    for (let n = 0; n < celulas.length; n++) {
      const k = celulas[n]
      if (tempo - this.toque[k] > TAU_POCA_S) { this.base[k] = this.altura[k]; this.novo[k] = 0 }
      // H106: o nó térmico é o interpasse; a poça recém-fundida cede mais na peça quente.
      this.mobilidade[k] = Math.max(this.mobilidade[k] * (tempo - this.toque[k] <= TAU_POCA_S ? 1 : 0), Math.min(1, Math.max(0, (temperaturaC - 200) / (GEOMETRIA.colapsoC - 200))))
      if (this.mobilidade[k] > 0) this.liquidas.add(k)
      this.toque[k] = tempo
      this.novo[k] += pesos[n] * escala
      this.altura[k] = Math.max(this.base[k], assentos[n]) + this.novo[k]
      this.camada[k] = this.camadaAtual
    }
    this.volumeTotal += volume
    this.versao++
  }

  /** H106: escoamento didático da parcela nova; não move o substrato nem o metal solidificado. */
  escoar(dt: number, tempo: number): void {
    if (dt <= 0 || this.liquidas.size === 0) return
    const variacoes = new Map<number, { dh: number; toque: number; mobilidade: number; camada: number }>()
    const somar = (k: number, dh: number, origem: number) => {
      const v = variacoes.get(k) ?? { dh: 0, toque: -Infinity, mobilidade: 0, camada: this.camada[k] }
      v.dh += dh
      if (dh > 0 && this.toque[origem] >= v.toque) {
        v.toque = this.toque[origem]; v.mobilidade = this.mobilidade[origem]; v.camada = this.camada[origem]
      }
      variacoes.set(k, v)
    }
    // Todas as diferenças usam o mesmo mapa: não há preferência pela ordem de visita.
    for (const k of this.liquidas) {
      const idade = Math.max(0, tempo - this.toque[k])
      if (idade >= TAU_POCA_S || this.novo[k] <= 0.000001) { this.liquidas.delete(k); continue }
      const i = k % this.nx, j = Math.floor(k / this.nx)
      const vizinhos = [i > 0 ? k - 1 : -1, i + 1 < this.nx ? k + 1 : -1, j > 0 ? k - this.nx : -1, j + 1 < this.ny ? k + this.nx : -1]
      const retencao = 0.12 + 0.05 * Math.sin(i * 0.36 + j * 0.21 + this.camada[k] * 1.7)
      const pesos = vizinhos.map(v => v < 0 ? 0 : Math.max(0, this.altura[k] - this.altura[v] - retencao))
      const total = pesos.reduce((a, v) => a + v, 0)
      if (total <= 0) continue
      const disponivel = Math.max(0, Math.min(this.novo[k], this.altura[k] - this.base[k]))
      // Retenção/molhamento local variam suavemente: pequenas línguas, sem sorteio por quadro.
      const molhamento = 0.7 + 0.3 * Math.sin(i * 0.24 + j * 0.17 + this.camada[k] * 1.7)
      const dh = Math.min(disponivel * 0.2, 1.6 * molhamento * dt * this.mobilidade[k] * (1 - idade / TAU_POCA_S) * total / 4)
      if (dh <= 0.0000001) continue
      somar(k, -dh, k)
      vizinhos.forEach((v, n) => { if (pesos[n] > 0) somar(v, dh * pesos[n] / total, k) })
    }
    for (const [k, v] of variacoes) {
      if (v.dh > 0 && tempo - this.toque[k] >= TAU_POCA_S) { this.base[k] = this.altura[k]; this.novo[k] = 0 }
      this.altura[k] = Math.max(this.base[k], this.altura[k] + v.dh)
      this.novo[k] = Math.max(0, this.novo[k] + v.dh)
      if (v.toque > -Infinity) {
        this.toque[k] = Math.max(this.toque[k], v.toque)
        this.mobilidade[k] = Math.max(this.mobilidade[k], v.mobilidade)
        this.camada[k] = v.camada
        this.liquidas.add(k)
      }
    }
    if (variacoes.size > 0) this.versao++
  }

  /**
   * Fim do cordão: a poça que fica para trás solidifica com uma depressão
   * (cratera). O preenchimento (AEF) já foi depositado parado no ponto.
   * Tira `volume` do trecho de `comprimento` mm atrás de (x, y), contra a
   * direção (dx, dy) do último movimento.
   */
  cratera(x: number, y: number, dx: number, dy: number, comprimento: number, raio: number, volume: number, tempo: number): void {
    const n = Math.hypot(dx, dy)
    if (volume <= 0 || n === 0) return
    const ux = dx / n, uy = dy / n
    const passos = Math.max(1, Math.round(comprimento / CELULA_MM))
    const r = Math.max(raio, CELULA_MM)
    let tirado = 0
    for (let p = 0; p < passos && tirado < volume; p++) {
      // A depressão é mais funda perto do ponto onde o arco apagou.
      const f = 1 - p / passos
      const alvo = (volume * 2 * f) / passos
      const cx = x - ux * p * CELULA_MM, cy = y - uy * p * CELULA_MM
      let soma = 0
      const celulas: number[] = [], pesos: number[] = []
      this.paraCadaCelula(cx, cy, r, (k, ddx, ddy) => {
        const w = Math.sqrt(Math.max(0, 1 - (ddx * ddx + ddy * ddy) / (r * r)))
        if (w > 0 && tempo - this.toque[k] <= TAU_POCA_S && this.novo[k] > 0) { celulas.push(k); pesos.push(w); soma += w }
      })
      if (soma <= 0) continue
      const escala = alvo / (soma * CELULA_MM * CELULA_MM)
      for (let m = 0; m < celulas.length; m++) {
        const k = celulas[m]
        const tira = Math.min(this.novo[k] * 0.6, pesos[m] * escala)
        this.novo[k] -= tira
        this.altura[k] -= tira
        tirado += tira * CELULA_MM * CELULA_MM
      }
    }
    this.volumeTotal -= tirado
    this.versao++
  }
}
