import type { Extras, FonteEntrada, Receptor } from './fonte'

/*
 * Controle (gamepad) via Gamepad API.
 *
 * O analógico controla a VELOCIDADE da tocha (não a posição): é o que um
 * controle faz melhor. A posição é integrada no tempo em passos FIXOS de
 * 8 ms a partir do relógio real; por isso, com o analógico parado numa
 * posição, a trajetória é a mesma a 30 ou a 144 quadros por segundo.
 *
 * Mapeamento: no layout "standard" do navegador, R2 = botão 7, X (Cross) = 0,
 * L1 = 4, Options = 9. Controles de PlayStation 4 costumam aparecer assim
 * por cabo USB; por Bluetooth, e em alguns navegadores, o mapeamento pode
 * mudar — por isso os botões são configuráveis e testáveis.
 */

/** O mínimo da Gamepad API que usamos (facilita testar sem hardware). */
export interface LeituraGamepad {
  readonly id: string
  readonly index: number
  readonly connected: boolean
  readonly mapping: string
  readonly axes: readonly number[]
  readonly buttons: readonly { pressed: boolean; value: number }[]
}

export interface ConfigControle {
  /** Multiplica a velocidade máxima (0,25 a 2). */
  sensibilidade: number
  /** Raio da zona morta do analógico (0 a 0,5). */
  zonaMorta: number
  botaoArco: number
  /** Segundo botão que também abre o arco (−1 = nenhum). Padrão: X / Cross. */
  botaoArcoAlternativo: number
  botaoPrecisao: number
  eixoX: number
  eixoY: number
  inverterY: boolean
}

export const CONFIG_CONTROLE_PADRAO: ConfigControle = {
  sensibilidade: 1,
  zonaMorta: 0.15,
  botaoArco: 7,
  botaoArcoAlternativo: 0,
  botaoPrecisao: 4,
  eixoX: 0,
  eixoY: 1,
  inverterY: false,
}

/** Velocidade da tocha com o analógico no fim do curso e sensibilidade 1 (mm/s). H87 (v1.8): metade (era 30), porque a solda certa pede metade da velocidade. */
export const VELOCIDADE_MAXIMA_MMS = 15
/** Com o botão de precisão pressionado. */
export const FATOR_PRECISAO = 0.4
/** Passo fixo de integração da posição (ms). */
export const PASSO_CONTROLE_MS = 8

export function descreverControle(g: LeituraGamepad): { nome: string; padrao: boolean; pareceDualShock4: boolean } {
  const pareceDualShock4 = /054c|dualshock|wireless controller/i.test(g.id)
  return { nome: g.id, padrao: g.mapping === 'standard', pareceDualShock4 }
}

/**
 * Zona morta radial com reescala (sem "degrau" na borda) e curva quadrática
 * para dar precisão perto do centro. Devolve componentes em −1..1.
 */
export function aplicarZonaMorta(x: number, y: number, zona: number): { x: number; y: number } {
  const m = Math.hypot(x, y)
  if (m <= zona || m === 0) return { x: 0, y: 0 }
  const util = Math.min(1, (m - zona) / (1 - zona))
  const curva = util * util
  return { x: (x / m) * curva, y: (y / m) * curva }
}

/** Pressionado de verdade: alguns gatilhos analógicos só informam o valor. */
export function botaoPressionado(g: LeituraGamepad, indice: number): boolean {
  const b = g.buttons[indice]
  return !!b && (b.pressed || b.value > 0.5)
}

export class FonteControle implements FonteEntrada {
  readonly dispositivo = 'controle' as const
  posicao: { x: number; y: number }
  gatilho = false
  extras: Extras = {}
  aoDesconectar: (() => void) | null = null
  conectado = true
  /** Posição (índice) do controle realmente em uso na lista do navegador. */
  indiceEmUso: number | null = null
  private receptor: Receptor | null = null
  private tUltimo: number | null = null
  private limites = { xMin: -10, xMax: 160, yMin: -45, yMax: 45 }

  constructor(
    private readonly indice: number,
    private readonly config: ConfigControle,
    inicio: { x: number; y: number },
    private readonly ler: () => (LeituraGamepad | null)[] = () => [...navigator.getGamepads()],
  ) {
    this.posicao = { ...inicio }
  }

  definirLimites(l: { xMin: number; xMax: number; yMin: number; yMax: number }): void {
    this.limites = l
  }

  ligar(receptor: Receptor): void {
    this.receptor = receptor
    this.tUltimo = null
  }

  desligar(): void {
    this.receptor = null
  }

  /** Depois de uma pausa: o tempo parado não vira movimento. */
  reiniciarRelogio(): void {
    this.tUltimo = null
  }

  /**
   * Estado do controle agora (null se não há nenhum). O navegador nem sempre
   * põe o controle na mesma posição da lista (depois de reconectar ele pode
   * ir para 1, 2...): usa o escolhido se estiver conectado; senão continua
   * com o que já estava em uso; senão o primeiro conectado.
   */
  leitura(): LeituraGamepad | null {
    const lista = this.ler()
    const ok = (g: LeituraGamepad | null | undefined): g is LeituraGamepad => !!g && g.connected
    const preferido = lista[this.indice]
    if (ok(preferido)) {
      this.indiceEmUso = this.indice
      return preferido
    }
    if (this.indiceEmUso !== null && ok(lista[this.indiceEmUso])) return lista[this.indiceEmUso]
    const i = lista.findIndex(ok)
    this.indiceEmUso = i >= 0 ? i : null
    return i >= 0 ? lista[i] : null
  }

  atualizar(agoraMs: number): void {
    const g = this.leitura()
    if (!g) {
      if (this.conectado) {
        this.conectado = false
        if (this.receptor?.arcoAberto) this.receptor.encerrarArco({ t: this.tUltimo ?? agoraMs, ...this.posicao })
        this.gatilho = false
        this.aoDesconectar?.()
      }
      return
    }
    this.conectado = true
    if (this.tUltimo === null) this.tUltimo = agoraMs

    const c = this.config
    const bruto = { x: g.axes[c.eixoX] ?? 0, y: (g.axes[c.eixoY] ?? 0) * (c.inverterY ? -1 : 1) }
    const d = aplicarZonaMorta(bruto.x, bruto.y, c.zonaMorta)
    const precisao = botaoPressionado(g, c.botaoPrecisao) ? FATOR_PRECISAO : 1
    const v = VELOCIDADE_MAXIMA_MMS * c.sensibilidade * precisao
    const vx = d.x * v
    const vy = d.y * v

    // Integra em passos fixos de 8 ms; o resto fica para o próximo quadro.
    while (this.tUltimo + PASSO_CONTROLE_MS <= agoraMs) {
      this.tUltimo += PASSO_CONTROLE_MS
      if (vx === 0 && vy === 0) continue
      this.posicao = {
        x: Math.min(this.limites.xMax, Math.max(this.limites.xMin, this.posicao.x + (vx * PASSO_CONTROLE_MS) / 1000)),
        y: Math.min(this.limites.yMax, Math.max(this.limites.yMin, this.posicao.y + (vy * PASSO_CONTROLE_MS) / 1000)),
      }
      this.receptor?.moverTocha({ t: this.tUltimo, ...this.posicao })
    }

    const quer = botaoPressionado(g, c.botaoArco) || (c.botaoArcoAlternativo >= 0 && botaoPressionado(g, c.botaoArcoAlternativo))
    if (this.receptor) {
      const a = { t: this.tUltimo, ...this.posicao }
      if (quer && !this.receptor.arcoAberto) this.receptor.iniciarArco(a)
      else if (!quer && this.receptor.arcoAberto) this.receptor.encerrarArco(a)
    }
    this.gatilho = quer
    this.extras = {}
  }
}
