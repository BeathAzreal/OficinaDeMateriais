import type { App } from '../app'
import { h } from '../dom'
import { somArco } from '../som'
import { telaMenu } from '../telas/menu'
import { montarConfiguracoes } from '../telas/configuracoes'

/** O pause nunca troca a tela: a bancada e a tentativa permanecem montadas. */
export function instalarPause(app: App): void {
  let fundo: HTMLElement | null = null
  let anterior: HTMLElement | null = null
  const fechar = (retomar: boolean) => {
    fundo?.remove(); fundo = null
    app.raiz.inert = false
    if (retomar) app.controlePausa?.retomar()
    app.jogoPausado = false
    anterior?.focus({ preventScroll: true })
  }
  app.fecharPausa = () => fechar(false)
  const desenhar = (config = false) => {
    if (!fundo) return
    const botao = (texto: string, acao: () => void) => h('button', { type: 'button', class: 'grafico-opcao', on: { click: acao } }, texto)
    const conteudo = config ? montarConfiguracoes(app, true) : h('nav', { class: 'pause-opcoes', 'aria-label': 'Opções da pausa' },
      botao('CONTINUAR', () => fechar(true)),
      botao('CONFIGURAÇÕES', () => desenhar(true)),
      app.escolherOutraPeca ? botao('ESCOLHER OUTRA PEÇA', () => app.escolherOutraPeca?.()) : null,
      botao('VOLTAR AO MENU', () => telaMenu(app)))
    fundo.replaceChildren(h('section', { class: `pause-painel${config ? ' pause-config' : ''}`, role: 'dialog', 'aria-modal': 'true', 'aria-label': config ? 'Configurações da partida' : 'Pausa' },
      h('h2', {}, config ? 'CONFIGURAÇÕES' : 'PAUSA'), conteudo,
      config ? botao('VOLTAR À PAUSA', () => desenhar()) : h('p', {}, 'Esc para continuar')))
    fundo.querySelector<HTMLElement>('button,select,input')?.focus({ preventScroll: true })
  }
  app.abrirPausa = () => {
    if (fundo || !document.body.classList.contains('jogo-imersivo')) return
    anterior = document.activeElement as HTMLElement | null
    app.jogoPausado = true
    app.controlePausa?.pausar()
    somArco.calar()
    app.raiz.inert = true
    fundo = h('div', { class: 'pause-fundo' })
    document.body.append(fundo)
    desenhar()
  }
  document.addEventListener('keydown', e => {
    if (document.querySelector('#camada-dialogo [role="dialog"]')) return
    if (e.key === 'Escape' && document.body.classList.contains('jogo-imersivo')) {
      e.preventDefault(); e.stopImmediatePropagation()
      if (fundo?.querySelector('.pause-config')) desenhar()
      else if (fundo) fechar(true)
      else app.abrirPausa()
    } else if (fundo && e.key === 'Tab') {
      const campos = [...fundo.querySelectorAll<HTMLElement>('button,select,input')].filter(el => !el.hasAttribute('disabled') && el.getClientRects().length)
      const i = campos.indexOf(document.activeElement as HTMLElement)
      e.preventDefault(); e.stopImmediatePropagation()
      campos[(i + (e.shiftKey ? -1 : 1) + campos.length) % campos.length]?.focus()
    } else if (fundo && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement)) e.stopPropagation()
  }, true)
}
