import type { App } from '../app'
import { anexar, h } from '../dom'
import '../../menu-grafico.css'

export interface OpcaoOficina {
  nome: string
  descricao: string
  abrir: () => void
}

/** A mesma cena acompanha a escolha do modo, processo e peça. */
export function menuOficina(app: App, titulo: string, caminho: string, opcoes: OpcaoOficina[], voltar: OpcaoOficina): void {
  app.ir(() => {
    document.body.classList.add('menu-grafico')
    app.raiz.classList.add('tela-inicio', 'submenu-oficina')
    app.raiz.classList.toggle('submenu-longo', opcoes.length > 4)
    let frame = 0
    let proximo = 0
    let confirmarAntes = !!navigator.getGamepads?.()[app.preferencias.indiceControle]?.buttons[0]?.pressed
    let saindo = false
    let timer = 0
    let indice = 0
    const itens = [...opcoes, voltar]
    const descricao = h('p', { class: 'grafico-descricao', 'aria-live': 'polite' }, itens[0].descricao)
    const abrir = (i: number) => {
      if (saindo) return
      saindo = true
      botoes[i].classList.add('confirmado')
      app.raiz.classList.add('menu-saindo')
      const reduzir = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      timer = window.setTimeout(itens[i].abrir, reduzir ? 0 : 240)
    }
    const selecionar = (i: number, foco = false) => {
      if (saindo) return
      indice = (i + itens.length) % itens.length
      botoes.forEach((b, n) => { b.classList.toggle('selecionado', n === indice); b.tabIndex = n === indice ? 0 : -1 })
      descricao.textContent = itens[indice].descricao
      if (foco) botoes[indice].focus()
    }
    const botoes = itens.map((o, i) => h('button', {
      type: 'button', class: `grafico-opcao${i === opcoes.length ? ' opcao-voltar' : ''}`,
      on: { pointerenter: () => selecionar(i), focus: () => selecionar(i), click: () => abrir(i) },
    }, h('span', {}, o.nome), h('span', { class: 'grafico-seta', 'aria-hidden': 'true' }, i === opcoes.length ? '←' : '↗')))
    const teclas = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.altKey || e.metaKey || document.querySelector('[role="dialog"]')) return
      if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) {
        e.preventDefault()
        selecionar(e.key === 'Home' ? 0 : e.key === 'End' ? itens.length - 1 : indice + (e.key === 'ArrowDown' ? 1 : -1), true)
      } else if (e.key === 'Enter' && e.target === app.raiz.querySelector('.tela-titulo')) { e.preventDefault(); abrir(indice) }
      else if (e.key === 'Escape') { e.preventDefault(); abrir(itens.length - 1) }
    }
    window.addEventListener('keydown', teclas)
    const controle = (agora: number) => {
      const g = navigator.getGamepads?.()[app.preferencias.indiceControle]
      if (g && !document.querySelector('[role="dialog"]') && document.visibilityState === 'visible') {
        const direcao = g.buttons[13]?.pressed || g.axes[1] > .55 ? 1 : g.buttons[12]?.pressed || g.axes[1] < -.55 ? -1 : 0
        if (direcao && agora > proximo) { selecionar(indice + direcao, true); proximo = agora + 210 }
        if (g.buttons[0]?.pressed && !confirmarAntes) abrir(indice)
        confirmarAntes = !!g.buttons[0]?.pressed
      }
      frame = requestAnimationFrame(controle)
    }
    frame = requestAnimationFrame(controle)
    anexar(app.raiz,
      h('header', { class: 'grafico-titulo' }, h('p', {}, caminho), h('h2', { class: 'tela-titulo', tabindex: '-1' }, titulo)),
      h('span', { class: 'grafico-versao' }, 'ALPHA / 2.2'),
      h('nav', { class: 'grafico-lista', 'aria-label': titulo }, ...botoes),
      h('div', { class: 'grafico-legenda' }, descricao),
      h('footer', { class: 'grafico-rodape' }, h('span', {}, 'OFICINA DE SOLDAGEM'), h('span', {}, '↑ ↓ ESCOLHER    ENTER CONFIRMAR    ESC VOLTAR')))
    selecionar(0)
    return () => {
      clearTimeout(timer)
      cancelAnimationFrame(frame)
      window.removeEventListener('keydown', teclas)
      document.body.classList.remove('menu-grafico')
      app.raiz.classList.remove('submenu-oficina', 'submenu-longo', 'menu-saindo')
    }
  }, titulo)
}
