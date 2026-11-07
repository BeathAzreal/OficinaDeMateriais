import { h } from '../dom'
import { abrirPainel } from '../dialogo'
import { conceito } from './pontuacao'
import type { ResultadoTig, DefeitoTig } from '../../pontuacao/tig'
import type { aprovacaoEletrodo } from '../../pontuacao/eletrodo'

/** Resultado do TIG: mesmo placar do eletrodo (nota, itens com o mínimo do Difícil e defeitos). */
export function resultadoTig(r: ResultadoTig, defeitos: DefeitoTig[], modo: string, aprovacao: ReturnType<typeof aprovacaoEletrodo>, op: { nova: () => void; pecas: () => void }) {
  return resultadoProcesso(r, defeitos, modo, aprovacao, op, {
    descontos: r.penalidadeFuros || r.penalidadeNiveis ? `Descontos: furos −${r.penalidadeFuros} · passar da chapa −${r.penalidadeNiveis}` : 'Sem descontos adicionais.',
    detalhe: `Modo ${modo}. Furos: −${r.penalidadeFuros}. Metal pendurado e raiz afundada: −${r.penalidadeNiveis}. Total limitado a 0–1000.`,
    limites: 'Modelo didático de calor na chapa: não avalia penetração na raiz, cor de oxidação do inox nem porosidade. Não qualifica soldador.',
  })
}

/**
 * H105: o mesmo placar para outro processo (TIG, brasagem): nota, itens com o
 * mínimo do Difícil, defeitos e, se houver, botões próprios do processo.
 */
export function resultadoProcesso(
  r: { nota: number; itens: readonly { nome: string; pontos: number; maximo: number; explicacao: string }[]; descricao: string },
  defeitos: readonly DefeitoTig[], modo: string, aprovacao: ReturnType<typeof aprovacaoEletrodo>, op: { nova: () => void; pecas: () => void },
  textos: { descontos: string; detalhe: string; limites: string; botoes?: HTMLElement[] },
) {
  const minimo = aprovacao.exigencia, pct = (f: number) => `${Math.round(f * 100)} %`
  const letra = conceito(r.nota, aprovacao.aprovada, 1000)
  const selo = minimo === null
    ? h('p', { class: 'selo selo-livre' }, 'Modo Fácil — pontuação pura, sem aprovação')
    : aprovacao.aprovada
      ? h('p', { class: 'selo selo-ok' }, `✔ Aprovada — pelo menos ${pct(minimo)} em cada item e na nota`)
      : h('p', { class: 'selo selo-falha' }, `✖ Não aprovada — abaixo de ${pct(minimo)} em: ${aprovacao.abaixo.join(', ')}`)
  const titulo = h('h2', { tabindex: '-1' }, 'RESULTADO DA TENTATIVA')
  const detalhes = () => abrirPainel('Avaliação da tentativa', h('section', { class: 'resultado-smaw' },
    h('p', {}, `Nota automática do jogo, de 0 a 1000. ${r.descricao}.`),
    h('ul', {}, ...r.itens.map((i) => h('li', {}, h('strong', {}, `${i.nome}: ${i.pontos}/${i.maximo}`), h('small', {}, i.explicacao)))),
    h('p', {}, textos.detalhe),
    h('small', {}, textos.limites)))
  const graves = defeitos.filter((d) => d.grave).length
  const resumo = defeitos.length ? `${defeitos.length} defeito(s)${graves ? `, ${graves} pedindo reparo` : ''}: ${defeitos.map((d) => d.nome).join(', ')}.` : 'Nenhum defeito visível no trecho.'
  const listaDefeitos = () => abrirPainel('Defeitos encontrados', h('section', { class: 'resultado-smaw' },
    defeitos.length
      ? h('ul', { class: 'p15-defeitos' }, ...defeitos.map((d) => h('li', { 'data-grave': String(d.grave) },
        h('strong', {}, `${d.nome} · ${d.onde}`), h('small', {}, `Causa: ${d.causa}`), h('small', {}, `Como corrigir: ${d.corrigir}`))))
      : h('p', {}, 'Nenhum defeito visível no trecho exigido.'),
    h('small', {}, 'Inspeção didática do jogo, não norma.')))
  const painel = h('aside', { class: 'p15-painel p15-resultado', 'aria-label': 'Resultado da tentativa' },
    titulo,
    h('div', { class: 'placar' },
      h('span', { class: `conceito conceito-${letra}`, 'aria-label': `Conceito ${letra}` }, letra),
      h('div', {}, h('span', { class: 'placar-rotulo' }, `PONTUAÇÃO · ${modo.toUpperCase()}`), h('div', {}, h('span', { class: 'placar-numero' }, String(r.nota)), h('span', { class: 'placar-max' }, ' / 1000')))),
    selo,
    h('ul', { class: 'barras-categorias', 'aria-label': 'Notas por item' }, ...r.itens.map((i) => h('li', {},
      h('div', { class: 'barra-cabeca' }, h('span', {}, i.nome), h('strong', {}, `${i.pontos}/${i.maximo}`)),
      h('div', { class: 'barra-trilho', role: 'meter', 'aria-label': i.nome, 'aria-valuemin': '0', 'aria-valuemax': String(i.maximo), 'aria-valuenow': String(i.pontos) },
        h('div', { class: 'barra-valor', style: `width:${(100 * i.pontos) / i.maximo}%` }),
        minimo !== null ? h('div', { class: 'barra-minimo', title: `Mínimo do Difícil: ${pct(minimo)}`, style: `left:${minimo * 100}%` }) : null)))),
    h('p', { class: 'p15-descontos' }, textos.descontos),
    h('div', { class: 'p15-botoes-resultado' }, ...(textos.botoes ?? []),
      h('button', { type: 'button', on: { click: detalhes } }, 'Detalhes da avaliação'),
      h('button', { type: 'button', class: 'p15-botao-defeitos', 'data-graves': String(graves), title: resumo, 'aria-label': resumo, on: { click: listaDefeitos } }, `Defeitos (${defeitos.length})`)),
    h('small', {}, 'Inspecione em 360° com o botão do meio. + / − controlam o zoom. A tentativa está encerrada.'),
    h('div', { class: 'p15-proxima' },
      h('button', { type: 'button', class: 'primario', on: { click: op.nova } }, 'Nova tentativa'),
      h('button', { type: 'button', on: { click: op.pecas } }, 'Escolher outra peça')))
  return { painel, focar: () => titulo.focus() }
}
