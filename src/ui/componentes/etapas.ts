import { h } from '../dom'

/** Indicador de etapas de um fluxo (onde estou / o que falta). */
export function etapas(lista: string[], atual: number): HTMLElement {
  return h(
    'ol',
    { class: 'etapas', 'aria-label': 'Etapas' },
    lista.map((e, i) =>
      h(
        'li',
        { class: i < atual ? 'feita' : i === atual ? 'atual' : '', 'aria-current': i === atual ? 'step' : undefined },
        h('span', { class: 'etapa-num' }, i < atual ? '✓' : String(i + 1)),
        h('span', {}, e),
      ),
    ),
  )
}

export const ETAPAS_MISSAO = ['Bancada', 'Solda', 'Resultado', 'Entrega']
