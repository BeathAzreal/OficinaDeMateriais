import type { FonteEntrada } from '../../entrada/fonte'
import { FontePonteiro } from '../../entrada/ponteiro'
import { gravidade, NOME_POSICAO, POSICAO_PLANA, posicaoDe, SIGLAS_POSICAO, type FamiliaJunta, type PosicaoPeca } from '../../modelo/juntas'
import type { Vista } from '../../render/vista'
import { h } from '../dom'

/*
 * Posicionar a peça (H42, H47), sempre com o arco FECHADO:
 * - arrastando com o botão de girar a peça (padrão: direito) ou com a tecla
 *   da caneta segurada (padrão: E ou B): para os lados gira no próprio
 *   plano, para cima e para baixo tomba (gestos.ts);
 * - ou segurando os botões ⟲ ⟳ ▲ ▼, ou o direcional do controle.
 * Apenas rotação em X, em torno da garra, limitada pelo suporte.
 * As duas juntas decidem a posição de soldagem (plana, horizontal, vertical
 * ou sobrecabeça), que muda a poça (H47). Peça presa na estrutura não mexe.
 */

const VELOCIDADE_GRAUS_S = 60
/** Direcional do controle no mapeamento padrão do navegador. */
const BOTAO_CIMA = 12
const BOTAO_BAIXO = 13

export interface OpcoesGiro {
  /** Como a peça chega (H47). */
  inicial?: PosicaoPeca
  /** Peça presa: nada gira. */
  fixa?: boolean
  /** Para o código da posição (1G… ou 1F…). */
  familia?: FamiliaJunta
  /** H103: emenda de tubos: ⟲ ⟳ giram o tubo no próprio eixo (o "giro" da posição). */
  tubo?: boolean
}

export interface Giro {
  elemento: HTMLElement
  /** Posição atual da peça (graus). */
  readonly posicao: PosicaoPeca
  limitar: (teste: (giro: number, rolagem: number) => boolean) => void
  /** Chamado a cada quadro, antes de desenhar. */
  atualizar: (agoraMs: number, vista: Vista, fonte: FonteEntrada | null, arcoAberto: boolean) => void
  /** Gesto de arrastar (graus): só com o arco fechado e a peça solta. */
  aplicar: (dGiroGraus: number, dRolagemGraus: number) => void
  /** Volta para a posição em que a peça chegou (troca de peça na bancada). */
  reiniciar: (op?: OpcoesGiro) => void
  destruir: () => void
}

export function montarGiro(op: OpcoesGiro = {}): Giro {
  let inicial: PosicaoPeca = op.inicial ?? POSICAO_PLANA
  let fixa = !!op.fixa
  let familia: FamiliaJunta = op.familia ?? 'chanfro'
  let tubo = !!op.tubo
  let giro = inicial.giroGraus
  let rolagem = inicial.rolagemGraus
  let tAnterior: number | null = null
  let arcoAberto = false
  let permite = (_g: number, _r: number) => true
  const mover = (dg: number, dr: number) => {
    const n = Math.max(1, Math.ceil(Math.max(Math.abs(dg), Math.abs(dr))))
    for (let i = 0; i < n; i++) {
      const g = giro + dg / n, r = rolagem + dr / n
      if (!permite(g, r)) break
      giro = g; rolagem = r
    }
  }
  const tela = { esq: false, dir: false, cima: false, baixo: false }
  type Lado = keyof typeof tela

  const segurar = (rotulo: string, titulo: string, lado: Lado) => {
    const b = h('button', { type: 'button', class: 'botao-redondo botao-giro', title: titulo, 'aria-label': titulo }, rotulo)
    const soltar = () => (tela[lado] = false)
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault()
      tela[lado] = true
      try {
        b.setPointerCapture(e.pointerId)
      } catch {
        // Ponteiro sintético: segue sem captura.
      }
    })
    b.addEventListener('pointerup', soltar)
    b.addEventListener('pointercancel', soltar)
    b.addEventListener('lostpointercapture', soltar)
    return b
  }
  const botoes = [
    segurar('⟲', 'Girar a peça no plano, sentido anti-horário (segure)', 'esq'),
    segurar('⟳', 'Girar a peça no plano, sentido horário (segure)', 'dir'),
    segurar('▲', 'Girar a peça em X para trás, até o limite do suporte (segure)', 'cima'),
    segurar('▼', 'Girar a peça em X para a frente, até o limite do suporte (segure)', 'baixo'),
  ]
  const leituraGiro = h('output', { class: 'giro-angulo', title: 'Rotação da peça: volta completa de 360°' }, '0°')
  const leituraRolagem = h('output', { class: 'giro-angulo', title: 'Tombamento (0° = face para cima)' }, '0°')
  const leituraPosicao = h('output', { class: 'giro-posicao', 'aria-live': 'polite' })
  // A peça vista de lado: a chapa tomba contra o piso e a tocha fica sempre do lado da face (H47).
  const lado = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  lado.setAttribute('viewBox', '0 0 40 40')
  lado.setAttribute('class', 'giro-lado')
  lado.setAttribute('aria-hidden', 'true')
  lado.innerHTML =
    '<line class="piso" x1="2" y1="37" x2="38" y2="37"/><g class="peca-lado"><rect class="chapa" x="8" y="19" width="24" height="4" rx="1"/><line class="face" x1="8" y1="19" x2="32" y2="19"/><path class="tocha" d="M20 16 L20 6 M17 9 L20 5 L23 9"/></g>'
  const pecaLado = lado.querySelector('.peca-lado')!
  const endireitar = h('button', { type: 'button', class: 'botao-fantasma botao-endireitar', title: 'Voltar a peça para como ela chegou (com o arco fechado)' }, 'Como chegou')
  endireitar.addEventListener('click', () => {
    giro = inicial.giroGraus
    rolagem = inicial.rolagemGraus
  })

  const elemento = h(
    'div',
    { class: 'giro', role: 'group', 'aria-label': 'Posicionar a peça' },
    h('span', { class: 'giro-grupo' }, botoes[0], leituraGiro, botoes[1]),
    h('span', { class: 'giro-grupo' }, botoes[2], leituraRolagem, botoes[3]),
    lado,
    leituraPosicao,
    endireitar,
  )

  const perdeuFoco = () => {
    for (const k of Object.keys(tela) as Lado[]) tela[k] = false
  }
  window.addEventListener('blur', perdeuFoco)

  const direcional = (a: number, b: number): number => {
    let d = 0
    for (const g of navigator.getGamepads?.() ?? []) {
      if (!g) continue
      if (g.buttons[a]?.pressed) d -= 1
      if (g.buttons[b]?.pressed) d += 1
    }
    return Math.sign(d)
  }
  const sentido = (menos: Lado, mais: Lado, a: number, b: number) =>
    Math.sign((tela[mais] ? 1 : 0) - (tela[menos] ? 1 : 0) + direcional(a, b))

  const api: Giro = {
    elemento,
    limitar(teste) { permite = teste },
    get posicao() {
      return { rolagemGraus: rolagem, giroGraus: giro }
    },
    aplicar(dGiro, dRolagem) {
      if (arcoAberto || fixa) return
      mover(tubo ? dGiro : 0, dRolagem)
    },
    atualizar(agoraMs, vista, fonte, aberto) {
      arcoAberto = aberto
      const dt = tAnterior === null ? 0 : Math.min(0.1, (agoraMs - tAnterior) / 1000)
      tAnterior = agoraMs
      // H47: a peça só se mexe com o arco fechado (e não se estiver presa).
      const pode = !arcoAberto && !fixa
      if (pode) {
        // H103: no tubo, ⟲ ⟳ giram o tubo no eixo para trazer o trecho a soldar para cima.
        const dGiro = tubo ? sentido('esq', 'dir', -1, -1) * VELOCIDADE_GRAUS_S * dt : 0
        mover(dGiro, sentido('cima', 'baixo', BOTAO_CIMA, BOTAO_BAIXO) * VELOCIDADE_GRAUS_S * dt)
      }
      for (const b of botoes) b.disabled = !pode
      if (!tubo) botoes[0].disabled = botoes[1].disabled = true
      botoes[0].title = botoes[0].ariaLabel = tubo ? 'Girar o tubo no próprio eixo, sentido anti-horário (segure)' : 'Girar a peça no plano, sentido anti-horário (segure)'
      botoes[1].title = botoes[1].ariaLabel = tubo ? 'Girar o tubo no próprio eixo, sentido horário (segure)' : 'Girar a peça no plano, sentido horário (segure)'
      endireitar.disabled = !pode || (giro === inicial.giroGraus && rolagem === inicial.rolagemGraus)
      const angulo = (giro * Math.PI) / 180
      const mudou = vista.angulo !== angulo
      vista.definirAngulo(angulo)
      if (mudou && fonte instanceof FontePonteiro) fonte.reamostrar(agoraMs)
      leituraGiro.textContent = `${Math.round(((giro % 360) + 360) % 360)}°`
      leituraRolagem.textContent = `${Math.round(((rolagem % 360) + 360) % 360)}°`
      pecaLado.setAttribute('transform', `rotate(${-rolagem.toFixed(1)} 20 21)`)
      const pos = posicaoDe(gravidade({ rolagemGraus: rolagem, giroGraus: giro }))
      // Duas partes: em telas baixas o modo de fixação some e fica só a posição (estilo-espaco.css).
      const modo = fixa ? 'Presa na garra · ' : tubo ? 'Tubo · gire no eixo · ' : 'Rotação somente X · '
      // H103: no tubo a posição muda em volta; com o eixo de pé, a volta inteira é horizontal (2G).
      const deitado = Math.abs(Math.cos((rolagem * Math.PI) / 180)) > 0.7
      const nome = tubo ? (deitado ? 'plana em cima, vertical no lado, sobrecabeça embaixo' : 'Horizontal em volta (2G · PC)') : `${NOME_POSICAO[pos]} (${SIGLAS_POSICAO[familia][pos]})`
      if (leituraPosicao.textContent !== modo + nome) leituraPosicao.replaceChildren(h('span', { class: 'giro-modo' }, modo), nome)
      elemento.classList.toggle('travado', !pode)
    },
    reiniciar(novo = {}) {
      inicial = novo.inicial ?? POSICAO_PLANA
      fixa = !!novo.fixa
      familia = novo.familia ?? 'chanfro'
      tubo = !!novo.tubo
      giro = inicial.giroGraus
      rolagem = inicial.rolagemGraus
    },
    destruir() {
      window.removeEventListener('blur', perdeuFoco)
    },
  }
  return api
}
