import { TRAJETORIA, VELOCIDADE } from './parametros'
import { inicioDoDeslocamento, posicaoEntre, type Amostra } from './trajetoria'

export interface Velocidades {
  /** Componente ao longo da junta (eixo x). Negativa = recuando. */
  avancoMms: number
  /** Componente perpendicular à junta (eixo y). */
  lateralMms: number
  /** Caminho percorrido pela tocha / tempo, em qualquer direção. */
  totalMms: number
}

const PARADO: Velocidades = { avancoMms: 0, lateralMms: 0, totalMms: 0 }

/**
 * Mede a velocidade a partir das leituras do mouse e dos instantes em que
 * elas aconteceram — nunca a partir do número de quadros desenhados.
 *
 * Usa uma janela de tempo (H6): velocidade = deslocamento na janela / duração
 * da janela. Isso funciona igual a 30 ou a 240 quadros por segundo.
 */
export class EstimadorVelocidade {
  private amostras: Amostra[] = []

  constructor(private readonly janelaMs: number = VELOCIDADE.janelaMs) {}

  limpar(): void {
    this.amostras = []
  }

  adicionar(a: Amostra): void {
    const ultima = this.amostras[this.amostras.length - 1]
    // Leituras fora de ordem são tratadas como simultâneas à anterior.
    const nova = ultima && a.t < ultima.t ? { ...a, t: ultima.t } : a
    this.amostras.push(nova)

    // Descarta leituras velhas, mas mantém uma anterior à janela como âncora.
    const corte = nova.t - this.janelaMs - TRAJETORIA.duracaoMaxDeslocamentoMs
    while (this.amostras.length > 2 && this.amostras[1].t < corte) this.amostras.shift()
  }

  /** Posição estimada da tocha no instante t. */
  posicaoEm(t: number): { x: number; y: number } | null {
    const a = this.amostras
    if (a.length === 0) return null
    if (t <= a[0].t) return a[0]
    for (let k = a.length - 1; k > 0; k--) {
      if (t >= a[k - 1].t) return posicaoEntre(a[k - 1], a[k], t)
    }
    return a[0]
  }

  medir(agoraMs: number): Velocidades {
    const a = this.amostras
    if (a.length === 0) return PARADO
    const t1 = Math.max(agoraMs, a[a.length - 1].t)
    const t0 = t1 - this.janelaMs

    // A trajetória é feita de retas; somamos o comprimento entre as quebras.
    const quebras = [t0]
    for (let k = 1; k < a.length; k++) {
      const tIni = inicioDoDeslocamento(a[k - 1], a[k])
      if (tIni > t0 && tIni < t1) quebras.push(tIni)
      if (a[k].t > t0 && a[k].t < t1) quebras.push(a[k].t)
    }
    quebras.push(t1)
    quebras.sort((p, q) => p - q)

    let caminho = 0
    let anterior = this.posicaoEm(quebras[0])!
    for (let i = 1; i < quebras.length; i++) {
      const p = this.posicaoEm(quebras[i])!
      caminho += Math.hypot(p.x - anterior.x, p.y - anterior.y)
      anterior = p
    }

    const inicio = this.posicaoEm(t0)!
    const fim = this.posicaoEm(t1)!
    const s = this.janelaMs / 1000
    return {
      avancoMms: (fim.x - inicio.x) / s,
      lateralMms: (fim.y - inicio.y) / s,
      totalMms: caminho / s,
    }
  }
}
