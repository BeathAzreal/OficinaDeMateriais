import { NOME_DIFICULDADE, type Dificuldade } from '../../missoes/catalogo'
import { comoPecaBaseBrasagem, type PecaBrasagem } from '../../missoes/pecasBrasagem'
import { MATERIAIS } from '../../modelo/material'
import { Cordao } from '../../modelo/cordao'
import { autoFluxante, BICOS, BRASAGEM, CHAMAS, FLUXOS, LIGAS, ModeloBrasagem, type ChamaId, type LigaId, type PreparoBrasagem } from '../../modelo/brasagem'
import { aprovacaoEletrodo } from '../../pontuacao/eletrodo'
import { analiseVisualBrasagem, avaliarBrasagem, inspecionarBrasagem, trechoBrasagem } from '../../pontuacao/brasagem'
import { criarBancada15 } from '../../render/bancada15'
import type { App } from '../app'
import { abrirPainel } from '../dialogo'
import { corteBrasagem } from '../componentes/corteBrasagem'
import { painelMaquina } from '../componentes/painelMaquina'
import { resultadoProcesso } from '../componentes/resultadoTig'
import { h, n0, n1 } from '../dom'

/** Quadro muito longo (aba travada, depurador) não vira um salto de vários segundos de chama. */
const DT_MAX = 0.25

/**
 * Controles da brasagem (H105). Duas mãos, como no TIG: o maçarico numa e a vareta na outra.
 * - mesa: a caneta é o maçarico (encostar a ponta põe a chama na peça; passar por cima a afasta);
 *   o mouse é a mão da vareta (mover escolhe onde ela encosta na borda; clique esquerdo encosta).
 * - mouse: o mouse é o maçarico (segurar o botão esquerdo põe a chama na peça); Espaço encosta a
 *   vareta, que fica à frente da chama (A/D mudam a distância); W/S ou roda: distância do bico.
 */
export type ControleBrasagem = 'mesa' | 'mouse'
const NOME_CONTROLE: Record<ControleBrasagem, string> = { mesa: 'Mesa + mouse (duas mãos)', mouse: 'Só mouse' }
const DISTANCIA = { min: 2, max: 40, inicial: 15, passoRoda: 1, teclaMmS: 10 }
const VARETA = { min: 4, max: 30, inicial: 8 }

/** Nome da cor da peça pela temperatura, como o brasador lê (aço e cobre). */
export function corDaPeca(tC: number): string {
  if (tC < 480) return 'sem cor'
  if (tC < 600) return 'vermelho bem escuro'
  if (tC < 700) return 'vermelho escuro'
  if (tC < 780) return 'vermelho-cereja escuro'
  if (tC < 860) return 'vermelho-cereja'
  if (tC < 950) return 'cereja claro'
  if (tC < 1050) return 'laranja'
  return 'amarelo'
}

/** Quatro tons da liga, da borda (mais escura) à crista (mais clara), para o cordão 3D. */
function tonsDaLiga(cor: string): [string, string, string, string] {
  const v = parseInt(cor.slice(1), 16), r = v >> 16, g = (v >> 8) & 255, b = v & 255
  const tom = (f: number) => '#' + [r, g, b].map((c) => Math.round(Math.min(255, f < 1 ? c * f : c + (255 - c) * (f - 1))).toString(16).padStart(2, '0')).join('')
  return [tom(0.55), tom(0.8), tom(1), tom(1.35)]
}

export function telaTreinoBrasagem(app: App, peca: PecaBrasagem, modo: Dificuldade, voltar: () => void): void {
  app.ir((app) => {
    app.raiz.classList.add('app-cheia')
    app.escolherOutraPeca = voltar
    const base = comoPecaBaseBrasagem(peca)
    const vista = criarBancada15(base, { tig: true, material: peca.material })
    if (!vista) return app.raiz.append(h('p', {}, 'WebGL indisponível: abra o treino no Chrome ou Edge com aceleração gráfica.'))
    const canvas = vista.canvas
    canvas.style.touchAction = 'none'
    let preparo: PreparoBrasagem = { ...peca.recomendado }
    let modelo = new ModeloBrasagem(peca, preparo)
    const novoCordao3D = () => new Cordao(undefined, undefined, undefined, { junta: 'sobreposta', dimensoes: { espessuraMm: peca.espessuraMm, aberturaMm: 0 } })
    let cordao3D = novoCordao3D()
    let controle: ControleBrasagem = 'mouse'
    let distancia: number = DISTANCIA.inicial
    let afastamentoVareta: number = VARETA.inicial
    let chamaMouse = false, varetaMouse = false
    let pausado = false, encerrada = false, foco = true
    let pedido = 0, anterior = performance.now(), analiseMs = 0, filetesMs = 0
    let painelResultado: HTMLElement | null = null
    let gestoCamera = false, ultimaTela = { x: 0, y: 0 }
    let avisoCaneta = ''
    const teclas = new Set<string>()
    const soltar = () => { teclas.clear(); chamaMouse = false; varetaMouse = false; modelo.encostarVareta = false; modelo.naPeca = false }
    // No Difícil não há termômetro: lê-se a cor da peça e o fluxo, como na oficina.
    const termometro = modo === 'aprendiz'

    // HUD sobre a vista.
    const estado = h('strong', { class: 'p15-estado', role: 'status', 'aria-live': 'polite' })
    const FAIXA_C = { min: 400, max: 1150 }
    const pct = (t: number) => `${Math.max(0, Math.min(100, ((t - FAIXA_C.min) / (FAIXA_C.max - FAIXA_C.min)) * 100))}%`
    const faixasEl = h('div', { class: 'p15-medidor-faixas' })
    const marcaBorda = h('span', { class: 'p15-medidor-marca', title: 'Borda, onde a vareta encosta' })
    const marcaDentro = h('span', { class: 'p15-medidor-marca p15-marca-dentro', title: 'Fim da sobreposição, por dentro' })
    const medidorTexto = h('span', { class: 'p15-medidor-texto' })
    const temperaturaHud = h('output', { class: 'p15-numero' })
    const fluxoHud = h('output')
    const ligaHud = h('output')
    const preenchimentoHud = h('output')
    const varetaHud = h('output')
    const hud = h('div', { class: 'p15-hud' }, estado,
      h('div', { class: 'p15-hud-arco' }, h('div', { class: 'p15-hud-linha' }, h('span', { class: 'p15-rotulo' }, termometro ? 'Temperatura onde a vareta encosta' : 'Cor da peça onde a vareta encosta'), temperaturaHud),
        h('div', { class: 'p15-medidor', 'aria-hidden': 'true' }, faixasEl, marcaBorda, marcaDentro), medidorTexto),
      h('div', { class: 'p15-hud-grade' },
        h('div', { class: 'p15-hud-item' }, h('span', { class: 'p15-rotulo' }, 'Fluxo'), fluxoHud),
        h('div', { class: 'p15-hud-item' }, h('span', { class: 'p15-rotulo' }, 'Liga'), ligaHud),
        h('div', { class: 'p15-hud-item' }, h('span', { class: 'p15-rotulo' }, 'Folga cheia'), preenchimentoHud),
        h('div', { class: 'p15-hud-item' }, h('span', { class: 'p15-rotulo' }, 'Vareta'), varetaHud)))
    const desenharFaixas = () => {
      const l = modelo.liga
      const zonas: [number, number, string, string][] = [
        [FAIXA_C.min, l.solidusC, 'contato', 'fria: a liga não derrete na peça'],
        [l.solidusC, l.trabalhoC[0], 'atencao', 'pastosa: a liga mal corre'],
        [l.trabalhoC[0], l.trabalhoC[1], 'bom', 'faixa de trabalho: a liga corre'],
        [l.trabalhoC[1], l.superaquecimentoC, 'atencao', 'quente demais: afaste a chama'],
        [l.superaquecimentoC, FAIXA_C.max, 'contato', 'superaquecida: a liga se estraga'],
      ]
      faixasEl.replaceChildren(...zonas.map(([a, b, classe, nome]) => h('span', { class: `p15-faixa p15-faixa-${classe}`, title: nome, style: `width:${((b - a) / (FAIXA_C.max - FAIXA_C.min)) * 100}%` })))
    }

    // Painel lateral: preparo (liga, fluxo, bico, chama).
    const seletorLiga = h('select', { 'aria-label': 'Liga de adição' }, (Object.keys(LIGAS) as LigaId[]).map((id) => h('option', { value: id }, `${LIGAS[id].nome} · ${LIGAS[id].trabalhoC[0]}–${LIGAS[id].trabalhoC[1]} °C`))) as HTMLSelectElement
    const caixaFluxo = h('input', { type: 'checkbox', id: 'bras-fluxo' }) as HTMLInputElement
    const textoFluxo = h('span', {})
    const seletorBico = h('select', { 'aria-label': 'Bico do maçarico' }, BICOS.map((b) => h('option', { value: String(b.n) }, `Bico ${b.n}`))) as HTMLSelectElement
    const seletorChama = h('select', { 'aria-label': 'Regulagem da chama' }, (Object.keys(CHAMAS) as ChamaId[]).map((c) => h('option', { value: c }, CHAMAS[c].nome))) as HTMLSelectElement
    const resumoChama = h('p', { class: 'p15-dica' })
    const avisoPreparo = h('p', { class: 'p15-dica' })
    const aplicarPreparo = () => {
      seletorLiga.value = preparo.liga
      caixaFluxo.checked = preparo.fluxo
      seletorBico.value = String(preparo.bico)
      seletorChama.value = preparo.chama
      const l = LIGAS[preparo.liga]
      textoFluxo.textContent = `Pincelar ${FLUXOS[l.fluxo].nome} (ativo de ${FLUXOS[l.fluxo].ativoC[0]} a ${FLUXOS[l.fluxo].ativoC[1]} °C)`
      resumoChama.textContent = CHAMAS[preparo.chama].resumo
      const r = peca.recomendado
      const avisos: string[] = []
      if (l.fosforo && MATERIAIS[peca.material].id !== 'cobre') avisos.push('Cobre-fósforo no aço deixa a junta frágil.')
      if (!preparo.fluxo && !autoFluxante(l, peca.material)) avisos.push('Sem fluxo, esta liga não molha este metal.')
      if (preparo.liga !== r.liga || preparo.bico !== r.bico || preparo.fluxo !== r.fluxo || preparo.chama !== r.chama) avisos.push(`Recomendado: ${LIGAS[r.liga].nome}, ${r.fluxo ? 'com' : 'sem'} fluxo, bico ${r.bico}, chama ${CHAMAS[r.chama].nome.toLowerCase()}.`)
      avisoPreparo.textContent = avisos.join(' ')
      vista.definirCoresLiga(tonsDaLiga(l.cor))
      desenharFaixas()
    }
    // Liga e fluxo mudam a peça montada: recomeça. Bico e chama trocam na hora.
    seletorLiga.addEventListener('change', () => { preparo = { ...preparo, liga: seletorLiga.value as LigaId, fluxo: !autoFluxante(LIGAS[seletorLiga.value as LigaId], peca.material) || preparo.fluxo }; recomecar(); canvas.focus() })
    caixaFluxo.addEventListener('change', () => { preparo = { ...preparo, fluxo: caixaFluxo.checked }; recomecar(); canvas.focus() })
    seletorBico.addEventListener('change', () => { preparo = { ...preparo, bico: Number(seletorBico.value) }; modelo.preparo.bico = preparo.bico; aplicarPreparo(); canvas.focus() })
    seletorChama.addEventListener('change', () => { preparo = { ...preparo, chama: seletorChama.value as ChamaId }; modelo.preparo.chama = preparo.chama; aplicarPreparo(); canvas.focus() })
    const seletorControle = h('select', { 'aria-label': 'Controle do maçarico e da vareta' }, (['mouse', 'mesa'] as const).map((c) => h('option', { value: c }, NOME_CONTROLE[c]))) as HTMLSelectElement
    const explicacaoControle = h('p', { class: 'p15-dica' })
    const mudarControle = (c: ControleBrasagem) => {
      soltar()
      controle = c
      seletorControle.value = c
      explicacaoControle.textContent = c === 'mesa'
        ? 'Caneta = maçarico: encoste a ponta para pôr a chama na peça; levante para afastar. Mouse = mão da vareta: mova para escolher onde ela encosta na borda e clique para encostar.'
        : 'Mouse = maçarico: segure o botão esquerdo para pôr a chama na peça; solte para afastar. Espaço encosta a vareta na borda, à frente da chama no sentido do FIM (A/D mudam a distância). W/S ou a roda: distância do bico.'
    }
    seletorControle.addEventListener('change', () => { mudarControle(seletorControle.value as ControleBrasagem); canvas.focus() })
    const novaVareta = h('button', { type: 'button', on: { click: () => { modelo.novaVareta(); canvas.focus() } } }, 'Nova vareta')
    const preparoEl = h('fieldset', { class: 'p15-fonte' }, h('legend', {}, 'Preparo da junta'),
      h('label', { class: 'p15-linha' }, 'Liga', seletorLiga),
      h('label', { for: 'bras-fluxo', class: 'interruptor' }, caixaFluxo, textoFluxo),
      h('label', { class: 'p15-linha' }, 'Bico', seletorBico),
      h('label', { class: 'p15-linha' }, 'Chama', seletorChama), resumoChama, avisoPreparo,
      h('label', { class: 'p15-linha' }, 'Controle', seletorControle), explicacaoControle)
    const distanciaFaixa = h('input', { type: 'range', min: DISTANCIA.min, max: DISTANCIA.max, step: 0.5, value: DISTANCIA.inicial, 'aria-label': 'Distância do bico à peça' }) as HTMLInputElement
    distanciaFaixa.addEventListener('input', () => { distancia = Number(distanciaFaixa.value) })
    const varetaFaixa = h('input', { type: 'range', min: VARETA.min, max: VARETA.max, step: 1, value: VARETA.inicial, 'aria-label': 'Vareta à frente da chama' }) as HTMLInputElement
    varetaFaixa.addEventListener('input', () => { afastamentoVareta = Number(varetaFaixa.value) })
    const distanciaTexto = h('small', {})
    const macaricoEl = h('div', {},
      h('label', {}, h('span', { class: 'p15-linha' }, 'Distância do bico', distanciaTexto), distanciaFaixa),
      h('label', {}, h('span', { class: 'p15-linha' }, 'Vareta à frente da chama (só mouse)', h('small', {}, 'A/D')), varetaFaixa),
      h('p', { class: 'p15-dica' }, 'Ponta do dardo a 5–15 mm da peça e a chama sempre andando. Aqueça a sobreposição inteira, não só a borda; encoste a vareta do lado oposto à chama: é a peça quente que derrete a liga.'),
      h('button', { type: 'button', on: { click: () => { vista.centralizar(); canvas.focus() } } }, 'Centralizar câmera'))
    const itensObjetivo = ['Folga cheia no trecho', 'Liga até o fim', 'Fluxo sem queimar', 'Sem metal fundido'].map((t) => {
      const valor = h('span', { class: 'p15-obj-valor' })
      return { li: h('li', {}, h('span', {}, t), valor), valor }
    })
    const objetivo = h('section', { class: 'p15-objetivo', 'aria-label': 'Objetivo da peça' },
      h('p', {}, peca.objetivo), h('p', { class: 'p15-dica' }, peca.porque),
      h('p', {}, `Folga de ${peca.folgaMm.toLocaleString('pt-BR')} mm · sobreposição de ${peca.sobreposicaoMm} mm · trecho ${peca.inicioMm}–${peca.fimMm} mm.`),
      h('ul', {}, itensObjetivo.map((i) => i.li)))
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
      modelo = new ModeloBrasagem(peca, preparo)
      // Só no desenvolvimento: deixa os testes de navegador lerem o modelo (some no build).
      if (import.meta.env.DEV) (window as unknown as { __brasagem?: ModeloBrasagem }).__brasagem = modelo
      modelo.xMm = peca.inicioMm + 8
      modelo.varetaXMm = peca.inicioMm + 2
      cordao3D = novoCordao3D()
      distancia = DISTANCIA.inicial
      vista.atualizarDefeitos(null)
      analiseMs = 0
      aplicarPreparo()
    }
    const encerrar = () => {
      if (encerrada || pausado || modelo.tempoChamaS < 0.5) return
      soltar()
      // A peça esfria e a liga solidifica antes da inspeção.
      for (let k = 0; k < 40; k++) modelo.avancar(0.25)
      atualizarFiletes(performance.now(), true)
      encerrada = true
      hud.hidden = true
      const r = avaliarBrasagem(peca, modelo, modo)
      const ver = h('button', { type: 'button', on: { click: () => abrirPainel('Folga por dentro', corteBrasagem(peca, modelo, modelo.liga.cor)) } }, 'Ver a folga por dentro')
      const d = r.descontos
      const resultado = resultadoProcesso(r, inspecionarBrasagem(peca, modelo), NOME_DIFICULDADE[modo], aprovacaoEletrodo(r, modo), { nova: recomecar, pecas: voltar }, {
        descontos: d.furos || d.fragil || d.zinco ? `Descontos: metal fundido −${d.furos} · junta frágil −${d.fragil} · zinco queimado −${d.zinco}` : 'Sem descontos adicionais.',
        detalhe: `Modo ${modo}. Metal de base fundido: −${d.furos}. Junta frágil (fósforo no aço): −${d.fragil}. Zinco queimado em volta: −${d.zinco}. Total limitado a 0–1000.`,
        limites: 'Modelo didático: calor na chapa, capilaridade e fluxo com números do jogo; temperaturas de liga e fluxo de catálogo. Não qualifica brasador.',
        botoes: [ver],
      })
      const painel = conteudo.querySelector<HTMLElement>('.p15-painel')!
      painel.hidden = true
      painelResultado = resultado.painel
      painel.parentElement!.append(painelResultado)
      resultado.focar()
    }
    const avaliar = h('button', { type: 'button', class: 'primario', disabled: true, on: { click: encerrar } }, 'Encerrar tentativa ↵')
    const instrumentos = painelMaquina([
      ['PREPARO', preparoEl],
      ['MAÇARICO', macaricoEl],
      ['MISSÃO', h('div', {}, objetivo, ajuda)],
    ])
    const zoomValor = h('output', {}, '100%')
    const area = h('div', { class: 'p15-vista' }, canvas, hud,
      h('div', { class: 'zoom-bancada', role: 'group', 'aria-label': 'Zoom da câmera' }, h('span', { title: 'Teclas + e −' }, 'ZOOM'),
        h('button', { type: 'button', 'aria-label': 'Afastar câmera', on: { click: () => { vista.aproximar(150); canvas.focus() } } }, '−'), zoomValor,
        h('button', { type: 'button', 'aria-label': 'Aproximar câmera', on: { click: () => { vista.aproximar(-150); canvas.focus() } } }, '+')))
    const conteudo = h('section', { class: 'p15' },
      h('header', { class: 'p15-cabecalho' },
        h('div', {},
          h('h2', { class: 'tela-titulo', tabindex: '-1' }, peca.titulo),
          h('p', {}, `Brasagem oxiacetilênica · modo ${NOME_DIFICULDADE[modo]} · ${MATERIAIS[peca.material].nomeCurto} ${n1(peca.espessuraMm)} mm · junta sobreposta`)),
        h('div', { class: 'p15-processos navegacao-de-partida' }, h('button', { type: 'button', on: { click: () => voltar() } }, 'Outras peças'))),
      h('div', { class: 'p15-grade' }, area,
        h('aside', { class: 'p15-painel' },
          h('div', { class: 'maquina-identificacao' }, 'MAÇARICO OXIACETILÊNICO', h('span', {}, '● CHAMA ACESA')),
          h('div', { class: 'p15-comandos' }, novaVareta),
          instrumentos,
          h('div', { class: 'p15-avaliacao' }, avaliar, pausar, h('button', { type: 'button', 'aria-label': 'Recomeçar peça', on: { click: recomecar } }, '↺')))))
    app.raiz.append(conteudo)
    mudarControle('mouse')
    recomecar()

    // Entrada: caneta e mouse chegam como ponteiros diferentes (pointerType), ao mesmo tempo.
    const ouvintes: (() => void)[] = []
    const ouvir = (alvoEv: EventTarget, tipo: string, f: EventListener) => { alvoEv.addEventListener(tipo, f); ouvintes.push(() => alvoEv.removeEventListener(tipo, f)) }
    const ponto = (e: PointerEvent) => vista.pontoNaTela(e.clientX, e.clientY)
    const moverMacarico = (e: PointerEvent) => {
      const p = ponto(e)
      if (p) { modelo.xMm = p.x; modelo.yMm = Math.max(-20, Math.min(15, p.y)) }
    }
    const caneta = (e: PointerEvent) => {
      if (controle !== 'mesa') { mudarControle('mesa'); avisoCaneta = 'Caneta detectada: controle em Mesa + mouse.' }
      moverMacarico(e)
      chamaMouse = (e.buttons & 1) === 1 || e.pressure > 0.05
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
      else if (controle === 'mesa') { varetaMouse = true; const p = ponto(e); if (p) modelo.varetaXMm = p.x }
      else { moverMacarico(e); chamaMouse = true }
    })
    ouvir(canvas, 'pointermove', (ev) => {
      const e = ev as PointerEvent
      if (pausado) return
      if (gestoCamera) {
        vista.orbitar(e.clientX - ultimaTela.x, e.clientY - ultimaTela.y)
        ultimaTela = { x: e.clientX, y: e.clientY }
        return
      }
      if (encerrada) return
      if (e.pointerType === 'pen') caneta(e)
      else if (controle === 'mouse') moverMacarico(e)
      else { const p = ponto(e); if (p) modelo.varetaXMm = p.x }
    })
    const fimPonteiro = (ev: Event) => {
      const e = ev as PointerEvent
      if (gestoCamera && e.pointerType !== 'pen') { gestoCamera = false; return }
      if (e.pointerType === 'pen') chamaMouse = false
      else if (controle === 'mesa') varetaMouse = false
      else chamaMouse = false
    }
    ouvir(canvas, 'pointerup', fimPonteiro)
    ouvir(canvas, 'pointercancel', fimPonteiro)
    ouvir(canvas, 'contextmenu', (e) => e.preventDefault())
    ouvir(canvas, 'wheel', (ev) => {
      const e = ev as WheelEvent
      e.preventDefault()
      if (pausado) return
      if (encerrada) { vista.aproximar(e.deltaY); return }
      distancia = Math.max(DISTANCIA.min, Math.min(DISTANCIA.max, distancia + Math.sign(e.deltaY) * DISTANCIA.passoRoda))
    })
    const TECLAS = ['KeyW', 'KeyS', 'KeyA', 'KeyD', 'Space']
    ouvir(window, 'keydown', (ev) => {
      const e = ev as KeyboardEvent
      if ((e.target as HTMLElement)?.matches('input,select,textarea')) return
      if (e.key === 'Enter' && !encerrada) { e.preventDefault(); encerrar(); return }
      if (['+', '-', '='].includes(e.key) || ['NumpadAdd', 'NumpadSubtract'].includes(e.code)) {
        e.preventDefault()
        if (!pausado) vista.aproximar(e.key === '-' || e.code === 'NumpadSubtract' ? 150 : -150)
        return
      }
      if (!TECLAS.includes(e.code)) return
      e.preventDefault()
      if (!pausado && !encerrada) teclas.add(e.code)
    })
    ouvir(window, 'keyup', (ev) => { teclas.delete((ev as KeyboardEvent).code) })
    ouvir(window, 'blur', () => { foco = false; soltar() })
    ouvir(window, 'focus', () => { foco = true })
    ouvir(document, 'visibilitychange', () => { soltar(); anterior = performance.now() })
    const tamanho = new ResizeObserver(() => { const r = area.getBoundingClientRect(); vista.enquadrar(r.width, r.height) })
    tamanho.observe(area)

    /** O cordão 3D mostra o filete da borda: refeito do modelo (a liga que entra na folga sai do filete). */
    let fileteSoma = -1
    const atualizarFiletes = (agora: number, forcar = false) => {
      if (!forcar && agora - filetesMs < 250) return
      filetesMs = agora
      let soma = 0
      for (let i = 0; i < modelo.filete.length; i++) soma += modelo.filete[i]
      if (!forcar && Math.abs(soma - fileteSoma) < 0.05) return
      fileteSoma = soma
      cordao3D = novoCordao3D()
      for (let i = 0; i < modelo.filete.length; i++) if (modelo.filete[i] > 0.03) cordao3D.depositar(i + 0.5, 0, modelo.filete[i], agora, 0.16)
    }

    let objetivoMs = 0
    const atualizarObjetivo = (agora: number) => {
      if (agora - objetivoMs < 250) return
      objetivoMs = agora
      let n = 0, cheio = 0, fim = 0
      for (let x = peca.inicioMm + 0.5; x < peca.fimMm; x += 2) {
        n++
        const t = trechoBrasagem(modelo, x)
        cheio += t.preenchimento
        if (t.profundidadeMm >= 0.9 * peca.sobreposicaoMm) fim++
      }
      const cob = n ? cheio / n : 0
      preenchimentoHud.value = `${n0(cob * 100)}%`
      const itens: [boolean, string][] = [
        [cob >= 0.8, `${n0(cob * 100)}%`],
        [n > 0 && fim / n >= 0.9, `${n0((n ? fim / n : 0) * 100)}%`],
        [modelo.fluxoQueimado === 0 && modelo.tempoChamaS > 0, modelo.preparo.fluxo ? `${modelo.fluxoQueimado}×` : 'sem fluxo'],
        [modelo.furos.length === 0 && modelo.tempoChamaS > 0, `${modelo.furos.length}`],
      ]
      itens.forEach(([ok, texto], i) => {
        itensObjetivo[i].li.dataset.ok = String(ok)
        if (itensObjetivo[i].valor.textContent !== texto) itensObjetivo[i].valor.textContent = texto
      })
    }
    const estadoFluxo = (): string => {
      if (!modelo.preparo.fluxo) return autoFluxante(modelo.liga, peca.material) ? 'não precisa (o fósforo limpa o cobre)' : 'sem fluxo'
      const x = modelo.varetaXMm
      const t = modelo.temperaturaC(x, 0.25)
      const [a0, a1] = FLUXOS[modelo.liga.fluxo].ativoC
      const resta = modelo.fluxoEm(x, 0.25)
      if (resta <= 0.05) return modelo.maximaC(x, 0.25) > a1 ? 'queimado (preto)' : 'gasto'
      if (t < 100) return 'pasta branca'
      if (t < a0) return 'pó branco, secando'
      if (t <= a1) return `vítreo, limpando (${n0(resta * 100)}%)`
      return 'queimando!'
    }
    const quadro = (agora: number) => {
      const dt = Math.min(DT_MAX, (agora - anterior) / 1000)
      anterior = agora
      const pode = !encerrada && !pausado && foco && !document.hidden
      if (pode) {
        const t = (c: string) => Number(teclas.has(c))
        distancia = Math.max(DISTANCIA.min, Math.min(DISTANCIA.max, distancia + (t('KeyS') - t('KeyW')) * DISTANCIA.teclaMmS * dt))
        afastamentoVareta = Math.max(VARETA.min, Math.min(VARETA.max, afastamentoVareta + (t('KeyD') - t('KeyA')) * 12 * dt))
        modelo.distanciaMm = distancia
        modelo.naPeca = chamaMouse
        if (controle === 'mouse') {
          // A vareta fica à frente da chama no sentido do trabalho (do INÍCIO ao FIM): não pula no vaivém.
          modelo.varetaXMm = Math.max(0.5, Math.min(149.5, modelo.xMm + afastamentoVareta))
          modelo.encostarVareta = teclas.has('Space')
        } else modelo.encostarVareta = varetaMouse || teclas.has('Space')
        modelo.avancar(dt)
      } else if (!encerrada) { modelo.naPeca = false; modelo.encostarVareta = false; if (!pausado) modelo.avancar(dt) }
      atualizarFiletes(agora)
      // Leituras.
      const tBorda = modelo.temperaturaC(modelo.varetaXMm, 0.25)
      const tDentro = modelo.temperaturaC(modelo.varetaXMm, -peca.sobreposicaoMm + 0.25)
      const l = modelo.liga
      const tChama = modelo.temperaturaC(modelo.xMm, modelo.yMm)
      const naChama = modelo.encostarVareta && tBorda < l.solidusC && modelo.chamaEm(modelo.varetaXMm, 0.25) > BRASAGEM.varetaNaChama
      const texto = encerrada ? 'Tentativa encerrada · inspecione e veja a nota ao lado' : pausado ? 'Pausado'
        : naChama ? 'A chama está derretendo a vareta! Encoste-a do outro lado: a PEÇA tem de derreter a liga'
        : modelo.zincoFerveu > 0 && tBorda > l.superaquecimentoC ? 'Fumaça branca: o zinco da liga está fervendo · afaste a chama'
        : modelo.encostarVareta && tBorda < l.solidusC ? 'Peça fria: a liga não derrete · aqueça mais antes de encostar'
        : modelo.encostarVareta ? 'Liga correndo · deixe ela entrar e avance com a chama'
        : !modelo.naPeca ? 'Chama afastada · segure para aquecer a junta'
        : tChama > modelo.base.fusaoC - 150 ? 'A chapa vai fundir! Mova a chama, não pare num ponto'
        : tBorda > l.superaquecimentoC || tChama > l.superaquecimentoC + 60 ? 'Quente demais · afaste a chama'
        : tBorda >= l.trabalhoC[0] && tDentro >= l.solidusC ? 'Na cor de trabalho · encoste a vareta na borda'
        : tBorda >= l.trabalhoC[0] ? 'Borda pronta, mas por dentro ainda está fria · leve a chama para dentro'
        : 'Aquecendo · mova a chama sobre toda a sobreposição'
      if (estado.textContent !== texto) estado.textContent = texto
      estado.dataset.arco = String(modelo.naPeca)
      estado.dataset.alerta = String(naChama || tBorda > l.superaquecimentoC || tChama > l.superaquecimentoC + 60)
      temperaturaHud.value = termometro ? `${n0(tBorda)} °C` : corDaPeca(tBorda)
      marcaBorda.style.left = pct(tBorda)
      marcaDentro.style.left = pct(tDentro)
      marcaDentro.hidden = !termometro
      const faixa = tBorda < l.solidusC ? 'fria para a liga' : tBorda < l.trabalhoC[0] ? 'pastosa' : tBorda <= l.trabalhoC[1] ? 'faixa de trabalho' : tBorda <= l.superaquecimentoC ? 'quente demais' : 'superaquecida'
      const detalhe = termometro ? `${faixa} · dentro ${n0(tDentro)} °C · sob a chama ${n0(tChama)} °C` : `${faixa} · sob a chama: ${corDaPeca(tChama)}`
      if (medidorTexto.textContent !== detalhe) medidorTexto.textContent = detalhe
      medidorTexto.dataset.faixa = tBorda < l.trabalhoC[0] ? 'curto' : tBorda <= l.trabalhoC[1] ? 'adequado' : 'longo'
      fluxoHud.value = estadoFluxo()
      ligaHud.value = `${l.nome.split(' (')[0]}`
      varetaHud.value = `${n0(modelo.varetaRestanteMm)} mm`
      distanciaTexto.textContent = `${n1(distancia)} mm${distancia < modelo.bico.dardoMm ? ' · dardo na peça!' : distancia > BRASAGEM.distanciaLongeMm ? ' · longe' : ''}`
      distanciaFaixa.value = String(distancia)
      varetaFaixa.value = String(afastamentoVareta)
      novaVareta.disabled = modelo.varetaRestanteMm > BRASAGEM.varetaInicialMm - 1
      avaliar.disabled = encerrada || modelo.tempoChamaS < 0.5 || pausado
      zoomValor.value = `${vista.zoomPercentual()}%`
      const instrucao = (avisoCaneta ? avisoCaneta + ' ' : '') + (controle === 'mesa'
        ? 'Caneta: encoste para pôr a chama na peça e mova sobre a sobreposição até a cor de trabalho. Com o mouse, escolha o ponto da borda e clique para encostar a vareta.'
        : 'Segure o botão esquerdo para pôr a chama na peça e mova sobre a sobreposição até a cor de trabalho. Espaço encosta a vareta à frente da chama; a liga corre para dentro da folga. Avance aos poucos.')
      if (ajuda.textContent !== instrucao) ajuda.textContent = instrucao
      atualizarObjetivo(agora)
      if ((agora - analiseMs > 500 && modelo.tempoChamaS > 0 && !encerrada) || (encerrada && analiseMs >= 0)) {
        analiseMs = encerrada ? -1 : agora
        vista.atualizarDefeitos(analiseVisualBrasagem(modelo, cordao3D.nPosicoes, cordao3D.passoMm))
      }
      vista.desenharBrasagem(modelo, cordao3D, pode ? dt : 0, encerrada)
      pedido = requestAnimationFrame(quadro)
    }
    pedido = requestAnimationFrame(quadro)
    return () => { cancelAnimationFrame(pedido); soltar(); tamanho.disconnect(); ouvintes.forEach((f) => f()); vista.destruir() }
  }, 'Treino · brasagem')
}
