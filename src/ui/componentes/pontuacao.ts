import { devolverTentativa } from '../../didatica/devolutiva'
import { ESCALA_PONTUACAO, escalaDaPontuacao, FICHA_CATEGORIA, type ResultadoPontuacao } from '../../pontuacao/regras'
import { abrirPainel } from '../dialogo'
import { contarAte, h, n0, n1 } from '../dom'
import { montarAbas } from './abas'

/**
 * Conceito estilo arcade (S, A, B, C, D) — só APRESENTAÇÃO da nota total.
 * Desde a v1.8 (H89) vale a nota, aprovada ou não; `aprovada` fica para
 * quem chama, sem efeito no conceito.
 */
export function conceito(total: number, _aprovada: boolean, escala = ESCALA_PONTUACAO): string {
  // Limites em fração da escala (S ≥ 95 %, A ≥ 85 %, B ≥ 70 %, C ≥ 50 %).
  const f = total / escala
  return f >= 0.95 ? 'S' : f >= 0.85 ? 'A' : f >= 0.7 ? 'B' : f >= 0.5 ? 'C' : 'D'
}

/** O que mais provavelmente fez a solda não ser aprovada, em linguagem de bancada (H90). */
function dicaReprovada(r: ResultadoPontuacao): string {
  const falhas = r.essenciais.filter((e) => !e.cumprida).map((e) => e.id)
  // O problema que ocupa mais junta.
  const problema = [...r.problemas].sort((a, b) => b.fimMm - b.inicioMm - (a.fimMm - a.inicioMm))[0]?.descricao ?? ''
  const nomes = r.categorias.filter((c) => falhas.includes(c.id)).map((c) => c.nome.toLowerCase()).join(', ')
  const base = `Abaixo do mínimo do Difícil em: ${nomes}.`
  if (falhas.includes('integridade') && /perfura|excessiv/.test(problema)) return `${base} Calor demais por mm: ande mais rápido ou reduza alimentação/tensão.`
  if (falhas.includes('integridade') && /falta/.test(problema)) return `${base} Falta de fusão: ande mais devagar (fique na faixa verde de velocidade) ou aumente alimentação/tensão.`
  if (falhas.includes('desenho') && /borda/.test(problema)) return `${base} O cordão saiu da junta: mantenha a tocha sobre a linha.`
  if (falhas.includes('desenho')) return `${base} Cubra o trecho do INÍCIO ao FIM, sem interrupções, com a largura do desenho.`
  if (falhas.includes('regularidade')) return `${base} Mantenha o mesmo ritmo do começo ao fim.`
  if (falhas.includes('deformacao')) return `${base} Calor demais na peça: ande um pouco mais rápido.`
  if (falhas.includes('eficiencia')) return `${base} Mantenha o arco sobre a junta, sem reabrir à toa.`
  return base
}

/**
 * Painel da pontuação automática, para caber numa tela: conceito, total,
 * aprovação, categorias em barras e condições essenciais numa linha cada.
 * "O que aconteceu e como é calculado" (o detalhe de cada categoria, as
 * penalidades e os trechos com problema) abre numa sobreposição.
 */
export function montarPontuacao(r: ResultadoPontuacao, opcoes: { animar?: boolean; rotulo?: string } = {}): HTMLElement {
  // pontuacao-v3: escala de 1000, nota inteira; versões antigas (0–100) mantêm uma casa.
  const devolutiva = devolverTentativa(r)
  const casas = r.versao === 'pontuacao-v1' || r.versao === 'pontuacao-v2' ? 1 : 0
  const nota = (v: number) => (casas === 0 ? n0(v) : n1(v))
  const total = h('span', { class: 'placar-numero' }, opcoes.animar ? nota(0) : nota(r.total))
  if (opcoes.animar) contarAte(total, r.total, casas)
  const escala = escalaDaPontuacao(r.versao)
  const letra = conceito(r.total, r.aprovada, escala)
  // H90: no Fácil (exigencia null) não há aprovação; tentativas antigas (sem o campo) mostram como antes.
  const semAprovacao = r.exigencia === null
  const minimo = typeof r.exigencia === 'number' ? r.exigencia : null

  const categorias = h(
    'ul',
    { class: 'barras-categorias', 'aria-label': 'Notas por categoria' },
    r.categorias.map((c) => {
      // Categoria zerada pela regra de aprovação: mostra quanto valeria, para não parecer defeito.
      const zerada = r.penalidades.find((p) => p.descricao === `${c.nome} zerada`)
      const valeria = zerada ? -zerada.pontos : 0
      return h(
        'li',
        {},
        h('div', { class: 'barra-cabeca' }, h('span', {}, c.nome), zerada ? h('small', { class: 'nota-zerada', title: 'Zerada porque a solda não foi aprovada' }, `valeria ${nota(valeria)}`) : null, h('strong', {}, `${nota(c.pontos)} / ${c.maximo}`)),
        h(
          'div',
          { class: 'barra-trilho', role: 'meter', 'aria-valuemin': '0', 'aria-valuemax': String(c.maximo), 'aria-valuenow': String(c.pontos), 'aria-label': c.nome },
          zerada ? h('div', { class: 'barra-valeria', style: `width:${(valeria / c.maximo) * 100}%` }) : null,
          h('div', { class: 'barra-valor', style: `width:${c.maximo ? (c.pontos / c.maximo) * 100 : 0}%` }),
          minimo !== null && c.maximo > 0 ? h('div', { class: 'barra-minimo', title: `Mínimo do Difícil: ${Math.round(minimo * 100)} %`, style: `left:${minimo * 100}%` }) : null,
        ),
      )
    }),
  )

  // O detalhe fica numa sobreposição, em abas (o resumo e uma por categoria): cabe sem rolar.
  const detalhe = () => {
    const resumo = h(
      'section',
      { class: 'cartao' },
      h('h4', {}, semAprovacao ? 'Modo Fácil: só a nota, sem aprovação' : minimo !== null ? `Para aprovar: pelo menos ${Math.round(minimo * 100)} % em cada categoria` : 'Condições essenciais'),
      r.essenciais.length ? h('ul', { class: 'lista-essenciais' }, r.essenciais.map((e) => h('li', { class: e.cumprida ? 'ok' : 'falha' }, h('strong', {}, `${e.cumprida ? '✔' : '✖'} ${e.descricao}. `), e.justificativa))) : null,
      r.penalidades.length ? h('h4', {}, 'Penalidades') : null,
      r.penalidades.length ? h('ul', { class: 'lista-penalidades' }, r.penalidades.map((p) => h('li', {}, h('strong', {}, `${p.descricao} (${nota(p.pontos)})`), ` — ${p.justificativa}`))) : null,
      h('h4', {}, 'Trechos com problema (previsão sintética)'),
      r.problemas.length
        ? h('ul', { class: 'lista-problemas' }, r.problemas.map((p) => h('li', {}, `${n1(p.inicioMm)} a ${n1(p.fimMm)} mm: ${p.descricao}`)))
        : h('p', { class: 'dica' }, 'Nenhum trecho com problema previsto.'),
      h('p', { class: 'dica pequena' }, `Regras ${r.versao}. O conceito (${letra}) é só apresentação da nota. A integridade é uma previsão sintética do modelo, não um ensaio.`),
    )
    const porCategoria = r.categorias.map((c): [string, HTMLElement] => {
      const ficha = FICHA_CATEGORIA[c.id]
      return [
        `${c.nome} · ${nota(c.pontos)}`,
        h(
          'section',
          { class: 'cartao' },
          h('h4', {}, `${c.nome}: ${nota(c.pontos)} / ${c.maximo}`),
          h('p', {}, c.explicacao),
          h('dl', { class: 'ficha' }, h('dt', {}, 'Definição'), h('dd', {}, ficha.definicao), h('dt', {}, 'Dados'), h('dd', {}, ficha.dados), h('dt', {}, 'Regra'), h('dd', {}, ficha.regra), h('dt', {}, 'Limitações'), h('dd', {}, ficha.limitacoes)),
        ),
      ]
    })
    const abas = montarAbas([['Resumo', resumo], ...porCategoria], 'Detalhe da pontuação')
    return h('div', { class: 'detalhe-pontuacao' }, abas.lista, ...abas.corpos)
  }

  return h(
    'section',
    { class: 'painel-pontuacao', 'aria-label': 'Pontuação automática' },
    h(
      'div',
      { class: 'placar' },
      h('span', { class: `conceito conceito-${letra}`, 'aria-label': `Conceito ${letra}` }, letra),
      h('div', {}, h('span', { class: 'placar-rotulo' }, opcoes.rotulo ?? 'PONTUAÇÃO AUTOMÁTICA'), h('div', {}, total, h('span', { class: 'placar-max' }, `/ ${escala}`))),
    ),
    semAprovacao
      ? h('p', { class: 'selo selo-livre' }, 'Modo Fácil — pontuação pura, sem aprovação')
      : r.aprovada
        ? h('p', { class: 'selo selo-ok' }, minimo !== null ? `✔ Aprovada — pelo menos ${Math.round(minimo * 100)} % em cada categoria` : '✔ Aprovada — condições essenciais cumpridas')
        : h('p', { class: 'selo selo-falha' }, minimo !== null ? `✖ Não aprovada — categoria abaixo de ${Math.round(minimo * 100)} %` : '✖ Não aprovada — condição essencial descumprida'),
    semAprovacao || r.aprovada || minimo === null ? null : h('p', { class: 'dica dica-reprovada' }, dicaReprovada(r)),
    h('button', { type: 'button', class: 'botao-secundario', on: { click: () => abrirPainel('Plano para a próxima tentativa', h('section', {}, h('h3', {}, devolutiva.prioridade), h('h4', {}, 'O que foi registrado'), h('p', {}, devolutiva.evidencia), h('h4', {}, 'O que tentar'), h('p', {}, devolutiva.proximaAcao), h('h4', {}, 'Como conferir'), h('p', {}, devolutiva.verificar), h('p', { class: 'nota' }, 'Mude uma variável por vez, mantendo missão, dificuldade e dispositivo. Previsão didática; não diagnostica defeitos reais.'))) } }, 'Próxima tentativa: ', devolutiva.prioridade),
    categorias,
    // No Difícil, a linha de cada categoria já tem a marca do mínimo; a lista só aparece em tentativas antigas.
    minimo === null && r.essenciais.length ? h('ul', { class: 'essenciais-curtos', 'aria-label': 'Condições essenciais' }, r.essenciais.map((e) => h('li', { class: e.cumprida ? 'ok' : 'falha', title: e.justificativa }, `${e.cumprida ? '✔' : '✖'} ${e.descricao}`))) : null,
    h(
      'button',
      { type: 'button', class: 'botao-fantasma botao-detalhe', on: { click: () => abrirPainel('O que aconteceu e como é calculado', detalhe()) } },
      `O que aconteceu e como é calculado${r.problemas.length ? ` · ${r.problemas.length} trecho(s) com problema` : ''}`,
    ),
  )
}
