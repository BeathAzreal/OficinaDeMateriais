import { h } from '../dom'

/*
 * H103: girar o tubo no próprio eixo nos treinos de eletrodo e TIG. Segure
 * ⟲ ou ⟳ com o arco apagado: o trecho a soldar vem para cima (1G). Botões
 * em vez de teclas, para não disputar as teclas configuráveis do eletrodo.
 */

const VELOCIDADE_GRAUS_S = 60

export interface GiroTubo {
  elemento: HTMLElement
  /** A cada quadro: gira se um botão estiver seguro e `pode` for verdadeiro. */
  atualizar: (dt: number, pode: boolean) => void
  /** Volta ao ângulo em que o tubo chegou (peça nova). */
  reiniciar: () => void
}

export function montarGiroTubo(inicialGraus: number, aoGirar: (radianos: number) => void): GiroTubo {
  let graus = inicialGraus
  let sentido = 0
  const leitura = h('output', { title: 'Rotação do tubo no próprio eixo' }, `${Math.round(graus)}°`)
  const botao = (rotulo: string, titulo: string, s: number) => {
    const b = h('button', { type: 'button', title: titulo, 'aria-label': titulo }, rotulo) as HTMLButtonElement
    const soltar = () => { if (sentido === s) sentido = 0 }
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault()
      sentido = s
      try { b.setPointerCapture(e.pointerId) } catch { /* ponteiro sintético */ }
    })
    b.addEventListener('pointerup', soltar)
    b.addEventListener('pointercancel', soltar)
    b.addEventListener('lostpointercapture', soltar)
    return b
  }
  const menos = botao('⟲', 'Girar o tubo no próprio eixo, sentido anti-horário (segure, com o arco apagado)', -1)
  const mais = botao('⟳', 'Girar o tubo no próprio eixo, sentido horário (segure, com o arco apagado)', 1)
  const elemento = h('div', { class: 'giro-tubo-bancada', role: 'group', 'aria-label': 'Girar o tubo' }, h('span', {}, 'TUBO'), menos, leitura, mais)
  const aplicar = () => {
    leitura.textContent = `${Math.round(((graus % 360) + 360) % 360)}°`
    aoGirar((graus * Math.PI) / 180)
  }
  return {
    elemento,
    atualizar(dt, pode) {
      menos.disabled = mais.disabled = !pode
      if (!pode || sentido === 0 || !(dt > 0)) return
      graus += sentido * VELOCIDADE_GRAUS_S * dt
      aplicar()
    },
    reiniciar() {
      graus = inicialGraus
      sentido = 0
      aplicar()
    },
  }
}
