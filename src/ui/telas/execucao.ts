import { GRAUS_POR_PIXEL, Gestos } from '../../entrada/gestos'
import { compactar, type EventosCompactos } from '../../dados/eventos'
import { seloMaterial } from '../componentes/material'
import type { Preferencias } from '../../dados/preferencias'
import { FonteControle } from '../../entrada/controle'
import type { FonteEntrada } from '../../entrada/fonte'
import { FontePonteiro } from '../../entrada/ponteiro'
import { NOME_DISPOSITIVO, type Dispositivo } from '../../entrada/tipos'
import { requisitosEfetivos, type Dificuldade, type Missao } from '../../missoes/catalogo'
import { MATERIAIS } from '../../modelo/material'
import { EQUILIBRIO, PECA } from '../../modelo/parametros'
import { dbcpDe, equilibrioArco, INFO_TECNICA, modoTransferencia, textoTensao, razaoEfetiva, taxaDeposicao, tecnicaDe, type Ajustes, type ContextoProcesso } from '../../modelo/processo'
import { semArco, Simulacao } from '../../modelo/simulacao'
import { desenharCena } from '../../render/cena'
import { Escamas, Particulas } from '../../render/efeitos'
import { geometriaDa } from '../../modelo/junta'
import { Vista } from '../../render/vista'
import { montarGiro } from '../componentes/giro'
import { areaParaLargura, INFO_JUNTA, juntaDe } from '../../modelo/juntas'
import { montarVisual3D } from '../componentes/visual3d'
import { somArco } from '../som'
import type { App, Tela } from '../app'
import { confirmar } from '../dialogo'
import { h, n1 } from '../dom'

/*
 * Execução de uma tentativa (oficial ou treino), com qualquer dispositivo.
 * A tela só liga a fonte de entrada à simulação e desenha; a pontuação é
 * feita depois, a partir do registro salvo (pontuação oficial = replay).
 */

export interface OpcoesExecucao {
  missao: Missao
  dificuldade: Dificuldade
  contexto: ContextoProcesso
  ajustes: Ajustes
  dispositivo: Dispositivo
  preferencias: Preferencias
  oficial: boolean
  /** Ex.: "Tentativa oficial 2 de 3". */
  rotulo: string
  /** Regra de entrega em vigor (torneios). */
  regra?: string
  aoConcluir: (r: { eventos: EventosCompactos; sim: Simulacao }) => void
  /** Saída sem concluir (oficial: a tentativa fica interrompida). */
  aoEscolherPeca?: () => void
  aoSair: () => void
}

const TEXTO_ARCO = {
  equilibrado: 'arco equilibrado',
  curto: 'arco curto demais: tensão baixa para esta alimentação (cordão irregular)',
  longo: 'arco longo demais: tensão alta para esta alimentação (cordão irregular)',
} as const

/** H100: com tensão baixa demais o gatilho não abre arco; entre 10 e 14 V o arame bate. */
function textoArcoAberto(sim: Simulacao): string {
  const modo = modoTransferencia(sim.ajustes, sim.contexto)
  if (modo === 'sem-arco') return `Sem arco: com ${textoTensao(sim.ajustes.tensao)} o arame só sai e bate na chapa. Solte o gatilho e suba a tensão.`
  if (modo === 'arame-batendo') return 'Arco aberto · arame batendo: tensão baixa demais, o arame mergulha na poça aos trancos e não funde as bordas'
  return `Arco aberto · ${TEXTO_ARCO[equilibrioArco(sim.ajustes, sim.contexto).condicao]}`
}

const INSTRUCOES: Record<Dispositivo, string> = {
  mouse: 'Segure o botão esquerdo para abrir o arco e mova ao longo da junta.',
  caneta: 'Encoste a caneta na mesa para abrir o arco e deslize ao longo da junta.',
  controle: 'Analógico esquerdo move a tocha; gatilho configurado abre o arco; botão de precisão deixa o movimento mais lento.',
}

export function telaExecucao(op: OpcoesExecucao): Tela {
  return (app: App) => {
    app.raiz.classList.add('app-cheia')
    app.escolherOutraPeca = op.aoEscolherPeca ?? null
    const req = requisitosEfetivos(op.missao, op.dificuldade)
    const sim = new Simulacao(op.contexto)
    sim.definirAjustes(op.ajustes)
    const vista = new Vista()
    vista.geometria = geometriaDa('reta')
    const escamas = new Escamas()
    const particulas = new Particulas()
    const giro = montarGiro({ inicial: op.contexto.posicaoInicial, fixa: op.contexto.posicaoFixa, familia: INFO_JUNTA[juntaDe(op.contexto)].familia, tubo: !!op.contexto.tubo })

    const canvas = h('canvas', { class: 'tela-solda', 'aria-label': `Vista de cima das chapas. ${INSTRUCOES[op.dispositivo]}` })
    const area = h('div', { class: 'area-peca' }, canvas)
    const sobreposicao = h('div', { class: 'pausa', hidden: true, role: 'alertdialog', 'aria-live': 'assertive' })
    const sobreGiro = h('div', { class: 'giro-sobre', title: 'Posicionar a peça e a câmera só com o arco fechado: arraste com o botão direito (peça) ou o do meio (câmera), ou segure E/B (peça) ou Espaço (câmera) movendo a caneta; mude em Controles. No controle: direcional (peça) e analógico direito (câmera).' }, giro.elemento)
    area.append(sobreGiro, sobreposicao)

    // Visual 3D (só desenho): o canvas 2D fica por cima, transparente, recebendo o ponteiro.
    const visual = montarVisual3D({
      serralheria: op.oficial && op.missao.id === 'suporte-carbono',
      oficinaTreino: !op.oficial,
      app,
      area,
      canvas,
      vista,
      peca: () => ({ contexto: op.contexto, geometria: vista.geometria, oficinaTreino: !op.oficial, serralheria: op.oficial && op.missao.id === 'suporte-carbono', missao: { inicioMm: op.missao.trecho.inicioMm, fimMm: op.missao.trecho.fimMm, alinhamentoMm: req.alinhamentoMm } }),
      aoMudarMapa: () => reamostrarPonteiro(),
      quando: 'nesta tentativa',
    })
    // Câmera junto do giro: um só painel no canto, nada por cima da peça.
    sobreGiro.append(visual.elemento)

    const vAvanco = h('span', { class: 'valor-grande' }, '0,0')
    const marcador = h('div', { class: 'marcador' })
    const faixa = h('div', { class: 'faixa' })
    const aquecimento = h('div', { class: 'preenchimento' })
    const largura = h('dd', {}, '—')
    const tempo = h('dd', {}, '0,0 s')
    const status = h('p', { class: 'status', role: 'status' })
    const botaoEncerrar = h('button', { type: 'button', class: 'primario', disabled: true }, 'Encerrar tentativa ', h('kbd', {}, 'Enter'))
    const botaoPausa = h('button', { type: 'button', class: 'navegacao-de-partida' }, 'Pausar ', h('kbd', {}, 'P'))
    const botaoSair = h('button', { type: 'button', class: 'secundario navegacao-de-partida' }, op.oficial ? 'Abandonar tentativa' : 'Sair do treino')

    // v1.8 (H87): a solda certa pede metade da velocidade; a escala também caiu à metade (era 40).
    const ESCALA_V = 20
    const painel = h(
      'aside',
      { class: 'painel' },
      h('p', { class: op.oficial ? 'etiqueta etiqueta-oficial' : 'etiqueta etiqueta-treino' }, op.oficial ? 'OFICIAL' : 'TREINO — não conta'),
      h('p', { class: 'rotulo-tentativa' }, op.rotulo),
      h('p', {}, seloMaterial(op.contexto.material, op.contexto.espessuraMm)),
      op.regra ? h('p', { class: 'regra-vigor' }, h('strong', {}, 'Regra de entrega: '), op.regra) : null,
      status,
      h(
        'section',
        { class: 'bloco', title: 'Faixa verde: velocidade que daria a largura do desenho com estes ajustes (pelo modelo).' },
        h('h2', {}, 'Velocidade de avanço'),
        h('p', { class: 'valor' }, vAvanco, h('small', {}, ' mm/s')),
        h('div', { class: 'barra', 'aria-hidden': 'true' }, faixa, marcador),
        h('div', { class: 'escala' }, h('span', {}, '0'), h('span', {}, '10'), h('span', {}, '20 mm/s')),
        h('p', { class: 'nota' }, 'Faixa verde: velocidade que daria a largura do desenho com estes ajustes (pelo modelo).'),
      ),
      h(
        'section',
        { class: 'bloco', title: 'Calor acumulado da peça (relativo, sintético).' },
        h('h2', {}, 'Aquecimento da peça'),
        h('div', { class: 'barra barra-calor', role: 'meter', 'aria-label': 'Aquecimento acumulado relativo' }, aquecimento),
        h('p', { class: 'nota' }, `${MATERIAIS[op.contexto.material].ficha.calor} (Relativo, sintético.)`),
      ),
      h(
        'section',
        { class: 'bloco' },
        h(
          'dl',
          { class: 'medidas' },
          h('dt', {}, 'Largura sob a tocha'),
          largura,
          h('dt', {}, 'Tempo de arco'),
          tempo,
          // H38 + H48: o que a tocha faz nesta tentativa (fixo; escolhido na bancada).
          h('dt', { title: 'Ângulo de avanço da técnica e distância bico de contato–peça (DBCP)' }, 'Tocha'),
          h('dd', {}, `${INFO_TECNICA[tecnicaDe(op.contexto)].nome} ${Math.abs(INFO_TECNICA[tecnicaDe(op.contexto)].anguloAvancoGraus)}° · DBCP ${dbcpDe(op.contexto)} mm`),
        ),
      ),
      h('p', { class: 'nota nota-instrucao' }, INSTRUCOES[op.dispositivo], ' Dispositivo: ', NOME_DISPOSITIVO[op.dispositivo], '.'),
      h('div', { class: 'botoes' }, botaoEncerrar, botaoPausa, botaoSair),
    )
    app.raiz.append(h('section', { class: 'execucao', 'aria-label': 'Execução da solda' }, area, painel))

    const inicio = { x: op.missao.trecho.inicioMm - 8, y: 0 }
    let fonte: FonteEntrada
    if (op.dispositivo === 'controle') {
      const c = new FonteControle(op.preferencias.indiceControle, op.preferencias.controle, inicio)
      c.definirLimites({ xMin: -5, xMax: PECA.comprimentoMm + 5, yMin: -PECA.larguraChapaMm, yMax: PECA.larguraChapaMm })
      fonte = c
    } else {
      fonte = new FontePonteiro(op.dispositivo, canvas, visual.mapa, op.preferencias.caneta)
    }
    function reamostrarPonteiro() {
      if (fonte instanceof FontePonteiro && !pausado) fonte.reamostrar(performance.now())
    }

    let pausado = false
    let motivoPausa = ''
    const pausar = (motivo: string) => {
      if (pausado) return
      // H49: fecha o arco sem contar o tempo da pausa como solda parada.
      sim.pausar(performance.now())
      fonte.desligar()
      pausado = true
      motivoPausa = motivo
      sobreposicao.hidden = false
      atualizarPausa()
    }
    const retomar = () => {
      if (!pausado || !fonte.conectado) return
      if (fonte instanceof FonteControle) fonte.reiniciarRelogio()
      sim.retomar(performance.now())
      fonte.ligar(sim)
      pausado = false
      sobreposicao.hidden = true
      canvas.focus()
    }
    const botaoRetomar = h('button', { type: 'button', class: 'primario', on: { click: retomar } }, 'Continuar')
    const textoPausa = h('p', {})
    sobreposicao.append(h('div', { class: 'pausa-caixa' }, h('h2', {}, 'Pausa'), textoPausa, botaoRetomar))
    const atualizarPausa = () => {
      const conectado = fonte instanceof FonteControle ? !!fonte.leitura() : true
      if (fonte instanceof FonteControle) fonte.conectado = conectado
      textoPausa.textContent = conectado
        ? `${motivoPausa} O arco foi fechado. Continue quando estiver pronto.`
        : `${motivoPausa} Reconecte o controle para continuar.`
      botaoRetomar.disabled = !conectado
    }
    app.controlePausa = { pausar: () => { pausar('Pausa pedida.'); sobreposicao.hidden = true }, retomar }
    fonte.aoDesconectar = () => pausar('O controle foi desconectado.')
    fonte.ligar(sim)

    const encerrar = async () => {
      if (sim.arcoAberto || sim.tempoDeArcoMs <= 0) return
      if (op.oficial && !(await confirmar('Encerrar a tentativa?', 'Ela será pontuada e contará no limite de tentativas.', { sim: 'Encerrar e pontuar' }))) return
      app.guardaSaida = null
      op.aoConcluir({ eventos: compactar(sim.eventos), sim })
    }
    botaoEncerrar.addEventListener('click', encerrar)
    botaoPausa.addEventListener('click', () => app.abrirPausa())
    botaoSair.addEventListener('click', async () => {
      const ok = op.oficial
        ? await confirmar('Abandonar a tentativa oficial?', 'Ela será registrada como interrompida e contará no limite.', { sim: 'Abandonar', perigo: true })
        : true
      if (!ok) return
      app.guardaSaida = null
      op.aoSair()
    })
    app.guardaSaida = async () => {
      if (!op.oficial) return true
      const ok = await confirmar('Sair agora?', 'A tentativa oficial em andamento será registrada como interrompida e contará no limite.', { sim: 'Sair', perigo: true })
      if (ok) op.aoSair()
      return ok
    }

    const teclas = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return
      if (e.key === 'Enter' && !(e.target instanceof HTMLButtonElement)) encerrar()
      else if (e.key === 'p' || e.key === 'P') app.abrirPausa()
    }
    window.addEventListener('keydown', teclas)
    // H49: janela escondida ou sem foco pausa a tentativa (o tempo parado não vira solda).
    const semFoco = () => {
      if (document.hidden || sim.arcoAberto) pausar('A janela do jogo perdeu o foco.')
    }
    document.addEventListener('visibilitychange', semFoco)
    window.addEventListener('blur', semFoco)

    // Câmera livre e giro da peça por gestos (gestos.ts): nunca com o arco aberto nem na pausa.
    const gestos = new Gestos({
      alvo: canvas,
      controles: () => app.preferencias.controles,
      pode: () => !sim.arcoAberto && !pausado,
      mover: (g, dx, dy) => (g === 'peca' ? giro.aplicar(dx * GRAUS_POR_PIXEL, dy * GRAUS_POR_PIXEL) : visual.orbitar(dx, dy)),
      aproximar: (d) => visual.aproximar(d),
      aoTerminar: () => reamostrarPonteiro(),
    })

    const redimensionar = () => {
      const { width, height } = area.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
      canvas.getContext('2d')!.setTransform(dpr, 0, 0, dpr, 0, 0)
      vista.ajustar(width, height)
      visual.ajustarTamanho(width, height)
    }
    const observador = new ResizeObserver(redimensionar)
    observador.observe(area)
    redimensionar()

    // Faixa de velocidade que daria a largura do desenho (só referência visual).
    const area0 = (w: number) => areaParaLargura(juntaDe(op.contexto), op.contexto, w, razaoEfetiva(op.ajustes, op.contexto))
    const q = taxaDeposicao(op.ajustes, op.contexto)
    const vMin = q / area0(req.larguraMaxMm)
    const vMax = q / area0(req.larguraMinMm)
    const pctV = (v: number) => Math.min(100, Math.max(0, (v / ESCALA_V) * 100))
    faixa.style.left = `${pctV(vMin)}%`
    faixa.style.width = `${pctV(vMax) - pctV(vMin)}%`

    // Começa no visual escolhido nas Configurações (ou na última partida).
    visual.iniciar()

    let pedido = 0
    const quadro = () => {
      const agora = performance.now()
      if (pausado) {
        atualizarPausa()
      } else {
        fonte.atualizar(agora)
        giro.limitar((g, r) => visual.permitePosicao(g, r))
    giro.atualizar(agora, vista, fonte, sim.arcoAberto)
        // H47: a posição da peça entra no modelo (gravada ao abrir o arco).
        sim.definirPosicao(giro.posicao)
        sim.avancarTempo(agora)
      }
      const instanteProcesso = sim.instanteDeProcesso(agora)
      const estado = sim.estado(agora)
      const posicao = fonte.posicao
      escamas.atualizar(sim.registro)
      const ctx = canvas.getContext('2d')!
      if (visual.ativo) {
        // O canvas 2D fica transparente: só recebe o ponteiro.
        ctx.clearRect(0, 0, vista.larguraCss, vista.alturaCss)
        const p = posicao ?? estado.posicao
        const desvio = equilibrioArco(estado.ajustes, op.contexto).desvio
        visual.desenhar({ cordao: sim.cordao, registro: sim.registro, eventos: sim.eventos, posicao: p, arcoAberto: estado.arcoAberto && !semArco(sim), sobreAPeca: estado.sobreAPeca, desvio, agoraMs: instanteProcesso, aquecimento: estado.aquecimento, percurso: sim.percurso, rolagemGraus: giro.posicao.rolagemGraus, ponteiroDentro: posicao !== null && !pausado, angulo: vista.angulo })
        // Som do arco (H45) com a mesma regra de cena.ts.
        if (!pausado) somArco.atualizar(!!(p && estado.arcoAberto && !semArco(sim) && estado.sobreAPeca), desvio, EQUILIBRIO.tolerancia)
      } else desenharCena(ctx, vista, {
        cordao: sim.cordao,
        estado: { ...estado, posicao: posicao ?? estado.posicao },
        escamas,
        agoraMs: instanteProcesso,
        ponteiroDentro: posicao !== null && !pausado,
        contexto: op.contexto,
        percurso: sim.percurso,
        missao: { inicioMm: op.missao.trecho.inicioMm, fimMm: op.missao.trecho.fimMm, alinhamentoMm: req.alinhamentoMm },
        particulas,
        som: pausado ? undefined : somArco,
      })
      const v = estado.velocidades.avancoMms
      vAvanco.textContent = n1(v)
      marcador.style.left = `${pctV(v)}%`
      aquecimento.style.width = `${Math.min(100, (estado.aquecimento / 1.2) * 100)}%`
      if (estado.posicao) {
        const s = sim.cordao.secao(sim.cordao.indiceEm(estado.posicao.x))
        largura.textContent = s.larguraMm > 0.3 ? `${n1(s.larguraMm)} mm` : '—'
      }
      tempo.textContent = `${n1(sim.tempoDeArcoMs / 1000)} s`
      status.textContent = sim.arcoAberto ? textoArcoAberto(sim) : sim.tempoDeArcoMs > 0 ? 'Arco fechado — continue ou encerre a tentativa.' : 'Pronto: abra o arco perto da marca de INÍCIO.'
      botaoEncerrar.disabled = sim.arcoAberto || sim.tempoDeArcoMs <= 0 || pausado
      pedido = requestAnimationFrame(quadro)
    }
    pedido = requestAnimationFrame(quadro)

    return () => {
      cancelAnimationFrame(pedido)
      observador.disconnect()
      fonte.desligar()
      window.removeEventListener('keydown', teclas)
      document.removeEventListener('visibilitychange', semFoco)
      window.removeEventListener('blur', semFoco)
      gestos.destruir()
      giro.destruir()
      somArco.calar()
      visual.destruir()
    }
  }
}
