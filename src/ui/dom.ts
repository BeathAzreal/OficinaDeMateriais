/** Pequenos utilitários de DOM para montar as telas sem framework. */

type Filho = Node | string | number | null | undefined | false
type Atributos = Record<string, unknown> & {
  class?: string
  on?: Partial<{ [K in keyof HTMLElementEventMap]: (e: HTMLElementEventMap[K]) => void }>
}

const PROPRIEDADES = new Set(['value', 'checked', 'disabled', 'selected', 'hidden', 'textContent', 'htmlFor', 'tabIndex'])

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  atributos: Atributos = {},
  ...filhos: (Filho | Filho[])[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag)
  for (const [k, v] of Object.entries(atributos)) {
    if (v === undefined || v === null || v === false) continue
    if (k === 'on') {
      for (const [evento, f] of Object.entries(v as Record<string, EventListener>)) el.addEventListener(evento, f)
    } else if (k === 'class') {
      el.className = String(v)
    } else if (PROPRIEDADES.has(k)) {
      ;(el as unknown as Record<string, unknown>)[k] = v
    } else {
      el.setAttribute(k, v === true ? '' : String(v))
    }
  }
  for (const f of filhos.flat()) {
    if (f === null || f === undefined || f === false) continue
    el.append(f instanceof Node ? f : String(f))
  }
  return el
}

export const n1 = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
export const n0 = (v: number) => v.toLocaleString('pt-BR', { maximumFractionDigits: 0 })
export const pct = (v: number) => v.toLocaleString('pt-BR', { style: 'percent', maximumFractionDigits: 0 })
export const dataHora = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })

/** Oferece um arquivo de texto para o usuário salvar. */
export function baixarArquivo(nome: string, conteudo: string, tipo = 'application/json'): void {
  const url = URL.createObjectURL(new Blob([conteudo], { type: tipo }))
  const a = h('a', { href: url, download: nome })
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Lê um arquivo escolhido pelo usuário como texto. */
export function lerArquivo(arquivo: File): Promise<string> {
  return arquivo.text()
}

/** Cabeçalho de tela com foco para leitores de tela e teclado. */
export function titulo(texto: string, subtitulo?: string): HTMLElement {
  return h('header', { class: 'tela-cabecalho' }, h('h2', { tabindex: '-1', class: 'tela-titulo' }, texto), subtitulo ? h('p', { class: 'tela-subtitulo' }, subtitulo) : null)
}

/** Contagem animada (estilo arcade). Respeita "reduzir movimento". */
export function contarAte(el: HTMLElement, valor: number, casas = 1, duracaoMs = 1200): void {
  const fmt = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
    el.textContent = fmt(valor)
    return
  }
  const inicio = performance.now()
  const passo = (agora: number) => {
    const f = Math.min(1, (agora - inicio) / duracaoMs)
    const suave = 1 - (1 - f) ** 3
    el.textContent = fmt(valor * suave)
    if (f < 1) requestAnimationFrame(passo)
  }
  requestAnimationFrame(passo)
}

/** append que aceita null/false e listas (como os filhos de h()). */
export function anexar(pai: Element, ...filhos: (Filho | Filho[])[]): void {
  for (const f of filhos.flat()) {
    if (f === null || f === undefined || f === false) continue
    pai.append(f instanceof Node ? f : String(f))
  }
}

/** replaceChildren que aceita null/false e listas. */
export function substituir(pai: Element, ...filhos: (Filho | Filho[])[]): void {
  pai.replaceChildren()
  anexar(pai, ...filhos)
}
