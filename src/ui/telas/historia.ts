import { roteiroDaMissao } from '../../missoes/aprendizagem'
import { progressoDoPerfil } from '../../dados/participantes'
import { registrarExecucao } from '../../dados/arcade'
import type { EventosCompactos } from '../../dados/eventos'
import { buscarPerfilArcade, chaveProgresso, missaoLiberada } from '../../dados/participantes'
import { chaveRanking, criarRecorde, ehNovoRecorde, normalizarNome, posicaoNoRanking, ranking, NOME_MAXIMO, type Recorde } from '../../dados/recordes'
import { NOME_DISPOSITIVO } from '../../entrada/tipos'
import { DIFICULDADES, MISSOES, NOME_DIFICULDADE, PLANEJADAS, requisitosEfetivos, type Dificuldade, type Missao } from '../../missoes/catalogo'
import { MATERIAIS } from '../../modelo/material'
import { pontuarRegistro } from '../../pontuacao/oficial'
import { CATEGORIAS, EXIGENCIA, NOME_CATEGORIA, VERSAO_PONTUACAO, type ResultadoPontuacao } from '../../pontuacao/regras'
import type { App } from '../app'
import { montarInspecao } from '../componentes/inspecao'
import { montarPontuacao } from '../componentes/pontuacao'
import { confirmar, abrirPainel } from '../dialogo'
import { contarAte, dataHora, h, n0, n1, titulo, anexar } from '../dom'
import { telaExecucao } from './execucao'
import { montarPreparacao, type ConfiguracaoTentativa } from './missao'
import { etapas, ETAPAS_MISSAO } from '../componentes/etapas'
import { icone } from '../componentes/icones'
import { telaMenu } from './menu'
import { telaRecordes } from './recordes'

/*
 * Modo História: capítulos (missões) com níveis Aprendiz e Profissional.
 * nome → capítulo → ficha → bancada → tentativas → entrega → pontuação
 * detalhada → registro no ranking local. Aprovar libera o próximo.
 */

interface TentativaArcade {
  numero: number
  config: ConfiguracaoTentativa
  eventos: EventosCompactos | null
  resultado: ResultadoPontuacao | null
}

interface Sessao {
  nome: string
  missao: Missao
  dificuldade: Dificuldade
  tentativas: TentativaArcade[]
  ultimaConfig?: ConfiguracaoTentativa
}

const CONTEXTO = 'História'

export function telaHistoria(app: App): void {
  passoNome(app)
}

function passoNome(app: App): void {
  app.ir((app) => {
    const campo = h('input', { id: 'historia-nome', type: 'text', maxlength: String(NOME_MAXIMO), value: app.preferencias.ultimoNome, autocomplete: 'nickname', placeholder: 'ex.: Vic' })
    const erro = h('p', { class: 'erro', role: 'alert' })
    const seguir = (e?: Event) => {
      e?.preventDefault()
      const nome = normalizarNome(campo.value)
      if (!nome) {
        erro.textContent = 'Escreva um nome ou apelido (até 24 caracteres).'
        campo.focus()
        return
      }
      app.preferencias.ultimoNome = nome
      app.salvar('preferencias')
      passoMissoes(app, nome)
    }
    anexar(
      app.raiz,
      h(
        'div',
        { class: 'tela-centro' },
        h(
          'form',
          { class: 'cartao cartao-destaque form-nome', on: { submit: seguir } },
          icone('historia', 'icone grande'),
          h('h2', { class: 'tela-titulo', tabindex: '-1' }, 'HISTÓRIA'),
          h('p', {}, 'Sua jornada na oficina. Conclua encomendas para abrir novos capítulos e desafios profissionais.'),
          h('label', { for: 'historia-nome' }, 'Seu nome ou apelido'),
          campo,
          erro,
          h('p', { class: 'dica' }, 'O nome vai junto com a pontuação no ranking deste navegador.'),
          h('button', { type: 'submit', class: 'primario grande largura-total' }, 'ESCOLHER CAPÍTULO'),
        ),
      ),
    )
  }, CONTEXTO)
}

function melhorDe(app: App, m: Missao, d: Dificuldade): Recorde | undefined {
  const dispositivo = app.preferencias.dispositivo
  return ranking(app.recordes, chaveRanking({ missaoId: m.id, missaoVersao: m.versao, dificuldade: d, dispositivo, versaoPontuacao: VERSAO_PONTUACAO }))[0]
}

function passoMissoes(app: App, nome: string): void {
  app.ir((app) => {
    const perfil = buscarPerfilArcade(app.perfis, nome)
    const progresso = progressoDoPerfil(perfil)
    const proxima = MISSOES.find(m => m.id === progresso.proximaId)
    const capitulos = MISSOES.map((m, i) => {
      // H90: a História é só no Difícil.
      const niveis = DIFICULDADES.filter((d) => d === 'profissional').map((d) => {
        const lib = missaoLiberada(perfil, m.id, d)
        const melhor = melhorDe(app, m, d)
        const aprovada = !!perfil?.aprovadas?.includes(chaveProgresso(m.id, d))
        return h(
          'button',
          {
            type: 'button',
            class: `nivel ${aprovada ? 'aprovado' : ''}`,
            disabled: !lib.liberada,
            title: lib.liberada ? '' : lib.motivo,
            on: { click: () => passoPreparacao(app, { nome, missao: m, dificuldade: d, tentativas: [] }) },
          },
          icone(lib.liberada ? (aprovada ? 'estrela' : 'continuar') : 'cadeado'),
          h('span', { class: 'nivel-nome' }, NOME_DIFICULDADE[d]),
          h('span', { class: 'nivel-info' }, lib.liberada ? (melhor ? `recorde ${n0(melhor.total)}` : aprovada ? 'aprovado' : 'jogar') : 'bloqueado'),
        )
      })
      const liberado = missaoLiberada(perfil, m.id, 'profissional')
      return h(
        'li',
        { class: `capitulo material-${m.material} ${liberado.liberada ? '' : 'trancado'}` },
        h('span', { class: 'capitulo-num' }, `Capítulo ${i + 1}`),
        h('h3', {}, m.titulo),
        h('p', { class: 'capitulo-material' }, `${MATERIAIS[m.material].nome} · ${n1(m.geometria.espessuraMm)} mm · ${m.setor}`),
        h('p', {}, roteiroDaMissao(m).habilidade),
        h('button', { type: 'button', class: 'botao-fantasma', on: { click: () => { const r = roteiroDaMissao(m); abrirPainel('Roteiro de aprendizado', h('section', {}, h('h3', {}, r.habilidade), h('ol', {}, [r.preparar,r.executar,r.inspecionar].map(t => h('li', {}, t))), h('p', {}, 'Experimento: ', r.experimento))) } } }, 'Ver roteiro'),
        liberado.liberada ? null : h('p', { class: 'dica' }, icone('cadeado'), ' ', liberado.motivo),
        h('div', { class: 'niveis' }, niveis),
      )
    })
    // Em preparação: uma linha só (o motivo aparece ao passar o mouse), para a tela não rolar.
    const planejadas = h(
      'p',
      { class: 'dica em-preparacao' },
      h('strong', {}, 'Em preparação: '),
      PLANEJADAS.map((p, i) => h('span', { title: `${p.contexto} ${p.motivo}` }, `${i ? ' · ' : ''}${p.titulo}`)),
    )
    anexar(
      app.raiz,
      titulo(`Capítulos de ${nome}`, `Recordes mostrados para: ${NOME_DISPOSITIVO[app.preferencias.dispositivo]}. Eletrodo revestido e TIG ainda não estão disponíveis.`),
      h('div', { class: 'acoes' }, h('span', {}, `Aprovadas no Difícil (40 % em cada categoria): ${progresso.profissional}/${progresso.total}`), proxima ? h('button', { type: 'button', class: 'primario', on: { click: () => passoPreparacao(app, { nome, missao: proxima, dificuldade: progresso.dificuldade, tentativas: [] }) } }, `Continuar: ${proxima.titulo} · ${NOME_DIFICULDADE[progresso.dificuldade]}`) : h('span', {}, 'Todos os capítulos concluídos. Você pode repetir para aprimorar.')),
      h('ol', { class: 'trilha-capitulos' }, capitulos),
      planejadas,
      h('div', { class: 'acoes' }, h('button', { type: 'button', class: 'botao-fantasma', on: { click: () => passoNome(app) } }, 'Trocar nome')),
    )
  }, CONTEXTO)
}

function restantes(s: Sessao): number {
  return requisitosEfetivos(s.missao, s.dificuldade).tentativas - s.tentativas.length
}

function passoPreparacao(app: App, s: Sessao): void {
  app.ir((app) => {
    const r = restantes(s)
    const total = requisitosEfetivos(s.missao, s.dificuldade).tentativas
    const prep = montarPreparacao(app, {
      missao: s.missao,
      dificuldade: s.dificuldade,
      oficial: r > 0 ? `Soldar: tentativa ${s.tentativas.length + 1} de ${total}` : null,
      treino: true,
      inicial: s.ultimaConfig,
      aoIniciar: (config, oficial) => executar(app, s, config, oficial),
    })
    anexar(
      app.raiz,
      etapas(ETAPAS_MISSAO, 0),
      titulo('Bancada', `${s.missao.titulo} · ${NOME_DIFICULDADE[s.dificuldade]} · tentativas restantes: ${r}`),
      prep.elemento,
      s.tentativas.some((t) => t.resultado) ? h('div', { class: 'acoes' }, h('button', { type: 'button', class: 'botao-secundario', on: { click: () => passoEntrega(app, s) } }, 'Entregar uma tentativa já feita')) : null,
    )
    return prep.destruir
  }, `${CONTEXTO} · ${s.missao.titulo}`)
}

function executar(app: App, s: Sessao, config: ConfiguracaoTentativa, oficial: boolean): void {
  s.ultimaConfig = config
  const numero = s.tentativas.length + 1
  app.ir(
    telaExecucao({
      missao: s.missao,
      dificuldade: s.dificuldade,
      contexto: config.contexto,
      ajustes: config.ajustes,
      dispositivo: config.dispositivo,
      preferencias: app.preferencias,
      oficial,
      rotulo: oficial ? `Tentativa ${numero} de ${requisitosEfetivos(s.missao, s.dificuldade).tentativas} · ${s.nome}` : 'Treino livre da missão',
      aoConcluir: ({ eventos }) => {
        const { resultado } = pontuarRegistro(s.missao, s.dificuldade, config.contexto, eventos, undefined, EXIGENCIA.desafio)
        const t: TentativaArcade = { numero, config, eventos, resultado }
        // Treino não é registrado (não consome tentativa, não pode ser entregue).
        s.tentativas = registrarExecucao({ limite: requisitosEfetivos(s.missao, s.dificuldade).tentativas, tentativas: s.tentativas }, t, oficial).tentativas
        passoResultado(app, s, t, oficial)
      },
      aoSair: () => {
        // Oficial abandonada conta no limite; treino abandonado não deixa rastro.
        s.tentativas = registrarExecucao({ limite: requisitosEfetivos(s.missao, s.dificuldade).tentativas, tentativas: s.tentativas }, { numero, config, eventos: null, resultado: null }, oficial).tentativas
        passoPreparacao(app, s)
      },
    }),
    `${CONTEXTO} · ${oficial ? 'tentativa oficial' : 'treino'}`,
  )
}

function passoResultado(app: App, s: Sessao, t: TentativaArcade, oficial: boolean): void {
  app.ir((app) => {
    const inspecao = montarInspecao({ missao: s.missao, dificuldade: s.dificuldade, contexto: t.config.contexto, eventos: t.eventos!, ajustes: t.config.ajustes, preparo: t.config.preparo, dispositivo: t.config.dispositivo })
    // Tela travada: tudo cabe na janela; textos longos abrem em sobreposição.
    app.raiz.classList.add('tela-resultado')
    const r = restantes(s)
    const acoes = oficial
      ? h(
          'div',
          { class: 'acoes' },
          r > 0 ? h('button', { type: 'button', on: { click: () => passoPreparacao(app, s) } }, `Nova tentativa (restam ${r})`) : null,
          h('button', { type: 'button', on: { click: () => passoEntrega(app, s) } }, 'Escolher qual entregar'),
          h('button', { type: 'button', class: 'primario', on: { click: () => entregar(app, s, t) } }, 'Entregar esta solda'),
        )
      : h('div', { class: 'acoes' }, h('button', { type: 'button', class: 'primario', on: { click: () => passoPreparacao(app, s) } }, 'Voltar à preparação'))
    anexar(app.raiz, 
      etapas(ETAPAS_MISSAO, 2),
      titulo(oficial ? `Tentativa ${t.numero} concluída` : 'Treino concluído', oficial ? `Restam ${r} tentativa(s). Você pode entregar agora.` : 'Treino: não entra no ranking.'),
      h('div', { class: 'grade-resultado' }, montarPontuacao(t.resultado!, { animar: true, rotulo: oficial ? 'PONTUAÇÃO DA TENTATIVA' : 'TREINO — NÃO CONTA' }), inspecao.elemento),
      acoes,
    )
    return inspecao.destruir
  }, `${CONTEXTO} · resultado`)
}

function passoEntrega(app: App, s: Sessao): void {
  app.ir((app) => {
    const feitas = s.tentativas.filter((t) => t.resultado)
    let escolhida = feitas.reduce<TentativaArcade | null>((a, b) => (!a || b.resultado!.total > a.resultado!.total ? b : a), null)
    const lista = h(
      'fieldset',
      {},
      h('legend', {}, 'Qual tentativa você entrega?'),
      feitas.map((t) => {
        const id = `entrega-${t.numero}`
        const entrada = h('input', { type: 'radio', name: 'entrega', id, checked: t === escolhida })
        entrada.addEventListener('change', () => (escolhida = t))
        return h('div', { class: 'opcao' }, entrada, h('label', { for: id }, `Tentativa ${t.numero}: ${n1(t.resultado!.total)} pontos · ${t.resultado!.aprovada ? 'aprovada' : 'não aprovada'}`))
      }),
      s.tentativas.some((t) => !t.resultado) ? h('p', { class: 'nota' }, 'Tentativas abandonadas não podem ser entregues.') : null,
    )
    anexar(app.raiz, 
      etapas(ETAPAS_MISSAO, 3),
      titulo('Entrega', `${restantes(s)} tentativa(s) ainda disponível(is)`),
      lista,
      h(
        'div',
        { class: 'acoes' },
        restantes(s) > 0 ? h('button', { type: 'button', on: { click: () => passoPreparacao(app, s) } }, 'Fazer outra tentativa') : null,
        h('button', { type: 'button', class: 'primario', disabled: !escolhida, on: { click: () => escolhida && entregar(app, s, escolhida) } }, 'Confirmar entrega'),
      ),
    )
  }, `${CONTEXTO} · entrega`)
}

async function entregar(app: App, s: Sessao, t: TentativaArcade): Promise<void> {
  if (!(await confirmar('Entregar esta solda?', `Tentativa ${t.numero}, ${n1(t.resultado!.total)} pontos. Depois da entrega, esta missão termina.`, { sim: 'Entregar' }))) return
  passoPontuacaoFinal(app, s, t)
}

function passoPontuacaoFinal(app: App, s: Sessao, t: TentativaArcade): void {
  app.ir((app) => {
    const r = t.resultado!
    const numero = h('span', { class: 'placar-numero gigante' }, '0,0')
    contarAte(numero, r.total, 1, 1600)
    const campo = h('input', { id: 'recorde-nome', type: 'text', maxlength: String(NOME_MAXIMO), value: s.nome })
    const erro = h('p', { class: 'erro', role: 'alert' })
    const registrar = (e: Event) => {
      e.preventDefault()
      const nome = normalizarNome(campo.value)
      if (!nome) {
        erro.textContent = 'Informe um nome ou apelido.'
        return
      }
      const recorde = criarRecorde(
        {
          total: r.total,
          aprovada: r.aprovada,
          categorias: Object.fromEntries(r.categorias.map((c) => [c.id, c.pontos])) as Recorde['categorias'],
          missaoId: s.missao.id,
          missaoVersao: s.missao.versao,
          missaoTitulo: s.missao.titulo,
          dificuldade: s.dificuldade,
          processo: 'MIG/MAG',
          material: s.missao.material,
          dispositivo: t.config.dispositivo,
          versaoPontuacao: r.versao,
        },
        nome,
        new Date(),
      )
      app.recordes = [...app.recordes, recorde]
      app.salvar('recordes')
      // H90 (v1.9): ser aprovado (pelo menos 40 % em cada categoria) libera a próxima missão.
      if (r.aprovada) {
        let perfil = buscarPerfilArcade(app.perfis, nome)
        if (!perfil) {
          perfil = { id: app.ambiente.novoId('par'), nome, criadoEm: new Date().toISOString(), origem: 'arcade', aprovadas: [] }
          app.perfis = [...app.perfis, perfil]
        }
        perfil.aprovadas = [...new Set([...(perfil.aprovadas ?? []), chaveProgresso(s.missao.id, s.dificuldade)])]
        app.salvar('participantes')
      }
      app.preferencias.ultimoNome = nome
      app.salvar('preferencias')
      passoRanking(app, recorde, s)
    }
    anexar(app.raiz, 
      titulo('Pontuação final', `${s.missao.titulo} · ${NOME_DIFICULDADE[s.dificuldade]} · ${NOME_DISPOSITIVO[t.config.dispositivo]}`),
      h(
        'div',
        { class: 'placar-final' },
        numero,
        h('p', { class: r.aprovada ? 'selo selo-ok' : 'selo selo-falha' }, r.aprovada ? '✔ APROVADA' : '✖ NÃO APROVADA'),
        h('ul', { class: 'categorias-final' }, CATEGORIAS.map((c) => {
          const cat = r.categorias.find((x) => x.id === c)!
          const n = h('strong', {}, '0,0')
          contarAte(n, cat.pontos, 1, 1400)
          return h('li', {}, h('span', {}, NOME_CATEGORIA[c]), n, h('small', {}, ` / ${cat.maximo}`))
        })),
      ),
      h(
        'form',
        { class: 'cartao-form', on: { submit: registrar } },
        h('label', { for: 'recorde-nome' }, 'Confirme ou edite o nome que vai para o ranking'),
        campo,
        erro,
        h('p', { class: 'nota' }, 'Os recordes ficam guardados só neste navegador e podem ser perdidos se os dados do site forem apagados.'),
        h('div', { class: 'acoes' }, h('button', { type: 'button', on: { click: () => telaMenu(app) } }, 'Sair sem registrar'), h('button', { type: 'submit', class: 'primario' }, 'Registrar no ranking')),
      ),
      h('details', {}, h('summary', {}, 'Ver a pontuação detalhada'), montarPontuacao(r)),
    )
  }, `${CONTEXTO} · pontuação`)
}

function passoRanking(app: App, recorde: Recorde, s: Sessao): void {
  app.ir((app) => {
    const lista = ranking(app.recordes, chaveRanking(recorde)).slice(0, 10)
    const posicao = posicaoNoRanking(app.recordes, recorde)
    const novo = ehNovoRecorde(app.recordes, recorde)
    anexar(app.raiz, 
      titulo(novo ? 'NOVO RECORDE!' : `${posicao}º lugar`, `${recorde.missaoTitulo} · ${NOME_DIFICULDADE[recorde.dificuldade]} · ${NOME_DISPOSITIVO[recorde.dispositivo]}`),
      novo ? h('p', { class: 'faixa-recorde', role: 'status' }, `★ ${recorde.nome} lidera este ranking com ${n1(recorde.total)} pontos ★`) : null,
      h(
        'table',
        { class: 'tabela ranking' },
        h('caption', {}, 'Melhores pontuações deste desafio'),
        h('thead', {}, h('tr', {}, ['Pos.', 'Nome', 'Pontos', 'Situação', 'Data'].map((c) => h('th', { scope: 'col' }, c)))),
        h(
          'tbody',
          {},
          lista.map((r, i) =>
            h(
              'tr',
              { class: r.id === recorde.id ? 'destaque' : '' },
              h('td', {}, i < 3 ? `${i + 1}º ★` : `${i + 1}º`),
              h('td', {}, r.nome, r.id === recorde.id ? h('span', { class: 'sr-only' }, ' (este registro)') : null),
              h('td', { class: 'num' }, n1(r.total)),
              h('td', {}, r.aprovada ? 'aprovada' : 'não aprovada'),
              h('td', {}, dataHora(r.data)),
            ),
          ),
        ),
      ),
      posicao > 10 ? h('p', {}, `Seu registro ficou em ${posicao}º lugar.`) : null,
      h(
        'div',
        { class: 'acoes' },
        h('button', { type: 'button', on: { click: () => telaRecordes(app) } }, 'Ver todos os recordes'),
        h('button', { type: 'button', on: { click: () => passoMissoes(app, s.nome) } }, 'Outra missão'),
        h('button', { type: 'button', class: 'primario', on: { click: () => passoPreparacao(app, { nome: s.nome, missao: s.missao, dificuldade: s.dificuldade, tentativas: [] }) } }, 'Jogar de novo'),
      ),
    )
  }, `${CONTEXTO} · ranking`)
}
