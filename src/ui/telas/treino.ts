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

/**
 * Treino: bancada livre (sandbox) por processo e peça, sem ranking nem registro
 * oficial. Missões ficam no Arcade/História; ordens de serviço, na Fábrica.
 */
export function telaTreino(app: App): void {
  menuOficina(app, 'TREINO', 'OFICINA / PRÁTICA LIVRE', [
    { nome: 'MIG/MAG', descricao: 'Abra a bancada livre. Escolha a chapa, a junta, regule a máquina e pratique.', abrir: () => escolherModo(app, 'MIG/MAG', 'TREINO / BANCADA LIVRE', (d) => treinoLivre(app, d), () => telaTreino(app)) },
    { nome: 'ELETRODO', descricao: 'Escolha a peça e pratique o controle da distância e o consumo da vareta.', abrir: () => escolherPecaEletrodo(app) },
    { nome: 'TIG', descricao: 'Tocha numa mão e vareta na outra: pedal, poça e toques de vareta. Mesa digitalizadora + mouse ou só mouse.', abrir: () => escolherPecaTig(app) },
    { nome: 'PLASMA', descricao: 'Arco apertado por um bocal: keyhole que atravessa a chapa numa passada, sem chanfro, e microplasma para chapa muito fina.', abrir: () => escolherPecaPlasma(app) },
    { nome: 'SUBAQUÁTICA', descricao: 'Solda molhada no fundo do mar com eletrodo revestido: só a sua lanterna ilumina a peça, a corrente é ligada pela superfície e a água tempera a solda.', abrir: () => escolherPecaSubaquatica(app) },
    { nome: 'TORNO', descricao: 'Torno convencional em 3D: faceie, desbaste e dê o acabamento com as manivelas, meça com micrômetro e veja o cavaco de cada material.', abrir: () => escolherPecaTorno(app, () => telaTreino(app)) },
    { nome: 'BRASAGEM', descricao: 'Maçarico, fluxo e vareta: aqueça a junta sobreposta e deixe a liga correr para dentro da folga, sem fundir a peça.', abrir: () => escolherPecaBrasagem(app) },
  ], { nome: 'VOLTAR AO MENU', descricao: 'Voltar ao início da oficina.', abrir: () => telaMenu(app) })
}

/** O que cada modo de pontuação faz, para a escolha antes de soldar (H88). */
export const DESCRICAO_MODO: Record<Dificuldade, string> = {
  aprendiz: 'Tolerâncias largas: um pouco fora da medida perde pouco. Bom para aprender o movimento.',
  profissional: 'Tolerâncias apertadas, perto das de norma: desvios e defeitos custam caro.',
}

/** Escolha do modo de pontuação antes de soldar (H88). */
function escolherModo(app: App, titulo: string, caminho: string, abrir: (d: Dificuldade) => void, voltar: () => void): void {
  menuOficina(app, titulo, caminho + ' / MODO DE PONTUAÇÃO', DIFICULDADES.map(d => ({
    nome: NOME_DIFICULDADE[d].toUpperCase(), descricao: DESCRICAO_MODO[d], abrir: () => abrir(d),
  })), { nome: 'VOLTAR', descricao: 'Voltar à escolha anterior.', abrir: voltar })
}

function escolherPecaEletrodo(app: App): void {
  menuOficina(app, 'ELETRODO', 'TREINO / ESCOLHA A PEÇA', [...PECAS_ELETRODO.filter(p => p.sobreChapa), ...PECAS_ELETRODO.filter(p => !p.sobreChapa)].map(p => ({
    nome: p.titulo,
    descricao: `${p.aplicacao} · ${n1(p.espessuraMm)} mm · ${INFO_JUNTA[p.junta].nome}. Avaliação visual e nota do treino.`,
    abrir: () => escolherChapa(app, 'ELETRODO', 'eletrodo', p.titulo, materialEletrodo(p), () => escolherPecaEletrodo(app), (mat, caminho) =>
      escolherModo(app, 'ELETRODO', caminho, (d) => telaTreinoEletrodo(app, pecaEletrodoEm(p, mat), d, () => escolherPecaEletrodo(app)), () => escolherPecaEletrodo(app))),
  })), { nome: 'VOLTAR AO TREINO', descricao: 'Escolher outro processo.', abrir: () => telaTreino(app) })
}

function escolherPecaTig(app: App): void {
  menuOficina(app, 'TIG', 'TREINO / ESCOLHA A PEÇA', PECAS_TIG.map(p => ({
    nome: p.titulo,
    descricao: `${p.aplicacao} · ${MATERIAIS[p.material].nomeCurto} ${n1(p.espessuraMm)} mm · ${INFO_JUNTA[p.junta].nome} · vareta Ø ${n1(p.varetaMm)} mm.`,
    abrir: () => escolherChapa(app, 'TIG', 'TIG', p.titulo, p.material, () => escolherPecaTig(app), (mat, caminho) =>
      escolherModo(app, 'TIG', caminho, (d) => telaTreinoTig(app, pecaTigEm(p, mat), d, () => escolherPecaTig(app)), () => escolherPecaTig(app))),
  })), { nome: 'VOLTAR AO TREINO', descricao: 'Escolher outro processo.', abrir: () => telaTreino(app) })
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
  const abrir = (p: PecaTorno) => escolherModo(app, 'TORNO', 'TREINO / ' + p.titulo.toUpperCase(), (d) => telaTorno(app, p, d, () => escolherPecaTorno(app, voltar)), () => escolherPecaTorno(app, voltar))
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
    abrir: () => escolherModo(app, 'PLASMA', 'TREINO / ' + p.titulo.toUpperCase(), (d) => telaTreinoPlasma(app, p, d, () => escolherPecaPlasma(app)), () => escolherPecaPlasma(app)),
  })), { nome: 'VOLTAR AO TREINO', descricao: 'Escolher outro processo.', abrir: () => telaTreino(app) })
}

/** H110: solda subaquática molhada (eletrodo revestido no mar). */
function escolherPecaSubaquatica(app: App): void {
  menuOficina(app, 'SUBAQUÁTICA', 'TREINO / SOLDA MOLHADA / ESCOLHA O MERGULHO', PECAS_SUBAQUATICA.map(p => ({
    nome: p.titulo,
    descricao: `${p.aplicacao} · ${p.subaquatica!.profundidadeM} m · ${INFO_JUNTA[p.junta].nome} · ${n1(p.espessuraMm)} mm. ${p.porque}`,
    abrir: () => escolherModo(app, 'SUBAQUÁTICA', 'TREINO / ' + p.titulo.toUpperCase(), (d) => telaTreinoEletrodo(app, p, d, () => escolherPecaSubaquatica(app)), () => escolherPecaSubaquatica(app)),
  })), { nome: 'VOLTAR AO TREINO', descricao: 'Escolher outro processo.', abrir: () => telaTreino(app) })
}

function escolherPecaBrasagem(app: App): void {
  menuOficina(app, 'BRASAGEM', 'TREINO / ESCOLHA A PEÇA', PECAS_BRASAGEM.map(p => ({
    nome: p.titulo,
    descricao: `${p.aplicacao} · ${MATERIAIS[p.material].nomeCurto} ${n1(p.espessuraMm)} mm · ${LIGAS[p.recomendado.liga].nome}.`,
    abrir: () => escolherChapa(app, 'BRASAGEM', 'brasagem', p.titulo, p.material, () => escolherPecaBrasagem(app), (mat, caminho) =>
      escolherModo(app, 'BRASAGEM', caminho, (d) => telaTreinoBrasagem(app, pecaBrasagemEm(p, mat), d, () => escolherPecaBrasagem(app)), () => escolherPecaBrasagem(app))),
  })), { nome: 'VOLTAR AO TREINO', descricao: 'Escolher outro processo.', abrir: () => telaTreino(app) })
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
        h('button', { type: 'button', on: { click: () => telaTreino(app) } }, 'Outros treinos'),
        h('button', { type: 'button', class: 'primario', on: { click: () => bancadaTreino(app, { ...s, inicial: config, anterior: tentativa ?? s.anterior }) } }, 'Treinar de novo'),
      ),
    )
    return inspecao.destruir
  }, 'Treino · resultado')
}
