import { MODELO, PECA } from './parametros'

/** Distância lateral até a qual a tocha conta como "sobre a junta" (eficiência, PONTUACAO.md). */
export const DISTANCIA_JUNTA_MM = 10

/**
 * O que aconteceu em cada posição da junta enquanto o arco estava aberto:
 * tempo de permanência (H20), aporte relativo (H31) e aporte efetivo, que já
 * inclui o aquecimento acumulado (H32). É alimentado pela mesma integração
 * que deposita o metal, então não depende dos quadros.
 */
export class Percurso {
  readonly nPosicoes: number
  private readonly permanenciaMs: Float64Array
  /** Tempo com a tocha a até DISTANCIA_JUNTA_MM da linha da junta. */
  private readonly pertoDaJuntaMs: Float64Array
  /** Σ potência × dt (s). */
  private readonly aportes: Float64Array
  /** Σ potência × ∫(1 + e·T) dt (s). */
  private readonly aportesEfetivos: Float64Array
  /** H101: maior índice de fusão que cada fatia já atingiu (o que derreteu não volta). */
  private readonly picos: Float64Array

  constructor(
    readonly comprimentoMm: number = PECA.comprimentoMm,
    readonly passoMm: number = MODELO.passoMm,
  ) {
    this.nPosicoes = Math.ceil(comprimentoMm / passoMm)
    this.permanenciaMs = new Float64Array(this.nPosicoes)
    this.pertoDaJuntaMs = new Float64Array(this.nPosicoes)
    this.aportes = new Float64Array(this.nPosicoes)
    this.aportesEfetivos = new Float64Array(this.nPosicoes)
    this.picos = new Float64Array(this.nPosicoes)
  }

  /** H101: guarda o índice de fusão da fatia i se for o maior até agora. */
  registrarPico(i: number, indice: number): void {
    if (i >= 0 && i < this.nPosicoes && indice > this.picos[i]) this.picos[i] = indice
  }

  picoEm(i: number): number {
    return this.picos[i] ?? 0
  }

  /** Aporte efetivo bruto da fatia i (sem cópia), para a avaliação local do pico. */
  aporteEfetivoEm(i: number): number {
    return this.aportesEfetivos[i] ?? 0
  }

  registrar(xMm: number, yMm: number, duracaoMs: number, aporte = 0, aporteEfetivo = 0): void {
    if (xMm < 0 || xMm > this.comprimentoMm || duracaoMs <= 0) return
    const i = Math.min(this.nPosicoes - 1, Math.floor(xMm / this.passoMm))
    this.permanenciaMs[i] += duracaoMs
    if (Math.abs(yMm) <= DISTANCIA_JUNTA_MM) this.pertoDaJuntaMs[i] += duracaoMs
    this.aportes[i] += aporte
    this.aportesEfetivos[i] += aporteEfetivo
  }

  private somaEntre(v: Float64Array, x0Mm: number, x1Mm: number): number {
    let soma = 0
    for (let i = 0; i < this.nPosicoes; i++) {
      const x = (i + 0.5) * this.passoMm
      if (x >= x0Mm && x < x1Mm) soma += v[i]
    }
    return soma
  }

  /** Tempo de arco (ms) com a tocha em [x0, x1), contando fatias pelo centro. */
  permanenciaEntre(x0Mm: number, x1Mm: number): number {
    return this.somaEntre(this.permanenciaMs, x0Mm, x1Mm)
  }

  /** Tempo de arco (ms) em [x0, x1) com a tocha perto da linha da junta. */
  pertoDaJuntaEntre(x0Mm: number, x1Mm: number): number {
    return this.somaEntre(this.pertoDaJuntaMs, x0Mm, x1Mm)
  }

  total(): number {
    return this.permanenciaEntre(0, Infinity)
  }

  /** Tempo de arco por fatia (ms), com a tocha em cima dela. */
  copiaDasPermanencias(): Float64Array {
    return this.permanenciaMs.slice()
  }

  copiaDosAportes(): Float64Array {
    return this.aportes.slice()
  }

  copiaDosAportesEfetivos(): Float64Array {
    return this.aportesEfetivos.slice()
  }
}
