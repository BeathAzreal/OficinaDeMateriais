import type { PecaTig } from '../missoes/pecasTig'
import { MATERIAIS, type Material } from './material'

/*
 * TIG (GTAW) didático, H92. O tungstênio não se consome: o arco aquece a
 * chapa, a poça aparece onde o calor passa do ponto de fusão e a vareta de
 * adição só funde quando toca a poça. Calor num campo 2D da chapa (condução
 * no plano e perda para o resto da peça), em subpassos fixos: o resultado
 * não depende da taxa de quadros. Números do jogo, não de procedimento.
 */

export const TIG = {
  /** Arco acende com o pedal até esta distância (alta frequência) e apaga acima de `arcoMaxMm`. */
  aberturaMm: 5,
  arcoMaxMm: 8,
  /** Tungstênio encostando na chapa ou na poça. */
  contatoMm: 0.3,
  /** Vareta tocando o tungstênio: o arco está curto demais para caber a vareta. */
  varetaNoTungstenioMm: 1.1,
  rendimento: 0.65,
  /** Subida da temperatura que funde o aço (K acima do ambiente); cada chapa tem a sua (H104). */
  fusaoK: 1450,
  /**
   * Furo na chapa fina: pico acima de `furoK + furoPorMmK × espessura` (no aço; nas outras chapas, na
   * mesma proporção da temperatura de fusão), ou poça mais larga que `furoLargura × espessura + 3 mm`.
   */
  furoK: 2600,
  furoPorMmK: 250,
  furoLargura: 3.5,
  /** Velocidade com que a ponta da vareta desce para a poça e volta (mm/s). */
  varetaMmS: 70,
  /** Altura de descanso da ponta da vareta, dentro do gás (mm). */
  varetaDescansoMm: 3,
  /** Vareta que funde na poça (mm de vareta por segundo de contato). */
  fusaoVaretaMmS: 25,
  /** Toque que já está fundindo continua até esta fração da temperatura de fusão na ponta (número do jogo). */
  fusaoContinuaFracao: 0.85,
  varetaInicialMm: 300,
  /** Tempo do pedal até a corrente cheia no modo só mouse (s). */
  rampaPedalS: 0.35,
} as const

const NX = 150, NY = 81, DX = 1, DY = 0.5, Y0 = -20
const PASSO = 1 / 120

/** Pressão da caneta (0–1) para o pedal: toque leve não acende; a corrente cheia vem antes do fundo. */
export function pedalDaPressao(pressao: number): number {
  return Math.max(0, Math.min(1, (pressao - 0.05) / 0.6))
}

export type EstadoTig = 'desligado' | 'pronto' | 'arco' | 'afastado'
export type EventoTig = 'contaminou' | 'vareta-no-tungstenio' | 'vareta-fria' | 'furo' | 'toque' | 'cratera' | 'keyhole' | 'arco-duplo'

export interface ToqueVareta {
  xMm: number
  yMm: number
  tMs: number
  volumeMm3: number
}

export class ModeloTig {
  readonly temperatura = new Float64Array(NX * NY)
  /** Maior temperatura que cada célula já viu: fundiu se passou de `fusaoK`. */
  readonly maxima = new Float64Array(NX * NY)
  private readonly aux = new Float64Array(NX * NY)
  readonly material: NonNullable<Material['tig']>
  correnteA = 80
  /** 0–1: pedal (pressão da caneta ou botão do mouse). */
  pedal = 0
  xMm = 75
  yMm = 0
  /** Distância do tungstênio à superfície logo abaixo (mm). */
  distanciaMm = 6
  inclinacaoGraus = 15
  azimuteGraus = 0
  /** Jogador mergulhando a vareta. */
  mergulhar = false
  /** Altura da ponta da vareta acima da chapa (mm). */
  alturaVaretaMm: number = TIG.varetaDescansoMm
  varetaRestanteMm: number = TIG.varetaInicialMm
  estado: EstadoTig = 'pronto'
  contaminado = false
  /** Superfície (metal já posto) sob um ponto, para medir o arco até o topo do cordão. */
  superficie: (x: number, y: number) => number = () => 0
  tempoArcoS = 0
  energiaJ = 0
  contaminacoes = 0
  varetaNoTungstenio = 0
  varetaFria = 0
  furos: { xMm: number; yMm: number }[] = []
  crateras: { xMm: number }[] = []
  toques: ToqueVareta[] = []
  /** Sentido do avanço (+1 para a direita), pela média recente do movimento. */
  sentido = 1
  velocidadeMmS = 0
  private resto = 0
  private tempoMs = 0
  private xAnterior = 75
  private emContato = false
  private toqueAtual: ToqueVareta | null = null
  private pedalAnterior = 0
  private quedaPedalS = 0

  constructor(readonly peca: PecaTig) {
    // H104: calor por volume, difusividade, perda e fusão vêm da chapa (material.ts).
    const tig = MATERIAIS[peca.material].tig
    if (!tig) throw new Error(`${MATERIAIS[peca.material].nome} não vai ao TIG no jogo.`)
    this.material = tig
  }

  /** Subida da temperatura que funde esta chapa (K acima do ambiente). */
  get fusaoK(): number { return this.material.fusaoK }

  /** Espessura que recebe o calor (no T, o arco fica concentrado no canto: o jogo usa a de uma chapa). */
  get espessuraTermicaMm(): number { return this.peca.espessuraMm }
  get tensaoV(): number { return 10 + 0.6 * Math.max(0, this.distanciaMm) }
  get correnteAtualA(): number { return this.estado === 'arco' ? this.correnteA * this.pedal : 0 }
  get potenciaW(): number { return TIG.rendimento * this.correnteAtualA * this.tensaoV }
  /** Espalhamento do calor: arco longo abre e espalha (H92). */
  get sigmaMm(): number { return 0.9 + 0.35 * Math.max(0.5, this.distanciaMm) + (this.contaminado ? 0.8 : 0) }

  protected indice(x: number, y: number): number {
    const i = Math.round(x / DX - 0.5), j = Math.round((y - Y0) / DY - 0.5)
    if (i < 0 || i >= NX || j < 0 || j >= NY) return -1
    return j * NX + i
  }
  temperaturaEm(x: number, y: number): number {
    const k = this.indice(x, y)
    return k < 0 ? 0 : this.temperatura[k]
  }
  fundiuEm(x: number, y: number): boolean {
    const k = this.indice(x, y)
    return k >= 0 && this.maxima[k] >= this.fusaoK
  }
  /** Largura da zona fundida numa seção x (mm). */
  larguraFundida(x: number): number {
    const i = Math.round(x / DX - 0.5)
    if (i < 0 || i >= NX) return 0
    let n = 0
    for (let j = 0; j < NY; j++) if (this.maxima[j * NX + i] >= this.fusaoK) n++
    return n * DY
  }
  /** Raio equivalente da poça agora (mm): área fundida num raio de 8 mm do tungstênio (a poça fica um pouco atrás dele ao avançar). */
  get raioPocaMm(): number {
    const i0 = Math.round(this.xMm / DX - 0.5)
    let n = 0
    for (let i = Math.max(0, i0 - 8); i <= Math.min(NX - 1, i0 + 8); i++) for (let j = 0; j < NY; j++) if (this.temperatura[j * NX + i] >= this.fusaoK) n++
    return Math.sqrt((n * DX * DY) / Math.PI)
  }
  /** H95: largura com que o metal da vareta se espalha: a da poça em que funde (entre 2,5 e 8 mm). */
  get larguraDepositoMm(): number {
    return Math.max(2.5, Math.min(8, 2 * this.raioPocaMm))
  }
  /** Até onde a poça vai na frente do tungstênio, no sentido do avanço (mm). */
  get frentePocaMm(): number {
    let d = 0
    while (d < 15 && this.temperaturaEm(this.xMm + this.sentido * (d + 0.5), this.yMm) >= this.fusaoK) d += 0.5
    return d
  }
  /**
   * Ponta da vareta: na borda da frente da POÇA, onde o soldador mergulha a
   * vareta. Normalmente logo à frente do tungstênio, onde a poça avança. Se
   * ali está frio porque o jogador avançou a tocha antes de tocar (a poça
   * ficou para trás), a vareta vai à borda da poça mais perto, até 4 mm atrás
   * do tungstênio. Sem poça nenhuma, fica na chapa fria (e só bate).
   */
  get pontaVareta(): { x: number; y: number } {
    const x0 = this.xMm + this.sentido * Math.max(0.8, this.frentePocaMm - 0.3)
    if (this.temperaturaEm(x0, this.yMm) >= this.fusaoK) return { x: x0, y: this.yMm }
    for (let x = x0 - this.sentido * 0.5; this.sentido * (this.xMm - x) <= 4; x -= this.sentido * 0.5) {
      if (this.temperaturaEm(x, this.yMm) >= this.fusaoK) return { x, y: this.yMm }
    }
    return { x: x0, y: this.yMm }
  }

  /** Avança o tempo; `depositar` recebe o metal da vareta (posição e volume) a cada subpasso. */
  avancar(dt: number, depositar?: (x: number, y: number, volume: number) => void, eventos?: (e: EventoTig) => void): void {
    if (!(dt > 0)) return
    // Sentido e velocidade do avanço pelo movimento da tocha neste quadro.
    const dx = this.xMm - this.xAnterior
    this.xAnterior = this.xMm
    const v = dx / dt
    // Só o avanço com arco conta: levar a tocha até o início (ou um salto do ponteiro) não muda o sentido.
    if (this.estado === 'arco' && Math.abs(dx) < 5) {
      this.velocidadeMmS = 0.8 * this.velocidadeMmS + 0.2 * Math.abs(v)
      if (Math.abs(v) > 0.4) this.sentido = v > 0 ? 1 : -1
    } else if (this.estado !== 'arco') this.velocidadeMmS = 0
    this.resto += dt
    while (this.resto >= PASSO) {
      this.resto -= PASSO
      this.passo(PASSO, depositar, eventos)
    }
  }

  /** Até onde o arco abre e até onde se mantém (mm). O plasma (arco piloto, coluna estreita) alcança mais longe. */
  protected get aberturaMm(): number { return TIG.aberturaMm }
  protected get arcoMaxMm(): number { return TIG.arcoMaxMm }
  /** Distância em que a tocha "encosta" (mm). */
  protected get contatoMm(): number { return TIG.contatoMm }

  /** Tocha encostando na poça com o arco aberto (uma vez por contato). No TIG, o tungstênio contamina. */
  protected aoEncostar(eventos?: (e: EventoTig) => void): void {
    this.contaminado = true
    this.contaminacoes++
    eventos?.('contaminou')
  }

  /** Depois do aquecimento de cada subpasso com arco (o plasma abre e mantém o keyhole aqui). */
  protected aposAquecer(_dt: number, _eventos?: (e: EventoTig) => void): void {}

  /** O arco acabou de apagar. `cortouDeVez`: pedal solto de uma vez ou tocha afastada. */
  protected aoApagar(cortouDeVez: boolean, eventos?: (e: EventoTig) => void): void {
    if (cortouDeVez && this.raioPocaMm > 1.2) {
      this.crateras.push({ xMm: this.xMm })
      eventos?.('cratera')
    }
  }

  private passo(dt: number, depositar?: (x: number, y: number, volume: number) => void, eventos?: (e: EventoTig) => void): void {
    this.tempoMs += dt * 1000
    const arcoAntes = this.estado === 'arco'
    // Distância real: do tungstênio ao topo do metal sob ele.
    const L = this.distanciaMm
    if (L <= this.contatoMm && arcoAntes) {
      // Tungstênio na poça: contamina e o arco fica instável até apontar de novo.
      if (!this.emContato) {
        this.emContato = true
        this.aoEncostar(eventos)
      }
    } else this.emContato = false
    if (this.pedal > 0.04) {
      if (this.estado === 'arco') { if (L > this.arcoMaxMm) this.estado = 'afastado' }
      else if (L <= this.aberturaMm) this.estado = 'arco'
      else this.estado = 'afastado'
    } else this.estado = 'pronto'
    // Cratera: arco cortado de uma vez com a poça grande (sem diminuir o pedal antes).
    if (this.pedal < this.pedalAnterior) this.quedaPedalS += dt
    else this.quedaPedalS = 0
    if (arcoAntes && this.estado !== 'arco') this.aoApagar(this.pedalAnterior > 0.5 || this.estado === 'afastado', eventos)
    this.pedalAnterior = this.pedal
    if (this.estado === 'arco') {
      this.tempoArcoS += dt
      const q = this.potenciaW * dt
      this.energiaJ += q
      this.aquecer(q)
      this.aposAquecer(dt, eventos)
      this.conferirFuro(eventos)
    }
    this.conduzir(dt)
    this.vareta(dt, depositar, eventos)
  }

  private aquecer(q: number): void {
    const s = this.sigmaMm, cap = this.material.rhoC * DX * DY * this.espessuraTermicaMm
    const i0 = Math.round(this.xMm / DX - 0.5), j0 = Math.round((this.yMm - Y0) / DY - 0.5)
    const ri = Math.ceil((3 * s) / DX), rj = Math.ceil((3 * s) / DY)
    let soma = 0
    for (let j = j0 - rj; j <= j0 + rj; j++) for (let i = i0 - ri; i <= i0 + ri; i++) {
      if (i < 0 || i >= NX || j < 0 || j >= NY) continue
      const x = (i + 0.5) * DX - this.xMm, y = Y0 + (j + 0.5) * DY - this.yMm
      soma += Math.exp(-(x * x + y * y) / (2 * s * s))
    }
    if (!soma) return
    for (let j = j0 - rj; j <= j0 + rj; j++) for (let i = i0 - ri; i <= i0 + ri; i++) {
      if (i < 0 || i >= NX || j < 0 || j >= NY) continue
      const x = (i + 0.5) * DX - this.xMm, y = Y0 + (j + 0.5) * DY - this.yMm
      const k = j * NX + i
      this.temperatura[k] += (q * Math.exp(-(x * x + y * y) / (2 * s * s))) / soma / cap
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
        // Bordas em x isoladas; a 20 mm da junta a chapa já está fria.
        const l = i > 0 ? T[k - 1] : t, r = i < NX - 1 ? T[k + 1] : t
        const b = j > 0 ? T[k - NX] : 0, c = j < NY - 1 ? T[k + NX] : 0
        A[k] = t + h * (alfa * ((l - 2 * t + r) / (DX * DX) + (b - 2 * t + c) / (DY * DY)) - perda * t)
      }
      T.set(A)
    }
  }

  private vareta(dt: number, depositar?: (x: number, y: number, volume: number) => void, eventos?: (e: EventoTig) => void): void {
    const alvo = this.mergulhar ? 0 : TIG.varetaDescansoMm
    const passo = TIG.varetaMmS * dt
    this.alturaVaretaMm += Math.max(-passo, Math.min(passo, alvo - this.alturaVaretaMm))
    const tocando = this.alturaVaretaMm <= 0.3 && this.varetaRestanteMm > 0
    if (!tocando) {
      if (this.toqueAtual) { if (this.toqueAtual.volumeMm3 > 0) { this.toques.push(this.toqueAtual); eventos?.('toque') } this.toqueAtual = null }
      return
    }
    // Durante um mergulho a vareta fica no mesmo ponto: o lugar é escolhido quando ela toca.
    const p = this.toqueAtual ? { x: this.toqueAtual.xMm, y: this.toqueAtual.yMm } : this.pontaVareta
    if (this.estado === 'arco' && this.distanciaMm < TIG.varetaNoTungstenioMm) {
      // Pouco espaço entre o tungstênio e a poça: a vareta encosta no eletrodo.
      if (!this.toqueAtual) { this.varetaNoTungstenio++; this.contaminado = true; eventos?.('vareta-no-tungstenio') }
    }
    if (!this.toqueAtual) this.toqueAtual = { xMm: p.x, yMm: p.y, tMs: this.tempoMs, volumeMm3: 0 }
    // Um toque que já começou fundindo continua enquanto a ponta segue na poça: o metal frio da
    // vareta esfria a célula, mas o arco ao lado mantém a poça (folga de 20 %).
    const limite = this.toqueAtual.volumeMm3 > 0 ? TIG.fusaoContinuaFracao * this.fusaoK : this.fusaoK
    if (this.temperaturaEm(p.x, p.y) < limite) {
      // Vareta na chapa fria: não funde, só bate (conta uma vez por toque).
      if (this.toqueAtual.volumeMm3 === 0 && !(this.toqueAtual as { fria?: boolean }).fria) {
        ;(this.toqueAtual as { fria?: boolean }).fria = true
        this.varetaFria++
        eventos?.('vareta-fria')
      }
      return
    }
    const area = Math.PI * (this.peca.varetaMm / 2) ** 2
    const mm = Math.min(this.varetaRestanteMm, TIG.fusaoVaretaMmS * dt)
    const volume = area * mm
    this.varetaRestanteMm -= mm
    this.toqueAtual.volumeMm3 += volume
    // Fundir a vareta tira calor da poça (metal frio entrando).
    const k = this.indice(p.x, p.y)
    if (k >= 0) {
      const cap = this.material.rhoC * DX * DY * this.espessuraTermicaMm
      const tira = (volume * 9) / cap / 6
      for (const d of [0, -1, 1, -NX, NX, this.sentido]) if (k + d >= 0 && k + d < NX * NY) this.temperatura[k + d] = Math.max(0, this.temperatura[k + d] - tira)
    }
    depositar?.(p.x, p.y, volume)
  }

  /** Furo: calor demais na chapa fina (mais fácil quanto mais fina). */
  protected conferirFuro(eventos?: (e: EventoTig) => void): void {
    if (this.estado !== 'arco') return
    const k = this.indice(this.xMm, this.yMm), t = this.peca.espessuraMm
    if (k < 0) return
    const quente = this.temperatura[k] > this.limiteFuroK
    const larga = 2 * this.raioPocaMm > TIG.furoLargura * t + 3
    if (!quente && !larga) return
    if (this.furos.some((f) => Math.abs(f.xMm - this.xMm) < 4)) return
    this.furos.push({ xMm: this.xMm, yMm: this.yMm })
    eventos?.('furo')
  }

  /** Limite de temperatura que fura esta chapa (K acima do ambiente). */
  get limiteFuroK(): number { return (TIG.furoK + TIG.furoPorMmK * this.peca.espessuraMm) * (this.fusaoK / TIG.fusaoK) }
  /** H94: maior temperatura que a seção x já viu, em fração do limite de furo. */
  picoRelativo(x: number): number {
    const i = Math.round(x / DX - 0.5)
    if (i < 0 || i >= NX) return 0
    let pico = 0
    for (let j = 0; j < NY; j++) pico = Math.max(pico, this.maxima[j * NX + i])
    return pico / this.limiteFuroK
  }

  /** Afiar o tungstênio (só com o arco apagado): tira a contaminação. */
  afiar(): boolean {
    if (this.estado === 'arco') return false
    this.contaminado = false
    return true
  }
  novaVareta(): void { this.varetaRestanteMm = TIG.varetaInicialMm }
}
