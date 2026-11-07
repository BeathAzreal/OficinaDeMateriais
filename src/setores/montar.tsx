import { StrictMode, type ReactElement } from 'react'
import { createRoot } from 'react-dom/client'

/*
 * O que faz: monta a tela de um setor em React (Usinagem, Laboratório) dentro
 * do jogo, numa "sombra" (Shadow DOM) para que o estilo do setor e o da
 * oficina não se misturem.
 * Onde mexer: o CSS de cada setor continua no arquivo dele (ui/estilo.css);
 * aqui só se troca `:root`/`body` por `:host`, que é a raiz da sombra.
 */

/** Adapta o CSS feito para uma página inteira à raiz da sombra. */
export function cssParaSombra(css: string): string {
  return css
    .replace(/:root\b/g, ':host')
    .replace(/(^|[\s,}])(?:html|body)(?=\s*[{,])/g, '$1:host')
}

export function montarSetor(hospedeiro: HTMLElement, css: string, elemento: ReactElement): () => void {
  const sombra = hospedeiro.shadowRoot ?? hospedeiro.attachShadow({ mode: 'open' })
  const estilo = document.createElement('style')
  estilo.textContent = cssParaSombra(css)
  const raiz = document.createElement('div')
  raiz.className = 'raiz-setor'
  sombra.replaceChildren(estilo, raiz)
  const react = createRoot(raiz)
  react.render(<StrictMode>{elemento}</StrictMode>)
  return () => {
    react.unmount()
    sombra.replaceChildren()
  }
}
