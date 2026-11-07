import { resumoOrganizacao } from '../../dados/organizacaoTorneio'
import { abrirPainel } from '../dialogo'
import type { PerfilParticipante } from '../../dados/participantes'
import {
  classificacaoGeral,
  classificacaoRodada,
  CONFIG_PADRAO,
  concluirTentativa,
  criarTorneio,
  dispositivoFixado,
  duplicarConfig,
  entregar,
  ErroTorneio,
  iniciar,
  iniciarTentativa,
  marcarInterrompidas,
  rodadaCompleta,
  rotuloCampo,
  selecionarEntrega,
  tentativasOficiais,
  tentativasRestantes,
  validarConfig,
  vezAtual,
  type BaseTorneio,
  type ConfigTorneio,
  type GrupoClassificacao,
  type RegraEntrega,
  type TentativaRegistro,
  missaoDaRodada,
  descreverRodada,
  nomePeca,
} from '../../dados/torneio'
import { DISPOSITIVOS, NOME_DISPOSITIVO, type Dispositivo } from '../../entrada/tipos'
import { buscarMissao, DIFICULDADES, MISSOES, NOME_DIFICULDADE, type Dificuldade, descreverConsumiveis, descreverJunta, requisitosEfetivos } from '../../missoes/catalogo'
import { INFO_JUNTA } from '../../modelo/juntas'
import { pontuarRegistro } from '../../pontuacao/oficial'
import { CATEGORIAS, NOME_CATEGORIA, PESOS_PADRAO, type CategoriaId } from '../../pontuacao/regras'
import { normalizarNome } from '../../dados/recordes'
import type { App } from '../app'
import { montarInspecao } from '../componentes/inspecao'
import { montarAbas } from '../componentes/abas'
import { montarPontuacao } from '../componentes/pontuacao'
import { avisar, confirmar } from '../dialogo'
import { dataHora, h, n1, titulo, anexar } from '../dom'
import { telaExecucao } from './execucao'
import { montarPreparacao, type ConfiguracaoTentativa } from './missao'
import { telaJulgamento } from './julgamento'

/*
 * Torneio local por turnos. As regras (vez, limite, entrega, publicação)
 * ficam no motor puro (dados/torneio.ts); aqui só montamos as telas e
 * gravamos depois de cada ação relevante.
 */

export const TEXTO_REGRA: Record<RegraEntrega, string> = {
  ultima: 'vale a ÚLTIMA tentativa concluída',
  melhor: 'vale a MELHOR tentativa pela nota automática',
  escolha: 'o jogador ESCOLHE qual tentativa entregar',
}

const TEXTO_ORDEM = { fixa: 'mesma ordem em todas as rodadas', rodizio: 'rodízio (quem começa muda a cada rodada)', sorteio: 'ordem sorteada em cada rodada' }

function executarAcao(app: App, acao: () => BaseTorneio): BaseTorneio | null {
  try {
    const b = acao()
    app.gravarBase(b)
    return b
  } catch (e) {
    if (e instanceof ErroTorneio) {
      avisar('Ação não permitida', e.message)
      return null
    }
    throw e
  }
}

const nomeDe = (b: BaseTorneio, id: string) => b.participantes.find((p) => p.id === id)?.nome ?? '?'

// ---------------------------------------------------------------- lista

export function telaTorneios(app: App): void {
  app.ir((app) => {
    const lista = [...app.torneios].sort((a, b) => b.criadoEm.localeCompare(a.criadoEm))
    anexar(app.raiz, 
      titulo('Versus · torneios locais', 'Por turnos, no mesmo computador. Tudo fica salvo neste navegador.'),
      h('div', { class: 'acoes' }, h('button', { type: 'button', class: 'primario', on: { click: () => telaConfigTorneio(app) } }, 'Novo torneio')),
      lista.length
        ? h(
            'ul',
            { class: 'lista-torneios' },
            lista.map((t) =>
              h(
                'li',
                { class: 'cartao-missao' },
                h('h3', {}, t.config.nome),
                h('p', {}, `${t.status === 'concluido' ? 'Concluído' : t.status === 'em-andamento' ? 'Em andamento' : 'Preparado'} · ${t.config.participantes.length} participantes · ${t.config.rodadas.length} rodada(s) · ${t.config.modo === 'professor' ? 'com professor' : 'sem professor'}`),
                h('p', { class: 'nota' }, `Criado em ${dataHora(t.criadoEm)}`),
                h(
                  'div',
                  { class: 'acoes' },
                  h('button', { type: 'button', class: 'primario', on: { click: () => painelTorneio(app, t.id) } }, t.status === 'concluido' ? 'Ver resultados' : 'Abrir'),
                  h('button', { type: 'button', on: { click: () => telaConfigTorneio(app, duplicarConfig(t), t.id) } }, 'Duplicar configuração'),
                  h(
                    'button',
                    {
                      type: 'button',
                      class: 'perigo',
                      on: {
                        click: async () => {
                          if (!(await confirmar('Excluir torneio?', `"${t.config.nome}" e todas as tentativas, entregas e avaliações dele serão apagados.`, { sim: 'Excluir', perigo: true }))) return
                          app.excluirTorneio(t.id)
                          telaTorneios(app)
                        },
                      },
                    },
                    'Excluir',
                  ),
                ),
              ),
            ),
          )
        : h('p', {}, 'Nenhum torneio ainda.'),
    )
  }, 'Versus')
}

// ---------------------------------------------------------------- configuração

function telaConfigTorneio(app: App, inicial?: ConfigTorneio, origemId: string | null = null): void {
  app.ir((app) => {
    const c: ConfigTorneio = inicial
      ? structuredClone(inicial)
      : {
          ...structuredClone(CONFIG_PADRAO),
          nome: '',
          participantes: [],
          rodadas: [{ missaoId: MISSOES[0].id, missaoVersao: MISSOES[0].versao, dificuldade: 'aprendiz', tentativas: 3 }],
        }
    const erros = h('div', { class: 'erro', role: 'alert' })
    const nome = h('input', { id: 'cfg-nome', type: 'text', value: c.nome, maxlength: '24' })
    const participantes = h('textarea', { id: 'cfg-part', rows: '5', value: c.participantes.join('\n') })

    const rodadas = h('ol', { class: 'lista-rodadas' })
    const desenharRodadas = () => {
      rodadas.replaceChildren(
        ...c.rodadas.map((r, i) => {
          // Peça escolhida pelo MATERIAL (e espessura); a missão do catálogo só fornece consumíveis e limites do desenho.
          const detalhe = h('small', { class: 'rodada-detalhe' })
          const atualizarDetalhe = () => {
            const m = buscarMissao(r.missaoId)!
            const req = requisitosEfetivos(m, r.dificuldade)
            detalhe.textContent = `Largura ${n1(req.larguraMinMm)}–${n1(req.larguraMaxMm)} mm · reforço ≤ ${n1(req.reforcoMaxMm)} mm · ${descreverConsumiveis(m).join(' · ')}`
          }
          const missao = h('select', { 'aria-label': `Material da rodada ${i + 1}` }, MISSOES.map((m) => h('option', { value: m.id, selected: m.id === r.missaoId }, `${nomePeca(m.id)} · ${INFO_JUNTA[m.geometria.junta].nome}`)))
          missao.addEventListener('change', () => {
            const m = buscarMissao(missao.value)!
            r.missaoId = m.id
            r.missaoVersao = m.versao
            atualizarDetalhe()
          })
          atualizarDetalhe()
          const dif = h('select', { 'aria-label': `Dificuldade da rodada ${i + 1}` }, DIFICULDADES.map((d) => h('option', { value: d, selected: d === r.dificuldade }, NOME_DIFICULDADE[d])))
          dif.addEventListener('change', () => {
            r.dificuldade = dif.value as Dificuldade
            atualizarDetalhe()
          })
          const tent = h('input', { type: 'number', min: '1', max: '10', value: String(r.tentativas), 'aria-label': `Tentativas por jogador na rodada ${i + 1}` })
          tent.addEventListener('input', () => (r.tentativas = Number(tent.value)))
          const remover = h('button', { type: 'button', class: 'pequeno', disabled: c.rodadas.length <= 1, 'aria-label': `Remover rodada ${i + 1}` }, 'Remover')
          remover.addEventListener('click', () => {
            c.rodadas.splice(i, 1)
            desenharRodadas()
          })
          return h('li', {}, h('span', {}, `Rodada ${i + 1}`), missao, dif, h('label', {}, 'tentativas ', tent), remover, detalhe)
        }),
      )
    }
    desenharRodadas()

    const radio = <T extends string>(grupo: string, valor: T, rotulo: string, atual: T, mudar: (v: T) => void) => {
      const id = `cfg-${grupo}-${valor}`
      const e = h('input', { type: 'radio', name: `cfg-${grupo}`, id, checked: valor === atual })
      e.addEventListener('change', () => e.checked && mudar(valor))
      return h('div', { class: 'opcao' }, e, h('label', { for: id }, rotulo))
    }

    const blocoProfessor = h('div', { hidden: c.modo !== 'professor' })
    const pesosMedia = h('div', { class: 'linha-controles', hidden: c.classificacao !== 'ponderada' })
    const pProf = h('input', { type: 'number', min: '0', max: '100', value: String(c.pesosMedia.professor), 'aria-label': 'Peso da nota do professor' })
    const pSis = h('input', { type: 'number', min: '0', max: '100', value: String(c.pesosMedia.sistema), 'aria-label': 'Peso da nota do sistema' })
    pProf.addEventListener('input', () => (c.pesosMedia.professor = Number(pProf.value)))
    pSis.addEventListener('input', () => (c.pesosMedia.sistema = Number(pSis.value)))
    pesosMedia.append(h('label', {}, 'Peso do professor ', pProf), h('label', {}, 'Peso do sistema ', pSis))
    blocoProfessor.append(
      h('p', {}, h('strong', {}, 'Classificação neste modo')),
      radio('classif', 'professor', 'Pela nota final do professor (padrão; a automática fica como referência separada)', c.classificacao, (v) => {
        c.classificacao = v
        pesosMedia.hidden = true
      }),
      radio('classif', 'sistema', 'Pela nota automática do sistema', c.classificacao, (v) => {
        c.classificacao = v
        pesosMedia.hidden = true
      }),
      radio('classif', 'ponderada', 'Média ponderada das duas', c.classificacao, (v) => {
        c.classificacao = v
        pesosMedia.hidden = false
      }),
      pesosMedia,
      h('p', { class: 'nota' }, 'Na média ponderada, a nota do professor (0 a 10) é convertida para 0 a 1000 antes de combinar, e os pesos aparecem no resultado. Atenção: a nota final do professor já pode considerar a avaliação do sistema, então a média pode contar os mesmos critérios duas vezes.'),
      h('p', { class: 'nota' }, 'O julgamento por código reduz vieses, mas num aplicativo local não garante anonimato completo nem impede fraudes.'),
    )

    const pesos = h('div', { class: 'grade-pesos' })
    const somaPesos = h('p', { class: 'nota' })
    const atualizarSoma = () => {
      const soma = CATEGORIAS.reduce((s, k) => s + (Number(c.pesos[k]) || 0), 0)
      somaPesos.textContent = `Soma: ${soma} (deve ser 100). Proposta didática configurável antes do início.`
    }
    for (const k of CATEGORIAS) {
      const e = h('input', { type: 'number', min: '0', max: '100', value: String(c.pesos[k]), id: `cfg-peso-${k}` })
      e.addEventListener('input', () => {
        c.pesos[k as CategoriaId] = Number(e.value)
        atualizarSoma()
      })
      pesos.append(h('label', { for: e.id }, NOME_CATEGORIA[k as CategoriaId]), e)
    }
    atualizarSoma()

    const dispositivo = h('select', { 'aria-label': 'Dispositivo exigido', disabled: c.dispositivo.tipo !== 'exigir' }, DISPOSITIVOS.map((d) => h('option', { value: d, selected: c.dispositivo.tipo === 'exigir' && c.dispositivo.dispositivo === d }, NOME_DISPOSITIVO[d])))
    dispositivo.addEventListener('change', () => (c.dispositivo = { tipo: 'exigir', dispositivo: dispositivo.value as Dispositivo }))

    const enviar = async (e: Event) => {
      e.preventDefault()
      c.nome = normalizarNome(nome.value)
      c.participantes = participantes.value.split('\n').map(normalizarNome).filter(Boolean)
      const problemas = validarConfig(c)
      if (problemas.length) {
        erros.replaceChildren(h('ul', {}, problemas.map((p) => h('li', {}, p))))
        erros.querySelector('li')?.scrollIntoView({ block: 'center' })
        return
      }
      erros.replaceChildren()
      const resumo = h(
        'div',
        {},
        h('p', {}, `${c.participantes.length} participantes, ${c.rodadas.length} rodada(s), ${c.modo === 'professor' ? 'com professor' : 'sem professor'}.`),
        h('p', {}, `Entrega: ${TEXTO_REGRA[c.regraEntrega]}. Dispositivo: ${c.dispositivo.tipo === 'exigir' ? `exigido ${NOME_DISPOSITIVO[c.dispositivo.dispositivo]}` : 'classificação separada por dispositivo'}.`),
        h('p', {}, h('strong', {}, 'Depois de iniciar, as regras ficam bloqueadas. Para mudar, será preciso duplicar a configuração em um novo torneio.')),
      )
      if (!(await confirmar('Iniciar o torneio?', resumo, { sim: 'Iniciar' }))) return
      const agora = new Date().toISOString()
      const perfis: PerfilParticipante[] = c.participantes.map((n) => ({ id: app.ambiente.novoId('par'), nome: n, criadoEm: agora, origem: 'torneio' }))
      const torneio = criarTorneio(c, perfis, app.ambiente, origemId)
      const base = iniciar({ torneio, participantes: perfis, tentativas: [], entregas: [], avaliacoes: [] }, app.ambiente)
      app.gravarBase(base)
      painelTorneio(app, base.torneio.id)
    }

    anexar(app.raiz, 
      titulo(origemId ? 'Novo torneio (configuração duplicada)' : 'Novo torneio', 'Todos recebem as mesmas condições em cada rodada.'),
      (() => {
        // Tela travada: cada parte da configuração numa aba (nada de rolar a página).
        const grupo = (...filhos: HTMLElement[]) => h('div', { class: 'grupo-campos' }, filhos)
        const partes = [
        h('fieldset', {}, h('legend', {}, 'Identificação'), h('label', { for: 'cfg-nome' }, 'Nome do torneio'), nome, h('label', { for: 'cfg-part' }, 'Participantes (um nome por linha, na ordem de cadastro)'), participantes),
        h(
          'fieldset',
          {},
          h('legend', {}, 'Rodadas'),
      rodadas,
          h('button', { type: 'button', on: { click: () => { c.rodadas.push({ ...c.rodadas[c.rodadas.length - 1] }); desenharRodadas() } } }, 'Adicionar rodada'),
          h('p', { class: 'nota' }, 'As tentativas são um limite máximo: o jogador pode entregar antes de esgotá-las.'),
        ),
        h('fieldset', {}, h('legend', {}, 'Ordem dos jogadores'), (['fixa', 'rodizio', 'sorteio'] as const).map((o) => radio('ordem', o, TEXTO_ORDEM[o], c.ordem, (v) => (c.ordem = v)))),
        h('fieldset', {}, h('legend', {}, 'Regra para a entrega final (mostrada antes de soldar)'), (['ultima', 'melhor', 'escolha'] as const).map((r) => radio('entrega', r, TEXTO_REGRA[r], c.regraEntrega, (v) => (c.regraEntrega = v)))),
        h(
          'fieldset',
          {},
          h('legend', {}, 'Dispositivo permitido'),
          radio('disp', 'separar', 'Qualquer dispositivo, com classificação separada por dispositivo (cada jogador mantém o seu)', c.dispositivo.tipo, () => {
            c.dispositivo = { tipo: 'separar' }
            dispositivo.disabled = true
          }),
          radio('disp', 'exigir', 'Exigir o mesmo dispositivo para todos', c.dispositivo.tipo, () => {
            c.dispositivo = { tipo: 'exigir', dispositivo: dispositivo.value as Dispositivo }
            dispositivo.disabled = false
          }),
          dispositivo,
          h('p', { class: 'nota' }, 'Mouse, caneta e controle não foram testados como equivalentes em competição; por isso o padrão é separar.'),
        ),
        h(
          'fieldset',
          {},
          h('legend', {}, 'Avaliação'),
          radio('modo', 'automatico', 'Sem professor: classificação só pela pontuação automática', c.modo, (v) => {
            c.modo = v
            blocoProfessor.hidden = true
          }),
          radio('modo', 'professor', 'Com professor: julgamento por código, em duas etapas', c.modo, (v) => {
            c.modo = v
            blocoProfessor.hidden = false
          }),
          blocoProfessor,
        ),
        h(
          'fieldset',
          {},
          h('legend', {}, 'Classificação e desempate'),
          radio('desempate', 'integridade-desenho', 'Empate na nota: integridade, depois desenho, depois menos tentativas', c.desempate, (v) => (c.desempate = v)),
          radio('desempate', 'desenho-integridade', 'Empate na nota: desenho, depois integridade, depois menos tentativas', c.desempate, (v) => (c.desempate = v)),
          h('p', { class: 'nota' }, 'Sem professor: entregas aprovadas sempre ficam acima das não aprovadas — rapidez ou economia não compensam um requisito essencial.'),
        ),
        h('fieldset', {}, h('legend', {}, 'Pesos da pontuação automática'), pesos, somaPesos, h('button', { type: 'button', on: { click: () => { c.pesos = { ...PESOS_PADRAO }; telaConfigTorneio(app, { ...c, nome: nome.value, participantes: participantes.value.split('\n') }, origemId) } } }, 'Voltar aos pesos padrão')),
        ]
        const [identificacao, rodadasFs, ordem, entrega, dispositivoFs, avaliacao, classificacao, pesosFs] = partes
        const abas = montarAbas(
          [
            ['Participantes', grupo(identificacao)],
            ['Rodadas', grupo(rodadasFs)],
            ['Regras', grupo(ordem, entrega, dispositivoFs)],
            ['Avaliação', grupo(avaliacao, classificacao)],
            ['Pesos', grupo(pesosFs)],
          ],
          'Configuração do torneio',
        )
        // Erro de validação: mostra a aba do campo com problema.
        nome.addEventListener('invalid', () => abas.escolher(0))
        participantes.addEventListener('invalid', () => abas.escolher(0))
        return h(
          'form',
          { class: 'form-torneio form-em-abas', on: { submit: enviar } },
          abas.lista,
          abas.corpos,
          erros,
          h('div', { class: 'acoes' }, h('button', { type: 'button', on: { click: () => telaTorneios(app) } }, 'Cancelar'), h('button', { type: 'submit', class: 'primario' }, 'Revisar e iniciar')),
        )
      })(),
    )
  }, 'Torneio · configuração')
}

// ---------------------------------------------------------------- painel

export function painelTorneio(app: App, id: string): void {
  app.ir((app) => {
    const b = app.baseDoTorneio(id)
    const c = b.torneio.config
    const vez = vezAtual(b)
    const organizacao = resumoOrganizacao(b)
    const rodadas = h(
      'table',
      { class: 'tabela' },
      h('caption', {}, 'Rodadas'),
      h('thead', {}, h('tr', {}, ['Rodada', 'Missão', 'Dificuldade', 'Tentativas', 'Entregas', c.modo === 'professor' ? 'Julgamento' : 'Resultado'].map((t) => h('th', { scope: 'col' }, t)))),
      h(
        'tbody',
        {},
        c.rodadas.map((r, i) => {
          const entregues = b.entregas.filter((e) => e.rodada === i).length
          const completa = rodadaCompleta(b, i)
          const coluna =
            c.modo === 'professor'
              ? completa
                ? b.torneio.publicadas[i]
                  ? h('span', {}, `publicada (${dataHora(b.torneio.publicadas[i])}) `, h('button', { type: 'button', class: 'pequeno', on: { click: () => telaJulgamento(app, id, i) } }, 'Revisões'))
                  : h('button', { type: 'button', class: 'pequeno primario', on: { click: () => telaJulgamento(app, id, i) } }, 'Julgar (professor)')
                : 'aguardando entregas'
              : completa
                ? h('button', { type: 'button', class: 'pequeno', on: { click: () => resultadoRodada(app, id, i) } }, 'Ver resultado')
                : '—'
          return h('tr', {}, h('td', {}, `${i + 1}`), h('td', {}, descreverRodada(r)), h('td', {}, NOME_DIFICULDADE[r.dificuldade]), h('td', {}, `até ${r.tentativas}`), h('td', {}, `${entregues} / ${b.torneio.participanteIds.length}`), h('td', {}, coluna))
        }),
      ),
    )
    const geral = classificacaoGeral(b)
    anexar(app.raiz, 
      titulo(c.nome, `${b.torneio.status === 'concluido' ? 'Concluído' : 'Em andamento'} · ${c.modo === 'professor' ? 'com professor' : 'sem professor'}`),
      vez
        ? h(
            'section',
            { class: 'vez-destaque' },
            h('p', {}, `Rodada ${vez.rodada + 1} de ${c.rodadas.length} · jogador ${vez.posicao} de ${vez.total}`),
            h('p', { class: 'vez-nome' }, `Vez de ${nomeDe(b, vez.participanteId)}`),
            h('button', { type: 'button', class: 'primario grande', on: { click: () => telaVez(app, id) } }, 'Chamar a vez'),
          )
        : h('p', { class: 'selo selo-ok' }, 'Todas as entregas foram feitas.'),
          h('button', { type: 'button', class: 'botao-secundario', on: { click: () => abrirPainel('Organização e comparação', h('section', {}, h('h3', {}, 'Pendências por rodada'), h('ul', {}, organizacao.rodadas.map(r => h('li', {}, `Rodada ${r.rodada+1}: ${r.entregues} entrega(s), ${r.faltam} pendente(s). ${r.acao}.`))), h('p', {}, organizacao.aviso), h('p', { class: 'nota' }, 'Cada rodada usa a mesma missão, dificuldade e limite de tentativas para o grupo. Notas do professor só são mostradas após publicação.'))) } }, 'Ver pendências e regras de comparação'),
      rodadas,
      h(
        'details',
        {},
        h('summary', {}, 'Regras deste torneio (bloqueadas)'),
        h(
          'ul',
          {},
          h('li', {}, `Participantes: ${c.participantes.join(', ')}`),
          h('li', {}, `Ordem: ${TEXTO_ORDEM[c.ordem]}`),
          h('li', {}, `Entrega: ${TEXTO_REGRA[c.regraEntrega]}`),
          h('li', {}, `Dispositivo: ${c.dispositivo.tipo === 'exigir' ? `exigido ${NOME_DISPOSITIVO[c.dispositivo.dispositivo]}` : 'separado por dispositivo'}`),
          h('li', {}, `Pesos: ${CATEGORIAS.map((k) => `${NOME_CATEGORIA[k]} ${c.pesos[k]}`).join(', ')}`),
          c.modo === 'professor' ? h('li', {}, `Classificação: ${c.classificacao === 'professor' ? 'nota final do professor' : c.classificacao === 'sistema' ? 'nota automática' : `média ponderada (professor ${c.pesosMedia.professor}, sistema ${c.pesosMedia.sistema})`}`) : null,
        ),
        h('button', { type: 'button', on: { click: () => telaConfigTorneio(app, duplicarConfig(b.torneio), b.torneio.id) } }, 'Duplicar configuração para mudar regras'),
      ),
      h('section', {}, h('h3', {}, 'Classificação geral'), geral ? tabelaClassificacao(b, geral.grupos, `Soma das rodadas ${geral.rodadasConsideradas.map((r) => r + 1).join(', ')}`) : h('p', { class: 'nota' }, c.modo === 'professor' ? 'Aparece depois que o professor publicar a primeira rodada.' : 'Aparece quando a primeira rodada terminar.')),
      b.torneio.historico.length ? h('details', {}, h('summary', {}, 'Histórico'), h('ul', {}, b.torneio.historico.map((x) => h('li', {}, `${dataHora(x.data)} — ${x.descricao}`)))) : null,
      h('div', { class: 'acoes' }, h('button', { type: 'button', on: { click: () => telaTorneios(app) } }, 'Lista de torneios')),
    )
  }, 'Versus')
}

export function tabelaClassificacao(b: BaseTorneio, grupos: GrupoClassificacao[], legenda: string): HTMLElement {
  const c = b.torneio.config
  const professor = c.modo === 'professor'
  return h(
    'div',
    {},
    grupos.map((g) =>
      h(
        'div',
        { class: 'rolagem-tabela' },
        h(
          'table',
          { class: 'tabela ranking' },
          h('caption', {}, `${legenda}${g.dispositivo ? ` · ${NOME_DISPOSITIVO[g.dispositivo]}` : ''}`),
          h('thead', {}, h('tr', {}, ['Pos.', 'Nome', professor ? 'Nota de classificação' : 'Nota', ...(professor ? ['Professor (0–10)', 'Automática (referência)'] : ['Situação']), 'Integridade', 'Desenho', 'Tentativas'].map((t) => h('th', { scope: 'col' }, t)))),
          h(
            'tbody',
            {},
            g.linhas.map((l) =>
              h(
                'tr',
                { class: l.posicao === 1 ? 'lider' : '' },
                h('td', {}, `${l.posicao}º`),
                h('th', { scope: 'row' }, l.nome),
                h('td', { class: 'num' }, n1(l.nota)),
                ...(professor ? [h('td', { class: 'num' }, l.professor === null ? '—' : n1(l.professor)), h('td', { class: 'num' }, n1(l.automatico))] : [h('td', {}, l.aprovada ? 'aprovada' : 'não aprovada')]),
                h('td', { class: 'num' }, n1(l.integridade)),
                h('td', { class: 'num' }, n1(l.desenho)),
                h('td', { class: 'num' }, String(l.tentativasUsadas)),
              ),
            ),
          ),
        ),
      ),
    ),
    h(
      'p',
      { class: 'nota' },
      professor
        ? `Classificação ${c.classificacao === 'professor' ? 'pela nota final do professor (convertida para 0–1000)' : c.classificacao === 'sistema' ? 'pela nota automática' : `pela média ponderada: professor ${c.pesosMedia.professor}, sistema ${c.pesosMedia.sistema}, com a nota do professor convertida para 0–1000`}. Desempate: nota automática, ${c.desempate === 'integridade-desenho' ? 'integridade, desenho' : 'desenho, integridade'}, menos tentativas.`
        : `Desempate: aprovadas primeiro, depois nota, ${c.desempate === 'integridade-desenho' ? 'integridade, desenho' : 'desenho, integridade'} e menos tentativas.`,
    ),
  )
}

// ---------------------------------------------------------------- vez do jogador

function rotuloRegra(b: BaseTorneio): string {
  return TEXTO_REGRA[b.torneio.config.regraEntrega]
}

function dispositivosPermitidos(b: BaseTorneio, pid: string): Dispositivo[] {
  const regra = b.torneio.config.dispositivo
  if (regra.tipo === 'exigir') return [regra.dispositivo]
  const fixado = dispositivoFixado(b, pid)
  return fixado ? [fixado] : DISPOSITIVOS
}

function telaVez(app: App, id: string): void {
  if (!vezAtual(app.baseDoTorneio(id))) return painelTorneio(app, id)
  app.ir((app) => {
    const b = app.baseDoTorneio(id)
    const vez = vezAtual(b)!
    const r = b.torneio.config.rodadas[vez.rodada]
    const nome = nomeDe(b, vez.participanteId)
    anexar(app.raiz, 
      h(
        'section',
        { class: 'passagem' },
        h('p', { class: 'rodada' }, `RODADA ${vez.rodada + 1} DE ${b.torneio.config.rodadas.length} · JOGADOR ${vez.posicao} DE ${vez.total}`),
        h('h2', { class: 'tela-titulo vez-nome', tabindex: '-1' }, `Vez de ${nome}`),
        h('p', {}, `Peça: ${nomePeca(r.missaoId)} · ${NOME_DIFICULDADE[r.dificuldade]} · até ${r.tentativas} tentativa(s) · restam ${tentativasRestantes(b, vez.participanteId, vez.rodada)}`),
        h('p', {}, `Junta da rodada (igual para todos): ${descreverJunta(missaoDaRodada(r))}`),
        h('p', { class: 'regra-vigor destaque' }, h('strong', {}, 'Regra de entrega: '), rotuloRegra(b)),
        h('p', { class: 'dica' }, `Pesos da pontuação: ${CATEGORIAS.map((c) => `${NOME_CATEGORIA[c].toLowerCase()} ${b.torneio.config.pesos[c]}`).join(' · ')}`),
        h('div', { class: 'acoes' }, h('button', { type: 'button', on: { click: () => painelTorneio(app, id) } }, 'Painel do torneio'), h('button', { type: 'button', class: 'primario grande', on: { click: () => preparacaoVez(app, id) } }, `Sou ${nome} — começar`)),
      ),
    )
  }, 'Torneio · vez')
}

/** Configuração usada na última tentativa (memória da sessão, não conta como dado oficial). */
const ultimaConfig = new Map<string, ConfiguracaoTentativa>()

function preparacaoVez(app: App, id: string): void {
  app.ir((app) => {
    const b = app.baseDoTorneio(id)
    const vez = vezAtual(b)!
    const r = b.torneio.config.rodadas[vez.rodada]
    const m = missaoDaRodada(r)
    const restantes = tentativasRestantes(b, vez.participanteId, vez.rodada)
    const feitas = tentativasOficiais(b, vez.participanteId, vez.rodada)
    const prep = montarPreparacao(app, {
      missao: m,
      dificuldade: r.dificuldade,
      oficial: restantes > 0 ? `Iniciar tentativa oficial ${feitas.length + 1} de ${r.tentativas}` : null,
      treino: true,
      regra: rotuloRegra(b),
      dispositivos: dispositivosPermitidos(b, vez.participanteId),
      inicial: ultimaConfig.get(`${id}|${vez.participanteId}`),
      aoIniciar: (config, oficial) => {
        ultimaConfig.set(`${id}|${vez.participanteId}`, config)
        if (oficial) iniciarOficial(app, id, config)
        else treinoNaVez(app, id, config)
      },
    })
    anexar(app.raiz, 
      titulo('Preparação', `${nomeDe(b, vez.participanteId)} · ${descreverRodada(r)} · tentativas oficiais restantes: ${restantes}`),
      prep.elemento,
      feitas.length ? h('div', { class: 'acoes' }, h('button', { type: 'button', class: 'primario', on: { click: () => telaEntrega(app, id) } }, 'Ir para a entrega')) : null,
    )
    return prep.destruir
  }, 'Torneio · preparação')
}

function treinoNaVez(app: App, id: string, config: ConfiguracaoTentativa): void {
  const b = app.baseDoTorneio(id)
  const vez = vezAtual(b)!
  const r = b.torneio.config.rodadas[vez.rodada]
  const m = missaoDaRodada(r)
  // Treino: nada é registrado no torneio.
  app.ir(
    telaExecucao({
      missao: m,
      dificuldade: r.dificuldade,
      contexto: config.contexto,
      ajustes: config.ajustes,
      dispositivo: config.dispositivo,
      preferencias: app.preferencias,
      oficial: false,
      rotulo: `Treino de ${nomeDe(b, vez.participanteId)} — não conta`,
      aoConcluir: ({ eventos }) =>
        app.ir((app) => {
          const { resultado } = pontuarRegistro(m, r.dificuldade, config.contexto, eventos, b.torneio.config.pesos)
          anexar(app.raiz, 
            titulo('Resultado do treino', 'Não conta no torneio.'),
            montarPontuacao(resultado, { rotulo: 'TREINO — NÃO CONTA' }),
            h('div', { class: 'acoes' }, h('button', { type: 'button', class: 'primario', on: { click: () => preparacaoVez(app, id) } }, 'Voltar à preparação')),
          )
        }, 'Torneio · treino'),
      aoSair: () => preparacaoVez(app, id),
    }),
    'Torneio · treino',
  )
}

function iniciarOficial(app: App, id: string, config: ConfiguracaoTentativa): void {
  const b0 = app.baseDoTorneio(id)
  const vez = vezAtual(b0)!
  let tentativaId = ''
  const b = executarAcao(app, () => {
    const r = iniciarTentativa(b0, { participanteId: vez.participanteId, dispositivo: config.dispositivo, preparo: config.preparo, ajustes: config.ajustes, contexto: config.contexto }, app.ambiente)
    tentativaId = r.tentativa.id
    return r.base
  })
  if (!b) return
  const t = b.tentativas.find((x) => x.id === tentativaId)!
  const rodada = b.torneio.config.rodadas[vez.rodada]
  const m = missaoDaRodada(rodada)
  app.ir(
    telaExecucao({
      missao: m,
      dificuldade: rodada.dificuldade,
      contexto: config.contexto,
      ajustes: config.ajustes,
      dispositivo: config.dispositivo,
      preferencias: app.preferencias,
      oficial: true,
      rotulo: `${nomeDe(b, vez.participanteId)} · tentativa oficial ${t.numero} de ${rodada.tentativas}`,
      regra: rotuloRegra(b),
      aoConcluir: ({ eventos }) => {
        const { resultado } = pontuarRegistro(m, rodada.dificuldade, config.contexto, eventos, b.torneio.config.pesos)
        const nova = executarAcao(app, () => concluirTentativa(app.baseDoTorneio(id), tentativaId, { eventos, resultado }, app.ambiente))
        if (nova) resultadoOficial(app, id, tentativaId)
      },
      aoSair: () => {
        executarAcao(app, () => marcarInterrompidas(app.baseDoTorneio(id)).base)
        preparacaoVez(app, id)
      },
    }),
    'Torneio · tentativa oficial',
  )
}

function resultadoOficial(app: App, id: string, tentativaId: string): void {
  app.ir((app) => {
    const b = app.baseDoTorneio(id)
    const t = b.tentativas.find((x) => x.id === tentativaId)!
    const r = b.torneio.config.rodadas[t.rodada]
    const m = missaoDaRodada(r)
    const restantes = tentativasRestantes(b, t.participanteId, t.rodada)
    const inspecao = montarInspecao({ missao: m, dificuldade: r.dificuldade, contexto: t.contexto, eventos: t.eventos!, ajustes: t.ajustes, preparo: t.preparo, dispositivo: t.dispositivo })
    // Tela travada: tudo cabe na janela; textos longos abrem em sobreposição.
    app.raiz.classList.add('tela-resultado')
    anexar(app.raiz, 
      titulo(`Tentativa oficial ${t.numero} concluída`, `${nomeDe(b, t.participanteId)} · restam ${restantes} · regra: ${rotuloRegra(b)}`),
      h('div', { class: 'grade-resultado' }, montarPontuacao(t.resultado!, { animar: true }), inspecao.elemento),
      h(
        'div',
        { class: 'acoes' },
        restantes > 0 ? h('button', { type: 'button', on: { click: () => preparacaoVez(app, id) } }, `Nova tentativa (restam ${restantes})`) : null,
        h('button', { type: 'button', class: 'primario', on: { click: () => telaEntrega(app, id) } }, restantes > 0 ? 'Entregar agora' : 'Fazer a entrega'),
      ),
    )
    return inspecao.destruir
  }, 'Torneio · resultado')
}

function telaEntrega(app: App, id: string): void {
  app.ir((app) => {
    const b = app.baseDoTorneio(id)
    const vez = vezAtual(b)!
    const oficiais = tentativasOficiais(b, vez.participanteId, vez.rodada)
    const concluidas = oficiais.filter((t) => t.status === 'concluida')
    const c = b.torneio.config
    let escolha: string | undefined = concluidas[concluidas.length - 1]?.id
    const previsto = c.regraEntrega === 'escolha' ? null : selecionarEntrega(c.regraEntrega, concluidas, c.desempate)
    const descrever = (t: TentativaRegistro) =>
      t.status === 'concluida' ? `Tentativa ${t.numero}: ${n1(t.resultado!.total)} pontos · ${t.resultado!.aprovada ? 'aprovada' : 'não aprovada'}` : `Tentativa ${t.numero}: interrompida (não pode ser entregue)`
    const corpo =
      c.regraEntrega === 'escolha'
        ? h(
            'fieldset',
            {},
            h('legend', {}, 'Escolha a tentativa que será entregue'),
            oficiais.map((t) => {
              const idr = `ent-${t.id}`
              const e = h('input', { type: 'radio', name: 'entrega', id: idr, disabled: t.status !== 'concluida', checked: t.id === escolha })
              e.addEventListener('change', () => (escolha = t.id))
              return h('div', { class: 'opcao' }, e, h('label', { for: idr }, descrever(t)))
            }),
          )
        : h('div', {}, h('ul', {}, oficiais.map((t) => h('li', { class: t === previsto ? 'destaque' : '' }, descrever(t), t === previsto ? ' ← será entregue' : ''))), previsto ? null : h('p', {}, 'Nenhuma tentativa concluída: a entrega ficará sem solda válida (nota zero).'))
    const confirmarEntrega = async () => {
      if (!(await confirmar('Confirmar a entrega final?', `Regra: ${rotuloRegra(b)}. Depois de confirmar, não dá para mudar.`, { sim: 'Entregar' }))) return
      const nova = executarAcao(app, () => entregar(app.baseDoTorneio(id), vez.participanteId, c.regraEntrega === 'escolha' ? escolha : undefined, app.ambiente))
      if (nova) passagem(app, id)
    }
    anexar(app.raiz, 
      titulo('Entrega final', `${nomeDe(b, vez.participanteId)} · regra: ${rotuloRegra(b)}`),
      corpo,
      h(
        'div',
        { class: 'acoes' },
        tentativasRestantes(b, vez.participanteId, vez.rodada) > 0 ? h('button', { type: 'button', on: { click: () => preparacaoVez(app, id) } }, 'Voltar e fazer outra tentativa') : null,
        h('button', { type: 'button', class: 'primario', disabled: c.regraEntrega === 'escolha' && !escolha, on: { click: confirmarEntrega } }, 'Confirmar entrega'),
      ),
    )
  }, 'Torneio · entrega')
}

/** Passagem de turno: nenhum dado da tentativa anterior aparece aqui. */
function passagem(app: App, id: string): void {
  app.ir((app) => {
    const b = app.baseDoTorneio(id)
    const vez = vezAtual(b)
    const ultimaRodadaCompleta = b.torneio.config.rodadas.map((_, i) => i).filter((i) => rodadaCompleta(b, i)).pop()
    const acabouRodada = ultimaRodadaCompleta !== undefined && (!vez || vez.rodada > ultimaRodadaCompleta) && b.entregas.filter((e) => e.rodada === ultimaRodadaCompleta).length === b.torneio.participanteIds.length
    anexar(app.raiz, 
      h(
        'section',
        { class: 'passagem' },
        h('h2', { class: 'tela-titulo', tabindex: '-1' }, 'Entrega registrada'),
        h('p', {}, 'Os dados da tentativa ficam guardados e não aparecem nesta tela.'),
        vez
          ? h('div', {}, h('p', { class: 'rodada' }, `RODADA ${vez.rodada + 1} · PRÓXIMO`), h('p', { class: 'vez-nome' }, `Passe para ${nomeDe(b, vez.participanteId)}`))
          : h('p', { class: 'vez-nome' }, 'Todas as entregas do torneio foram feitas.'),
        h(
          'div',
          { class: 'acoes' },
          acabouRodada && b.torneio.config.modo === 'automatico' ? h('button', { type: 'button', on: { click: () => resultadoRodada(app, id, ultimaRodadaCompleta!) } }, `Resultado da rodada ${ultimaRodadaCompleta! + 1}`) : null,
          acabouRodada && b.torneio.config.modo === 'professor' ? h('button', { type: 'button', on: { click: () => telaJulgamento(app, id, ultimaRodadaCompleta!) } }, `Julgamento da rodada ${ultimaRodadaCompleta! + 1} (professor)`) : null,
          h('button', { type: 'button', on: { click: () => painelTorneio(app, id) } }, 'Painel do torneio'),
          vez ? h('button', { type: 'button', class: 'primario grande', on: { click: () => telaVez(app, id) } }, `${nomeDe(b, vez.participanteId)}: começar`) : null,
        ),
      ),
    )
  }, 'Torneio · passagem de turno')
}

// ---------------------------------------------------------------- resultados

export function resultadoRodada(app: App, id: string, rodada: number): void {
  app.ir((app) => {
    const b = app.baseDoTorneio(id)
    const grupos = classificacaoRodada(b, rodada)
    const r = b.torneio.config.rodadas[rodada]
    if (!grupos) {
      anexar(app.raiz, titulo(`Rodada ${rodada + 1}`), h('p', {}, 'Resultados ainda não publicados.'))
      return
    }
    const detalhes = b.torneio.ordemPorRodada[rodada].map((pid) => {
      const e = b.entregas.find((x) => x.participanteId === pid && x.rodada === rodada)!
      const t = e.tentativaId ? b.tentativas.find((x) => x.id === e.tentativaId) : undefined
      const a = b.avaliacoes.find((x) => x.entregaId === e.id)
      return h(
        'details',
        { class: 'detalhe-entrega' },
        h('summary', {}, `${nomeDe(b, pid)} — ${t ? `tentativa ${t.numero} (${NOME_DISPOSITIVO[t.dispositivo]})` : 'sem solda válida'}`),
        a?.final ? h('div', { class: 'avaliacao-professor' }, h('p', {}, h('strong', {}, `Nota final do professor: ${n1(a.final.nota)} / 10. `), a.final.justificativa), a.revisoes.length ? h('ul', {}, a.revisoes.map((rv) => h('li', {}, `${dataHora(rv.data)} — ${rotuloCampo(rv.campo)}: ${rv.anterior} → ${rv.novo}. Motivo: ${rv.motivo}${rv.aposPublicacao ? ' (após a publicação)' : ''}`))) : null) : null,
        t?.resultado ? montarPontuacao(t.resultado, { rotulo: b.torneio.config.modo === 'professor' ? 'AUTOMÁTICA (REFERÊNCIA)' : 'PONTUAÇÃO AUTOMÁTICA' }) : h('p', {}, 'Todas as tentativas foram interrompidas.'),
      )
    })
    anexar(app.raiz, 
      titulo(`Resultado da rodada ${rodada + 1}`, `${descreverRodada(r)} · ${NOME_DIFICULDADE[r.dificuldade]}`),
      tabelaClassificacao(b, grupos, `Rodada ${rodada + 1}`),
      h('h3', {}, 'Detalhes por participante'),
      detalhes,
      h('div', { class: 'acoes' }, h('button', { type: 'button', class: 'primario', on: { click: () => painelTorneio(app, id) } }, 'Painel do torneio')),
    )
  }, 'Torneio · resultado da rodada')
}
