import { descompactar, type EventosCompactos } from '../../dados/eventos'
import { NOME_DISPOSITIVO, type Dispositivo } from '../../entrada/tipos'
import { requisitosEfetivos, type Dificuldade, type Missao, type Preparo } from '../../missoes/catalogo'
import { avaliar } from '../../modelo/avaliacao'
import { analisarFusao, type PontoFusao } from '../../modelo/fusao'
import { analisarDefeitos, CONSELHO_DEFEITO, NOME_DEFEITO, type AnaliseDefeitos } from '../../modelo/defeitos'
import type { Cordao } from '../../modelo/cordao'
import { GASES, MATERIAIS } from '../../modelo/material'
import { analisarMovimento } from '../../modelo/movimento'
import { correnteA, modoTransferencia, NOME_TRANSFERENCIA, textoAlimentacao, textoTensao, type Ajustes, type ContextoProcesso, INFO_TECNICA, tecnicaDe } from '../../modelo/processo'
import { reproduzir } from '../../modelo/replay'
import { Simulacao, type EventoTentativa } from '../../modelo/simulacao'
import { desenharCena } from '../../render/cena'
import { criarCena3D, EXAGERO_MAX, EXAGERO_MIN, EXAGERO_PADRAO, webglDisponivel, type Cena3D } from '../../render/cena3d'
import { desenharCorteSintetico } from '../../render/corte'
import { Escamas } from '../../render/efeitos'
import { desenharVelocidades } from '../../render/graficos'
import { COR_ESTADO, desenharPerfilMissao, SIGLA_ESTADO, xMmNoPerfilMissao } from '../../render/graficosMissao'
import { geometriaDa } from '../../modelo/junta'
import { gravidade, INFO_JUNTA, juntaDe, NOME_POSICAO, posicaoDe, SIGLAS_POSICAO } from '../../modelo/juntas'
import { Vista } from '../../render/vista'
import { DESCRICAO_ESTADO, type EstadoFusao } from '../../modelo/fusao'
import { h, n1 } from '../dom'

/*
 * Inspeção de uma tentativa a partir do REGISTRO salvo: replay animado,
 * percurso da tocha, perfil de largura com a previsão de fusão, corte
 * sintético, velocidade por trecho e parâmetros. São os mesmos dados usados
 * pela pontuação automática.
 */

export interface DadosInspecao {
  missao: Missao
  dificuldade: Dificuldade
  contexto: ContextoProcesso
  eventos: EventosCompactos
  ajustes: Ajustes
  preparo: Preparo
  /** Omitido no julgamento do professor. */
  dispositivo?: Dispositivo
}

export function montarInspecao(d: DadosInspecao): { elemento: HTMLElement; destruir: () => void } {
  const eventos = descompactar(d.eventos)
  const final = reproduzir(d.contexto, eventos)
  const req = requisitosEfetivos(d.missao, d.dificuldade)
  const secoes = Array.from({ length: final.cordao.nPosicoes }, (_, i) => final.cordao.secao(i))
  const fusao = analisarFusao(final.cordao, final.percurso, d.contexto)
  const movimento = analisarMovimento(final.percurso, avaliar(final.cordao))
  // Defeitos visíveis previstos (H50–H57): os mesmos do registro, com o empeno da peça fria.
  const defeitos = analisarDefeitos({ cordao: final.cordao, percurso: final.percurso, contexto: d.contexto, registro: final.registro, eventos, fusao })

  // --- Vista de cima com replay.
  const tela = h('canvas', { class: 'inspecao-tela', 'aria-label': 'Vista de cima da peça soldada (replay do registro)' })
  const area = h('div', { class: 'inspecao-area' }, tela)
  const vista = new Vista()
  vista.geometria = geometriaDa('reta')
  let simAtual: Simulacao = final
  let escamas = new Escamas()
  let mostrarPercurso = false
  let pedido = 0
  // Vista 3D (só leitura do modelo): criada na primeira vez que é aberta.
  let modo: '2d' | '3d' = '2d'
  let cena3d: Cena3D | null = null
  // O que a vista 3D mostra de defeitos: refeito quando o cordão muda (replay) ou volta ao final.
  let cordaoMostrado: Cordao | null = null
  let defeitosMostrados: AnaliseDefeitos | null = null
  let tDefeitosReplay = -Infinity

  const desenharTopo = (agora = performance.now()) => {
    const { width, height } = area.getBoundingClientRect()
    if (width === 0) return
    if (modo === '3d' && cena3d) {
      cena3d.ajustarTamanho(width, height)
      // A peça fica na posição em que foi soldada (gravidade preservada); só a câmera gira.
      cena3d.definirPosicao(simAtual.posicao)
      cena3d.atualizarCordao(simAtual.cordao)
      if (simAtual.cordao !== cordaoMostrado) {
        cordaoMostrado = simAtual.cordao
        defeitosMostrados = null
        tDefeitosReplay = -Infinity
      }
      if (simAtual === final) {
        if (defeitosMostrados !== defeitos) cena3d.atualizarDefeitos((defeitosMostrados = defeitos), true)
      } else if (agora - tDefeitosReplay >= 300) {
        // No replay a peça ainda está quente: defeitos sim, empeno não.
        defeitosMostrados = analisarDefeitos({ cordao: simAtual.cordao, percurso: simAtual.percurso, contexto: d.contexto, registro: simAtual.registro, eventos: simAtual.eventos })
        cena3d.atualizarDefeitos(defeitosMostrados, false)
        tDefeitosReplay = agora
      }
      const est = simAtual.estado(agora)
      cena3d.definirTocha(simAtual !== final ? est.posicao : null, est.arcoAberto && est.sobreAPeca)
      return
    }
    const ctx = tela.getContext('2d')!
    const dpr = window.devicePixelRatio || 1
    if (tela.width !== Math.round(width * dpr)) {
      tela.width = Math.round(width * dpr)
      tela.height = Math.round(height * dpr)
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    vista.ajustar(width, height)
    escamas.atualizar(simAtual.registro)
    desenharCena(ctx, vista, {
      cordao: simAtual.cordao,
      estado: { ...simAtual.estado(agora), posicao: simAtual.arcoAberto ? simAtual.estado(agora).posicao : null },
      escamas,
      // No estado final não há brilho de metal quente.
      agoraMs: simAtual === final ? Number.MAX_SAFE_INTEGER : agora,
      ponteiroDentro: simAtual !== final,
      contexto: d.contexto,
      percurso: simAtual.percurso,
      missao: { inicioMm: d.missao.trecho.inicioMm, fimMm: d.missao.trecho.fimMm, alinhamentoMm: req.alinhamentoMm },
    })
    if (mostrarPercurso) {
      ctx.save()
      ctx.strokeStyle = 'rgba(0, 230, 255, 0.85)'
      ctx.lineWidth = 1.2
      ctx.beginPath()
      let aberto = false
      for (const e of eventos) {
        if (e.tipo === 'ajustes' || e.tipo === 'posicao') continue
        const q = vista.ponto(e.x, e.y)
        if (e.tipo === 'inicio') {
          ctx.moveTo(q.x, q.y)
          aberto = true
        } else if (aberto) ctx.lineTo(q.x, q.y)
        if (e.tipo === 'fim') aberto = false
      }
      ctx.stroke()
      ctx.restore()
    }
  }

  const botaoReplay = h('button', { type: 'button' }, '▶ Reproduzir')
  const velocidade = h('select', { 'aria-label': 'Velocidade do replay' }, ['1', '2', '4'].map((v) => h('option', { value: v }, `${v}×`)))
  const caixaPercurso = h('input', { type: 'checkbox', id: `percurso-${Math.random().toString(36).slice(2)}` })
  const rotuloPercurso = h('label', { for: caixaPercurso.id }, caixaPercurso, ' mostrar percurso da tocha')
  caixaPercurso.addEventListener('change', () => {
    mostrarPercurso = caixaPercurso.checked
    desenharTopo()
  })

  // --- Peça em 3D (o jogo é só 3D). Sem WebGL, fica a vista de cima 2D de reserva.
  const temWebgl = webglDisponivel()
  // Começa na escala real; o exagero vertical (até 6×) é opcional, para ver detalhes da forma.
  const exageroInicial = EXAGERO_PADRAO
  const exagero = h('input', { type: 'range', min: String(EXAGERO_MIN), max: String(EXAGERO_MAX), step: '0.5', value: String(exageroInicial), id: `exagero-${Math.random().toString(36).slice(2)}` })
  const rotuloExagero = h('span', {})
  const textoExagero = () => `${Number(exagero.value).toLocaleString('pt-BR')}×`
  rotuloExagero.textContent = textoExagero()
  const avisoExagero = h('span', {}, textoExagero())
  const controles3d = h(
    'div',
    { class: 'linha-controles', hidden: true },
    h('button', { type: 'button', title: 'Câmera de frente para a face da junta (por baixo, se a peça foi soldada de cabeça para baixo)', on: { click: () => cena3d?.vistaDeCima() } }, 'Olhar a face'),
    h('button', { type: 'button', on: { click: () => cena3d?.vistaInicial() } }, 'Vista inclinada'),
    h('button', { type: 'button', title: 'Avesso da junta: raiz, metal que passou e furos', on: { click: () => cena3d?.vistaAvesso() } }, 'Ver o avesso'),
    h('label', { for: exagero.id }, 'Exagero vertical ', rotuloExagero),
    exagero,
  )
  const dica3d = h(
    'p',
    { class: 'dica', hidden: true },
    'Arraste para girar, roda para aproximar, botão direito para mover. Forma calculada pelo modelo (altura × ',
    avisoExagero,
    '): não é foto.',
  )
  exagero.addEventListener('input', () => {
    rotuloExagero.textContent = avisoExagero.textContent = textoExagero()
    cena3d?.definirExagero(Number(exagero.value))
  })
  const definirModo = (m: '2d' | '3d') => {
    if (m === '3d' && !cena3d) {
      cena3d = criarCena3D({ contexto: d.contexto, geometria: vista.geometria, missao: d.missao.trecho })
      if (!cena3d) {
        m = '2d'
      } else {
        cena3d.definirExagero(Number(exagero.value))
        area.append(cena3d.elemento)
      }
    }
    modo = m
    area.classList.toggle('inspecao-area-3d', m === '3d')
    tela.hidden = m === '3d'
    if (cena3d) cena3d.elemento.hidden = m !== '3d'
    controles3d.hidden = dica3d.hidden = m !== '3d'
    // O percurso da tocha é um traço da vista de cima.
    rotuloPercurso.hidden = m === '3d'
    cena3d?.definirVisivel(m === '3d')
    desenharTopo()
  }

  const parar = () => {
    cancelAnimationFrame(pedido)
    simAtual = final
    escamas = new Escamas()
    botaoReplay.textContent = '▶ Reproduzir'
    desenharTopo()
  }

  botaoReplay.addEventListener('click', () => {
    if (simAtual !== final) return parar()
    const reproducao = new Simulacao(d.contexto)
    const comTempo = eventos.filter((e): e is Extract<EventoTentativa, { t: number }> => 't' in e)
    if (comTempo.length === 0) return
    const t0 = comTempo[0].t
    const tFim = comTempo[comTempo.length - 1].t
    let k = 0
    let tReplay = 0
    let anterior = performance.now()
    simAtual = reproducao
    escamas = new Escamas()
    botaoReplay.textContent = '■ Parar'
    const quadro = (agora: number) => {
      tReplay += (agora - anterior) * Number(velocidade.value)
      anterior = agora
      while (k < eventos.length) {
        const e = eventos[k]
        if ('t' in e && e.t - t0 > tReplay) break
        if (e.tipo === 'ajustes') reproducao.definirAjustes(e.ajustes)
        else if (e.tipo === 'posicao') reproducao.definirPosicao(e)
        else if (e.tipo === 'inicio') reproducao.iniciarArco(e)
        else if (e.tipo === 'mover') reproducao.moverTocha(e)
        else reproducao.encerrarArco(e)
        k++
      }
      reproducao.avancarTempo(t0 + tReplay)
      desenharTopo(t0 + tReplay)
      if (t0 + tReplay > tFim + 300) return parar()
      pedido = requestAnimationFrame(quadro)
    }
    pedido = requestAnimationFrame(quadro)
  })

  // --- Perfil e corte.
  const perfil = h('canvas', { class: 'grafico grafico-perfil-missao', 'aria-label': 'Largura do cordão ao longo da junta e previsão de fusão' })
  const corte = h('canvas', { class: 'grafico grafico-corte' })
  const deslizador = h('input', { type: 'range', min: '0', max: '150', step: '0.5', 'aria-label': 'Posição do corte (mm)' })
  const rotuloCorte = h('span', {})
  const velocidades = h('canvas', { class: 'grafico grafico-velocidade', 'aria-label': 'Velocidade efetiva por trecho de 5 mm' })
  let xCorte = (d.missao.trecho.inicioMm + d.missao.trecho.fimMm) / 2
  let xHover: number | null = null

  const desenharGraficos = () => {
    desenharPerfilMissao(perfil, secoes, fusao, req, d.missao.trecho, xCorte, xHover)
    const i = Math.min(secoes.length - 1, Math.floor(xCorte / 0.5))
    desenharCorteSintetico(corte, secoes[i], fusao[i] as PontoFusao, d.contexto, { a: defeitos, i })
    rotuloCorte.textContent = `x = ${n1(xCorte)} mm`
    deslizador.value = String(xCorte)
    if (movimento) desenharVelocidades(velocidades, movimento, null, xCorte, null)
  }
  const xDoEvento = (e: MouseEvent) => {
    const r = perfil.getBoundingClientRect()
    return xMmNoPerfilMissao(e.clientX - r.left, r.width)
  }
  perfil.addEventListener('pointermove', (e) => {
    xHover = xDoEvento(e)
    desenharGraficos()
  })
  perfil.addEventListener('pointerleave', () => {
    xHover = null
    desenharGraficos()
  })
  perfil.addEventListener('click', (e) => {
    xCorte = xDoEvento(e)
    desenharGraficos()
  })
  deslizador.addEventListener('input', () => {
    xCorte = Number(deslizador.value)
    desenharGraficos()
  })

  const legenda = h(
    'ul',
    { class: 'legenda-estados' },
    (Object.keys(COR_ESTADO) as EstadoFusao[]).map((k) =>
      h('li', {}, h('span', { class: 'amostra', style: `background:${COR_ESTADO[k]}` }), `${SIGLA_ESTADO[k]} — ${DESCRICAO_ESTADO[k]}`),
    ),
  )

  const m = MATERIAIS[d.contexto.material]
  const parametros = h(
    'dl',
    { class: 'medidas parametros' },
    [
      ['Material', `${m.nome}, ${n1(d.contexto.espessuraMm)} mm`],
      ['Processo', `${GASES[d.contexto.gas].processo} (${d.missao.processo})`],
      ['Gás', GASES[d.contexto.gas].nome],
      ['Arame', `${n1(d.contexto.diametroArameMm)} mm`],
      ['Polaridade', 'CC+ (fixa)'],
      ['Tensão / alimentação', `${textoTensao(d.ajustes.tensao)} / ${textoAlimentacao(d.ajustes.alimentacao)}`],
      ['Transferência', NOME_TRANSFERENCIA[modoTransferencia(d.ajustes, d.contexto)]],
      ['Corrente estimada', `≈ ${n1(correnteA(d.ajustes, d.contexto)).replace(/,\d$/, '')} A`],
      ['Técnica', INFO_TECNICA[tecnicaDe(d.contexto)].nome],
      ['Junta', INFO_JUNTA[juntaDe(d.contexto)].nome],
      ['Posição no último passe', (() => {
        const pos = posicaoDe(gravidade(final.posicao))
        return `${NOME_POSICAO[pos]} (${SIGLAS_POSICAO[INFO_JUNTA[juntaDe(d.contexto)].familia][pos]})${d.contexto.posicaoFixa ? ', peça fixa' : ''}`
      })()],
      [m.limpeza?.rotulo ?? 'Óxido removido', m.exigeLimpeza ? (d.contexto.oxidoRemovido ? 'sim' : 'não') : 'não se aplica'],
      ['Tempo de arco', `${n1(final.tempoDeArcoMs / 1000)} s`],
      ['Aberturas de arco', String(eventos.filter((e) => e.tipo === 'inicio').length)],
      ...(d.dispositivo ? [['Dispositivo', NOME_DISPOSITIVO[d.dispositivo]]] : []),
    ].flatMap(([a, b]) => [h('dt', {}, a), h('dd', {}, b)]),
  )

  // Lista de defeitos visíveis (H50–H57), com causa típica e correção.
  const n1mm = (v: number) => `${n1(v)} mm`
  const listaDefeitos = h(
    'div',
    { class: 'defeitos-previstos' },
    defeitos.ocorrencias.length
      ? h(
          'ul',
          { class: 'lista-defeitos' },
          defeitos.ocorrencias.map((o) =>
            h(
              'li',
              {},
              h('strong', {}, NOME_DEFEITO[o.tipo]),
              ` · de ${n1mm(o.inicioMm)} a ${n1mm(o.fimMm)} · ${o.unidade === 'mm' ? `${n1(o.valor)} mm (limite do jogo ${n1(o.limiar)} mm)` : o.unidade === 'por 10 mm' ? `${n1(o.valor)} por 10 mm` : o.unidade === 'mm no avesso' ? `${n1(o.valor)} mm de metal no avesso (limite do jogo ${n1(o.limiar)} mm)` : o.unidade === 'mm de largura' ? `buraco de até ${n1(o.valor)} mm` : `índice ${n1(o.valor)}`}`,
              h('br', {}),
              h('span', { class: 'dica' }, CONSELHO_DEFEITO[o.tipo]),
            ),
          ),
        )
      : h('p', {}, 'Nenhum defeito visível previsto.'),
    h('p', { class: 'dica' }, `Empeno previsto das chapas: ${n1(defeitos.empenoGraus)}° (aparece na peça 3D). Previsão do modelo didático, com limiares do jogo: não é inspeção visual real.`),
  )

  // Abas: a peça fica sempre à vista; os gráficos ficam em abas para não virar um rolo.
  const paineis: [string, HTMLElement][] = [
    ['Largura', h('div', {}, perfil, legenda, h('p', { class: 'dica' }, 'Faixa verde: largura pedida no desenho. Marcas amarelas: início e fim do trecho exigido. Clique no gráfico para escolher o corte.'))],
    ['Corte', h('div', {}, h('p', { class: 'dica' }, 'Corte transversal sintético em ', rotuloCorte), deslizador, corte)],
    [`Defeitos${defeitos.ocorrencias.length ? ` (${defeitos.ocorrencias.length})` : ''}`, listaDefeitos],
    ...(movimento ? ([['Velocidade', h('div', {}, velocidades, h('p', { class: 'dica' }, 'Velocidade efetiva em cada trecho de 5 mm (tempo de arco que a tocha passou ali).'))]] as [string, HTMLElement][]) : []),
    ['Parâmetros', parametros],
  ]
  const idAbas = Math.random().toString(36).slice(2, 8)
  const lista = h('div', { class: 'abas', role: 'tablist', 'aria-label': 'Evidências da solda' })
  const corpos = paineis.map(([, conteudo], i) => h('div', { class: 'aba-corpo', role: 'tabpanel', id: `aba-${idAbas}-${i}`, 'aria-labelledby': `aba-b-${idAbas}-${i}`, hidden: i !== 0 }, conteudo))
  const botoes = paineis.map(([nome], i) =>
    h('button', { type: 'button', role: 'tab', id: `aba-b-${idAbas}-${i}`, 'aria-controls': `aba-${idAbas}-${i}`, 'aria-selected': String(i === 0), tabindex: i === 0 ? '0' : '-1' }, nome),
  )
  const escolherAba = (k: number) => {
    botoes.forEach((b, i) => {
      b.setAttribute('aria-selected', String(i === k))
      b.tabIndex = i === k ? 0 : -1
      corpos[i].hidden = i !== k
    })
    botoes[k].focus()
    requestAnimationFrame(desenharGraficos)
  }
  botoes.forEach((b, i) => {
    b.addEventListener('click', () => escolherAba(i))
    b.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') escolherAba((i + 1) % botoes.length)
      if (e.key === 'ArrowLeft') escolherAba((i - 1 + botoes.length) % botoes.length)
    })
  })
  lista.append(...botoes)

  const elemento = h(
    'div',
    { class: 'inspecao' },
    h(
      'section',
      { class: 'inspecao-peca' },
      h('h3', {}, 'Peça soldada (replay do registro)'),
      area,
      h('div', { class: 'linha-controles' }, botaoReplay, velocidade, rotuloPercurso),
      controles3d,
      dica3d,
    ),
    lista,
    corpos,
  )

  const observador = new ResizeObserver(() => {
    desenharTopo()
    desenharGraficos()
  })
  observador.observe(area)
  observador.observe(perfil)
  requestAnimationFrame(() => {
    if (temWebgl) definirModo('3d')
    desenharTopo()
    desenharGraficos()
  })

  return {
    elemento,
    destruir: () => {
      cancelAnimationFrame(pedido)
      observador.disconnect()
      cena3d?.destruir()
      cena3d = null
    },
  }
}
