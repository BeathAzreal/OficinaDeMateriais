import { montarGiroTubo } from '../componentes/giroTubo'
import { NOME_DIFICULDADE, type Dificuldade } from '../../missoes/catalogo'
import { comoPecaBase, type PecaTig } from '../../missoes/pecasTig'
import { MATERIAIS } from '../../modelo/material'
import { Cordao } from '../../modelo/cordao'
import { DepositoEletrodo } from '../../modelo/depositoEletrodo'
import { GIRO_INICIAL_TUBO_GRAUS, INFO_JUNTA } from '../../modelo/juntas'
import { ModeloTig, pedalDaPressao, TIG } from '../../modelo/tig'
import { ModeloPlasma, PLASMA, furoQueFechaMm } from '../../modelo/plasma'
import type { PecaPlasma } from '../../missoes/pecasPlasma'
import { analiseVisualPlasma, avaliarPlasma, inspecionarPlasma } from '../../pontuacao/plasma'
import { aprovacaoEletrodo } from '../../pontuacao/eletrodo'
import { alvoTig, analiseVisualTig, avaliarTig, inspecionarTig, trechoTig } from '../../pontuacao/tig'
import { criarBancada15 } from '../../render/bancada15'
import type { App } from '../app'
import { painelMaquina } from '../componentes/painelMaquina'
import { resultadoProcesso, resultadoTig } from '../componentes/resultadoTig'
import { h, n0, n1 } from '../dom'

/** Quadro muito longo (aba travada, depurador) não vira um salto de vários segundos de arco. */
const DT_MAX = 0.25

/**
 * Controles do TIG (H92). O TIG pede duas mãos: a tocha numa e a vareta na outra.
 * - mesa: a caneta é a tocha (posição; a pressão é o pedal; a inclinação da caneta inclina a tocha);
 *   o mouse é a mão da vareta (clique esquerdo mergulha a vareta; a roda sobe e desce a tocha).
 * - mouse: o mouse é a tocha (segurar o botão esquerdo é o pedal); Espaço mergulha a vareta; W/S ou roda: altura.
 */
export type ControleTig = 'mesa' | 'mouse'

const NOME_CONTROLE: Record<ControleTig, string> = { mesa: 'Mesa + mouse (duas mãos)', mouse: 'Só mouse' }
/** Altura da tocha sobre a chapa, ajustada pelo jogador (mm). */
const ALTURA = { min: 0, max: 12, inicial: 3, passoRoda: 0.25, teclaMmS: 4 }

export function telaTreinoTig(app: App, peca: PecaTig, modo: Dificuldade, voltar: () => void): void {
  treinoTocha(app, peca, modo, voltar, null)
}

/**
 * H107: soldagem a plasma na mesma bancada do TIG. Muda a fonte (gás de
 * plasma), o bocal no lugar do tungstênio exposto, o keyhole e a nota.
 */
export function telaTreinoPlasma(app: App, peca: PecaPlasma, modo: Dificuldade, voltar: () => void): void {
  treinoTocha(app, peca, modo, voltar, peca)
}

function treinoTocha(app: App, peca: PecaTig, modo: Dificuldade, voltar: () => void, plasma: PecaPlasma | null): void {
  const criarModelo = (): ModeloTig => plasma ? new ModeloPlasma(peca) : new ModeloTig(peca)
  /** Limites do arco no medidor (o plasma alcança mais longe). */
  const ARCO = plasma
    ? { contato: PLASMA.contatoMm, curto: 2, bom: 7, max: PLASMA.arcoMaxMm }
    : { contato: TIG.contatoMm, curto: TIG.varetaNoTungstenioMm, bom: 4, max: TIG.arcoMaxMm }
  app.ir((app) => {
    app.raiz.classList.add('app-cheia')
    app.escolherOutraPeca = voltar
    const base = comoPecaBase(peca)
    const vista = criarBancada15(base, { tig: true, material: peca.material })
    if (!vista) return app.raiz.append(h('p', {}, 'WebGL indisponível: abra o treino no Chrome ou Edge com aceleração gráfica.'))
    const canvas = vista.canvas
    canvas.style.touchAction = 'none'
    let modelo = criarModelo()
    const mp = () => modelo as ModeloPlasma
    let dep = new DepositoEletrodo(base)
    const novoCordao3D = () => new Cordao(undefined, undefined, undefined, { junta: peca.junta, dimensoes: { espessuraMm: peca.espessuraMm, aberturaMm: 0 } })
    let cordao3D = novoCordao3D()
    let controle: ControleTig = 'mouse'
    let alturaTocha: number = ALTURA.inicial
    let pedalMouse = false, varetaMouse = false
    /** Toque rápido (tecla ou clique) ainda vale um mergulho mínimo, mesmo entre dois quadros. */
    let varetaAte = 0
    /**
     * H102: toque pedido e ainda não visto por um quadro. Em PC lento a tecla
     * pode descer e subir entre dois quadros; o toque fica guardado e, no
     * quadro seguinte, a vareta mergulha pelo menos TOQUE_MINIMO_MS.
     */
    let toquePendente = false
    const TOQUE_MINIMO_MS = 150
    let pausado = false, encerrada = false, foco = true
    let pedido = 0, anterior = performance.now(), analiseMs = 0
    let painelResultado: HTMLElement | null = null
    let gestoCamera = false, ultimaTela = { x: 0, y: 0 }
    let avisoCaneta = ''
    const teclas = new Set<string>()
    const soltar = () => { teclas.clear(); pedalMouse = false; varetaMouse = false; toquePendente = false; modelo.mergulhar = false; modelo.pedal = 0 }

    // HUD sobre a vista.
    const estado = h('strong', { class: 'p15-estado', role: 'status', 'aria-live': 'polite' })
    const faixasEl = h('div', { class: 'p15-medidor-faixas' },
      ...([[ARCO.contato, plasma ? 'bocal encosta' : 'encosta', 'contato'], [ARCO.curto, plasma ? 'perto' : 'curto: a vareta encosta', 'atencao'], [ARCO.bom, 'adequado', 'bom'], [ARCO.max, 'longo', 'atencao']] as const)
        .map(([ate, nome, classe], i, l) => h('span', { class: `p15-faixa p15-faixa-${classe}`, title: nome, style: `width:${((ate - (i ? l[i - 1][0] : 0)) / ARCO.max) * 100}%` })))
    const marcador = h('span', { class: 'p15-medidor-marca' })
    const medidorTexto = h('span', { class: 'p15-medidor-texto' })
    const distanciaHud = h('output', { class: 'p15-numero' })
    const pedalBarra = h('progress', { max: 1, value: 0, 'aria-label': 'Pedal' })
    const pedalTexto = h('output')
    const pocaHud = h('output')
    const avanco = h('output')
    const varetaHud = h('output')
    const hud = h('div', { class: 'p15-hud' }, estado,
      h('div', { class: 'p15-hud-arco' }, h('div', { class: 'p15-hud-linha' }, h('span', { class: 'p15-rotulo' }, 'Comprimento do arco'), distanciaHud),
        h('div', { class: 'p15-medidor', 'aria-hidden': 'true' }, faixasEl, marcador), medidorTexto),
      h('div', { class: 'p15-hud-grade' },
        h('div', { class: 'p15-hud-item p15-consumo' }, h('span', { class: 'p15-rotulo' }, 'Pedal'), pedalTexto, pedalBarra),
        h('div', { class: 'p15-hud-item' }, h('span', { class: 'p15-rotulo' }, plasma?.tecnica === 'keyhole' ? 'Keyhole' : 'Poça'), pocaHud),
        h('div', { class: 'p15-hud-item' }, h('span', { class: 'p15-rotulo' }, 'Avanço'), avanco),
        h('div', { class: 'p15-hud-item' }, h('span', { class: 'p15-rotulo' }, 'Vareta'), varetaHud)))

    // Painel lateral.
    const correnteValor = h('output')
    // H104: chapas que pedem mais corrente (cobre, alumínio) alargam a escala da fonte.
    const corrente = h('input', { type: 'range', min: plasma ? 5 : 20, max: plasma ? 250 : Math.max(200, Math.ceil((peca.correnteA.max * 1.2) / 10) * 10), step: plasma ? 1 : 5, value: Math.round((peca.correnteA.min + peca.correnteA.max) / 10) * 5, 'aria-label': 'Corrente máxima do pedal (A)' }) as HTMLInputElement
    const referencia = h('small', { class: 'p15-dica' })
    const seletorControle = h('select', { 'aria-label': 'Controle da tocha e da vareta' }, (['mouse', 'mesa'] as const).map((c) => h('option', { value: c }, NOME_CONTROLE[c]))) as HTMLSelectElement
    const explicacaoControle = h('p', { class: 'p15-dica' })
    const mudarControle = (c: ControleTig) => {
      soltar()
      controle = c
      seletorControle.value = c
      explicacaoControle.textContent = c === 'mesa'
        ? 'Caneta = tocha: leve a ponta até a peça; a pressão é o pedal (mais força, mais corrente); inclinar a caneta inclina a tocha. Mouse = mão da vareta: clique esquerdo mergulha a vareta na poça; a roda sobe e desce a tocha. Se a caneta não mexer a tocha, ative o Windows Ink no programa da mesa.'
        : 'Mouse = tocha: leve até a peça; segure o botão esquerdo para o pedal (a corrente sobe aos poucos). Espaço mergulha a vareta na poça. W/S ou a roda sobem e descem a tocha.'
    }
    seletorControle.addEventListener('change', () => { mudarControle(seletorControle.value as ControleTig); canvas.focus() })
    const afiar = h('button', { type: 'button', class: 'p15-alerta', on: { click: () => { if (plasma) mp().trocarBocal(); else modelo.afiar(); canvas.focus() } } }, plasma ? 'Trocar bocal' : 'Afiar tungstênio')
    // Plasma: vazão do gás de plasma (o gás do orifício, que forma o jato).
    const gasValor = h('output')
    const gas = h('input', { type: 'range', min: PLASMA.gas.min, max: PLASMA.gas.max, step: 0.1, value: plasma ? (plasma.gasLMin.min + plasma.gasLMin.max) / 2 : PLASMA.gas.inicial, 'aria-label': 'Vazão do gás de plasma (L/min)' }) as HTMLInputElement
    gas.addEventListener('input', () => { if (plasma) mp().gasLMin = Number(gas.value) })
    const gasCampo = plasma ? h('label', {}, h('span', { class: 'p15-linha' }, 'Gás de plasma (argônio)', gasValor), gas,
      h('small', { class: 'p15-dica' }, `Pouco gás: só funde por cima. Gás demais: o jato corta. Sugerido: ${n1(plasma.gasLMin.min)}–${n1(plasma.gasLMin.max)} L/min.`)) : null
    const novaVareta = h('button', { type: 'button', on: { click: () => { modelo.novaVareta(); canvas.focus() } } }, 'Nova vareta')
    const fonte = h('fieldset', { class: 'p15-fonte' }, h('legend', {}, plasma ? 'Fonte plasma (CC, eletrodo negativo, arco piloto)' : 'Fonte TIG (CC, eletrodo negativo)'),
      h('label', {}, h('span', { class: 'p15-linha' }, 'Corrente no pedal cheio', correnteValor), corrente),
      referencia, gasCampo,
      h('label', { class: 'p15-linha' }, 'Controle', seletorControle), explicacaoControle)
    const alturaFaixa = h('input', { type: 'range', min: ALTURA.min, max: ALTURA.max, step: 0.1, value: ALTURA.inicial, 'aria-label': 'Altura da tocha' }) as HTMLInputElement
    alturaFaixa.addEventListener('input', () => { alturaTocha = Number(alturaFaixa.value) })
    const inclinacao = h('input', { type: 'range', min: 0, max: 40, step: 1, value: 15, 'aria-label': 'Inclinação da tocha' }) as HTMLInputElement
    inclinacao.addEventListener('input', () => { modelo.inclinacaoGraus = Number(inclinacao.value) })
    const tocha = h('div', {},
      h('label', {}, h('span', { class: 'p15-linha' }, 'Altura da tocha', h('small', {}, 'roda ou W/S')), alturaFaixa),
      h('label', {}, h('span', { class: 'p15-linha' }, 'Inclinação', h('small', {}, 'caneta ou I/K')), inclinacao),
      h('p', { class: 'p15-dica' }, plasma
        ? 'O tungstênio fica recuado dentro do bocal: não toca a poça. Mantenha o bocal a 3–6 mm; encostado na peça, o arco passa pelo bocal (arco duplo) e o gasta.'
        : 'Tungstênio a 2–3 mm da poça. Quando o cordão crescer, suba um pouco: tungstênio na poça contamina.'),
      h('button', { type: 'button', on: { click: () => { vista.centralizar(); canvas.focus() } } }, 'Centralizar câmera'))
    const alvo = plasma ? { descricao: plasma.tecnica === 'keyhole' ? 'Keyhole do início ao fim: penetração total numa passada, sem furo no fim' : 'Cordão estreito e contínuo, sem furar' } : alvoTig(peca)
    const nomesObjetivo = plasma
      ? ['Fusão no trecho', plasma.tecnica === 'keyhole' ? 'Penetração total' : 'Sem keyhole', 'Bocal sem arco duplo', 'Sem furos']
      : ['Fusão no trecho', 'Toques de vareta', 'Tungstênio limpo', 'Sem furos']
    const itensObjetivo = nomesObjetivo.map((t) => {
      const valor = h('span', { class: 'p15-obj-valor' })
      return { li: h('li', {}, h('span', {}, t), valor), valor }
    })
    const objetivo = h('section', { class: 'p15-objetivo', 'aria-label': 'Objetivo da peça' },
      h('p', {}, peca.objetivo), h('p', {}, `${alvo.descricao}. Trecho: ${peca.inicioMm}–${peca.fimMm} mm.`), h('ul', {}, itensObjetivo.map((i) => i.li)))
    const ajuda = h('p', { class: 'p15-ajuda' })
    app.controlePausa = { pausar: () => { pausado = true; soltar() }, retomar: () => { pausado = false; anterior = performance.now() } }
    const pausar = h('button', { type: 'button', class: 'navegacao-de-partida', on: { click: () => { pausado = !pausado; soltar(); pausar.textContent = pausado ? 'Continuar' : 'Pausar'; anterior = performance.now() } } }, 'Pausar')

    const recomecar = () => {
      soltar()
      encerrada = false
      hud.hidden = false
      painelResultado?.remove(); painelResultado = null
      const painel = app.raiz.querySelector<HTMLElement>('.p15-painel')
      if (painel) painel.hidden = false
      modelo = criarModelo()
      if (plasma) mp().gasLMin = Number(gas.value)
      giroTubo?.reiniciar()
      modelo.correnteA = Number(corrente.value)
      modelo.inclinacaoGraus = Number(inclinacao.value)
      modelo.xMm = peca.inicioMm - 3
      dep = new DepositoEletrodo(base)
      cordao3D = novoCordao3D()
      alturaTocha = ALTURA.inicial
      vista.atualizarDefeitos(null)
      analiseMs = 0
    }
    corrente.addEventListener('input', () => { modelo.correnteA = Number(corrente.value) })
    const encerrar = () => {
      if (encerrada || pausado || modelo.tempoArcoS < 0.1) return
      soltar()
      // O arco apaga com o pedal solto; um passo para registrar o fim.
      modelo.avancar(1 / 60)
      encerrada = true
      hud.hidden = true
      const op = { nova: recomecar, pecas: voltar }
      let resultado: ReturnType<typeof resultadoTig>
      if (plasma) {
        const r = avaliarPlasma(plasma, mp(), modo)
        resultado = resultadoProcesso(r, inspecionarPlasma(plasma, mp()), NOME_DIFICULDADE[modo], aprovacaoEletrodo(r, modo), op, {
          descontos: r.penalidadeFuros ? `Descontos: furos −${r.penalidadeFuros}` : 'Sem descontos adicionais.',
          detalhe: `Modo ${NOME_DIFICULDADE[modo]}. Furos: −${r.penalidadeFuros}. Total limitado a 0–1000.`,
          limites: 'Modelo didático de calor na chapa e do keyhole: não avalia porosidade, mordedura no avesso nem a cor de oxidação do inox. Correntes e vazões são do jogo. Não qualifica soldador nem procedimento.',
        })
      } else {
        const r = avaliarTig(peca, modelo, dep, modo)
        resultado = resultadoTig(r, inspecionarTig(peca, modelo, dep), NOME_DIFICULDADE[modo], aprovacaoEletrodo(r, modo), op)
      }
      const painel = conteudo.querySelector<HTMLElement>('.p15-painel')!
      painel.hidden = true
      painelResultado = resultado.painel
      painel.parentElement!.append(painelResultado)
      resultado.focar()
    }
    const avaliar = h('button', { type: 'button', class: 'primario', disabled: true, on: { click: encerrar } }, 'Encerrar tentativa ↵')
    const instrumentos = painelMaquina([
      ['FONTE', fonte],
      ['TOCHA', tocha],
      ['MISSÃO', h('div', {}, objetivo, ajuda)],
    ])
    const zoomValor = h('output', {}, '100%')
    const area = h('div', { class: 'p15-vista' }, canvas, hud,
      h('div', { class: 'zoom-bancada', role: 'group', 'aria-label': 'Zoom da câmera' }, h('span', { title: 'Teclas + e −' }, 'ZOOM'),
        h('button', { type: 'button', 'aria-label': 'Afastar câmera', on: { click: () => { vista.aproximar(150); canvas.focus() } } }, '−'), zoomValor,
        h('button', { type: 'button', 'aria-label': 'Aproximar câmera', on: { click: () => { vista.aproximar(-150); canvas.focus() } } }, '+')))
    // H103: na emenda de tubos, ⟲ ⟳ giram o tubo com o arco apagado.
    const giroTubo = vista.tubo ? montarGiroTubo(GIRO_INICIAL_TUBO_GRAUS, (r) => vista.girarTubo(r)) : null
    if (giroTubo) area.append(giroTubo.elemento)
    const conteudo = h('section', { class: 'p15' },
      h('header', { class: 'p15-cabecalho' },
        h('div', {},
          h('h2', { class: 'tela-titulo', tabindex: '-1' }, peca.titulo),
          h('p', {}, plasma
            ? `Plasma (${plasma.tecnica === 'keyhole' ? 'keyhole' : 'microplasma'}) · modo ${NOME_DIFICULDADE[modo]} · ${MATERIAIS[peca.material].nomeCurto} · ${INFO_JUNTA[peca.junta].nome} reto · ${n1(peca.espessuraMm)} mm · vareta opcional`
            : `TIG · modo ${NOME_DIFICULDADE[modo]} · ${MATERIAIS[peca.material].nomeCurto} · ${INFO_JUNTA[peca.junta].nome} · ${n1(peca.espessuraMm)} mm · vareta Ø ${n1(peca.varetaMm)} mm`)),
        h('div', { class: 'p15-processos navegacao-de-partida' }, h('button', { type: 'button', on: { click: () => voltar() } }, 'Outras peças'))),
      h('div', { class: 'p15-grade' }, area,
        h('aside', { class: 'p15-painel' },
          h('div', { class: 'maquina-identificacao' }, plasma ? 'PLASMA / CC' : 'TIG / CC', h('span', {}, plasma ? '● ARCO PILOTO' : '● FONTE ENERGIZADA')),
          h('div', { class: 'p15-comandos' }, afiar, novaVareta),
          instrumentos,
          h('div', { class: 'p15-avaliacao' }, avaliar, pausar, h('button', { type: 'button', 'aria-label': 'Recomeçar peça', on: { click: recomecar } }, '↺')))))
    app.raiz.append(conteudo)
    mudarControle('mouse')
    recomecar()

    // Entrada: caneta e mouse chegam como ponteiros diferentes (pointerType), ao mesmo tempo.
    const ouvintes: (() => void)[] = []
    const ouvir = (alvoEv: EventTarget, tipo: string, f: EventListener) => { alvoEv.addEventListener(tipo, f); ouvintes.push(() => alvoEv.removeEventListener(tipo, f)) }
    const moverTocha = (e: PointerEvent) => {
      const p = vista.pontoNaTela(e.clientX, e.clientY)
      if (p) { modelo.xMm = p.x; modelo.yMm = Math.max(-15, Math.min(15, p.y)) }
    }
    const caneta = (e: PointerEvent) => {
      if (controle !== 'mesa') {
        // Primeira caneta vista: passa para o modo de duas mãos.
        mudarControle('mesa')
        avisoCaneta = 'Caneta detectada: controle em Mesa + mouse.'
      }
      moverTocha(e)
      modelo.pedal = e.buttons & 1 ? pedalDaPressao(e.pressure) : 0
      if (e.tiltX || e.tiltY) modelo.inclinacaoGraus = Math.max(0, Math.min(40, Math.hypot(e.tiltX, e.tiltY)))
    }
    ouvir(canvas, 'pointerdown', (ev) => {
      const e = ev as PointerEvent
      if (pausado) return
      e.preventDefault(); canvas.focus()
      ultimaTela = { x: e.clientX, y: e.clientY }
      const capturar = () => { try { canvas.setPointerCapture(e.pointerId) } catch { /* ponteiro já solto */ } }
      if (e.button === 1 || e.button === 2) { gestoCamera = true; capturar(); return }
      if (encerrada) return
      capturar()
      if (e.pointerType === 'pen') caneta(e)
      else if (controle === 'mesa') { varetaMouse = true; toquePendente = true }
      else { moverTocha(e); pedalMouse = true }
    })
    ouvir(canvas, 'pointermove', (ev) => {
      const e = ev as PointerEvent
      if (pausado) return
      if (gestoCamera) {
        if (modelo.estado !== 'arco') vista.orbitar(e.clientX - ultimaTela.x, e.clientY - ultimaTela.y)
        ultimaTela = { x: e.clientX, y: e.clientY }
        return
      }
      if (encerrada) return
      if (e.pointerType === 'pen') caneta(e)
      else if (controle === 'mouse') moverTocha(e)
    })
    const fimPonteiro = (ev: Event) => {
      const e = ev as PointerEvent
      if (gestoCamera && e.pointerType !== 'pen') { gestoCamera = false; return }
      if (e.pointerType === 'pen') modelo.pedal = 0
      else if (controle === 'mesa') varetaMouse = false
      else pedalMouse = false
    }
    ouvir(canvas, 'pointerup', fimPonteiro)
    ouvir(canvas, 'pointercancel', fimPonteiro)
    ouvir(canvas, 'contextmenu', (e) => e.preventDefault())
    ouvir(canvas, 'wheel', (ev) => {
      const e = ev as WheelEvent
      e.preventDefault()
      if (pausado) return
      if (encerrada) { vista.aproximar(e.deltaY); return }
      alturaTocha = Math.max(ALTURA.min, Math.min(ALTURA.max, alturaTocha + Math.sign(e.deltaY) * ALTURA.passoRoda))
    })
    const TECLAS = ['KeyW', 'KeyS', 'KeyI', 'KeyK', 'Space']
    ouvir(window, 'keydown', (ev) => {
      const e = ev as KeyboardEvent
      if ((e.target as HTMLElement)?.matches('input,select,textarea')) return
      if (e.key === 'Enter' && !encerrada) { e.preventDefault(); encerrar(); return }
      if (['+', '-', '='].includes(e.key) || ['NumpadAdd', 'NumpadSubtract'].includes(e.code)) {
        e.preventDefault()
        if (!pausado && modelo.estado !== 'arco') vista.aproximar(e.key === '-' || e.code === 'NumpadSubtract' ? 150 : -150)
        return
      }
      if (!TECLAS.includes(e.code)) return
      e.preventDefault()
      if (!pausado && !encerrada) { if (e.code === 'Space' && !e.repeat) toquePendente = true; teclas.add(e.code) }
    })
    ouvir(window, 'keyup', (ev) => { teclas.delete((ev as KeyboardEvent).code) })
    ouvir(window, 'blur', () => { foco = false; soltar() })
    ouvir(window, 'focus', () => { foco = true })
    ouvir(document, 'visibilitychange', () => { soltar(); anterior = performance.now() })
    const tamanho = new ResizeObserver(() => { const r = area.getBoundingClientRect(); vista.enquadrar(r.width, r.height) })
    tamanho.observe(area)

    let objetivoMs = 0
    const atualizarObjetivo = (agora: number) => {
      if (agora - objetivoMs < 250) return
      objetivoMs = agora
      let n = 0, total = 0
      for (let x = peca.inicioMm + 0.5; x < peca.fimMm; x += 2) { total++; if (trechoTig(peca, modelo, dep, x).fundido) n++ }
      const cob = total ? n / total : 0
      let itens: [boolean, string][]
      if (plasma) {
        const m = mp()
        let pass = 0
        for (let x = peca.inicioMm + 0.5; x < peca.fimMm; x += 2) if (m.passouEm(x)) pass++
        const fp = total ? pass / total : 0
        itens = [
          [cob >= 0.95, `${n0(cob * 100)}%`],
          plasma.tecnica === 'keyhole' ? [fp >= 0.95, `${n0(fp * 100)}%`] : [m.aberturasKeyhole === 0 && m.tempoArcoS > 0, m.aberturasKeyhole ? `furou ${m.aberturasKeyhole}×` : 'ok'],
          [m.arcosDuplos === 0 && m.tempoArcoS > 0, m.bocalGasto ? 'bocal gasto' : `${m.arcosDuplos}×`],
          [m.furos.length === 0 && m.tempoArcoS > 0, `${m.furos.length}`],
        ]
      } else itens = [
        [cob >= 0.95, `${n0(cob * 100)}%`],
        [modelo.toques.length > 0 && modelo.varetaFria === 0, `${modelo.toques.length}${modelo.varetaFria ? ` · ${modelo.varetaFria} na chapa fria` : ''}`],
        [modelo.contaminacoes === 0 && modelo.varetaNoTungstenio === 0 && modelo.tempoArcoS > 0, modelo.contaminado ? 'contaminado' : `${modelo.contaminacoes + modelo.varetaNoTungstenio}×`],
        [modelo.furos.length === 0 && modelo.tempoArcoS > 0, `${modelo.furos.length}`],
      ]
      itens.forEach(([ok, texto], i) => {
        itensObjetivo[i].li.dataset.ok = String(ok)
        if (itensObjetivo[i].valor.textContent !== texto) itensObjetivo[i].valor.textContent = texto
      })
    }
    const mensagens = plasma ? {
      pronto: 'Arco piloto aceso · leve o bocal a 3–6 mm e pise', arco: 'Arco transferido', afastado: 'Bocal longe demais · desça a tocha', desligado: 'Pausado',
    } : {
      pronto: 'Pedal solto · leve o tungstênio a 2–3 mm e pise', arco: 'Arco aberto', afastado: 'Tungstênio longe demais · desça a tocha', desligado: 'Pausado',
    }
    const quadro = (agora: number) => {
      const dt = Math.min(DT_MAX, (agora - anterior) / 1000)
      anterior = agora
      const pode = !encerrada && !pausado && foco && !document.hidden
      giroTubo?.atualizar(dt, pode && modelo.estado !== 'arco')
      if (pode) {
        const t = (c: string) => Number(teclas.has(c))
        alturaTocha = Math.max(ALTURA.min, Math.min(ALTURA.max, alturaTocha + (t('KeyW') - t('KeyS')) * ALTURA.teclaMmS * dt))
        modelo.inclinacaoGraus = Math.max(0, Math.min(40, modelo.inclinacaoGraus + (t('KeyI') - t('KeyK')) * 30 * dt))
        if (controle === 'mouse') {
          // Pedal no botão do mouse: sobe em rampa e desce devagar (soltar devagar evita a cratera).
          modelo.pedal = pedalMouse ? Math.min(1, modelo.pedal + dt / TIG.rampaPedalS) : Math.max(0, modelo.pedal - dt / 0.6)
          modelo.mergulhar = teclas.has('Space') || agora < varetaAte || toquePendente
        } else modelo.mergulhar = varetaMouse || teclas.has('Space') || agora < varetaAte || toquePendente
        // O mergulho mínimo conta a partir do quadro que viu o toque, não do instante da tecla.
        if (toquePendente) { varetaAte = Math.max(varetaAte, agora + TOQUE_MINIMO_MS); toquePendente = false }
        // Arco medido até o topo do metal já posto: o cordão crescendo encurta o arco.
        modelo.distanciaMm = alturaTocha - dep.espessura(modelo.xMm, modelo.yMm)
        const x0 = modelo.xMm, y0 = modelo.yMm
        modelo.avancar(dt, (x, y, v) => {
          dep.depositar(x, y, v, agora, 0.25, 0, 0, modelo.larguraDepositoMm)
          cordao3D.depositar(x, y, v, agora, 0.3)
        })
        // Fusão sem vareta também aparece: um filme fino onde a poça passa.
        if (modelo.raioPocaMm > 1) cordao3D.depositar(x0, y0, 1.2 * dt * Math.min(1, modelo.raioPocaMm / 3), agora, 0.12)
      } else if (!encerrada) modelo.pedal = 0
      // Leituras.
      const L = modelo.distanciaMm
      const textoPlasma = (): string | null => {
        if (!plasma || modelo.estado !== 'arco') return null
        const m = mp()
        if (m.bocalGasto) return 'Bocal gasto (arco duplo) · arco aberto e fraco: solte o pedal e troque o bocal'
        if (m.keyhole && m.keyholeMm > 0.8 * furoQueFechaMm(peca.espessuraMm)) return 'Keyhole crescendo · avance, senão o furo não fecha'
        if (m.keyhole) return plasma.tecnica === 'keyhole' ? 'Keyhole aberto · avance constante; no fim, solte o pedal devagar' : 'O jato furou a chapa fina · baixe o gás e a corrente'
        if (modelo.raioPocaMm < 1) return 'Arco aberto · espere a poça'
        return plasma.tecnica === 'keyhole' ? (m.gasLMin < PLASMA.gasKeyholeMin ? 'Poça sem keyhole · gás de plasma baixo demais' : 'Poça formada · espere o keyhole abrir antes de avançar') : 'Poça formada · avance constante'
      }
      const texto = encerrada ? 'Tentativa encerrada · inspecione e veja a nota ao lado' : pausado ? 'Pausado'
        : textoPlasma() ?? (modelo.contaminado && modelo.estado === 'arco' ? 'Tungstênio contaminado · arco instável: solte o pedal e afie'
        : modelo.estado === 'arco' && modelo.raioPocaMm < 1 ? 'Arco aberto · espere a poça brilhar antes de avançar'
        : modelo.estado === 'arco' && L < TIG.varetaNoTungstenioMm ? 'Arco curto · suba um pouco antes de pôr a vareta'
        : mensagens[modelo.estado])
      if (estado.textContent !== texto) estado.textContent = texto
      estado.dataset.arco = String(modelo.estado === 'arco' && !modelo.contaminado)
      estado.dataset.alerta = String(modelo.contaminado || L <= ARCO.contato || (!!plasma && mp().bocalGasto))
      distanciaHud.value = `${n1(Math.max(0, L))} mm`
      marcador.style.left = `${Math.min(100, Math.max(0, (L / ARCO.max) * 100))}%`
      const faixa = plasma
        ? (L <= ARCO.contato ? 'bocal encostado · arco duplo' : L < ARCO.curto ? 'perto · risco de arco duplo' : L <= ARCO.bom ? 'adequado · a coluna quase não muda' : L <= ARCO.max ? 'longo · arco perde força' : 'apaga')
        : (L <= ARCO.contato ? 'encostado na poça' : L < ARCO.curto ? 'curto · a vareta encosta no tungstênio' : L <= ARCO.bom ? 'adequado' : L <= ARCO.max ? 'longo · poça larga e rasa' : 'apaga')
      if (medidorTexto.textContent !== faixa) medidorTexto.textContent = faixa
      medidorTexto.dataset.faixa = L < ARCO.curto ? 'curto' : L <= ARCO.bom ? 'adequado' : 'longo'
      pedalBarra.value = modelo.pedal
      pedalTexto.value = `${n0(modelo.correnteAtualA)} A`
      pocaHud.value = plasma?.tecnica === 'keyhole'
        ? (mp().keyhole ? `aberto · Ø ${n1(mp().keyholeMm)} mm` : modelo.raioPocaMm > 0.3 ? 'fechado' : '—')
        : modelo.raioPocaMm > 0.3 ? `${n1(2 * modelo.raioPocaMm)} mm` : '—'
      if (plasma) gasValor.value = `${n1(mp().gasLMin)} L/min`
      avanco.value = `${n1(modelo.estado === 'arco' ? modelo.velocidadeMmS : 0)} mm/s`
      varetaHud.value = `${n0(modelo.varetaRestanteMm)} mm`
      correnteValor.value = `${n0(modelo.correnteA)} A`
      const textoRef = `Sugerido para esta peça: ${peca.correnteA.min}–${peca.correnteA.max} A no pedal cheio${plasma ? `, avanço de ${n1(plasma.avancoMmS.min)}–${n1(plasma.avancoMmS.max)} mm/s` : ''}.`
        + (plasma && modelo.correnteA > PLASMA.correnteBocalA ? ` Acima de ${PLASMA.correnteBocalA} A o bocal não aguenta (arco duplo).`
          : modelo.correnteA > peca.correnteA.max + 10 ? (plasma?.tecnica === 'keyhole' ? ' Acima disso o keyhole cresce e pode não fechar.' : ' Acima disso a chapa fina fura.')
          : modelo.correnteA < peca.correnteA.min - (plasma ? 3 : 10) ? (plasma?.tecnica === 'keyhole' ? ' Abaixo disso o keyhole não abre.' : ' Abaixo disso a poça demora ou não se forma.') : '')
      if (referencia.textContent !== textoRef) referencia.textContent = textoRef
      alturaFaixa.value = String(alturaTocha)
      inclinacao.value = String(modelo.inclinacaoGraus)
      afiar.hidden = plasma ? !mp().bocalGasto : !modelo.contaminado
      gas.disabled = pausado
      afiar.disabled = modelo.estado === 'arco'
      novaVareta.disabled = modelo.varetaRestanteMm > TIG.varetaInicialMm - 1
      corrente.disabled = modelo.estado === 'arco' || pausado
      avaliar.disabled = encerrada || modelo.tempoArcoS < 0.1 || pausado
      zoomValor.value = `${vista.zoomPercentual()}%`
      const instrucao = (avisoCaneta ? avisoCaneta + ' ' : '') + (plasma
        ? (controle === 'mesa'
          ? 'Caneta: leve o bocal ao INÍCIO (3–6 mm) e pressione para o pedal. ' + (plasma.tecnica === 'keyhole' ? 'Espere o keyhole abrir, avance constante e, no fim, alivie a pressão devagar.' : 'Avance constante, sem parar.') + ' Vareta opcional (clique do mouse).'
          : 'Leve o mouse ao INÍCIO e segure o botão esquerdo (pedal). ' + (plasma.tecnica === 'keyhole' ? 'Espere o keyhole abrir, avance constante sem parar e, no fim, solte o botão (a corrente desce em rampa e o furo fecha).' : 'Avance constante, sem parar.') + ' Vareta opcional (Espaço).')
        : controle === 'mesa'
        ? 'Caneta: leve o tungstênio ao INÍCIO e pressione para o pedal. Espere a poça, toque a vareta com o clique do mouse na frente da poça e avance um passo a cada toque.'
        : 'Leve o mouse ao INÍCIO e segure o botão esquerdo (pedal). Espere a poça, toque a vareta com Espaço na frente da poça e avance um passo a cada toque. No fim, um último toque e solte o botão.')
      if (ajuda.textContent !== instrucao) ajuda.textContent = instrucao
      atualizarObjetivo(agora)
      // H94: metal no avesso, raiz afundada e furos aparecem no cordão 3D (a cada meio segundo e ao encerrar).
      if ((agora - analiseMs > 500 && modelo.tempoArcoS > 0 && !encerrada) || (encerrada && analiseMs >= 0)) {
        analiseMs = encerrada ? -1 : agora
        vista.atualizarDefeitos(plasma ? analiseVisualPlasma(plasma, mp(), cordao3D.nPosicoes, cordao3D.passoMm) : analiseVisualTig(peca, modelo, cordao3D.nPosicoes, cordao3D.passoMm))
      }
      vista.desenharTig(modelo, cordao3D, pode ? dt : 0, encerrada)
      pedido = requestAnimationFrame(quadro)
    }
    pedido = requestAnimationFrame(quadro)
    return () => { cancelAnimationFrame(pedido); soltar(); tamanho.disconnect(); ouvintes.forEach((f) => f()); vista.destruir() }
  }, plasma ? 'Treino · Plasma' : 'Treino · TIG')
}
