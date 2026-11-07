import { CONTROLES_PADRAO, nomeTecla, teclaValida, validarControles, type ControlesPeca } from '../../entrada/gestos'
import type { App } from '../app'
import { h } from '../dom'

/*
 * Controles da câmera e da peça (gestos.ts): que botão do mouse move a
 * câmera e qual gira a peça, o que a roda faz e quais teclas a caneta usa.
 * Abre da bancada (antes de cada tentativa) e vale na hora.
 */

export function montarControles(app: App): HTMLElement {
  const id = Math.random().toString(36).slice(2, 8)
  const salvar = (novo: Partial<ControlesPeca>) => {
    app.preferencias.controles = validarControles({ ...app.preferencias.controles, ...novo })
    app.salvar('preferencias')
    desenhar()
  }

  const corpo = h('div', { class: 'controles-pecas' })
  /** Botão que espera a próxima tecla apertada. */
  const capturar = (rotulo: string, atual: string, aoEscolher: (k: string) => void) => {
    const b = h('button', { type: 'button', class: 'botao-tecla', 'aria-label': `${rotulo}: ${nomeTecla(atual)}. Clique e aperte outra tecla.` }, atual ? nomeTecla(atual) : '—')
    b.addEventListener('click', () => {
      b.textContent = 'aperte uma tecla…'
      b.classList.add('esperando')
      const ouvir = (e: KeyboardEvent) => {
        e.preventDefault()
        e.stopPropagation()
        window.removeEventListener('keydown', ouvir, true)
        b.classList.remove('esperando')
        if (e.key !== 'Escape' && teclaValida(e.key)) aoEscolher(e.key.toLowerCase())
        else desenhar()
      }
      window.addEventListener('keydown', ouvir, true)
    })
    return b
  }

  const desenhar = () => {
    const c = app.preferencias.controles
    const linha = (rotulo: string, ...campo: Node[]) => h('div', { class: 'campo campo-controle' }, h('span', { class: 'rotulo-campo' }, rotulo), h('div', { class: 'campo-valor' }, campo))
    const botaoPeca = h(
      'select',
      { id: `ctl-botao-${id}`, 'aria-label': 'Botão do mouse que gira a peça' },
      h('option', { value: 'direito', selected: c.botaoPeca === 'direito' }, 'Direito gira a peça · meio move a câmera'),
      h('option', { value: 'meio', selected: c.botaoPeca === 'meio' }, 'Meio gira a peça · direito move a câmera'),
    )
    botaoPeca.addEventListener('change', () => salvar({ botaoPeca: botaoPeca.value as ControlesPeca['botaoPeca'] }))
    const roda = h(
      'select',
      { id: `ctl-roda-${id}`, 'aria-label': 'Roda do mouse' },
      h('option', { value: 'zoom', selected: c.rodaMouse === 'zoom' }, 'Aproxima e afasta a câmera'),
      h('option', { value: 'camera', selected: c.rodaMouse === 'camera' }, 'Gira a câmera em volta da peça'),
    )
    roda.addEventListener('change', () => salvar({ rodaMouse: roda.value as ControlesPeca['rodaMouse'] }))
    const teclasPeca = [0, 1].map((i) =>
      capturar(`Tecla ${i + 1} para girar a peça`, c.teclasPeca[i] ?? '', (k) => {
        const lista = [...c.teclasPeca]
        lista[i] = k
        salvar({ teclasPeca: lista.filter(Boolean), teclaCamera: k === c.teclaCamera ? '' : c.teclaCamera })
      }),
    )
    const teclaCamera = capturar('Tecla para mover a câmera', c.teclaCamera, (k) => salvar({ teclaCamera: k, teclasPeca: c.teclasPeca.filter((t) => t !== k) }))
    const padrao = h('button', { type: 'button', class: 'botao-fantasma' }, 'Voltar ao padrão')
    padrao.addEventListener('click', () => salvar({ ...CONTROLES_PADRAO, teclasPeca: [...CONTROLES_PADRAO.teclasPeca] }))
    corpo.replaceChildren(
      h('p', { class: 'dica' }, 'Câmera e peça só se mexem com o arco fechado: ninguém gira a peça e solda ao mesmo tempo.'),
      h('h4', {}, 'Mouse'),
      linha('Botões (arrastando)', botaoPeca),
      linha('Roda do mouse', roda),
      h('p', { class: 'dica' }, 'Arrastar a peça para os lados gira no plano; para cima e para baixo tomba (0° a 180°). Arrastar a câmera dá a volta na peça e muda a altura do olhar.'),
      h('h4', {}, 'Mesa digitalizadora (caneta) e teclado'),
      linha('Girar a peça: segure', ...teclasPeca),
      linha('Mover a câmera: segure', teclaCamera),
      h('p', { class: 'dica' }, 'Segure a tecla e mova a caneta (encostada ou não): com a tecla apertada a caneta não abre o arco. Enter, Esc, Tab e P são do jogo e não podem ser usadas.'),
      h('h4', {}, 'Controle (PS4/PS5/Xbox)'),
      h('p', { class: 'dica' }, 'Direcional: gira e tomba a peça. Analógico direito: move a câmera.'),
      padrao,
    )
  }
  desenhar()
  return corpo
}
