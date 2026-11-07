import { menuOficina } from '../componentes/menuOficina'
import { telaMenu } from './menu'
import { DIFICULDADES, NOME_DIFICULDADE, PECA_PADRAO, type Dificuldade, type Missao, pecaLivre } from '../../missoes/catalogo'
import { MATERIAIS, materiaisDoProcesso, type MaterialId, type ProcessoChapa } from '../../modelo/material'
import { pontuarRegistro } from '../../pontuacao/oficial'
import type { App } from '../app'
import { montarInspecao } from '../componentes/inspecao'
import { montarPontuacao } from '../componentes/pontuacao'
import { h, n1, titulo, anexar } from '../dom'
import { telaExecucao } from './execucao'
import { montarPreparacao, type ConfiguracaoTentativa } from './missao'
import { botaoExplicacao, tentativaDoRegistro } from '../componentes/explicacao'
import type { Tentativa } from '../../modelo/avaliacao'
import { materialEletrodo, PECAS_ELETRODO, pecaEletrodoEm } from '../../missoes/pecasEletrodo'
import { INFO_JUNTA } from '../../modelo/juntas'
import { telaTreinoEletrodo } from './treinoEletrodo'
import { PECAS_TIG, pecaTigEm } from '../../missoes/pecasTig'
import { resumoMaterial } from '../componentes/material'
import { telaTreinoPlasma, telaTreinoTig } from './treinoTig'
import { PECAS_PLASMA } from '../../missoes/pecasPlasma'
import { PECAS_SUBAQUATICA } from '../../missoes/pecasSubaquatica'
import { PECAS_TORNO, type PecaTorno } from '../../torno/pecas'
import { MATERIAIS_TORNO, type MaterialTornoId } from '../../torno/materiais'
import { telaTorno } from './torno'
import { PECAS_BRASAGEM, pecaBrasagemEm } from '../../missoes/pecasBrasagem'
import { LIGAS } from '../../modelo/brasagem'
import { telaTreinoBrasagem } from './treinoBrasagem'
import { escolherLaboratorio } from './laboratorio'
import { telaManufatura } from './manufatura'
import { abrirCncLivre } from './fabrica'
import { ROTULO_VERSAO } from '../../versao'
import '../../menu-grafico.css'
import '../../treino-hub.css'
import { botaoLaudo } from '../componentes/laudoTermico'

/*
 * Treino (v2.3): uma tela só. As áreas ficam lado a lado com todas as
 * atividades à vista, e o modo de pontuação (Fácil/Difícil) é uma chave
 * nesta tela, em vez de um menu a cada processo. Bancada livre (sandbox):
 * nada entra no ranking; missões ficam no Arcade e ordens de serviço, na Fábrica.
 */
const CHAVE_MODO = 'oficina-de-materiais/modo-treino'
let modoAtual: Dificuldade | null = null

/** Modo de pontuação escolhido no Treino (lembrado no navegador). */
export function modoTreino(): Dificuldade {
  if (modoAtual) return modoAtual
  try {
    const salvo = localStorage.getItem(CHAVE_MODO)
    modoAtual = salvo === 'profissional' ? 'profissional' : 'aprendiz'
  } catch { modoAtual = 'aprendiz' }
  return modoAtual
}

function definirModo(d: Dificuldade): void {
  modoAtual = d
  try { localStorage.setItem(CHAVE_MODO, d) } catch { /* sem armazenamento: vale só nesta sessão */ }
}

interface Atividade { nome: string; resumo: string; abrir: () => void }
interface Area { id: string; nome: string; resumo: string; atividades: Atividade[] }

function areasDoTreino(app: App): Area[] {
  return [
    { id: 'soldagem', nome: 'Soldagem', resumo: 'Bancada de solda: regule a máquina, solde e veja o resultado.', atividades: [
      { nome: 'MIG/MAG', resumo: 'Bancada livre: chapa, junta e máquina', abrir: () => treinoLivre(app, modoTreino()) },
      { nome: 'Eletrodo', resumo: 'Distância do arco e consumo da vareta', abrir: () => escolherPecaEletrodo(app) },
      { nome: 'TIG', resumo: 'Tocha, pedal e vareta', abrir: () => escolherPecaTig(app) },
      { nome: 'Plasma', resumo: 'Keyhole e microplasma', abrir: () => escolherPecaPlasma(app) },
      { nome: 'Subaquática', resumo: 'Eletrodo no fundo do mar', abrir: () => escolherPecaSubaquatica(app) },
      { nome: 'Brasagem', resumo: 'Maçarico, fluxo e capilaridade', abrir: () => escolherPecaBrasagem(app) },
    ] },
    { id: 'usinagem', nome: 'Usinagem', resumo: 'Torno: tolerância, acabamento e cavaco.', atividades: [
      { nome: 'Torno convencional', resumo: 'Manivelas, medição e nota', abrir: () => escolherPecaTorno(app, () => telaTreino(app)) },
      { nome: 'Torno CNC (anterior)', resumo: 'Versão anterior, até ser refeita', abrir: () => abrirCncLivre(app) },
    ] },
    { id: 'laboratorio', nome: 'Laboratório de falhas', resumo: 'Investigue por que a peça quebrou.', atividades: [
      { nome: 'A junta que falhou', resumo: 'Inspeção, corte, metalografia e dureza', abrir: () => escolherLaboratorio(app, () => telaTreino(app)) },
    ] },
    { id: 'manufatura', nome: 'Manufatura aditiva', resumo: 'Programe o robô e fabrique camada por camada.', atividades: [
      { nome: 'Missão: parede reta', resumo: 'Com nota e atividade guiada', abrir: () => telaManufatura(app, 'missao') },
      { nome: 'Modo livre', resumo: 'Sem missão e sem nota', abrir: () => telaManufatura(app, 'livre') },
    ] },
  ]
}

export function telaTreino(app: App): void {
  app.ir(() => {
    document.body.classList.add('menu-grafico')
    app.raiz.classList.add('tela-inicio', 'treino-hub')
    const areas = areasDoTreino(app)
    const chave = h('div', { class: 'treino-modo', role: 'radiogroup', 'aria-label': 'Modo de pontuação' })
    const desenharChave = () => chave.replaceChildren(
      h('span', { class: 'treino-modo-rotulo' }, 'Modo'),
      ...DIFICULDADES.map((d) => h('button', {
        type: 'button', role: 'radio', 'aria-checked': String(modoTreino() === d), class: modoTreino() === d ? 'ativo' : '',
        title: DESCRICAO_MODO[d],
        on: { click: () => { definirModo(d); desenharChave() } },
      }, NOME_DIFICULDADE[d])),
      h('span', { class: 'treino-modo-dica' }, DESCRICAO_MODO[modoTreino()]),
    )
    desenharChave()
    const botoes: HTMLButtonElement[] = []
    const colunas = areas.map((a) => h('section', { class: `treino-area area-${a.id}`, 'aria-labelledby': `area-${a.id}` },
      h('h3', { id: `area-${a.id}` }, a.nome),
      h('p', { class: 'treino-area-resumo' }, a.resumo),
      h('div', { class: 'treino-atividades' }, a.atividades.map((at) => {
        const b = h('button', { type: 'button', class: 'treino-atividade', on: { click: at.abrir } },
          h('strong', {}, at.nome), h('span', {}, at.resumo)) as HTMLButtonElement
        botoes.push(b)
        return b
      })),
    ))
    const voltar = h('button', { type: 'button', class: 'treino-voltar', on: { click: () => telaMenu(app) } }, '← Voltar ao menu') as HTMLButtonElement
    const teclas = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.altKey || e.metaKey || document.querySelector('[role="dialog"]')) return
      if (e.key === 'Escape') { e.preventDefault(); telaMenu(app); return }
      const i = botoes.indexOf(document.activeElement as HTMLButtonElement)
      if (['ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft'].includes(e.key)) {
        e.preventDefault()
        const passo = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : -1
        botoes[i < 0 ? 0 : (i + passo + botoes.length) % botoes.length].focus()
      }
    }
    window.addEventListener('keydown', teclas)
    anexar(app.raiz,
      h('header', { class: 'grafico-titulo treino-cabecalho' }, h('p', {}, 'OFICINA / PRÁTICA LIVRE'), h('h2', { class: 'tela-titulo', tabindex: '-1' }, 'TREINO')),
      h('span', { class: 'grafico-versao' }, ROTULO_VERSAO),
      chave,
      h('div', { class: 'treino-areas' }, colunas),
      h('div', { class: 'treino-rodape' }, voltar, h('span', {}, 'Nada do treino entra no ranking. Setas escolhem · Enter abre · Esc volta')),
    )
    return () => {
      window.removeEventListener('keydown', teclas)
      document.body.classList.remove('menu-grafico')
      app.raiz.classList.remove('treino-hub')
    }
  }, 'Treino')
}

/** O que cada modo de pontuação faz, para a escolha antes de soldar (H88). */
export const DESCRICAO_MODO: Record<Dificuldade, string> = {
  aprendiz: 'Tolerâncias largas: um pouco fora da medida perde pouco. Bom para aprender o movimento.',
  profissional: 'Tolerâncias apertadas, perto das de norma: desvios e defeitos custam caro.',
}

function escolherPecaEletrodo(app: App): void {
  menuOficina(app, 'ELETRODO', 'TREINO / ESCOLHA A PEÇA', [...PECAS_ELETRODO.filter(p => p.sobreChapa), ...PECAS_ELETRODO.filter(p => !p.sobreChapa)].map(p => ({
    nome: p.titulo,
    descricao: `${p.aplicacao} · ${n1(p.espessuraMm)} mm · ${INFO_JUNTA[p.junta].nome}. Avaliação visual e nota do treino.`,
    abrir: () => escolherChapa(app, 'ELETRODO', 'eletrodo', p.titulo, materialEletrodo(p), () => escolherPecaEletrodo(app), (mat) =>
      telaTreinoEletrodo(app, pecaEletrodoEm(p, mat), modoTreino(), () => escolherPecaEletrodo(app))),
  })), { nome: 'VOLTAR AO TREINO', descricao: 'Escolher outra atividade.', abrir: () => telaTreino(app) })
}

function escolherPecaTig(app: App): void {
  menuOficina(app, 'TIG', 'TREINO / ESCOLHA A PEÇA', PECAS_TIG.map(p => ({
    nome: p.titulo,
    descricao: `${p.aplicacao} · ${MATERIAIS[p.material].nomeCurto} ${n1(p.espessuraMm)} mm · ${INFO_JUNTA[p.junta].nome} · vareta Ø ${n1(p.varetaMm)} mm.`,
    abrir: () => escolherChapa(app, 'TIG', 'TIG', p.titulo, p.material, () => escolherPecaTig(app), (mat) =>
      telaTreinoTig(app, pecaTigEm(p, mat), modoTreino(), () => escolherPecaTig(app))),
  })), { nome: 'VOLTAR AO TREINO', descricao: 'Escolher outra atividade.', abrir: () => telaTreino(app) })
}

/**
 * H104: no treino a peça do eletrodo e do TIG pode ser de outra chapa. A
 * geometria da peça fica; o material traz a física dele (calor para fundir,
 * aquecimento, poro) e a corrente sugerida acompanha.
 */
function escolherChapa(app: App, titulo: string, processo: ProcessoChapa, peca: string, original: MaterialId, voltar: () => void, seguir: (m: MaterialId, caminho: string) => void): void {
  const caminho = 'TREINO / ' + peca.toUpperCase()
  const materiais = [original, ...materiaisDoProcesso(processo).filter((m) => m !== original)]
  menuOficina(app, titulo, caminho + ' / ESCOLHA A CHAPA', materiais.map((m) => ({
    nome: MATERIAIS[m].nomeCurto.toUpperCase() + (m === original ? ' (DA PEÇA)' : ''),
    descricao: resumoMaterial(m).replace(/ Chapas de .*$/, '') + ' ' + MATERIAIS[m].ficha.pontos.join(' '),
    abrir: () => seguir(m, `${caminho} / ${MATERIAIS[m].nomeCurto.toUpperCase()}`),
  })), { nome: 'VOLTAR', descricao: 'Escolher outra peça.', abrir: voltar })
}

/** v2.2: peças do torno convencional; o tarugo livre deixa escolher o material. */
export function escolherPecaTorno(app: App, voltar: () => void): void {
  const abrir = (p: PecaTorno) => telaTorno(app, p, modoTreino(), () => escolherPecaTorno(app, voltar))
  menuOficina(app, 'TORNO', 'OFICINA / TORNO CONVENCIONAL', PECAS_TORNO.map((p) => ({
    nome: p.titulo,
    descricao: `${p.aplicacao} ${p.alvo ? `· Tarugo Ø ${p.diametroBrutoMm} × ${p.balancoMm} mm.` : ''}`,
    abrir: () => p.alvo ? abrir(p) : menuOficina(app, 'TORNO', 'TREINO / TARUGO LIVRE / MATERIAL', (Object.keys(MATERIAIS_TORNO) as MaterialTornoId[]).map((id) => ({
      nome: MATERIAIS_TORNO[id].nome.toUpperCase(),
      descricao: MATERIAIS_TORNO[id].descricao,
      abrir: () => abrir({ ...p, material: id, titulo: `Tarugo livre — ${MATERIAIS_TORNO[id].nome.toLowerCase()}` }),
    })), { nome: 'VOLTAR', descricao: 'Escolher outra peça.', abrir: () => escolherPecaTorno(app, voltar) }),
  })), { nome: 'VOLTAR', descricao: 'Voltar.', abrir: voltar })
}

/** H107: peças do plasma (keyhole e microplasma); a chapa é a da peça (as faixas foram calibradas nela). */
function escolherPecaPlasma(app: App): void {
  menuOficina(app, 'PLASMA', 'TREINO / ESCOLHA A PEÇA', PECAS_PLASMA.map(p => ({
    nome: p.titulo,
    descricao: `${p.aplicacao} · ${p.correnteA.min}–${p.correnteA.max} A · gás ${n1(p.gasLMin.min)}–${n1(p.gasLMin.max)} L/min.`,
    abrir: () => telaTreinoPlasma(app, p, modoTreino(), () => escolherPecaPlasma(app)),
  })), { nome: 'VOLTAR AO TREINO', descricao: 'Escolher outra atividade.', abrir: () => telaTreino(app) })
}

/** H110: solda subaquática molhada (eletrodo revestido no mar). */
function escolherPecaSubaquatica(app: App): void {
  menuOficina(app, 'SUBAQUÁTICA', 'TREINO / SOLDA MOLHADA / ESCOLHA O MERGULHO', PECAS_SUBAQUATICA.map(p => ({
    nome: p.titulo,
    descricao: `${p.aplicacao} · ${p.subaquatica!.profundidadeM} m · ${INFO_JUNTA[p.junta].nome} · ${n1(p.espessuraMm)} mm. ${p.porque}`,
    abrir: () => telaTreinoEletrodo(app, p, modoTreino(), () => escolherPecaSubaquatica(app)),
  })), { nome: 'VOLTAR AO TREINO', descricao: 'Escolher outra atividade.', abrir: () => telaTreino(app) })
}

function escolherPecaBrasagem(app: App): void {
  menuOficina(app, 'BRASAGEM', 'TREINO / ESCOLHA A PEÇA', PECAS_BRASAGEM.map(p => ({
    nome: p.titulo,
    descricao: `${p.aplicacao} · ${MATERIAIS[p.material].nomeCurto} ${n1(p.espessuraMm)} mm · ${LIGAS[p.recomendado.liga].nome}.`,
    abrir: () => escolherChapa(app, 'BRASAGEM', 'brasagem', p.titulo, p.material, () => escolherPecaBrasagem(app), (mat) =>
      telaTreinoBrasagem(app, pecaBrasagemEm(p, mat), modoTreino(), () => escolherPecaBrasagem(app))),
  })), { nome: 'VOLTAR AO TREINO', descricao: 'Escolher outra atividade.', abrir: () => telaTreino(app) })
}

/** Um treino em andamento: a peça da bancada livre e o que repetir. */
interface SessaoTreino {
  m: Missao
  d: Dificuldade
  inicial?: ConfiguracaoTentativa
  /** Última tentativa avaliada, para a comparação (etapa 4). */
  anterior: Tentativa | null
}

function treinoLivre(app: App, d: Dificuldade): void {
  bancadaTreino(app, { m: PECA_PADRAO, d, anterior: null })
}

function bancadaTreino(app: App, s: SessaoTreino): void {
  app.ir((app) => {
    app.escolherOutraPeca = () => telaTreino(app)
    const prep = montarPreparacao(app, {
      oficinaTreino: true,
      missao: s.m,
      dificuldade: s.d,
      oficial: null,
      treino: true,
      inicial: s.inicial,
      escolherJunta: true,
      escolherMaterial: true,
      aoIniciar: (config) => {
        // No treino livre a chapa (material e espessura) e a junta vêm da bancada (H104).
        const m = pecaLivre(config.contexto)
        const atual: SessaoTreino = { ...s, m, inicial: config }
        app.ir(
          telaExecucao({
            missao: m,
            dificuldade: s.d,
            contexto: config.contexto,
            ajustes: config.ajustes,
            dispositivo: config.dispositivo,
            preferencias: app.preferencias,
            oficial: false,
            rotulo: `Treino livre · peça padrão · ${NOME_DIFICULDADE[s.d]}`,
            aoConcluir: ({ eventos }) => resultadoTreino(app, atual, config, eventos),
            aoSair: () => bancadaTreino(app, atual),
            aoEscolherPeca: () => telaTreino(app),
          }),
          'Treino · execução',
        )
      },
    })
    anexar(
      app.raiz,
      titulo('Treino livre', `Peça de teste · modo ${NOME_DIFICULDADE[s.d]} · escolha a chapa e o tipo de junta · nada é registrado`),
      prep.elemento,
    )
    return prep.destruir
  }, 'Treino livre')
}

function resultadoTreino(app: App, s: SessaoTreino, config: ConfiguracaoTentativa, eventos: Parameters<typeof pontuarRegistro>[3]): void {
  app.ir((app) => {
    const { resultado } = pontuarRegistro(s.m, s.d, config.contexto, eventos)
    const inspecao = montarInspecao({ missao: s.m, dificuldade: s.d, contexto: config.contexto, eventos, ajustes: config.ajustes, preparo: config.preparo, dispositivo: config.dispositivo })
    const tentativa = tentativaDoRegistro(config.contexto, eventos)
    // Tela travada: tudo cabe na janela; textos longos abrem em sobreposição.
    app.raiz.classList.add('tela-resultado')
    anexar(
      app.raiz,
      titulo('Resultado do treino', 'Treino: não entra no ranking nem em torneios.'),
      h('div', { class: 'grade-resultado' }, montarPontuacao(resultado, { animar: true, rotulo: 'TREINO — NÃO CONTA' }), inspecao.elemento),
      h(
        'div',
        { class: 'acoes' },
        tentativa ? botaoExplicacao(tentativa, s.anterior) : null,
        botaoLaudo(config.contexto, tentativa, config.ajustes),
        h('button', { type: 'button', on: { click: () => telaTreino(app) } }, 'Outros treinos'),
        h('button', { type: 'button', class: 'primario', on: { click: () => bancadaTreino(app, { ...s, inicial: config, anterior: tentativa ?? s.anterior }) } }, 'Treinar de novo'),
      ),
    )
    return inspecao.destruir
  }, 'Treino · resultado')
}
