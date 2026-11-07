/*
 * Gestos de posicionamento sobre a área da peça (H42, H47): mover a câmera
 * em volta da peça e girar/tombar a peça, sempre com o arco FECHADO. Assim
 * ninguém gira a peça (nem a câmera) e solda ao mesmo tempo.
 *
 * - Mouse: um botão arrastando gira a peça (padrão: direito) e outro move a
 *   câmera (padrão: o do meio, a "rodinha"). A roda aproxima e afasta, ou
 *   gira a câmera, conforme a preferência.
 * - Mesa digitalizadora: segurar uma tecla e mover a caneta (encostada ou
 *   não). Padrão: E ou B giram a peça; Espaço move a câmera.
 *
 * Enquanto um gesto está ativo, os eventos do ponteiro não chegam à fonte de
 * entrada (ponteiro.ts): a caneta encostada não abre o arco.
 */

export type BotaoMouse = 'direito' | 'meio'
export type Gesto = 'peca' | 'camera'

export interface ControlesPeca {
  /** Botão do mouse que, arrastando, gira a peça. */
  botaoPeca: BotaoMouse
  /** Botão do mouse que, arrastando, move a câmera (sempre o outro). */
  botaoCamera: BotaoMouse
  /** A roda do mouse aproxima a câmera ou gira a câmera. */
  rodaMouse: 'zoom' | 'camera'
  /** Teclas que, seguradas, fazem o movimento da caneta girar a peça (minúsculas, como KeyboardEvent.key). */
  teclasPeca: string[]
  /** Tecla que, segurada, faz o movimento da caneta mover a câmera. */
  teclaCamera: string
}

export const CONTROLES_PADRAO: ControlesPeca = {
  botaoPeca: 'direito',
  botaoCamera: 'meio',
  rodaMouse: 'zoom',
  teclasPeca: ['e', 'b'],
  teclaCamera: ' ',
}

/** Graus de giro ou tombamento da peça por pixel arrastado. */
export const GRAUS_POR_PIXEL = 0.4

export const NOME_BOTAO: Record<BotaoMouse, string> = { direito: 'botão direito', meio: 'botão do meio (rodinha)' }

/** Nome legível de uma tecla. */
export function nomeTecla(k: string): string {
  if (k === ' ') return 'Espaço'
  return k.length === 1 ? k.toUpperCase() : k
}

/** Teclas que não podem ser usadas (atalhos do jogo e navegação). */
const RESERVADAS = new Set(['enter', 'escape', 'tab', 'p'])

export function teclaValida(k: string): boolean {
  return typeof k === 'string' && k.length > 0 && k.length <= 12 && !RESERVADAS.has(k.toLowerCase())
}

/** Aceita controles parciais ou antigos, completando com o padrão; os dois botões nunca são iguais. */
export function validarControles(dados: unknown): ControlesPeca {
  const o = (dados && typeof dados === 'object' ? dados : {}) as Record<string, unknown>
  const P = CONTROLES_PADRAO
  const botao = (v: unknown): BotaoMouse | null => (v === 'direito' || v === 'meio' ? v : null)
  const botaoPeca = botao(o.botaoPeca) ?? P.botaoPeca
  const botaoCamera: BotaoMouse = botaoPeca === 'direito' ? 'meio' : 'direito'
  const teclasPeca = Array.isArray(o.teclasPeca) ? [...new Set(o.teclasPeca.filter((k): k is string => teclaValida(k as string)).map((k) => k.toLowerCase()))].slice(0, 2) : []
  let teclaCamera = typeof o.teclaCamera === 'string' && teclaValida(o.teclaCamera) ? o.teclaCamera.toLowerCase() : P.teclaCamera
  const pecas = teclasPeca.length ? teclasPeca : [...P.teclasPeca]
  // Uma tecla não faz as duas coisas.
  if (pecas.includes(teclaCamera)) teclaCamera = pecas.includes(P.teclaCamera) ? '' : P.teclaCamera
  return {
    botaoPeca,
    botaoCamera,
    rodaMouse: o.rodaMouse === 'camera' ? 'camera' : 'zoom',
    teclasPeca: pecas,
    teclaCamera,
  }
}

/** Qual gesto um botão do mouse (PointerEvent.button: 1 = meio, 2 = direito) faz. */
export function gestoDoBotao(c: ControlesPeca, button: number): Gesto | null {
  const b: BotaoMouse | null = button === 2 ? 'direito' : button === 1 ? 'meio' : null
  if (!b) return null
  return b === c.botaoPeca ? 'peca' : b === c.botaoCamera ? 'camera' : null
}

/** Qual gesto uma tecla segurada faz. */
export function gestoDaTecla(c: ControlesPeca, key: string): Gesto | null {
  const k = key.toLowerCase()
  if (c.teclasPeca.includes(k)) return 'peca'
  if (c.teclaCamera && k === c.teclaCamera) return 'camera'
  return null
}

export interface OpcoesGestos {
  /** Área que recebe o ponteiro (o canvas da peça). */
  alvo: HTMLElement
  controles: () => ControlesPeca
  /** Falso com o arco aberto (ou pausado): nada se mexe. */
  pode: () => boolean
  /** Deslocamento do ponteiro em pixels durante o gesto. */
  mover: (g: Gesto, dx: number, dy: number) => void
  /** Roda do mouse no modo "aproximar" (deltaY do evento). */
  aproximar: (deltaY: number) => void
  /** O gesto acabou: a mesma posição na tela pode ser outro ponto da peça. */
  aoTerminar: () => void
}

function campoDeTexto(t: EventTarget | null): boolean {
  return t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement || (t instanceof HTMLElement && t.isContentEditable)
}

export class Gestos {
  /** Gesto em andamento (botão ou tecla), ou null. */
  ativo: Gesto | null = null
  private porBotao: Gesto | null = null
  private porTecla: Gesto | null = null
  private ultimo: { x: number; y: number } | null = null
  private readonly remover: (() => void)[] = []

  constructor(private readonly op: OpcoesGestos) {
    const ouvir = <K extends keyof HTMLElementEventMap>(tipo: K, f: (e: HTMLElementEventMap[K]) => void, opcoes: AddEventListenerOptions = { capture: true }) => {
      op.alvo.addEventListener(tipo, f as EventListener, opcoes)
      this.remover.push(() => op.alvo.removeEventListener(tipo, f as EventListener, opcoes))
    }
    const janela = <K extends keyof WindowEventMap>(tipo: K, f: (e: WindowEventMap[K]) => void) => {
      window.addEventListener(tipo, f as EventListener, true)
      this.remover.push(() => window.removeEventListener(tipo, f as EventListener, true))
    }
    // Fase de captura: o gesto vê o evento antes da fonte de entrada e pode escondê-lo dela.
    ouvir('pointerdown', (e) => {
      this.ultimo = { x: e.clientX, y: e.clientY }
      const g = gestoDoBotao(op.controles(), e.button) ?? this.porTecla
      if (!g) return
      // Com o arco aberto, o gesto não começa (e o botão esquerdo continua soldando).
      if (!op.pode()) {
        if (e.button !== 0) e.preventDefault()
        return
      }
      e.preventDefault()
      e.stopImmediatePropagation()
      try {
        op.alvo.setPointerCapture(e.pointerId)
      } catch {
        // Ponteiro sintético: segue sem captura.
      }
      this.porBotao = g
      this.atualizarAtivo()
    })
    ouvir('pointermove', (e) => {
      const antes = this.ultimo
      this.ultimo = { x: e.clientX, y: e.clientY }
      // Tecla segurada desde antes de o arco fechar: o gesto começa agora.
      if (!this.ativo && this.porTecla && op.pode()) this.atualizarAtivo()
      if (!this.ativo) return
      if (!op.pode()) {
        this.encerrar()
        return
      }
      e.stopImmediatePropagation()
      if (antes) op.mover(this.ativo, e.clientX - antes.x, e.clientY - antes.y)
    })
    const soltar = (e: PointerEvent) => {
      if (!this.porBotao) return
      e.stopImmediatePropagation()
      this.porBotao = null
      this.atualizarAtivo()
    }
    ouvir('pointerup', soltar)
    ouvir('pointercancel', soltar)
    ouvir('lostpointercapture', soltar)
    ouvir('contextmenu', (e) => e.preventDefault())
    ouvir(
      'wheel',
      (e) => {
        e.preventDefault()
        if (!op.pode()) return
        if (op.controles().rodaMouse === 'zoom') op.aproximar(e.deltaY)
        else {
          op.mover('camera', -e.deltaX * 0.5, -e.deltaY * 0.5)
          op.aoTerminar()
        }
      },
      { capture: true, passive: false },
    )
    janela('keydown', (e) => {
      if (campoDeTexto(e.target) || e.ctrlKey || e.metaKey || e.altKey) return
      const g = gestoDaTecla(op.controles(), e.key)
      if (!g) return
      // Espaço não rola a página nem aperta o botão que estiver em foco.
      e.preventDefault()
      if (e.repeat || this.porTecla === g) return
      this.porTecla = g
      this.atualizarAtivo()
    })
    janela('keyup', (e) => {
      const g = gestoDaTecla(op.controles(), e.key)
      if (!g || this.porTecla !== g) return
      e.preventDefault()
      this.porTecla = null
      this.atualizarAtivo()
    })
    janela('blur', () => this.encerrar())
  }

  private atualizarAtivo(): void {
    const antes = this.ativo
    this.ativo = this.porBotao ?? (this.op.pode() ? this.porTecla : null)
    if (antes && !this.ativo) this.op.aoTerminar()
  }

  private encerrar(): void {
    this.porBotao = null
    this.porTecla = null
    this.atualizarAtivo()
  }

  destruir(): void {
    for (const r of this.remover.splice(0)) r()
  }
}
