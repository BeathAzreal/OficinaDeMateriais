import { descompactar, type EventosCompactos } from '../../dados/eventos'
import { comparar, type Juizo } from '../../didatica/comparacao'
import { explicar } from '../../didatica/explicacao'
import type { Tentativa } from '../../modelo/avaliacao'
import type { ContextoProcesso } from '../../modelo/processo'
import { reproduzir } from '../../modelo/replay'
import { abrirPainel } from '../dialogo'
import { h } from '../dom'

/*
 * Explicação de como os ajustes e o movimento afetaram o resultado, e
 * comparação com a tentativa anterior (etapa 4), agora no resultado do
 * treino com a interface nova. Reconstrói a tentativa pelo replay do registro.
 */

const TEXTO_JUIZO: Record<Juizo, string> = { melhor: '▲ melhor', pior: '▼ pior', igual: '= igual', maior: 'maior', menor: 'menor', diferente: 'diferente' }

/** Tentativa avaliada a partir do registro salvo. */
export function tentativaDoRegistro(contexto: ContextoProcesso, eventos: EventosCompactos): Tentativa | null {
  return reproduzir(contexto, descompactar(eventos)).finalizar()
}

/** Botão que abre a explicação e a comparação numa sobreposição (a tela de resultado não rola). */
export function botaoExplicacao(t: Tentativa, anterior: Tentativa | null): HTMLElement {
  return h('button', { type: 'button', class: 'botao-secundario', on: { click: () => abrirPainel('Por que saiu assim', montarExplicacao(t, anterior)) } }, 'Por que saiu assim')
}

export function montarExplicacao(t: Tentativa, anterior: Tentativa | null): HTMLElement {
  const itens = explicar(t)
  const explicacao = h(
    'ul',
    { class: 'lista-explicacao' },
    itens.map((i) => h('li', { 'data-tema': i.tema }, h('strong', {}, i.titulo), h('p', {}, i.texto))),
  )

  let comparacao: HTMLElement
  const c = anterior ? comparar(anterior, t) : null
  if (!anterior) comparacao = h('p', { class: 'nota' }, 'Esta é a primeira tentativa deste treino. Solde de novo para comparar.')
  else if (!c) comparacao = h('p', { class: 'nota' }, 'Não dá para comparar: uma das tentativas não teve cordão suficiente para medir.')
  else
    comparacao = h(
      'div',
      {},
      h('ul', { class: 'frases-comparacao' }, c.frases.map((f) => h('li', {}, f))),
      h(
        'table',
        { class: 'tabela-comparacao' },
        h('thead', {}, h('tr', {}, ['Medida', 'Anterior', 'Atual', ''].map((x) => h('th', {}, x)))),
        h(
          'tbody',
          {},
          c.linhas.map((l) => h('tr', {}, h('td', {}, l.rotulo), h('td', {}, l.anterior), h('td', {}, l.atual), h('td', { class: `juizo juizo-${l.juizo}` }, TEXTO_JUIZO[l.juizo]))),
        ),
      ),
      h('p', { class: 'nota' }, '"Melhor/pior" só onde o jogo tem critério (regularidade, alinhamento, alvo, interrupções). Critérios do jogo, não de qualidade de solda.'),
    )

  return h(
    'section',
    { class: 'painel-explicacao', 'aria-label': 'Explicação e comparação' },
    h('h3', {}, 'Por que saiu assim'),
    explicacao,
    h('h3', {}, 'Comparação com a tentativa anterior'),
    comparacao,
  )
}
