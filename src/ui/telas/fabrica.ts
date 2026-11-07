import { createElement } from 'react'
import cssUsinagem from '../../setores/usinagem/ui/estilo.css?inline'
import cssLaboratorio from '../../setores/laboratorio/ui/estilo.css?inline'
import { App as AppUsinagem } from '../../setores/usinagem/ui/App'
import { App as AppLaboratorio } from '../../setores/laboratorio/ui/App'
import { montarSetor } from '../../setores/montar'
import {
  ORDENS,
  SETORES,
  liberarOrdem,
  notaDaOrdem,
  podeLiberar,
  progressoDa,
  proximaEtapa,
  registrarEtapa,
  reiniciarOrdem,
  situacaoEtapa,
  type Etapa,
  type OrdemServico,
  type RegistroEtapa,
  type SetorId,
} from '../../fabrica/ordens'
import { MISSAO_OS01_EMENDA } from '../../fabrica/missaoOs'
import { registroDaSoldagem, registroDaUsinagem, registroDoLaboratorio, registroDoTorno } from '../../fabrica/registros'
import { PECAS_TORNO } from '../../torno/pecas'
import { telaTorno } from './torno'
import { escolherLaboratorio } from './laboratorio'
import { menuOficina } from '../componentes/menuOficina'
import { pontuarRegistro } from '../../pontuacao/oficial'
import { EXIGENCIA, type ResultadoPontuacao } from '../../pontuacao/regras'
import type { EventosCompactos } from '../../dados/eventos'
import { criarFabrica3D } from '../../render/fabrica3d'
import type { App } from '../app'
import { montarInspecao } from '../componentes/inspecao'
import { montarPontuacao } from '../componentes/pontuacao'
import { avisar, confirmar } from '../dialogo'
import { anexar, dataHora, h, titulo } from '../dom'
import { telaExecucao } from './execucao'
import { telaEscolhaManufatura } from './manufatura'
import { montarPreparacao, type ConfiguracaoTentativa } from './missao'
import { escolherPecaTorno, telaTreino } from './treino'
import '../../fabrica.css'

/*
 * O que faz: a FÁBRICA (v2.2). Um galpão 3D com os setores (Usinagem,
 * Soldagem, Manufatura Aditiva e Laboratório) e o quadro de ordens de
 * serviço. Uma OS passa pelos setores como na indústria; cada etapa grava o
 * resultado e a qualidade libera a OS no fim.
 * Onde mexer: as OS estão em src/fabrica/ordens.ts; os critérios de cada
 * setor, em src/fabrica/registros.ts; o galpão, em src/render/fabrica3d.ts.
 */

const CONTEXTO = 'Fábrica'

const NOME_SITUACAO = { pendente: 'Pendente', feita: 'Conforme', 'nao-conforme': 'Não conforme' } as const

/** Por enquanto há uma OS; com mais, a escolha fica no quadro de OS. */
function ordemAtiva(_app: App): OrdemServico {
  return ORDENS[0]
}

function registrar(app: App, ordem: OrdemServico, etapa: Etapa, r: RegistroEtapa): void {
  app.fabrica = registrarEtapa(app.fabrica, ordem.id, etapa.id, r)
  app.salvar('fabrica')
}

/** Etapas da OS ativa que pedem cada setor (para marcar no galpão). */
function setoresPendentes(ordem: OrdemServico, app: App): SetorId[] {
  const p = progressoDa(app.fabrica, ordem.id)
  if (p.liberadaEm) return []
  const prox = proximaEtapa(ordem, p)
  return prox ? [prox.setor] : []
}

export function telaFabrica(app: App, foco: SetorId | null = null): void {
  app.ir((app) => {
    app.raiz.classList.add('app-cheia')
    const ordem = ordemAtiva(app)
    const p = progressoDa(app.fabrica, ordem.id)
    const prox = proximaEtapa(ordem, p)
    const info = h('p', { class: 'fabrica-dica', 'aria-live': 'polite' }, 'Clique num setor do galpão ou use os botões. Arraste para girar a vista.')

    const entrar = (setor: SetorId) => {
      const etapa = ordem.etapas.find((e) => e.setor === setor && situacaoEtapa(p, e.id) !== 'feita') ?? null
      abrirSetor(app, setor, p.liberadaEm ? null : etapa)
    }
    const vista = criarFabrica3D({
      aoEscolher: entrar,
      aoPassar: (s) => { info.textContent = s ? `${SETORES[s].nome}: ${SETORES[s].funcao}` : 'Clique num setor do galpão ou use os botões. Arraste para girar a vista.' },
    })
    vista?.marcarPendentes(setoresPendentes(ordem, app))
    if (foco) vista?.focar(foco)

    const etapas = h(
      'ol',
      { class: 'os-etapas' },
      ordem.etapas.map((e, i) => {
        const s = situacaoEtapa(p, e.id)
        const r = p.etapas[e.id]
        return h(
          'li',
          { class: `os-etapa os-${s}${prox === e ? ' os-proxima' : ''}` },
          h('div', { class: 'os-etapa-topo' }, h('span', { class: 'os-numero' }, String(i + 1)), h('strong', {}, e.titulo), h('span', { class: `os-chip os-chip-${s}` }, NOME_SITUACAO[s])),
          h('p', { class: 'os-setor' }, SETORES[e.setor].nome),
          h('p', {}, e.instrucao),
          r ? h('p', { class: 'os-registro' }, `${r.resumo} · nota ${r.nota}/100`) : null,
          p.liberadaEm ? null : h('button', { type: 'button', class: prox === e ? 'primario' : '', on: { click: () => abrirSetor(app, e.setor, e), focus: () => vista?.focar(e.setor) } }, s === 'pendente' ? `Ir para ${SETORES[e.setor].nome}` : 'Refazer (fica o melhor resultado)'),
        )
      }),
    )

    const liberacao = p.liberadaEm
      ? h('div', { class: 'os-liberada' }, h('strong', {}, `OS liberada pela qualidade em ${dataHora(p.liberadaEm)}`), h('span', {}, `Nota da OS: ${notaDaOrdem(ordem, p)}/100`),
          h('div', { class: 'acoes' }, h('button', { type: 'button', on: { click: () => telaLiberacao(app, ordem) } }, 'Ver o relatório da OS'),
            h('button', { type: 'button', class: 'botao-fantasma', on: { click: async () => {
              if (!(await confirmar('Reabrir a OS?', 'Apaga os resultados desta OS para fazer de novo. Os progressos dentro de cada setor continuam salvos.', { sim: 'Reabrir', perigo: true }))) return
              app.fabrica = reiniciarOrdem(app.fabrica, ordem.id); app.salvar('fabrica'); telaFabrica(app)
            } } }, 'Reabrir a OS')))
      : h('div', { class: 'acoes' }, h('button', { type: 'button', class: podeLiberar(ordem, p) ? 'primario' : '', disabled: !podeLiberar(ordem, p), on: { click: () => telaLiberacao(app, ordem) } }, podeLiberar(ordem, p) ? 'Enviar para a qualidade (liberação)' : 'Liberação: faltam etapas conformes'))

    const setores = h(
      'div',
      { class: 'fabrica-setores', role: 'group', 'aria-label': 'Setores da fábrica' },
      (Object.keys(SETORES) as SetorId[]).map((s) =>
        h('button', { type: 'button', class: `fabrica-setor setor-${s}`, on: { click: () => entrar(s), focus: () => vista?.focar(s), pointerenter: () => vista?.focar(s) } },
          h('strong', {}, SETORES[s].nome), h('span', {}, SETORES[s].funcao)),
      ),
    )

    anexar(
      app.raiz,
      h('div', { class: 'fabrica' },
        h('div', { class: 'fabrica-palco' }, vista ? vista.canvas : h('div', { class: 'fabrica-sem-3d' }, h('p', {}, 'Este computador não abriu o 3D. Use os setores ao lado; todos funcionam sem o galpão.'))),
        h('aside', { class: 'fabrica-painel' },
          titulo('FÁBRICA', 'Prática industrial: a peça passa pelos setores como numa fábrica de verdade.'),
          h('section', { class: 'cartao os-cartao', 'aria-label': `Ordem de serviço ${ordem.codigo}` },
            h('p', { class: 'os-codigo' }, `${ordem.codigo} · ${ordem.cliente}`),
            h('h3', {}, ordem.titulo),
            h('p', { class: 'os-situacao' }, ordem.situacao),
            etapas,
            liberacao,
          ),
          h('h3', { class: 'fabrica-sub' }, 'Setores (acesso livre)'),
          setores,
          info,
        ),
      ),
    )
    return () => vista?.destruir()
  }, CONTEXTO)
}

/** Abre um setor; com `etapa`, o setor trabalha para a OS e grava o resultado nela. */
function abrirSetor(app: App, setor: SetorId, etapa: Etapa | null): void {
  const ordem = ordemAtiva(app)
  if (setor === 'usinagem') {
    // v2.2: a etapa da OS usa o torno convencional novo (OM-01, no Difícil).
    if (etapa) {
      const p = PECAS_TORNO.find((x) => x.id === 'om01-eixo')!
      return telaTorno(app, p, 'profissional', () => telaFabrica(app, 'usinagem'), {
        contexto: 'Fábrica · Usinagem',
        aoConcluir: (r, aprovada) => {
          registrar(app, ordem, etapa, registroDoTorno(r.nota, aprovada, { min: r.medidas.diametroMin, max: r.medidas.diametroMax }, app.ambiente.agora().toISOString()))
          void avisar(`Registrado na ${ordem.codigo}`, h('p', {}, aprovada ? 'Pino aprovado. Volte à fábrica para a próxima etapa.' : 'Pino não aprovado no Difícil. Você pode refazer: fica o melhor resultado.'))
        },
      })
    }
    return menuOficina(app, 'USINAGEM', 'FÁBRICA / SETOR DE USINAGEM', [
      { nome: 'TORNO CONVENCIONAL', descricao: 'Novo: torno em 3D operado nas manivelas, com cavaco, desgaste, medição e nota.', abrir: () => escolherPecaTorno(app, () => abrirSetor(app, 'usinagem', null)) },
      { nome: 'TORNO CNC (ANTERIOR)', descricao: 'A Usinagem CNC da versão anterior, até ser refeita no mesmo estilo.', abrir: () => telaSetorReact(app, 'usinagem', ordem, null) },
    ], { nome: 'VOLTAR À FÁBRICA', descricao: 'Voltar ao galpão.', abrir: () => telaFabrica(app, 'usinagem') })
  }
  if (setor === 'laboratorio') {
    // Laboratório no estilo da bancada de solda; a conclusão (no escritório) registra a etapa da OS.
    return escolherLaboratorio(app, () => telaFabrica(app, 'laboratorio'), {
      aoConcluir: etapa ? (r) => {
        registrar(app, ordem, etapa, registroDoLaboratorio(r.avaliacao.total, app.ambiente.agora().toISOString()))
        void avisar(`Registrado na ${ordem.codigo}`, h('p', {}, `Relatório de análise de falha: ${r.avaliacao.total}/100. Volte à fábrica para a próxima etapa.`))
      } : undefined,
    })
  }
  if (setor === 'manufatura') return telaEscolhaManufatura(app)
  if (etapa) return telaSoldagemOs(app, ordem, etapa)
  telaTreino(app)
}

function barraSetor(app: App, setor: SetorId, ordem: OrdemServico, etapa: Etapa | null, extra?: HTMLElement): HTMLElement {
  return h('div', { class: `barra-setor setor-${setor}` },
    h('button', { type: 'button', on: { click: () => telaFabrica(app, setor) } }, '← Voltar à fábrica'),
    h('div', { class: 'barra-setor-texto' },
      h('strong', {}, SETORES[setor].nome),
      h('span', {}, etapa ? `${ordem.codigo} · etapa: ${etapa.titulo}. ${etapa.porque}` : 'Acesso livre: o que você fizer aqui não entra na OS.'),
    ),
    extra ?? null,
  )
}

function telaSetorReact(app: App, setor: 'usinagem' | 'laboratorio', ordem: OrdemServico, etapa: Etapa | null): void {
  app.ir((app) => {
    app.raiz.classList.add('app-cheia')
    const estado = h('span', { class: 'barra-setor-estado', 'aria-live': 'polite' })
    const anotar = (r: RegistroEtapa) => {
      if (!etapa) return
      registrar(app, ordem, etapa, r)
      estado.textContent = `Registrado na ${ordem.codigo}: ${r.resumo}${r.conforme ? '' : ' · não conforme'}`
      estado.classList.toggle('ok', r.conforme)
      void avisar(`Registrado na ${ordem.codigo}`, h('div', {},
        h('p', {}, r.resumo),
        h('p', {}, r.conforme ? 'A etapa está conforme. Volte à fábrica para a próxima.' : 'A etapa ficou não conforme. Você pode refazer: fica o melhor resultado.')))
    }
    const hospedeiro = h('div', { class: `setor-react setor-${setor}` })
    anexar(app.raiz, barraSetor(app, setor, ordem, etapa, estado), hospedeiro)
    const agora = () => app.ambiente.agora().toISOString()
    const desmontar =
      setor === 'usinagem'
        ? montarSetor(hospedeiro, cssUsinagem, createElement(AppUsinagem, { aoEntregar: etapa ? (r) => anotar(registroDaUsinagem(r, agora())) : undefined }))
        : montarSetor(hospedeiro, cssLaboratorio, createElement(AppLaboratorio, { aoConcluir: etapa ? (r) => anotar(registroDoLaboratorio(r.avaliacao.total, agora())) : undefined }))
    return desmontar
  }, `${CONTEXTO} · ${SETORES[setor].nome}`)
}

/* ---------- Soldagem da OS: bancada → solda → pontuação → registro ---------- */

interface TentativaOs {
  config: ConfiguracaoTentativa
  eventos: EventosCompactos
  resultado: ResultadoPontuacao
}

function telaSoldagemOs(app: App, ordem: OrdemServico, etapa: Etapa, ultima?: ConfiguracaoTentativa): void {
  const missao = MISSAO_OS01_EMENDA
  app.ir((app) => {
    const prep = montarPreparacao(app, {
      missao,
      dificuldade: 'profissional',
      oficial: 'Soldar a emenda da OS',
      treino: true,
      inicial: ultima,
      destaque: h('p', { class: 'destaque-os' }, `${ordem.codigo}: avaliação no Difícil, com pelo menos 40 % em cada categoria (como na História). ${etapa.porque}`),
      aoIniciar: (config, oficial) => soldar(app, ordem, etapa, config, oficial),
    })
    anexar(app.raiz, barraSetor(app, 'soldagem', ordem, etapa), titulo('Bancada', `${missao.titulo} · ${missao.condicaoFornecimento}`), prep.elemento)
    return prep.destruir
  }, `${CONTEXTO} · Soldagem`)
}

function soldar(app: App, ordem: OrdemServico, etapa: Etapa, config: ConfiguracaoTentativa, oficial: boolean): void {
  const missao = MISSAO_OS01_EMENDA
  app.ir(
    telaExecucao({
      missao,
      dificuldade: 'profissional',
      contexto: config.contexto,
      ajustes: config.ajustes,
      dispositivo: config.dispositivo,
      preferencias: app.preferencias,
      oficial,
      rotulo: oficial ? `${ordem.codigo} · emenda` : 'Treino da emenda (não entra na OS)',
      aoConcluir: ({ eventos }) => {
        const { resultado } = pontuarRegistro(missao, 'profissional', config.contexto, eventos, undefined, EXIGENCIA.desafio)
        resultadoSoldagem(app, ordem, etapa, { config, eventos, resultado }, oficial)
      },
      aoSair: () => telaSoldagemOs(app, ordem, etapa, config),
    }),
    `${CONTEXTO} · Soldagem`,
  )
}

function resultadoSoldagem(app: App, ordem: OrdemServico, etapa: Etapa, t: TentativaOs, oficial: boolean): void {
  app.ir((app) => {
    const missao = MISSAO_OS01_EMENDA
    const inspecao = montarInspecao({ missao, dificuldade: 'profissional', contexto: t.config.contexto, eventos: t.eventos, ajustes: t.config.ajustes, preparo: t.config.preparo, dispositivo: t.config.dispositivo })
    app.raiz.classList.add('tela-resultado')
    const registrarNaOs = () => {
      const r = registroDaSoldagem(t.resultado.total, t.resultado.aprovada, app.ambiente.agora().toISOString())
      registrar(app, ordem, etapa, r)
      telaFabrica(app, 'soldagem')
    }
    anexar(
      app.raiz,
      barraSetor(app, 'soldagem', ordem, etapa),
      titulo(oficial ? 'Emenda concluída' : 'Treino concluído', oficial ? 'Entregue esta solda para a OS ou faça outra tentativa (fica o melhor resultado).' : 'Treino: não entra na OS.'),
      h('div', { class: 'grade-resultado' }, montarPontuacao(t.resultado, { animar: true, rotulo: oficial ? `${ordem.codigo} · EMENDA` : 'TREINO — NÃO CONTA' }), inspecao.elemento),
      h('div', { class: 'acoes' },
        h('button', { type: 'button', on: { click: () => telaSoldagemOs(app, ordem, etapa, t.config) } }, 'Nova tentativa'),
        oficial ? h('button', { type: 'button', class: 'primario', on: { click: registrarNaOs } }, `Entregar para a ${ordem.codigo}`) : null),
    )
    return inspecao.destruir
  }, `${CONTEXTO} · Soldagem · resultado`)
}

/* ---------- Liberação pela qualidade ---------- */

export function telaLiberacao(app: App, ordem: OrdemServico): void {
  app.ir((app) => {
    const p = progressoDa(app.fabrica, ordem.id)
    const respostas = ordem.perguntasLiberacao.map((pergunta, i) => {
      const id = `liberacao-${i}`
      return { pergunta, campo: h('textarea', { id, rows: '3', placeholder: 'Escreva com as suas palavras, citando o que você observou nos setores.' }) as HTMLTextAreaElement }
    })
    const liberar = async () => {
      if (respostas.some((r) => r.campo.value.trim().length < 15)) {
        await avisar('Faltam respostas', h('p', {}, 'Responda às três perguntas da qualidade (pelo menos uma frase em cada) antes de liberar.'))
        return
      }
      app.fabrica = liberarOrdem(app.fabrica, ordem.id, app.ambiente.agora().toISOString(), respostas.map((r) => r.campo.value.trim()))
      app.salvar('fabrica')
      telaLiberacao(app, ordem)
    }
    anexar(
      app.raiz,
      barraSetor(app, 'laboratorio', ordem, null),
      h('article', { class: 'cartao relatorio-os' },
        titulo(`Relatório da ${ordem.codigo}`, ordem.titulo),
        h('p', {}, h('strong', {}, 'Cliente: '), ordem.cliente),
        h('p', {}, ordem.situacao),
        h('table', { class: 'tabela-os' },
          h('thead', {}, h('tr', {}, h('th', {}, 'Etapa'), h('th', {}, 'Setor'), h('th', {}, 'Resultado'), h('th', {}, 'Nota'), h('th', {}, 'Situação'))),
          h('tbody', {}, ordem.etapas.map((e) => {
            const r = p.etapas[e.id]
            return h('tr', {}, h('td', {}, e.titulo), h('td', {}, SETORES[e.setor].nome), h('td', {}, r ? `${r.resumo} (${dataHora(r.em)})` : '—'), h('td', {}, r ? `${r.nota}` : '—'), h('td', {}, NOME_SITUACAO[situacaoEtapa(p, e.id)]))
          })),
        ),
        h('p', { class: 'nota-os' }, `Nota da OS (média das etapas): ${notaDaOrdem(ordem, p)}/100`),
        p.liberadaEm
          ? h('section', {},
              h('h3', {}, 'Respostas à qualidade'),
              ordem.perguntasLiberacao.map((q, i) => h('div', { class: 'resposta-os' }, h('p', {}, h('strong', {}, q)), h('p', {}, p.respostas?.[i] || '—'))),
              h('p', { class: 'os-liberada' }, h('strong', {}, `Liberada em ${dataHora(p.liberadaEm)}.`), ' Imprima ou salve em PDF para entregar ao professor.'))
          : h('section', {}, h('h3', {}, 'Perguntas da qualidade'), respostas.map((r) => h('div', { class: 'campo' }, h('label', { for: r.campo.id }, r.pergunta), r.campo))),
        h('div', { class: 'acoes' },
          h('button', { type: 'button', on: { click: () => window.print() } }, 'Imprimir / salvar em PDF'),
          p.liberadaEm ? null : h('button', { type: 'button', class: 'primario', disabled: !podeLiberar(ordem, p), on: { click: liberar } }, 'Liberar a OS'),
        ),
      ),
    )
  }, `${CONTEXTO} · Qualidade`)
}
