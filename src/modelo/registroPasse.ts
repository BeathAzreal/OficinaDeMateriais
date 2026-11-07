/**
 * Registro do passe do eletrodo (H82–H84): ao longo da junta, em fatias de meio
 * milímetro, o calor de cada passe, o tempo e o comprimento do arco, o metal posto
 * sobre escória fria, e onde o arco abriu, apagou ou o eletrodo grudou.
 */
import type { FormaDeposito15 } from './acionamento15'

/** Por que o arco apagou. */
export type MotivoParada = 'afastou' | 'fim-da-vareta' | 'grudou' | 'soltou'

export interface AberturaArco {
  xMm: number
  yMm: number
  tMs: number
  /** Reacendeu com a ponta quente, continuando o mesmo cordão (H71). */
  aQuente: boolean
}

export interface ParadaArco {
  xMm: number
  yMm: number
  tMs: number
  motivo: MotivoParada
  /** Tempo (ms) que a ponta ficou parada perto do fim antes de apagar: enche a cratera (H55). */
  permanenciaMs: number
}

/** Uma amostra da ponta com o arco aceso (para escamas e crateras). */
interface Amostra { tMs: number; xMm: number; tempoArcoS: number }

/** Núcleo de espalhamento da energia entre fatias vizinhas (o calor não fica num ponto só). */
const NUCLEO = [1, 2, 4, 6, 7, 6, 4, 2, 1].map((v) => v / 33)
/** Sem receber calor por este tempo (ms), a próxima passagem pela fatia conta como outro passe. */
const NOVA_PASSAGEM_MS = 2000
/** Passagem com menos que isto (kJ/mm) só raspou a fatia (calor do vizinho) e não conta como passe. */
const PASSAGEM_MINIMA_KJMM = 0.12

export class RegistroPasse {
  /** Energia que entrou em cada fatia (J). Dividida pelo passo dá o aporte de calor em J/mm. */
  readonly energiaJ: Float64Array
  /** Tempo de arco com a ponta sobre a fatia (s). */
  readonly tempoS: Float64Array
  /** Soma de (comprimento do arco ÷ diâmetro) × tempo, para a média por fatia. */
  readonly arcoXTempo: Float64Array
  /** Soma de instabilidade × tempo (arco longo, H69). */
  readonly instabXTempo: Float64Array
  /** Metal posto sobre escória fria (mm³, indicador de inclusão de escória). */
  readonly sobreEscoriaMm3: Float64Array
  /** Tempo de arco (s) da última passagem da ponta por cima da fatia: dá a fase das escamas. */
  readonly tempoArcoNaPassagem: Float64Array
  /** Sentido do avanço na última passagem (+1, −1; 0 = nunca passou). */
  readonly sentido: Int8Array
  /** Instante (ms) da última passagem com arco: um passe depois cobre a cratera do anterior. */
  readonly ultimaPassagemMs: Float64Array
  /** Energia da passagem em andamento, a menor e a maior passagem já fechada (J) e quantas (H74). */
  private readonly eVisita: Float64Array
  private readonly tVisitaMs: Float64Array
  private readonly eMinPasse: Float64Array
  private readonly eMaxPasse: Float64Array
  /** Energia do primeiro passe (J): só ele pode furar a raiz aberta do chanfro. */
  private readonly ePrimeiroPasse: Float64Array
  readonly passes: Uint8Array
  private readonly visitas: { tFimMs: number; e: number }[][]
  readonly aberturas: AberturaArco[] = []
  readonly paradas: ParadaArco[] = []
  readonly grudadas: { xMm: number; yMm: number }[] = []
  private amostras: Amostra[] = []
  private xAnterior = NaN

  constructor(readonly nPosicoes: number, readonly passoMm: number) {
    this.energiaJ = new Float64Array(nPosicoes)
    this.tempoS = new Float64Array(nPosicoes)
    this.arcoXTempo = new Float64Array(nPosicoes)
    this.instabXTempo = new Float64Array(nPosicoes)
    this.sobreEscoriaMm3 = new Float64Array(nPosicoes)
    this.tempoArcoNaPassagem = new Float64Array(nPosicoes)
    this.sentido = new Int8Array(nPosicoes)
    this.ultimaPassagemMs = new Float64Array(nPosicoes).fill(-Infinity)
    this.eVisita = new Float64Array(nPosicoes)
    this.tVisitaMs = new Float64Array(nPosicoes).fill(-Infinity)
    this.eMinPasse = new Float64Array(nPosicoes).fill(Infinity)
    this.eMaxPasse = new Float64Array(nPosicoes)
    this.ePrimeiroPasse = new Float64Array(nPosicoes)
    this.passes = new Uint8Array(nPosicoes)
    this.visitas = Array.from({ length: nPosicoes }, () => [])
  }

  /** Fecha a passagem em andamento da fatia, se ela foi de verdade (não só calor do vizinho). */
  private fecharPassagem(j: number): void {
    const e = this.eVisita[j]
    if (e / this.passoMm / 1000 >= PASSAGEM_MINIMA_KJMM) {
      this.eMinPasse[j] = Math.min(this.eMinPasse[j], e)
      this.eMaxPasse[j] = Math.max(this.eMaxPasse[j], e)
      if (this.passes[j] === 0) this.ePrimeiroPasse[j] = e
      if (this.passes[j] < 255) this.passes[j]++
      // H97: cada passagem guardada com o instante em que terminou, para saber o calor que veio depois de uma camada.
      this.visitas[j].push({ tFimMs: this.tVisitaMs[j], e })
    }
    this.eVisita[j] = 0
  }

  indiceEm(xMm: number): number {
    return Math.min(this.nPosicoes - 1, Math.max(0, Math.floor(xMm / this.passoMm)))
  }

  /** Um passo de arco aceso com a ponta em (x, y). `sobreEscoriaMm3`: metal posto sobre escória fria neste passo. */
  depositar(xMm: number, forma: FormaDeposito15, tMs: number, sobreEscoriaMm3 = 0): void {
    const dt = forma.dtS ?? 0
    const i = this.indiceEm(xMm)
    if (forma.energiaJ) {
      for (let k = 0; k < NUCLEO.length; k++) {
        const j = i + k - 4
        if (j < 0 || j >= this.nPosicoes) continue
        const e = forma.energiaJ * NUCLEO[k]
        if (tMs - this.tVisitaMs[j] > NOVA_PASSAGEM_MS) this.fecharPassagem(j)
        this.energiaJ[j] += e
        this.eVisita[j] += e
        this.tVisitaMs[j] = tMs
      }
    }
    this.tempoS[i] += dt
    this.arcoXTempo[i] += (forma.razaoArco ?? 1) * dt
    this.instabXTempo[i] += forma.instabilidade * dt
    this.sobreEscoriaMm3[i] += sobreEscoriaMm3
    const tempoArco = forma.tempoArcoS ?? 0
    // Escamas: marca as fatias entre a posição anterior e a atual com o tempo de arco (H56).
    const anterior = Number.isNaN(this.xAnterior) ? i : this.indiceEm(this.xAnterior)
    const dir = xMm > this.xAnterior ? 1 : xMm < this.xAnterior ? -1 : 0
    for (let j = Math.min(anterior, i); j <= Math.max(anterior, i); j++) {
      this.tempoArcoNaPassagem[j] = tempoArco
      if (dir) this.sentido[j] = dir
      else if (!this.sentido[j]) this.sentido[j] = 1
      this.ultimaPassagemMs[j] = tMs
    }
    this.xAnterior = xMm
    this.amostras.push({ tMs, xMm, tempoArcoS: tempoArco })
    if (this.amostras.length > 4000) this.amostras.splice(0, 2000)
  }

  inicioArco(xMm: number, yMm: number, tMs: number, aQuente: boolean): void {
    // Reabrir o arco começa outro passe: voltar por cima da emenda depois da troca de vareta é um retoque, não soma calor ao passe anterior.
    for (let j = 0; j < this.nPosicoes; j++) if (this.eVisita[j] > 0) { this.fecharPassagem(j); this.tVisitaMs[j] = -Infinity }
    this.aberturas.push({ xMm, yMm, tMs, aQuente })
    this.xAnterior = xMm
  }

  fimArco(xMm: number, yMm: number, tMs: number, motivo: MotivoParada): void {
    // Tempo com a ponta parada (a até 0,3 mm) no ponto final, nos últimos 600 ms de arco (H55).
    let parado = 0
    for (let k = this.amostras.length - 1; k > 0; k--) {
      const q = this.amostras[k], p = this.amostras[k - 1]
      if (q.tMs < tMs - 600) break
      if (Math.abs(p.xMm - xMm) <= 0.3 && Math.abs(q.xMm - xMm) <= 0.3) parado += q.tMs - Math.max(p.tMs, tMs - 600)
    }
    this.paradas.push({ xMm, yMm, tMs, motivo, permanenciaMs: parado })
    this.amostras = []
    this.xAnterior = NaN
  }

  grudou(xMm: number, yMm: number): void {
    this.grudadas.push({ xMm, yMm })
  }

  /**
   * H97: maior calor de uma passagem (kJ/mm) na fatia que terminou em `tMs` ou depois,
   * contando a passagem ainda aberta. É o calor que pode ter fundido uma camada posta em `tMs`.
   */
  calorDepoisDe(i: number, tMs: number): number {
    let max = 0
    for (const v of this.visitas[i]) if (v.tFimMs >= tMs) max = Math.max(max, v.e)
    if (this.tVisitaMs[i] >= tMs) max = Math.max(max, this.eVisita[i])
    return max / this.passoMm / 1000
  }

  /** Aporte de calor somado de todos os passes na fatia (kJ/mm). */
  aporteKJmm(i: number): number {
    return this.energiaJ[i] / this.passoMm / 1000
  }

  /** Aporte (kJ/mm) do passe mais frio e do mais quente que passaram pela fatia, contando o que está em andamento. */
  aportePorPasse(i: number): { min: number; max: number; primeiro: number; passes: number } {
    let min = this.eMinPasse[i], max = this.eMaxPasse[i], primeiro = this.ePrimeiroPasse[i], n = this.passes[i]
    const e = this.eVisita[i]
    if (e / this.passoMm / 1000 >= PASSAGEM_MINIMA_KJMM) { min = Math.min(min, e); max = Math.max(max, e); if (n === 0) primeiro = e; n++ }
    const k = 1 / this.passoMm / 1000
    return n ? { min: min * k, max: max * k, primeiro: primeiro * k, passes: n } : { min: 0, max: 0, primeiro: 0, passes: 0 }
  }

  /** Comprimento médio do arco na fatia, em diâmetros da alma (0 se o arco nunca passou). */
  arcoMedio(i: number): number {
    return this.tempoS[i] > 0 ? this.arcoXTempo[i] / this.tempoS[i] : 0
  }

  instabilidadeMedia(i: number): number {
    return this.tempoS[i] > 0 ? this.instabXTempo[i] / this.tempoS[i] : 0
  }
}
