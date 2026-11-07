import { h } from '../dom'

/** Seletores físicos de página: todos os controles ficam montados, sem rolagem. */
export function painelMaquina(paginas: [string, HTMLElement][]): HTMLElement {
  const id = Math.random().toString(36).slice(2, 9)
  const botoes = paginas.map(([nome], i) => h('button', { type: 'button', role: 'tab', id: `pm-${id}-${i}`, 'aria-selected': String(i === 0), 'aria-controls': `pm-corpo-${id}-${i}`, tabindex: i === 0 ? '0' : '-1' }, nome))
  const corpos = paginas.map(([, el], i) => h('div', { class: 'instrumentos-pagina', role: 'tabpanel', id: `pm-corpo-${id}-${i}`, 'aria-labelledby': `pm-${id}-${i}`, hidden: i !== 0 }, el))
  const selecionar = (indice: number) => {
    botoes.forEach((b, i) => { b.setAttribute('aria-selected', String(i === indice)); b.tabIndex = i === indice ? 0 : -1; corpos[i].hidden = i !== indice })
  }
  botoes.forEach((b, i) => {
    b.addEventListener('click', () => selecionar(i))
    b.addEventListener('keydown', e => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return
      e.preventDefault()
      const n = e.key === 'Home' ? 0 : e.key === 'End' ? paginas.length - 1 : (i + (e.key === 'ArrowRight' ? 1 : -1) + paginas.length) % paginas.length
      selecionar(n); botoes[n].focus()
    })
  })
  return h('div', { class: 'instrumentos' }, h('div', { class: 'instrumentos-abas', role: 'tablist', 'aria-label': 'Painel da máquina' }, ...botoes), ...corpos)
}
