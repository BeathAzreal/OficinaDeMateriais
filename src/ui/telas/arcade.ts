import { etapaArcade } from '../../arcade/desafios'
import { detectorSenha, TEXTO_SEGREDO } from '../../arcade/segredo'
import { seloMaterial } from '../componentes/material'
import {
  avaliarDesafio,
  descreverCondicao,
  gerarDesafio,
  missaoDoDesafio,
  multiplicador,
  VERSAO_ARCADE,
  VIDAS_INICIAIS,
  type Desafio,
  type ResultadoDesafio,
} from '../../arcade/desafios'
import { descompactar } from '../../dados/eventos'
import { NOME_MAXIMO, normalizarNome } from '../../dados/recordes'
import { chaveRankingArcade, criarRecordeArcade, rankingArcade, type DesafioRegistrado, type RecordeArcade } from '../../dados/recordesArcade'
import { NOME_DISPOSITIVO, type Dispositivo } from '../../entrada/tipos'
import { NOME_DIFICULDADE, descreverJunta } from '../../missoes/catalogo'
import { tecnicaDe } from '../../modelo/processo'
import { pontuarRegistro } from '../../pontuacao/oficial'
import { EXIGENCIA, VERSAO_PONTUACAO, type ResultadoPontuacao } from '../../pontuacao/regras'
import type { App } from '../app'
import { icone } from '../componentes/icones'
import { montarPontuacao } from '../componentes/pontuacao'
import { anexar, contarAte, dataHora, h, n0, n1, titulo } from '../dom'
import { telaExecucao } from './execucao'
import { telaMenu } from './menu'
import { montarPreparacao, type ConfiguracaoTentativa } from './missao'

/*
 * Arcade: desafios aleatórios em sequência. Três vidas; cada desafio tem uma
 * tentativa; acertar seguidas aumenta o combo. A peça de teste da bancada é
 * livre. A partida não é salva no meio (só o recorde no fim).
 */

interface Partida {
  nome: string
  dispositivo: Dispositivo | null
  vidas: number
  pontos: number
  combo: number
  desafio: Desafio
  historico: (DesafioRegistrado & { pontos: number; motivo: string })[]
  ultimaConfig?: ConfiguracaoTentativa
}

const CONTEXTO = 'Arcade'

function aleatorio(app: App): () => number {
  return app.ambiente.aleatorio
}

function placarTopo(p: Partida): HTMLElement {
  return h(
    'div',
    { class: 'placar-arcade', role: 'status' },
    h('span', { class: 'placar-item' }, h('small', {}, 'PONTOS'), h('strong', {}, n0(p.pontos))),
    h('span', { class: 'placar-item' }, h('small', {}, 'DESAFIO'), h('strong', {}, String(p.desafio.numero))),
    h('span', { class: 'placar-item' }, h('small', {}, 'COMBO'), h('strong', {}, `×${multiplicador(p.combo).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}`)),
    h(
      'span',
      { class: 'placar-item vidas', 'aria-label': `${p.vidas} vida(s)` },
      h('small', {}, 'VIDAS'),
      h('span', { class: 'coracoes' }, Array.from({ length: VIDAS_INICIAIS }, (_, i) => icone('coracao', i < p.vidas ? 'icone cheio' : 'icone vazio'))),
    ),
  )
}

export function telaArcade(app: App): void {
  app.ir((app) => {
    const campo = h('input', { id: 'arcade-nome', type: 'text', maxlength: String(NOME_MAXIMO), value: app.preferencias.ultimoNome, autocomplete: 'nickname', placeholder: 'ex.: Vic' })
    const erro = h('p', { class: 'erro', role: 'alert' })
    const lista = rankingArcade(app.recordesArcade, chaveRankingArcade({ dispositivo: app.preferencias.dispositivo, versaoArcade: VERSAO_ARCADE, versaoPontuacao: VERSAO_PONTUACAO })).slice(0, 5)
    const comecar = (e: Event) => {
      e.preventDefault()
      const nome = normalizarNome(campo.value)
      if (!nome) {
        erro.textContent = 'Escreva um nome ou apelido.'
        return
      }
      app.preferencias.ultimoNome = nome
      app.salvar('preferencias')
      const p: Partida = { nome, dispositivo: null, vidas: VIDAS_INICIAIS, pontos: 0, combo: 0, desafio: gerarDesafio(1, aleatorio(app)), historico: [] }
      apresentarDesafio(app, p)
    }
    anexar(
      app.raiz,
      h(
        'div',
        { class: 'arcade-abertura' },
        h(
          'form',
          { class: 'cartao cartao-destaque form-nome', on: { submit: comecar } },
          icone('arcade', 'icone grande'),
          h('h2', { class: 'tela-titulo titulo-arcade', tabindex: '-1' }, 'DESAFIOS'),
          h('p', { class: 'piscar' }, 'TRÊS VIDAS. ATÉ ONDE VOCÊ CHEGA?'),
          h(
            'ul',
            { class: 'regras-arcade' },
            h('li', {}, icone('coracao'), ' 3 vidas: cada desafio não concluído custa uma.'),
            h('li', {}, icone('raio'), ' Desafios progressivos: aquecimento, controle, técnica e tempo.'),
            h('li', {}, icone('estrela'), ' Acertos seguidos aumentam o combo (até ×2).'),
            h('li', {}, icone('ajuste'), ' Uma tentativa por desafio; a peça de teste da bancada é livre.'),
          ),
          h('label', { for: 'arcade-nome' }, 'Nome ou apelido'),
          campo,
          erro,
          h('button', { type: 'submit', class: 'primario grande largura-total' }, icone('continuar'), ' Começar partida'),
        ),
        h(
          'section',
          { class: 'cartao' },
          h('h3', {}, `Melhores · ${NOME_DISPOSITIVO[app.preferencias.dispositivo]}`),
          lista.length
            ? h('ol', { class: 'mini-ranking' }, lista.map((r) => h('li', {}, h('span', {}, r.nome), h('strong', {}, n0(r.pontos)))))
            : h('p', { class: 'dica' }, 'Ainda sem recordes neste dispositivo.'),
          h('p', { class: 'dica' }, 'Cada partida sorteia desafios diferentes: o ranking é de diversão, não uma comparação técnica.'),
        ),
      ),
    )
  }, CONTEXTO)
}

function apresentarDesafio(app: App, p: Partida): void {
  app.ir((app) => {
    const m = missaoDoDesafio(p.desafio)
    const c = descreverCondicao(p.desafio.condicao)
    anexar(
      app.raiz,
      placarTopo(p),
      h(
        'section',
        { class: 'cartao-desafio', 'aria-labelledby': 'titulo-desafio' },
        h('p', { class: 'desafio-num' }, `DESAFIO ${p.desafio.numero}`),
        h('p', { class: 'dica' }, etapaArcade(p.desafio.numero)),
        h('h2', { id: 'titulo-desafio', class: 'tela-titulo', tabindex: '-1' }, m.titulo),
        h('p', { class: 'desafio-material' }, seloMaterial(m.material, m.geometria.espessuraMm), ` ${NOME_DIFICULDADE[p.desafio.dificuldade]}`),
        h('p', {}, m.contexto),
        h('p', { class: 'dica' }, descreverJunta(m)),
        h('div', { class: `condicao condicao-${p.desafio.condicao.tipo}` }, h('strong', {}, c.titulo), h('span', {}, c.texto)),
        h('button', { type: 'button', class: 'primario grande', on: { click: () => bancada(app, p) } }, 'Para a bancada'),
      ),
    )
    // Senha escondida nesta tela: abre a fase urgente (não mexe em placar, vidas ou recordes).
    const senha = detectorSenha()
    const teclas = (ev: KeyboardEvent) => {
      if (ev.repeat || ev.target instanceof HTMLInputElement) return
      if (senha(ev.code)) videoSegredo(app, p)
    }
    window.addEventListener('keydown', teclas)
    return () => window.removeEventListener('keydown', teclas)
  }, `${CONTEXTO} · desafio ${p.desafio.numero}`)
}

/** Vídeo da fase escondida: qualquer .mp4/.webm em src/assets/segredo entra embutido no HTML. */
const VIDEO_SEGREDO = Object.values(import.meta.glob<string>('../../assets/segredo/*.{mp4,webm}', { eager: true, query: '?inline', import: 'default' }))[0]

function videoSegredo(app: App, p: Partida): void {
  if (!VIDEO_SEGREDO) {
    desafioUrgente(app, p)
    return
  }
  app.ir((app) => {
    let foi = false
    const seguir = () => {
      if (foi) return
      foi = true
      desafioUrgente(app, p)
    }
    const video = h('video', { class: 'video-segredo', src: VIDEO_SEGREDO, autoplay: '', playsinline: '', controls: '', on: { ended: seguir, error: seguir } }) as HTMLVideoElement
    // Fora da raiz do app: a tela inteira, por cima do topo e do fundo.
    const camada = h('div', { class: 'tela-segredo' }, video, h('button', { type: 'button', class: 'pular-segredo', on: { click: seguir } }, 'Pular ▸'))
    document.body.append(camada)
    video.play().catch(() => {})
    return () => {
      video.pause()
      camada.remove()
    }
  }, `${CONTEXTO} · ???`)
}

function desafioUrgente(app: App, p: Partida): void {
  app.ir((app) => {
    const m = missaoDoDesafio(p.desafio)
    anexar(
      app.raiz,
      h(
        'section',
        { class: 'cartao-desafio cartao-urgente', 'aria-labelledby': 'titulo-urgente' },
        h('p', { class: 'desafio-num piscar' }, `⚠ ${TEXTO_SEGREDO.titulo} ⚠`),
        h('h2', { id: 'titulo-urgente', class: 'tela-titulo', tabindex: '-1' }, m.titulo),
        h('p', { class: 'desafio-material' }, seloMaterial(m.material, m.geometria.espessuraMm), ` ${NOME_DIFICULDADE.profissional}`),
        ...TEXTO_SEGREDO.historia.map((t) => h('p', {}, t)),
        h('p', { class: 'dica' }, descreverJunta(m)),
        h('div', { class: 'condicao condicao-livre' }, h('strong', {}, 'Salve o gato'), h('span', {}, TEXTO_SEGREDO.regra)),
        h(
          'div',
          { class: 'acoes centro' },
          h('button', { type: 'button', class: 'primario grande', on: { click: () => bancadaUrgente(app, p) } }, 'Para a bancada'),
          h('button', { type: 'button', on: { click: () => apresentarDesafio(app, p) } }, 'Voltar ao desafio'),
        ),
      ),
    )
  }, `${CONTEXTO} · desafio urgente`)
}

function bancadaUrgente(app: App, p: Partida): void {
  app.ir((app) => {
    const m = missaoDoDesafio(p.desafio)
    const prep = montarPreparacao(app, {
      missao: m,
      dificuldade: 'profissional',
      oficial: 'Soldar (1 tentativa)',
      treino: false,
      dispositivos: p.dispositivo ? [p.dispositivo] : undefined,
      inicial: p.ultimaConfig,
      destaque: h('div', { class: 'condicao condicao-livre' }, h('strong', {}, TEXTO_SEGREDO.titulo), h('span', {}, TEXTO_SEGREDO.regra)),
      aoIniciar: (config) => soldarUrgente(app, p, config),
    })
    anexar(app.raiz, h('div', { class: 'linha-titulo-arcade' }, titulo('Bancada', `${TEXTO_SEGREDO.titulo} · ${m.titulo}`), placarTopo(p)), prep.elemento)
    return prep.destruir
  }, `${CONTEXTO} · bancada`)
}

function soldarUrgente(app: App, p: Partida, config: ConfiguracaoTentativa): void {
  const m = missaoDoDesafio(p.desafio)
  app.ir(
    telaExecucao({
      missao: m,
      dificuldade: 'profissional',
      contexto: config.contexto,
      ajustes: config.ajustes,
      dispositivo: config.dispositivo,
      preferencias: app.preferencias,
      oficial: true,
      rotulo: TEXTO_SEGREDO.titulo,
      aoConcluir: ({ eventos }) => fimUrgente(app, p, pontuarRegistro(m, 'profissional', config.contexto, eventos, undefined, EXIGENCIA.desafio).resultado),
      aoSair: () => fimUrgente(app, p, null),
    }),
    `${CONTEXTO} · solda`,
  )
}

function fimUrgente(app: App, p: Partida, resultado: ResultadoPontuacao | null): void {
  const salvou = !!resultado?.aprovada
  app.ir((app) => {
    anexar(
      app.raiz,
      h(
        'section',
        { class: `cartao-desafio ${salvou ? 'sucesso' : 'falha'}` },
        h('p', { class: 'desafio-num' }, TEXTO_SEGREDO.titulo),
        h('h2', { class: 'tela-titulo', tabindex: '-1' }, salvou ? 'GATO SALVO!' : 'AINDA NÃO…'),
        h('p', {}, salvou ? TEXTO_SEGREDO.vitoria : TEXTO_SEGREDO.derrota),
        h(
          'div',
          { class: 'acoes centro' },
          salvou ? null : h('button', { type: 'button', on: { click: () => desafioUrgente(app, p) } }, 'Tentar de novo'),
          h('button', { type: 'button', class: 'primario grande', on: { click: () => apresentarDesafio(app, p) } }, icone('continuar'), ` Voltar ao desafio ${p.desafio.numero}`),
        ),
      ),
      resultado ? h('details', { class: 'detalhes-resultado' }, h('summary', {}, 'Ver a pontuação detalhada desta solda'), montarPontuacao(resultado)) : null,
    )
  }, `${CONTEXTO} · desafio urgente`)
}

function bancada(app: App, p: Partida): void {
  app.ir((app) => {
    const m = missaoDoDesafio(p.desafio)
    const cond = p.desafio.condicao
    const travas =
      cond.tipo === 'maquina-ajustada'
        ? { ajustes: cond.ajustes, preparo: cond.preparo }
        : cond.tipo === 'tecnica'
          ? { preparo: { tecnica: cond.tecnica } }
          : undefined
    const c = descreverCondicao(cond)
    const prep = montarPreparacao(app, {
      missao: m,
      dificuldade: p.desafio.dificuldade,
      oficial: 'Soldar (1 tentativa)',
      treino: false,
      // A partida inteira usa o mesmo dispositivo do primeiro desafio.
      dispositivos: p.dispositivo ? [p.dispositivo] : undefined,
      inicial: p.ultimaConfig,
      travas,
      destaque: h('div', { class: `condicao condicao-${cond.tipo}` }, h('strong', {}, `Desafio ${p.desafio.numero}: ${c.titulo}`), h('span', {}, c.texto)),
      aoIniciar: (config) => soldar(app, p, config),
    })
    // Placar e título numa linha só: a bancada inteira cabe na tela.
    anexar(app.raiz, h('div', { class: 'linha-titulo-arcade' }, titulo('Bancada', `${m.titulo} · ${NOME_DIFICULDADE[p.desafio.dificuldade]}`), placarTopo(p)), prep.elemento)
    return prep.destruir
  }, `${CONTEXTO} · bancada`)
}

function soldar(app: App, p: Partida, config: ConfiguracaoTentativa): void {
  p.ultimaConfig = config
  p.dispositivo = config.dispositivo
  const m = missaoDoDesafio(p.desafio)
  app.ir(
    telaExecucao({
      missao: m,
      dificuldade: p.desafio.dificuldade,
      contexto: config.contexto,
      ajustes: config.ajustes,
      dispositivo: config.dispositivo,
      preferencias: app.preferencias,
      oficial: true,
      rotulo: `Desafio ${p.desafio.numero} · ${descreverCondicao(p.desafio.condicao).titulo}`,
      aoConcluir: ({ eventos }) => {
        const { resultado, sim } = pontuarRegistro(m, p.desafio.dificuldade, config.contexto, eventos, undefined, EXIGENCIA.desafio)
        const r = avaliarDesafio(
          p.desafio,
          resultado,
          {
            aberturasDeArco: descompactar(eventos).filter((e) => e.tipo === 'inicio').length,
            tempoArcoS: sim.tempoDeArcoMs / 1000,
            tecnica: tecnicaDe(config.contexto),
            ajustes: config.ajustes,
          },
          p.combo,
        )
        concluir(app, p, resultado, r)
      },
      aoSair: () => concluir(app, p, null, { concluido: false, motivo: 'Tentativa abandonada.', pontos: 0, multiplicador: multiplicador(p.combo) }),
    }),
    `${CONTEXTO} · solda`,
  )
}

function concluir(app: App, p: Partida, resultado: ResultadoPontuacao | null, r: ResultadoDesafio): void {
  const m = missaoDoDesafio(p.desafio)
  p.historico.push({
    missaoId: m.id,
    missaoTitulo: m.titulo,
    dificuldade: p.desafio.dificuldade,
    material: m.material,
    condicao: descreverCondicao(p.desafio.condicao).titulo,
    total: resultado?.total ?? 0,
    concluido: r.concluido,
    pontos: r.pontos,
    motivo: r.motivo,
  })
  p.pontos += r.pontos
  if (r.concluido) p.combo++
  else {
    p.combo = 0
    p.vidas--
  }
  app.ir((app) => {
    const fim = p.vidas <= 0
    const ganho = h('strong', { class: 'ganho' }, '+0')
    if (r.concluido) contarAte(ganho, r.pontos, 0, 900)
    anexar(
      app.raiz,
      placarTopo(p),
      h(
        'section',
        { class: `cartao-desafio ${r.concluido ? 'sucesso' : 'falha'}` },
        h('p', { class: 'desafio-num' }, `DESAFIO ${p.desafio.numero}`),
        h('h2', { class: 'tela-titulo', tabindex: '-1' }, r.concluido ? 'CONCLUÍDO!' : fim ? 'FIM DE JOGO' : 'NÃO CONCLUÍDO'),
        r.concluido ? h('p', { class: 'ganho-linha' }, ganho, h('span', {}, ` pontos (nota ${n1(resultado!.total)} × combo ${r.multiplicador.toLocaleString('pt-BR', { maximumFractionDigits: 2 })})`)) : h('p', { class: 'motivo' }, `${r.motivo} Você perdeu uma vida.`),
        h('div', { class: 'acoes centro' }, fim ? h('button', { type: 'button', class: 'primario grande', on: { click: () => finalPartida(app, p) } }, 'Ver pontuação final') : h('button', { type: 'button', class: 'primario grande', on: { click: () => proximo(app, p) } }, icone('continuar'), ' Próximo desafio')),
      ),
      resultado ? h('details', { class: 'detalhes-resultado' }, h('summary', {}, 'Ver a pontuação detalhada desta solda'), montarPontuacao(resultado)) : null,
    )
  }, `${CONTEXTO} · resultado`)
}

function proximo(app: App, p: Partida): void {
  p.desafio = gerarDesafio(p.desafio.numero + 1, aleatorio(app), p.desafio)
  apresentarDesafio(app, p)
}

function finalPartida(app: App, p: Partida): void {
  app.ir((app) => {
    const numero = h('span', { class: 'placar-numero gigante' }, '0')
    contarAte(numero, p.pontos, 0, 1600)
    const campo = h('input', { id: 'arcade-final-nome', type: 'text', maxlength: String(NOME_MAXIMO), value: p.nome })
    const erro = h('p', { class: 'erro', role: 'alert' })
    const concluidos = p.historico.filter((x) => x.concluido).length
    const registrar = (e: Event) => {
      e.preventDefault()
      const nome = normalizarNome(campo.value)
      if (!nome) {
        erro.textContent = 'Informe um nome ou apelido.'
        return
      }
      const rec = criarRecordeArcade(
        {
          pontos: p.pontos,
          desafiosConcluidos: concluidos,
          desafios: p.historico.map(({ pontos: _p, motivo: _m, ...d }) => d),
          processo: 'MIG/MAG',
          dispositivo: p.dispositivo ?? app.preferencias.dispositivo,
          versaoArcade: VERSAO_ARCADE,
          versaoPontuacao: VERSAO_PONTUACAO,
        },
        nome,
        new Date(),
      )
      app.recordesArcade = [...app.recordesArcade, rec]
      app.salvar('recordesArcade')
      app.preferencias.ultimoNome = nome
      app.salvar('preferencias')
      rankingFinal(app, rec)
    }
    anexar(
      app.raiz,
      h(
        'div',
        { class: 'tela-centro' },
        h(
          'section',
          { class: 'cartao cartao-destaque placar-final' },
          h('p', { class: 'desafio-num' }, 'FIM DE JOGO'),
          h('h2', { class: 'tela-titulo', tabindex: '-1' }, 'Pontuação final'),
          numero,
          h('p', {}, `${concluidos} de ${p.historico.length} desafio(s) concluído(s) · ${NOME_DISPOSITIVO[p.dispositivo ?? app.preferencias.dispositivo]}`),
          h('ol', { class: 'lista-desafios' }, p.historico.map((x) => h('li', { class: x.concluido ? 'ok' : 'falha' }, h('span', {}, `${x.concluido ? '✔' : '✖'} ${x.missaoTitulo} · ${x.condicao}`), h('strong', {}, x.concluido ? `+${n0(x.pontos)}` : '—')))),
          h(
            'form',
            { on: { submit: registrar } },
            h('label', { for: 'arcade-final-nome' }, 'Confirme ou edite o nome do recorde'),
            campo,
            erro,
            h('p', { class: 'dica' }, 'Os recordes ficam só neste navegador e somem se os dados do site forem apagados.'),
            h('div', { class: 'acoes' }, h('button', { type: 'button', class: 'botao-fantasma', on: { click: () => telaMenu(app) } }, 'Sair sem registrar'), h('button', { type: 'submit', class: 'primario' }, 'Registrar recorde')),
          ),
        ),
      ),
    )
  }, `${CONTEXTO} · fim`)
}

function rankingFinal(app: App, rec: RecordeArcade): void {
  app.ir((app) => {
    const lista = rankingArcade(app.recordesArcade, chaveRankingArcade(rec))
    const pos = lista.findIndex((r) => r.id === rec.id) + 1
    anexar(
      app.raiz,
      titulo(pos === 1 ? 'NOVO RECORDE!' : `${pos}º lugar`, `Arcade · ${NOME_DISPOSITIVO[rec.dispositivo]}`),
      pos === 1 ? h('p', { class: 'faixa-recorde', role: 'status' }, `★ ${rec.nome} lidera com ${n0(rec.pontos)} pontos ★`) : null,
      h(
        'table',
        { class: 'tabela ranking' },
        h('caption', {}, 'Melhores partidas'),
        h('thead', {}, h('tr', {}, ['Pos.', 'Nome', 'Pontos', 'Desafios', 'Data'].map((c) => h('th', { scope: 'col' }, c)))),
        h('tbody', {}, lista.slice(0, 10).map((r, i) => h('tr', { class: r.id === rec.id ? 'destaque' : '' }, h('td', {}, `${i + 1}º`), h('th', { scope: 'row' }, r.nome), h('td', { class: 'num' }, n0(r.pontos)), h('td', { class: 'num' }, String(r.desafiosConcluidos)), h('td', {}, dataHora(r.data))))),
      ),
      h('div', { class: 'acoes' }, h('button', { type: 'button', class: 'botao-secundario', on: { click: () => telaMenu(app) } }, 'Menu'), h('button', { type: 'button', class: 'primario grande', on: { click: () => telaArcade(app) } }, 'Jogar de novo')),
    )
  }, `${CONTEXTO} · ranking`)
}
