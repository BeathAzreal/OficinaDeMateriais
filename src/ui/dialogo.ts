import { h } from './dom'

/*
 * Diálogos modais acessíveis: foco no primeiro botão, Esc cancela, o foco
 * volta para onde estava. Usados para confirmar ações irreversíveis.
 */

function abrir(conteudo: HTMLElement, botoes: { texto: string; valor: string; primario?: boolean; perigo?: boolean }[], largo = false): Promise<string | null> {
  const camada = document.getElementById('camada-dialogo')!
  const anterior = document.activeElement as HTMLElement | null
  return new Promise((resolver) => {
    const fechar = (valor: string | null) => {
      camada.replaceChildren()
      document.removeEventListener('keydown', teclas, true)
      anterior?.focus?.()
      resolver(valor)
    }
    const teclas = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        fechar(null)
      }
      if (e.key === 'Tab') {
        const focaveis = [...caixa.querySelectorAll<HTMLElement>('button, input, select, textarea')].filter((x) => !x.hasAttribute('disabled'))
        if (focaveis.length === 0) return
        const i = focaveis.indexOf(document.activeElement as HTMLElement)
        const proximo = e.shiftKey ? (i <= 0 ? focaveis.length - 1 : i - 1) : i === focaveis.length - 1 ? 0 : i + 1
        e.preventDefault()
        focaveis[proximo].focus()
      }
    }
    const caixa = h(
      'div',
      { class: largo ? 'dialogo dialogo-largo' : 'dialogo', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'dialogo-titulo' },
      conteudo,
      h(
        'div',
        { class: 'acoes' },
        botoes.map((b) =>
          h('button', { type: 'button', class: [b.primario ? 'primario' : '', b.perigo ? 'perigo' : ''].join(' '), on: { click: () => fechar(b.valor) } }, b.texto),
        ),
      ),
    )
    camada.replaceChildren(h('div', { class: 'dialogo-fundo' }, caixa))
    document.addEventListener('keydown', teclas, true)
    const foco = caixa.querySelector<HTMLElement>('input, textarea, select') ?? caixa.querySelector<HTMLElement>('.acoes button.primario, .acoes button')
    // Sem rolar até o botão: textos longos começam do topo.
    foco?.focus({ preventScroll: true })
    caixa.scrollTop = 0
  })
}

export async function confirmar(tituloTexto: string, mensagem: string | HTMLElement, opcoes: { sim?: string; nao?: string; perigo?: boolean } = {}): Promise<boolean> {
  const r = await abrir(h('div', {}, h('h2', { id: 'dialogo-titulo' }, tituloTexto), typeof mensagem === 'string' ? h('p', {}, mensagem) : mensagem), [
    { texto: opcoes.nao ?? 'Cancelar', valor: 'nao' },
    { texto: opcoes.sim ?? 'Confirmar', valor: 'sim', primario: !opcoes.perigo, perigo: opcoes.perigo },
  ])
  return r === 'sim'
}

export async function avisar(tituloTexto: string, mensagem: string | HTMLElement): Promise<void> {
  await abrir(h('div', {}, h('h2', { id: 'dialogo-titulo' }, tituloTexto), typeof mensagem === 'string' ? h('p', {}, mensagem) : mensagem), [
    { texto: 'Entendi', valor: 'ok', primario: true },
  ])
}

/** Pede um texto; devolve null se cancelado. */
export async function pedirTexto(tituloTexto: string, rotulo: string, inicial = '', opcoes: { multilinha?: boolean; minimo?: number } = {}): Promise<string | null> {
  const campo = opcoes.multilinha
    ? h('textarea', { id: 'dialogo-campo', rows: '3', value: inicial })
    : h('input', { id: 'dialogo-campo', type: 'text', value: inicial, maxlength: '200' })
  const erro = h('p', { class: 'erro', role: 'alert' })
  for (;;) {
    const r = await abrir(h('div', {}, h('h2', { id: 'dialogo-titulo' }, tituloTexto), h('label', { for: 'dialogo-campo' }, rotulo), campo, erro), [
      { texto: 'Cancelar', valor: 'nao' },
      { texto: 'Confirmar', valor: 'sim', primario: true },
    ])
    if (r !== 'sim') return null
    const valor = campo.value.trim()
    if (valor.length >= (opcoes.minimo ?? 1)) return valor
    erro.textContent = `Escreva pelo menos ${opcoes.minimo ?? 1} caractere(s).`
  }
}

/** Painel largo só para leitura (desenho da missão, ajuda). */
export async function abrirPainel(tituloTexto: string, conteudo: HTMLElement): Promise<void> {
  await abrir(h('div', {}, h('h2', { id: 'dialogo-titulo' }, tituloTexto), conteudo), [{ texto: 'Fechar', valor: 'ok', primario: true }], true)
}
