import { h } from '../dom'

/*
 * Abas acessíveis (setas ← → trocam): para telas longas caberem numa tela
 * só, cada parte numa aba. O mesmo padrão das abas da inspeção.
 */

export function montarAbas(paineis: [string, HTMLElement][], rotulo: string): { lista: HTMLElement; corpos: HTMLElement[]; escolher: (k: number) => void } {
  const id = Math.random().toString(36).slice(2, 8)
  const lista = h('div', { class: 'abas', role: 'tablist', 'aria-label': rotulo })
  const corpos = paineis.map(([, conteudo], i) => h('div', { class: 'aba-corpo', role: 'tabpanel', id: `aba-${id}-${i}`, 'aria-labelledby': `aba-b-${id}-${i}`, hidden: i !== 0 }, conteudo))
  const botoes = paineis.map(([nome], i) =>
    h('button', { type: 'button', role: 'tab', id: `aba-b-${id}-${i}`, 'aria-controls': `aba-${id}-${i}`, 'aria-selected': String(i === 0), tabindex: i === 0 ? '0' : '-1' }, nome),
  )
  const escolher = (k: number) => {
    botoes.forEach((b, i) => {
      b.setAttribute('aria-selected', String(i === k))
      b.tabIndex = i === k ? 0 : -1
      corpos[i].hidden = i !== k
    })
  }
  botoes.forEach((b, i) => {
    b.addEventListener('click', () => escolher(i))
    b.addEventListener('keydown', (e) => {
      const k = e.key === 'ArrowRight' ? (i + 1) % botoes.length : e.key === 'ArrowLeft' ? (i - 1 + botoes.length) % botoes.length : -1
      if (k < 0) return
      escolher(k)
      botoes[k].focus()
    })
  })
  lista.append(...botoes)
  return { lista, corpos, escolher }
}
