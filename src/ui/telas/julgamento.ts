import {
  ErroTorneio,
  evidenciaJulgamento,
  ITENS_FICHA,
  listaJulgamento,
  NOME_ITEM_FICHA,
  podePublicar,
  prepararJulgamento,
  publicar,
  registrarFinal,
  registrarInicial,
  revisar,
  rotuloCampo,
  type BaseTorneio,
  type CampoRevisao,
  type ItemFicha,
  type NotaFicha, descreverRodada } from '../../dados/torneio'
import { buscarMissao } from '../../missoes/catalogo'
import type { App } from '../app'
import { montarInspecao } from '../componentes/inspecao'
import { montarPontuacao } from '../componentes/pontuacao'
import { avisar, confirmar } from '../dialogo'
import { dataHora, h, n1, titulo, anexar } from '../dom'
import { painelTorneio, resultadoRodada } from './torneio'

/*
 * Julgamento do professor, por código anônimo. Nesta tela NUNCA aparecem
 * nome, ordem de execução, dispositivo ou ranking. Fluxo por entrega:
 * evidências → avaliação inicial (ficha comum) → revelação da pontuação
 * automática → nota final com justificativa. Publicação só com tudo avaliado.
 */

const AVISO_ANONIMATO =
  'Julgamento por código: uma medida para reduzir vieses. Num aplicativo local não há garantia de anonimato completo nem proteção contra fraude.'

function acao(app: App, f: () => BaseTorneio): boolean {
  try {
    app.gravarBase(f())
    return true
  } catch (e) {
    if (e instanceof ErroTorneio) {
      avisar('Ação não permitida', e.message)
      return false
    }
    throw e
  }
}

export function telaJulgamento(app: App, id: string, rodada: number): void {
  // Prepara (uma vez) a ordem embaralhada e as fichas em branco.
  const b0 = app.baseDoTorneio(id)
  if (!b0.torneio.ordemJulgamento[rodada] || b0.avaliacoes.filter((a) => a.rodada === rodada).length < b0.entregas.filter((e) => e.rodada === rodada).length) {
    if (!acao(app, () => prepararJulgamento(b0, rodada, app.ambiente))) return
  }
  app.ir((app) => {
    const b = app.baseDoTorneio(id)
    const lista = listaJulgamento(b, rodada)
    const publicada = b.torneio.publicadas[rodada]
    const textoSituacao = { pendente: 'pendente', 'inicial-registrada': 'avaliação inicial registrada', finalizada: 'nota final registrada' }
    anexar(app.raiz, 
      titulo(`Julgamento — rodada ${rodada + 1}`, `${descreverRodada(b.torneio.config.rodadas[rodada])} · ordem de avaliação embaralhada`),
      h('p', { class: 'aviso-resultado' }, AVISO_ANONIMATO),
      h(
        'table',
        { class: 'tabela' },
        h('caption', {}, 'Entregas a avaliar'),
        h('thead', {}, h('tr', {}, ['Código', 'Situação', ''].map((t) => h('th', { scope: 'col' }, t)))),
        h(
          'tbody',
          {},
          lista.map((item) =>
            h(
              'tr',
              {},
              h('th', { scope: 'row' }, item.codigo),
              h('td', {}, textoSituacao[item.situacao]),
              h('td', {}, h('button', { type: 'button', class: item.situacao === 'finalizada' ? 'pequeno' : 'pequeno primario', on: { click: () => telaAvaliar(app, id, rodada, item.entregaId) } }, item.situacao === 'finalizada' ? 'Ver / revisar' : 'Avaliar')),
            ),
          ),
        ),
      ),
      publicada
        ? h('p', { class: 'selo selo-ok' }, `Resultados publicados em ${dataHora(publicada)}. Revisões agora recalculam a classificação e ficam no histórico.`)
        : h('p', { class: 'nota' }, podePublicar(b, rodada) ? 'Todas as entregas têm nota final. Os nomes só aparecem depois da publicação.' : 'A publicação fica disponível quando todas as entregas tiverem nota final.'),
      h(
        'div',
        { class: 'acoes' },
        h('button', { type: 'button', on: { click: () => painelTorneio(app, id) } }, 'Painel do torneio'),
        publicada
          ? h('button', { type: 'button', class: 'primario', on: { click: () => resultadoRodada(app, id, rodada) } }, 'Ver resultados publicados')
          : h(
              'button',
              {
                type: 'button',
                class: 'primario',
                disabled: !podePublicar(b, rodada),
                on: {
                  click: async () => {
                    if (!(await confirmar('Publicar os resultados da rodada?', 'Os nomes e a classificação passam a aparecer. Revisões posteriores ficam registradas no histórico.', { sim: 'Publicar' }))) return
                    if (acao(app, () => publicar(app.baseDoTorneio(id), rodada, app.ambiente))) resultadoRodada(app, id, rodada)
                  },
                },
              },
              'Publicar resultados',
            ),
      ),
    )
  }, 'Julgamento')
}

const OPCOES_NOTA: { valor: string; rotulo: string }[] = [
  { valor: '', rotulo: 'não avaliado (sem evidência suficiente)' },
  ...Array.from({ length: 11 }, (_, i) => ({ valor: String(i), rotulo: String(i) })),
]

function seletorNota(id: string, rotulo: string, atual: NotaFicha): { elemento: HTMLElement; valor: () => NotaFicha } {
  const s = h('select', { id }, OPCOES_NOTA.map((o) => h('option', { value: o.valor, selected: (atual === null ? '' : String(atual)) === o.valor }, o.rotulo)))
  return { elemento: h('div', { class: 'campo' }, h('label', { for: id }, rotulo), s), valor: () => (s.value === '' ? null : Number(s.value)) }
}

const textoNota = (v: NotaFicha) => (v === null ? 'não avaliado' : `${v} / 10`)

function telaAvaliar(app: App, id: string, rodada: number, entregaId: string): void {
  app.ir((app) => {
    const b = app.baseDoTorneio(id)
    const ev = evidenciaJulgamento(b, entregaId)
    const m = buscarMissao(ev.missaoId)!
    let destruir = () => {}
    const evidencias = ev.temSolda
      ? (() => {
          const insp = montarInspecao({ missao: m, dificuldade: ev.dificuldade, contexto: ev.contexto!, eventos: ev.eventos!, ajustes: ev.ajustes!, preparo: ev.preparo! })
          destruir = insp.destruir
          return insp.elemento
        })()
      : h('p', {}, 'Sem solda válida: todas as tentativas desta entrega foram interrompidas.')

    const etapas = h('div', { class: 'etapas-julgamento' })
    if (!ev.inicial) {
      // Etapa 1: avaliação inicial, sem ver a pontuação automática.
      const campos = ITENS_FICHA.map((i) => ({ i, ...seletorNota(`ficha-${i}`, NOME_ITEM_FICHA[i], null) }))
      const geral = seletorNota('ficha-geral', 'Avaliação geral inicial', null)
      const obs = h('textarea', { id: 'ficha-obs', rows: '3' })
      etapas.append(
        h(
          'form',
          {
            class: 'cartao-form',
            on: {
              submit: async (e: Event) => {
                e.preventDefault()
                if (!(await confirmar('Confirmar a avaliação inicial?', 'Depois de confirmar, a pontuação automática desta entrega será mostrada. Alterações posteriores ficam registradas como revisão.', { sim: 'Confirmar' }))) return
                const itens = Object.fromEntries(campos.map((c) => [c.i, c.valor()])) as Record<ItemFicha, NotaFicha>
                if (acao(app, () => registrarInicial(app.baseDoTorneio(id), entregaId, { itens, geral: geral.valor(), observacoes: obs.value.trim() }, app.ambiente))) telaAvaliar(app, id, rodada, entregaId)
              },
            },
          },
          h('h3', {}, '1. Avaliação inicial (ficha comum)'),
          h('p', { class: 'nota' }, 'Avalie a solda e as evidências acima. A pontuação automática ainda está oculta. Use "não avaliado" quando não houver evidência suficiente.'),
          campos.map((c) => c.elemento),
          geral.elemento,
          h('label', { for: 'ficha-obs' }, 'Observações'),
          obs,
          h('div', { class: 'acoes' }, h('button', { type: 'submit', class: 'primario' }, 'Confirmar avaliação inicial')),
        ),
      )
    } else {
      etapas.append(
        h('section', {}, h('h3', {}, '1. Avaliação inicial registrada'), h('dl', { class: 'medidas' }, ITENS_FICHA.flatMap((i) => [h('dt', {}, NOME_ITEM_FICHA[i]), h('dd', {}, textoNota(ev.inicial!.itens[i]))]), h('dt', {}, 'Geral inicial'), h('dd', {}, textoNota(ev.inicial.geral))), ev.inicial.observacoes ? h('p', {}, `Observações: ${ev.inicial.observacoes}`) : null),
        h('section', {}, h('h3', {}, '2. Pontuação automática (revelada)'), ev.automatico ? montarPontuacao(ev.automatico, { rotulo: 'AUTOMÁTICA' }) : h('p', {}, 'Sem pontuação automática (sem solda válida).')),
      )
      if (!ev.final) {
        const nota = h('input', { id: 'final-nota', type: 'number', min: '0', max: '10', step: '0.5', required: true })
        const just = h('textarea', { id: 'final-just', rows: '3', required: true, minlength: '10' })
        etapas.append(
          h(
            'form',
            {
              class: 'cartao-form',
              on: {
                submit: async (e: Event) => {
                  e.preventDefault()
                  if (!(await confirmar('Confirmar a nota final?', `Nota ${nota.value} / 10.`, { sim: 'Confirmar' }))) return
                  if (acao(app, () => registrarFinal(app.baseDoTorneio(id), entregaId, { nota: Number(nota.value), justificativa: just.value }, app.ambiente))) telaJulgamento(app, id, rodada)
                },
              },
            },
            h('h3', {}, '3. Nota geral final do professor'),
            h('label', { for: 'final-nota' }, 'Nota final (0 a 10)'),
            nota,
            h('label', { for: 'final-just' }, 'Justificativa (obrigatória)'),
            just,
            h('div', { class: 'acoes' }, h('button', { type: 'submit', class: 'primario' }, 'Confirmar nota final')),
          ),
        )
      } else {
        etapas.append(h('section', {}, h('h3', {}, '3. Nota final registrada'), h('p', {}, h('strong', {}, `${n1(ev.final.nota)} / 10. `), ev.final.justificativa)))
      }
      etapas.append(formularioRevisao(app, id, rodada, entregaId, !!ev.final))
    }

    const a = b.avaliacoes.find((x) => x.entregaId === entregaId)
    // Tela travada: a peça à esquerda; a ficha (formulário) rola só dentro da coluna dela.
    app.raiz.classList.add('tela-resultado', 'tela-julgamento')
    anexar(app.raiz, 
      titulo(`Entrega ${ev.codigo}`, `Rodada ${rodada + 1} · ${m.titulo}`),
      h('p', { class: 'aviso-resultado' }, AVISO_ANONIMATO),
      h(
        'div',
        { class: 'grade-resultado' },
        h('div', {}, evidencias),
        h(
          'div',
          { class: 'coluna-ficha' },
          etapas,
          a?.revisoes.length
            ? h('section', {}, h('h3', {}, 'Histórico de revisões'), h('table', { class: 'tabela' }, h('thead', {}, h('tr', {}, ['Data', 'Campo', 'Anterior', 'Novo', 'Motivo'].map((t) => h('th', { scope: 'col' }, t)))), h('tbody', {}, a.revisoes.map((r) => h('tr', {}, h('td', {}, dataHora(r.data)), h('td', {}, rotuloCampo(r.campo)), h('td', {}, r.anterior), h('td', {}, r.novo), h('td', {}, `${r.motivo}${r.aposPublicacao ? ' (após a publicação)' : ''}`))))))
            : null,
        ),
      ),
      h('div', { class: 'acoes' }, h('button', { type: 'button', on: { click: () => telaJulgamento(app, id, rodada) } }, 'Voltar à lista de códigos')),
    )
    return () => destruir()
  }, 'Julgamento')
}

function formularioRevisao(app: App, id: string, rodada: number, entregaId: string, temFinal: boolean): HTMLElement {
  const campos: { valor: CampoRevisao; rotulo: string }[] = [
    ...ITENS_FICHA.map((i) => ({ valor: `inicial.${i}` as CampoRevisao, rotulo: `Inicial — ${NOME_ITEM_FICHA[i]}` })),
    { valor: 'inicial.geral', rotulo: 'Inicial — avaliação geral' },
    ...(temFinal ? [{ valor: 'final.nota' as CampoRevisao, rotulo: 'Nota final' }, { valor: 'final.justificativa' as CampoRevisao, rotulo: 'Justificativa final' }] : []),
  ]
  const campo = h('select', { id: 'rev-campo' }, campos.map((c) => h('option', { value: c.valor }, c.rotulo)))
  const nota = h('select', { id: 'rev-nota' }, OPCOES_NOTA.map((o) => h('option', { value: o.valor }, o.rotulo)))
  const numero = h('input', { id: 'rev-numero', type: 'number', min: '0', max: '10', step: '0.5', hidden: true })
  const texto = h('textarea', { id: 'rev-texto', rows: '2', hidden: true })
  const motivo = h('textarea', { id: 'rev-motivo', rows: '2' })
  const ajustar = () => {
    const v = campo.value
    nota.hidden = !v.startsWith('inicial.')
    numero.hidden = v !== 'final.nota'
    texto.hidden = v !== 'final.justificativa'
  }
  campo.addEventListener('change', ajustar)
  ajustar()
  return h(
    'details',
    { class: 'revisao' },
    h('summary', {}, 'Revisar uma avaliação (fica registrado: valor anterior, novo, data e motivo)'),
    h(
      'form',
      {
        class: 'cartao-form',
        on: {
          submit: async (e: Event) => {
            e.preventDefault()
            const c = campo.value as CampoRevisao
            const novo: NotaFicha | string = c === 'final.nota' ? Number(numero.value) : c === 'final.justificativa' ? texto.value : nota.value === '' ? null : Number(nota.value)
            if (!(await confirmar('Registrar a revisão?', 'O valor anterior, o novo, a data e o motivo ficam no histórico.', { sim: 'Registrar' }))) return
            if (acao(app, () => revisar(app.baseDoTorneio(id), entregaId, c, novo, motivo.value, app.ambiente))) telaAvaliar(app, id, rodada, entregaId)
          },
        },
      },
      h('label', { for: 'rev-campo' }, 'Campo'),
      campo,
      h('label', { for: 'rev-nota' }, 'Novo valor'),
      nota,
      numero,
      texto,
      h('label', { for: 'rev-motivo' }, 'Motivo da alteração (obrigatório)'),
      motivo,
      h('div', { class: 'acoes' }, h('button', { type: 'submit' }, 'Registrar revisão')),
    ),
  )
}
