import { roteiroDaMissao } from '../../missoes/aprendizagem'
import type { Dispositivo } from '../../entrada/tipos'
import {
  descreverConsumiveis,
  NOME_DIFICULDADE,
  requisitosEfetivos,
  type Dificuldade,
  type Missao,
  type Preparo, descreverJunta } from '../../missoes/catalogo'
import { MATERIAIS } from '../../modelo/material'
import type { Ajustes } from '../../modelo/processo'
import { CATEGORIAS, ESCALA_PONTUACAO, exigenciaDe, NOME_CATEGORIA, PESOS_PADRAO, type Pesos } from '../../pontuacao/regras'
import type { App } from '../app'
import { montarBancada, type ConfiguracaoTentativa } from '../componentes/bancada'
import { icone } from '../componentes/icones'
import { h, n1, pct } from '../dom'

export type { ConfiguracaoTentativa } from '../componentes/bancada'

/** Ficha da missão: situação, desenho, requisitos, condições essenciais e critérios. */
export function montarBriefing(m: Missao, d: Dificuldade, extras: { tentativas?: string; regra?: string; pesos?: Pesos; exigencia?: number | null } = {}): HTMLElement {
  const roteiro = roteiroDaMissao(m)
  const req = requisitosEfetivos(m, d)
  const material = MATERIAIS[m.material]
  const pesos = extras.pesos ?? PESOS_PADRAO
  // H90: aprovação por categoria (Fácil: nenhuma; Difícil: 20 %; desafios e História: 40 %).
  const exigencia = extras.exigencia === undefined ? exigenciaDe(d) : extras.exigencia
  const essenciais = exigencia === null
    ? ['Modo Fácil: não há aprovação, vale só a nota']
    : [`Pelo menos ${pct(exigencia)} dos pontos em cada uma das cinco categorias`]
  const item = (rotulo: string, valor: string) => [h('dt', {}, rotulo), h('dd', {}, valor)]
  return h(
    'article',
    { class: 'briefing' },
    h(
      'div',
      { class: 'briefing-situacao' },
      h('p', { class: 'etiqueta-setor' }, `${m.setor} · ${NOME_DIFICULDADE[d]}`),
      h('p', { class: 'texto-grande' }, m.contexto),
      h('p', { class: 'dica' }, h('strong', {}, 'Habilidade: '), roteiro.habilidade),
      h('p', { class: 'dica' }, h('strong', {}, 'Para que serve: '), m.finalidade),
    ),
    h(
      'div',
      { class: 'briefing-grade' },
      h(
        'section',
        { class: 'cartao' },
        h('h4', {}, 'Requisitos do desenho'),
        h(
          'dl',
          { class: 'lista-dados' },
          item('Trecho a soldar', `${n1(m.trecho.inicioMm)} a ${n1(m.trecho.fimMm)} mm`),
          item('Largura', `${n1(req.larguraMinMm)} a ${n1(req.larguraMaxMm)} mm`),
          item('Reforço máximo', `${n1(req.reforcoMaxMm)} mm`),
          item('Alinhamento', `até ${n1(req.alinhamentoMm)} mm da junta`),
          item('Tentativas', extras.tentativas ?? `até ${req.tentativas}`),
        ),
      ),
      h(
        'section',
        { class: 'cartao' },
        h('h4', {}, 'Peça e processo'),
        h(
          'dl',
          { class: 'lista-dados' },
          item('Material', material.nome),
          item('Fornecimento', m.condicaoFornecimento),
          item('Chapas', `2 × ${n1(m.geometria.comprimentoMm)} × ${n1(m.geometria.larguraChapaMm)} × ${n1(m.geometria.espessuraMm)} mm, abertura ${n1(m.geometria.aberturaMm)} mm`),
          item('Processo', m.processo),
          item('Junta', m.junta),
          item('Tipo de junta', descreverJunta(m)),
          item('Tipo de solda', m.tipoSolda),
          item('Posição', m.posicao),
        ),
      ),
      h('section', { class: 'cartao' }, h('h4', {}, 'Plano da tentativa'), h('ol', {}, [roteiro.preparar, roteiro.executar, roteiro.inspecionar].map(t => h('li', {}, t))), h('p', { class: 'nota' }, 'Experimento no treino: ', roteiro.experimento)),
      h('section', { class: 'cartao' }, h('h4', {}, 'Para ser aprovado'), h('ul', { class: 'lista-check' }, essenciais.map((t) => h('li', {}, t)))),
      h(
        'section',
        { class: 'cartao' },
        h('h4', {}, `Como pontua (0 a ${ESCALA_PONTUACAO})`),
        h('ul', { class: 'lista-pesos' }, CATEGORIAS.map((c) => h('li', {}, h('span', {}, NOME_CATEGORIA[c]), h('strong', {}, String(pesos[c] * ESCALA_PONTUACAO / 100))))),
      ),
      h('section', { class: 'cartao' }, h('h4', {}, 'Consumíveis e equipamentos'), h('ul', {}, [...descreverConsumiveis(m), ...m.equipamentos].map((t) => h('li', {}, t)))),
    ),
    extras.regra ? h('p', { class: 'faixa-regra' }, icone('info'), h('span', {}, h('strong', {}, 'Regra de entrega: '), extras.regra)) : null,
  )
}

export interface OpcoesPreparacao {
  oficinaTreino?: boolean
  missao: Missao
  dificuldade: Dificuldade
  /** Texto do botão oficial, ex.: "Iniciar tentativa 2 de 3"; null = sem oficial. */
  oficial: string | null
  treino: boolean
  regra?: string
  dispositivos?: Dispositivo[]
  inicial?: Partial<ConfiguracaoTentativa>
  travas?: { ajustes?: Ajustes; preparo?: Partial<Preparo> }
  /** Deixa escolher o tipo de junta na peça de teste (treino livre, H46). */
  escolherJunta?: boolean
  /** H104: troca da chapa na peça de teste (treino livre). */
  escolherMaterial?: boolean
  /** Texto extra no topo (ex.: condição do desafio do Arcade). */
  destaque?: HTMLElement | null
  aoIniciar: (c: ConfiguracaoTentativa, oficial: boolean) => void
}

/**
 * Preparação obrigatória antes de cada tentativa: resumo da missão, bancada
 * (máquina + peça de teste + dispositivo) e confirmação.
 */
export function montarPreparacao(app: App, op: OpcoesPreparacao): { elemento: HTMLElement; destruir: () => void } {
  const m = op.missao
  const req = requisitosEfetivos(m, op.dificuldade)
  // Tela em bloco: tudo cabe na altura da janela, sem rolar a página.
  app.raiz.classList.add('tela-bancada')
  const bancada = montarBancada(app, { missao: m, dificuldade: op.dificuldade, dispositivos: op.dispositivos, inicial: op.inicial, travas: op.travas, escolherJunta: op.escolherJunta, escolherMaterial: op.escolherMaterial, oficinaTreino: op.oficinaTreino, serralheria: !op.oficinaTreino && m.id === 'suporte-carbono' })

  const conferido = h('input', { type: 'checkbox', id: 'prep-conferi' })
  const erros = h('p', { class: 'erro', role: 'alert' })
  const botaoTreino = op.treino ? h('button', { type: 'button', class: 'botao-secundario' }, 'Treinar a peça (não conta)') : null
  const botaoOficial = op.oficial ? h('button', { type: 'button', class: 'primario grande' }, icone('raio'), ` ${op.oficial}`) : null
  const textoMaterial = h('strong', {}, `${MATERIAIS[m.material].nome}, ${n1(m.geometria.espessuraMm)} mm`)
  const atualizar = () => {
    // H104: no treino livre a chapa muda na bancada.
    if (op.escolherMaterial) {
      const c = bancada.configuracao().contexto
      textoMaterial.textContent = `${MATERIAIS[c.material].nome}, ${n1(c.espessuraMm)} mm`
    }
    const p = bancada.problemas()
    erros.textContent = p.join(' ')
    if (botaoTreino) botaoTreino.disabled = p.length > 0
    if (botaoOficial) botaoOficial.disabled = p.length > 0 || !conferido.checked
  }
  bancada.aoMudar = atualizar
  conferido.addEventListener('change', atualizar)
  botaoTreino?.addEventListener('click', () => op.aoIniciar(bancada.configuracao(), false))
  botaoOficial?.addEventListener('click', () => op.aoIniciar(bancada.configuracao(), true))

  const resumo = h(
    'div',
    { class: 'resumo-missao' },
    h(
      'ul',
      { class: 'resumo-itens' },
      h('li', {}, h('span', {}, 'Material'), textoMaterial),
      h('li', {}, h('span', {}, 'Trecho'), h('strong', {}, `${n1(m.trecho.inicioMm)}–${n1(m.trecho.fimMm)} mm`)),
      h('li', {}, h('span', {}, 'Largura'), h('strong', {}, `${n1(req.larguraMinMm)}–${n1(req.larguraMaxMm)} mm`)),
      h('li', {}, h('span', {}, 'Reforço'), h('strong', {}, `≤ ${n1(req.reforcoMaxMm)} mm`)),
    ),
  )

  const elemento = h(
    'div',
    { class: 'preparacao' },
    op.destaque ?? null,
    op.regra ? h('p', { class: 'faixa-regra' }, icone('info'), h('span', {}, h('strong', {}, 'Regra de entrega em vigor: '), op.regra)) : null,
    resumo,
    bancada.elemento,
    h(
      'div',
      { class: 'barra-acoes' },
      op.oficial ? h('label', { for: 'prep-conferi', class: 'interruptor' }, conferido, h('span', {}, 'Conferi peça, máquina e dispositivo')) : h('span', {}),
      erros,
      h('div', { class: 'acoes-direita' }, botaoTreino, botaoOficial),
    ),
  )
  requestAnimationFrame(atualizar)
  return { elemento, destruir: () => bancada.destruir() }
}
