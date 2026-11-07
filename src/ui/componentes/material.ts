import { MATERIAIS, type Material, type MaterialId } from '../../modelo/material'
import { h } from '../dom'

/** Selo do material (cor + nome: a informação nunca depende só da cor). */
export function seloMaterial(id: MaterialId, espessuraMm?: number): HTMLElement {
  const m = MATERIAIS[id]
  return h(
    'span',
    { class: `selo-material material-${id}` },
    h('span', { class: 'selo-material-amostra', 'aria-hidden': 'true' }),
    h('span', {}, m.nome, espessuraMm !== undefined ? ` · ${espessuraMm.toLocaleString('pt-BR', { minimumFractionDigits: 1 })} mm` : ''),
  )
}

/**
 * H104: as características da chapa em níveis de 1 a 5, tirados dos números
 * do próprio modelo (material.ts): a ficha nunca diz uma coisa e a física outra.
 */
export const TRACOS_MATERIAL: readonly { nome: string; nivel: (m: Material) => number }[] = [
  { nome: 'Calor para fundir', nivel: (m) => nivel(m.necessidadeFusao, [0.9, 1.05, 1.5, 2]) },
  { nome: 'Esquenta rápido', nivel: (m) => nivel(m.ganhoAquecimento, [0.2, 0.27, 0.33, 0.38]) },
  { nome: 'Guarda o calor', nivel: (m) => nivel(m.tauAquecimentoS, [18, 26, 32, 38]) },
  { nome: 'Deforma', nivel: (m) => nivel(m.fatorDeformacao, [0.9, 1.15, 1.25, 1.5]) },
]

function nivel(v: number, limites: readonly number[]): number {
  return 1 + limites.filter((l) => v > l).length
}

const mm = (v: number) => v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })

/** Uma linha para menus: resumo e espessuras do estoque. */
export function resumoMaterial(id: MaterialId): string {
  const m = MATERIAIS[id]
  return `${m.ficha.resumo} Chapas de ${m.ficha.espessurasMm.map(mm).join(', ')} mm.`
}

/** Ficha da chapa: resumo, níveis e o que ela tem de próprio. */
export function fichaMaterial(id: MaterialId, op: { espessuraMm?: number; semSelo?: boolean } = {}): HTMLElement {
  const m = MATERIAIS[id]
  return h(
    'div',
    { class: 'ficha-material' },
    op.semSelo ? null : h('p', { class: 'ficha-material-topo' }, seloMaterial(id, op.espessuraMm)),
    h('p', { class: 'dica' }, m.ficha.resumo),
    h(
      'dl',
      { class: 'ficha-material-tracos' },
      TRACOS_MATERIAL.flatMap((t) => {
        const n = t.nivel(m)
        return [
          h('dt', {}, t.nome),
          h('dd', { 'aria-label': `${n} de 5` }, h('span', { class: 'ficha-material-nivel', 'aria-hidden': 'true' }, Array.from({ length: 5 }, (_, i) => h('span', { class: i < n ? 'cheio' : '' }))), h('small', {}, `${n}/5`)),
        ]
      }),
    ),
    h('ul', { class: 'ficha-material-pontos' }, m.ficha.pontos.map((p) => h('li', {}, p))),
  )
}
