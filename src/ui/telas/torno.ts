import { NOME_DIFICULDADE, type Dificuldade } from '../../missoes/catalogo'
import { aprovacaoEletrodo } from '../../pontuacao/eletrodo'
import { criarTorno3D, type Instrumento } from '../../render/torno3d'
import { avaliarTorno, comprimentoUsinado, inspecionarTorno, medidasTorno, RESOLUCAO, type ResultadoTorno } from '../../torno/avaliacao'
import { MATERIAIS_TORNO } from '../../torno/materiais'
import { ModeloTorno, TORNO, type EventoTorno } from '../../torno/modelo'
import type { PecaTorno } from '../../torno/pecas'
import type { App } from '../app'
import { painelMaquina } from '../componentes/painelMaquina'
import { resultadoProcesso } from '../componentes/resultadoTig'
import { h, n0, n1 } from '../dom'
import '../../torno.css'

/*
 * O que faz: a bancada do torno convencional (v2.2, H108), no molde da
 * bancada de solda: 3D grande com o painel de leituras por cima, painel
 * lateral com abas (MÁQUINA, FERRAMENTA, MEDIÇÃO, MISSÃO) e o resultado com
 * nota e defeitos. Mouse e teclado:
 * - botão esquerdo segurado: a ferramenta vai até o ponteiro na velocidade
 *   da manivela (Shift rápido); botão do meio gira a câmera, direito arrasta;
 * - A/D ou ←/→: carro (Z); W/S ou ↑/↓: transversal (W aprofunda); Shift rápido;
 * - roda: nônio do transversal (0,02 mm no diâmetro por clique); Shift+roda: Z;
 * - E liga/desliga o eixo; Espaço avanço longitudinal; F avanço transversal;
 *   1–7 marchas (eixo parado); 0 zera o Z na aresta; M instrumento; Enter encerra.
 */

const DT_MAX = 0.1
const NOME_INSTRUMENTO: Record<Instrumento, string> = { micrometro: 'Micrômetro (Ø, 0,01 mm)', paquimetro: 'Paquímetro (comprimento, 0,02 mm)', rugosimetro: 'Rugosímetro (Ra, 0,1 µm)' }

export interface OpcoesTorno {
  /** Chamado ao encerrar com nota (Fábrica: registra na OS). */
  aoConcluir?: (r: ResultadoTorno, aprovada: boolean) => void
  contexto?: string
}

export function telaTorno(app: App, peca: PecaTorno, modo: Dificuldade, voltar: () => void, op: OpcoesTorno = {}): void {
  app.ir((app) => {
    app.raiz.classList.add('app-cheia')
    app.escolherOutraPeca = voltar
    const novoModelo = () => new ModeloTorno({ material: peca.material, diametroMm: peca.diametroBrutoMm, balancoMm: peca.balancoMm })
    let modelo = novoModelo()
    const vista = criarTorno3D(modelo)
    if (!vista) { app.raiz.append(h('p', {}, 'WebGL indisponível: abra o torno no Chrome ou Edge com aceleração gráfica.')); return }
    const canvas = vista.canvas
    canvas.style.touchAction = 'none'
    const material = MATERIAIS_TORNO[peca.material]

    let pausado = false, encerrada = false, foco = true
    let pedido = 0, anterior = performance.now()
    let instrumento: Instrumento | null = null
    let zeroZ = peca.balancoMm
    let alvoMouse: { z: number; r: number } | null = null
    let painelResultado: HTMLElement | null = null
    let aviso = '', avisoAte = 0
    const teclas = new Set<string>()
    const soltar = () => { teclas.clear(); alvoMouse = null; modelo.vZ = 0; modelo.vR = 0 }
    const avisar = (t: string, ms = 3500) => { aviso = t; avisoAte = performance.now() + ms }
    const eventos = (e: EventoTorno) => {
      const textos: Record<EventoTorno, string> = {
        quebrou: 'A FERRAMENTA QUEBROU · afaste, troque a aresta (eixo parado) e continue',
        'colisao-placa': 'BATEU NA PLACA · a ferramenta quebrou: troque a aresta',
        sobrecarga: 'MOTOR PAROU POR SOBRECARGA · menos profundidade ou avanço',
        lascou: 'Aresta lascada · troque a aresta antes do acabamento',
        'medicao-insegura': 'PARE O EIXO ANTES DE MEDIR',
        vibrando: 'Trepidação · peça vibrando: corte mais leve aqui',
      }
      avisar(textos[e], e === 'vibrando' ? 2000 : 4500)
    }

    // HUD sobre a vista: leituras como o mostrador de um torno com DRO.
    const estado = h('strong', { class: 'p15-estado', role: 'status', 'aria-live': 'polite' })
    const droX = h('output', { class: 'tr-dro-valor' }), droZ = h('output', { class: 'tr-dro-valor' })
    const rpmHud = h('output'), vcHud = h('output'), fHud = h('output'), apHud = h('output'), vbHud = h('output')
    const potencia = h('progress', { max: 1, value: 0, 'aria-label': 'Potência do motor' }) as HTMLProgressElement
    const potenciaTexto = h('output')
    const hud = h('div', { class: 'p15-hud tr-hud' }, estado,
      h('div', { class: 'tr-dro' },
        h('div', {}, h('span', { class: 'p15-rotulo' }, 'X (Ø da ponta)'), droX),
        h('div', {}, h('span', { class: 'p15-rotulo' }, 'Z (aresta, da face)'), droZ)),
      h('div', { class: 'p15-hud-grade' },
        h('div', { class: 'p15-hud-item' }, h('span', { class: 'p15-rotulo' }, 'Eixo'), rpmHud),
        h('div', { class: 'p15-hud-item' }, h('span', { class: 'p15-rotulo' }, 'vc'), vcHud),
        h('div', { class: 'p15-hud-item' }, h('span', { class: 'p15-rotulo' }, 'Avanço real'), fHud),
        h('div', { class: 'p15-hud-item' }, h('span', { class: 'p15-rotulo' }, 'Profundidade'), apHud),
        h('div', { class: 'p15-hud-item p15-consumo' }, h('span', { class: 'p15-rotulo' }, 'Potência'), potenciaTexto, potencia),
        h('div', { class: 'p15-hud-item' }, h('span', { class: 'p15-rotulo' }, 'Desgaste VB'), vbHud)))

    // MÁQUINA: eixo, marchas, avanço automático.
    const botaoEixo = h('button', { type: 'button', class: 'tr-eixo', on: { click: () => { alternarEixo(); canvas.focus() } } })
    const botaoLong = h('button', { type: 'button', on: { click: () => { automatico('longitudinal'); canvas.focus() } } }, 'Avanço longitudinal ⟵ (Espaço)')
    const botaoTrans = h('button', { type: 'button', on: { click: () => { automatico('transversal'); canvas.focus() } } }, 'Avanço transversal ↓ (F)')
    const marchas = h('div', { class: 'tr-marchas', role: 'group', 'aria-label': 'Rotação do eixo (rpm)' },
      TORNO.rotacoes.map((rpm, i) => h('button', { type: 'button', 'data-rpm': String(rpm), title: `Tecla ${i + 1}`, on: { click: () => { trocarMarcha(rpm); canvas.focus() } } }, String(rpm))))
    const avancos = h('select', { 'aria-label': 'Avanço automático (mm/volta)' }, TORNO.avancos.map((f) => h('option', { value: String(f) }, `${f.toLocaleString('pt-BR')} mm/volta`))) as HTMLSelectElement
    avancos.value = String(modelo.avancoMmVolta)
    avancos.addEventListener('change', () => { modelo.avancoMmVolta = Number(avancos.value); canvas.focus() })
    const vcDica = h('p', { class: 'p15-dica' })
    const maquina = h('div', { class: 'tr-maquina' },
      botaoEixo,
      h('label', {}, h('span', { class: 'p15-linha' }, 'Rotação (rpm)', h('small', {}, 'troque com o eixo parado')), marchas),
      vcDica,
      h('label', {}, h('span', { class: 'p15-linha' }, 'Avanço automático'), avancos),
      h('div', { class: 'tr-automatico' }, botaoLong, botaoTrans),
      h('button', { type: 'button', on: { click: () => { zerarZ(); canvas.focus() } } }, 'Zerar Z na aresta (0)'),
      h('p', { class: 'p15-dica' }, peca.dica))

    // FERRAMENTA: pastilha, desgaste, troca.
    const vbBarra = h('progress', { max: TORNO.vbLasca, value: 0, 'aria-label': 'Desgaste da aresta' }) as HTMLProgressElement
    const vbTexto = h('output')
    const pastilha = h('select', { 'aria-label': 'Raio de ponta da pastilha' }, [0.4, 0.8, 1.2].map((r) => h('option', { value: String(r), selected: r === 0.8 }, `rε ${r.toLocaleString('pt-BR')} mm`))) as HTMLSelectElement
    pastilha.addEventListener('change', () => {
      if (!modelo.trocarPastilha(Number(pastilha.value))) { pastilha.value = String(modelo.raioPonta); avisar('Pare o eixo para trocar a pastilha') }
      canvas.focus()
    })
    const botaoAresta = h('button', { type: 'button', on: { click: () => { if (!modelo.trocarAresta()) avisar('Pare o eixo para trocar a aresta'); else avisar('Aresta nova', 1500); canvas.focus() } } }, 'Trocar aresta')
    const ferramenta = h('div', {},
      h('label', {}, h('span', { class: 'p15-linha' }, 'Pastilha de metal duro'), pastilha),
      h('label', {}, h('span', { class: 'p15-linha' }, 'Desgaste de flanco (VB)', vbTexto), vbBarra),
      botaoAresta,
      h('p', { class: 'p15-dica' }, 'Raio de ponta maior deixa a superfície mais lisa com o mesmo avanço (Ra ≈ f²/8rε), mas empurra mais a peça. A aresta gasta recua e a peça sai maior: troque antes do acabamento.'),
      h('p', { class: 'p15-dica' }, 'O mostrador X é a posição da ponta. Com força, a ferramenta e a peça cedem: no desbaste a peça sai alguns centésimos maior. Meça antes do passe final.'))

    // MEDIÇÃO: instrumentos (só com o eixo parado) e leituras.
    const leituras = h('ol', { class: 'tr-leituras' })
    const botoesInstrumento = (Object.keys(NOME_INSTRUMENTO) as Instrumento[]).map((i) =>
      h('button', { type: 'button', 'data-instrumento': i, on: { click: () => { escolherInstrumento(instrumento === i ? null : i); canvas.focus() } } }, NOME_INSTRUMENTO[i]))
    const medicao = h('div', {},
      h('div', { class: 'tr-instrumentos', role: 'group', 'aria-label': 'Instrumento' }, botoesInstrumento),
      h('p', { class: 'p15-dica' }, 'Escolha o instrumento (ou M) e clique na peça. Só com o eixo parado: medir com a peça girando é perigoso.'),
      leituras)

    // MISSÃO: desenho e itens ao vivo.
    const itensObjetivo = (peca.alvo ? ['Face', 'Diâmetro', 'Comprimento', 'Acabamento', 'Segurança'] : ['Material removido', 'Segurança']).map((t) => {
      const valor = h('span', { class: 'p15-obj-valor' })
      return { li: h('li', {}, h('span', {}, t), valor), valor }
    })
    const missao = h('section', { class: 'p15-objetivo' },
      h('p', {}, peca.objetivo),
      peca.alvo ? h('p', { class: 'tr-desenho' }, `Desenho: Ø ${n1(peca.alvo.diametro.nominal)} (${peca.alvo.diametro.sup ? '+' + peca.alvo.diametro.sup : '0'}/${peca.alvo.diametro.inf}) × ${peca.alvo.comprimento.nominal} ± ${peca.alvo.comprimento.tol} mm da face · Ra ≤ ${peca.alvo.raMax} µm · facear ≥ ${peca.alvo.facearMinMm} mm. Tarugo Ø ${peca.diametroBrutoMm} × ${peca.balancoMm} mm em balanço, ${material.nome.toLowerCase()}.`) : null,
      h('ul', {}, itensObjetivo.map((i) => i.li)))
    const ajuda = h('p', { class: 'p15-ajuda' }, 'Botão esquerdo segurado: a ferramenta vai até o ponteiro (Shift: rápido). A/D carro, W/S transversal (W aprofunda), roda: nônio. E liga o eixo, Espaço avanço longitudinal, F transversal. Afaste a ferramenta antes de ligar ou desligar.')

    const avaliar = h('button', { type: 'button', class: 'primario', on: { click: () => encerrar() } }, 'Encerrar e inspecionar ↵')
    const pausar = h('button', { type: 'button', class: 'navegacao-de-partida', on: { click: () => { pausado = !pausado; soltar(); pausar.textContent = pausado ? 'Continuar' : 'Pausar'; anterior = performance.now() } } }, 'Pausar')
    app.controlePausa = { pausar: () => { pausado = true; soltar() }, retomar: () => { pausado = false; anterior = performance.now() } }
    const zoomValor = h('output', {}, '100%')
    let zoom = 100
    const aproximar = (d: number) => { vista.aproximar(d); zoom = Math.round(zoom / Math.max(0.35, Math.min(3, 1 + d / 600))); zoomValor.value = `${zoom}%` }
    const area = h('div', { class: 'p15-vista' }, canvas, hud,
      h('div', { class: 'zoom-bancada', role: 'group', 'aria-label': 'Zoom da câmera' }, h('span', { title: 'Teclas + e −' }, 'ZOOM'),
        h('button', { type: 'button', 'aria-label': 'Afastar câmera', on: { click: () => { aproximar(150); canvas.focus() } } }, '−'), zoomValor,
        h('button', { type: 'button', 'aria-label': 'Aproximar câmera', on: { click: () => { aproximar(-150); canvas.focus() } } }, '+'),
        h('button', { type: 'button', on: { click: () => { vista.centralizar(); zoom = 100; zoomValor.value = '100%'; canvas.focus() } } }, 'Centralizar')))
    const painel = h('aside', { class: 'p15-painel' },
      h('div', { class: 'maquina-identificacao' }, 'TORNO / 4 kW', h('span', { class: 'tr-status' })),
      painelMaquina([['MÁQUINA', maquina], ['FERRAMENTA', ferramenta], ['MEDIÇÃO', medicao], ['MISSÃO', h('div', {}, missao, ajuda)]]),
      h('div', { class: 'p15-avaliacao' }, avaliar, pausar, h('button', { type: 'button', 'aria-label': 'Recomeçar peça', on: { click: () => recomecar() } }, '↺')))
    const conteudo = h('section', { class: 'p15 tr' },
      h('header', { class: 'p15-cabecalho' },
        h('div', {},
          h('h2', { class: 'tela-titulo', tabindex: '-1' }, peca.titulo),
          h('p', {}, `Torno convencional · modo ${NOME_DIFICULDADE[modo]} · ${material.nome} · Ø ${peca.diametroBrutoMm} × ${peca.balancoMm} mm em balanço`)),
        h('div', { class: 'p15-processos navegacao-de-partida' }, h('button', { type: 'button', on: { click: () => voltar() } }, 'Outras peças'))),
      h('div', { class: 'p15-grade' }, area, painel))
    app.raiz.append(conteudo)
    const status = conteudo.querySelector<HTMLElement>('.tr-status')!

    // Ações.
    function alternarEixo() {
      if (encerrada || pausado) return
      const antes = modelo.quebras
      modelo.alternarEixo(eventos)
      if (modelo.quebras === antes && modelo.eixoLigado) avisar(`Eixo ligado · ${modelo.rpm} rpm`, 1200)
    }
    function automatico(qual: 'longitudinal' | 'transversal') {
      if (!modelo.eixoLigado) { avisar('Ligue o eixo antes do avanço automático'); return }
      modelo.automatico = modelo.automatico === qual ? null : qual
    }
    function trocarMarcha(rpm: number) {
      if (!modelo.trocarRotacao(rpm)) avisar('Pare o eixo para trocar a marcha')
    }
    function zerarZ() { zeroZ = modelo.zFerramenta - modelo.raioPonta; avisar('Z zerado na aresta da ferramenta', 1500) }
    function escolherInstrumento(i: Instrumento | null) {
      instrumento = i
      canvas.style.cursor = i ? 'crosshair' : ''
      botoesInstrumento.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.instrumento === i)))
    }
    function medir(z: number) {
      if (!instrumento) return
      if (!modelo.podeMedir(eventos)) return
      const face = modelo.zFace
      let texto: string
      if (instrumento === 'micrometro') texto = `Ø ${(Math.round(modelo.diametroEm(z) / RESOLUCAO.micrometro) * RESOLUCAO.micrometro).toFixed(2)} mm a ${n1(face - z)} mm da face`
      else if (instrumento === 'paquimetro') {
        const L = comprimentoUsinado(modelo)
        texto = L === null ? 'Sem ressalto para medir' : `Ressalto a ${L.toFixed(2)} mm da face · face removida ${(peca.balancoMm - face).toFixed(2)} mm`
      } else {
        const ra = modelo.raEm(z)
        texto = ra === null ? `Superfície bruta a ${n1(face - z)} mm da face` : `Ra ${(Math.round(ra / RESOLUCAO.rugosimetro) * RESOLUCAO.rugosimetro).toFixed(1)} µm a ${n1(face - z)} mm da face`
      }
      vista!.mostrarInstrumento(instrumento, z, modelo)
      leituras.prepend(h('li', {}, texto))
      while (leituras.children.length > 8) leituras.lastElementChild!.remove()
    }
    function recomecar() {
      soltar()
      encerrada = false
      painelResultado?.remove(); painelResultado = null
      painel.hidden = false
      hud.hidden = false
      modelo = novoModelo()
      modelo.raioPonta = Number(pastilha.value)
      modelo.avancoMmVolta = Number(avancos.value)
      zeroZ = peca.balancoMm
      leituras.replaceChildren()
      vista!.mostrarInstrumento(null)
    }
    function encerrar() {
      if (encerrada || pausado || modelo.tempoS < 0.5) return
      soltar()
      if (modelo.eixoLigado) modelo.alternarEixo()
      encerrada = true
      hud.hidden = true
      escolherInstrumento(null)
      const r = avaliarTorno(peca, modelo, modo)
      const aprovacao = aprovacaoEletrodo(r, modo)
      if (peca.alvo) {
        const res = resultadoProcesso(r, inspecionarTorno(peca, modelo), NOME_DIFICULDADE[modo], aprovacao, { nova: recomecar, pecas: voltar }, {
          descontos: 'Sem descontos à parte: quebras, batidas e medições inseguras entram em "Ferramenta e segurança".',
          detalhe: `Modo ${NOME_DIFICULDADE[modo]}. Medidas com micrômetro (0,01 mm), paquímetro (0,02 mm) e rugosímetro (0,1 µm).`,
          limites: 'Modelo didático do torno: força, deflexão, desgaste e rugosidade com parâmetros sintéticos do jogo. Não avalia circularidade, conicidade fina nem tensões residuais. Não qualifica operador.',
        })
        painelResultado = res.painel
        painel.hidden = true
        painel.parentElement!.append(painelResultado)
        res.focar()
        op.aoConcluir?.(r, aprovacao.aprovada)
      } else {
        const md = medidasTorno(modelo, peca)
        painelResultado = h('aside', { class: 'p15-painel tr-livre' },
          h('h3', { tabindex: '-1' }, 'Medidas da peça'),
          h('ul', {},
            h('li', {}, `Face removida: ${md.faceRemovidaMm.toFixed(2)} mm`),
            h('li', {}, `Comprimento usinado: ${md.comprimentoMm === null ? '—' : md.comprimentoMm.toFixed(2) + ' mm'}`),
            h('li', {}, `Ø no trecho: ${md.diametroMin.toFixed(2)}–${md.diametroMax.toFixed(2)} mm`),
            h('li', {}, `Maior Ra: ${md.raMax === null ? '—' : md.raMax.toFixed(1) + ' µm'}`),
            h('li', {}, `Material removido: ${n0(modelo.volumeRemovidoMm3 / 1000)} cm³ · tempo de corte ${n0(modelo.tempoCorteS)} s`),
            h('li', {}, `Quebras ${modelo.quebras + modelo.colisoes} · sobrecargas ${modelo.sobrecargas} · VB final ${modelo.vb.toFixed(2)} mm`)),
          h('div', { class: 'acoes' }, h('button', { type: 'button', class: 'primario', on: { click: recomecar } }, 'Novo tarugo'), h('button', { type: 'button', on: { click: voltar } }, 'Escolher outra peça')))
        painel.hidden = true
        painel.parentElement!.append(painelResultado)
        painelResultado.querySelector<HTMLElement>('h3')?.focus()
      }
    }

    // Entrada.
    const ouvintes: (() => void)[] = []
    const ouvir = (alvo: EventTarget, tipo: string, f: EventListener, opcoes?: AddEventListenerOptions) => { alvo.addEventListener(tipo, f, opcoes); ouvintes.push(() => alvo.removeEventListener(tipo, f, opcoes)) }
    ouvir(canvas, 'pointerdown', (ev) => {
      const e = ev as PointerEvent
      if (pausado || encerrada || e.button !== 0) return
      canvas.focus()
      if (instrumento) { const z = vista.pontoNaPeca(e.clientX, e.clientY); if (z !== null) medir(z); return }
      try { canvas.setPointerCapture(e.pointerId) } catch { /* já solto */ }
      alvoMouse = vista.pontoNoPlano(e.clientX, e.clientY)
    })
    ouvir(canvas, 'pointermove', (ev) => {
      const e = ev as PointerEvent
      if (alvoMouse && (e.buttons & 1)) alvoMouse = vista.pontoNoPlano(e.clientX, e.clientY)
    })
    const fimPonteiro = () => { alvoMouse = null }
    ouvir(canvas, 'pointerup', fimPonteiro)
    ouvir(canvas, 'pointercancel', fimPonteiro)
    ouvir(canvas, 'contextmenu', (e) => e.preventDefault())
    ouvir(canvas, 'wheel', (ev) => {
      const e = ev as WheelEvent
      e.preventDefault()
      if (pausado || encerrada) return
      // Nônio: 0,01 mm no raio (0,02 no diâmetro) por clique; com Shift, 0,05 mm no Z.
      const s = Math.sign(e.deltaY)
      if (e.shiftKey) modelo.zFerramenta += 0.05 * s
      else modelo.rFerramenta = Math.max(-TORNO.alemDoCentroMm, modelo.rFerramenta + 0.01 * s)
    }, { passive: false })
    const TECLAS = ['KeyA', 'KeyD', 'KeyW', 'KeyS', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']
    ouvir(window, 'keydown', (ev) => {
      const e = ev as KeyboardEvent
      if ((e.target as HTMLElement)?.matches?.('input,select,textarea') || document.querySelector('[role="dialog"]')) return
      if (e.key === 'Enter' && !encerrada) { e.preventDefault(); encerrar(); return }
      if (encerrada || pausado) return
      if (e.key === '+' || e.key === '=' || e.code === 'NumpadAdd') { e.preventDefault(); aproximar(-150); return }
      if (e.key === '-' || e.code === 'NumpadSubtract') { e.preventDefault(); aproximar(150); return }
      if (e.code === 'KeyE' && !e.repeat) { e.preventDefault(); alternarEixo(); return }
      if (e.code === 'Space' && !e.repeat) { e.preventDefault(); automatico('longitudinal'); return }
      if (e.code === 'KeyF' && !e.repeat) { e.preventDefault(); automatico('transversal'); return }
      if (e.code === 'KeyM' && !e.repeat) { e.preventDefault(); const l = Object.keys(NOME_INSTRUMENTO) as Instrumento[]; escolherInstrumento(instrumento === null ? l[0] : l[l.indexOf(instrumento) + 1] ?? null); return }
      if (e.code === 'Digit0') { e.preventDefault(); zerarZ(); return }
      const marcha = /^Digit([1-7])$/.exec(e.code)
      if (marcha) { e.preventDefault(); trocarMarcha(TORNO.rotacoes[Number(marcha[1]) - 1]); return }
      if (!TECLAS.includes(e.code)) return
      e.preventDefault()
      teclas.add(e.code)
      if (e.shiftKey) teclas.add('Shift')
    })
    ouvir(window, 'keyup', (ev) => { const e = ev as KeyboardEvent; teclas.delete(e.code); if (!e.shiftKey) teclas.delete('Shift') })
    ouvir(window, 'blur', () => { foco = false; soltar() })
    ouvir(window, 'focus', () => { foco = true })
    ouvir(document, 'visibilitychange', () => { soltar(); anterior = performance.now() })
    const tamanho = new ResizeObserver(() => { const r = area.getBoundingClientRect(); vista.enquadrar(r.width, r.height) })
    tamanho.observe(area)

    // Laço.
    let objetivoMs = 0
    const quadro = (agora: number) => {
      const dt = Math.min(DT_MAX, (agora - anterior) / 1000)
      anterior = agora
      const pode = !encerrada && !pausado && foco && !document.hidden
      if (pode) {
        const rapido = teclas.has('Shift')
        const vel = rapido ? TORNO.manivela.rapido : TORNO.manivela.normal
        const t = (...c: string[]) => Number(c.some((x) => teclas.has(x)))
        let vz = (t('KeyD', 'ArrowRight') - t('KeyA', 'ArrowLeft')) * vel
        let vr = (t('KeyS', 'ArrowDown') - t('KeyW', 'ArrowUp')) * vel
        if (alvoMouse) {
          // A mão na manivela: vai até o ponteiro na velocidade da manivela.
          const dz = alvoMouse.z - modelo.zFerramenta, dr = Math.max(-TORNO.alemDoCentroMm, alvoMouse.r) - modelo.rFerramenta
          const d = Math.hypot(dz, dr)
          const v = Math.min(vel, d / Math.max(dt, 1e-3))
          if (d > 0.005) { vz = (dz / d) * v; vr = (dr / d) * v }
        }
        modelo.vZ = vz
        modelo.vR = vr
        modelo.avancar(dt, eventos)
      } else { modelo.vZ = 0; modelo.vR = 0 }

      // Leituras.
      const L = modelo
      const texto = encerrada ? 'Peça encerrada · inspecione e veja a nota ao lado' : pausado ? 'Pausado'
        : agora < avisoAte ? aviso
        : L.quebrada ? 'Ferramenta quebrada · pare o eixo, afaste e troque a aresta'
        : !L.eixoLigado ? (instrumento ? `Medindo: ${NOME_INSTRUMENTO[instrumento]} · clique na peça` : 'Eixo parado · afaste a ferramenta e ligue (E)')
        : L.vibrando ? 'Trepidação · corte mais leve na ponta da peça'
        : L.cortando ? (L.automatico ? `Cortando · avanço automático ${L.automatico}` : 'Cortando na manivela')
        : 'Eixo girando · aproxime a ferramenta'
      if (estado.textContent !== texto) estado.textContent = texto
      estado.dataset.arco = String(L.cortando)
      estado.dataset.alerta = String(L.quebrada || L.vibrando || (agora < avisoAte && /QUEBROU|BATEU|PAROU|PARE/.test(aviso)))
      droX.value = `${(2 * L.rFerramenta).toFixed(2)}`
      droZ.value = `${(L.zFerramenta - L.raioPonta - zeroZ).toFixed(2)}`
      rpmHud.value = L.eixoLigado ? `${L.rpm} rpm` : 'parado'
      vcHud.value = L.cortando ? `${n0(L.vcMMin)} m/min` : '—'
      vcHud.dataset.fora = String(L.cortando && (L.vcMMin < material.vcFaixa.min || L.vcMMin > material.vcFaixa.max))
      fHud.value = L.cortando ? `${L.fMmVolta.toFixed(2)} mm/v` : '—'
      apHud.value = L.cortando ? `${L.apMm.toFixed(2)} mm` : '—'
      const disponivel = TORNO.potenciaW * Math.min(1, L.rpm / TORNO.rotacaoPlenaRpm)
      potencia.value = Math.min(1, L.potenciaW / disponivel)
      potenciaTexto.value = `${n1(L.potenciaW / 1000)} kW`
      vbHud.value = `${L.vb.toFixed(2)} mm${L.lascada ? ' · lascada' : ''}`
      vbBarra.value = Math.min(TORNO.vbLasca, L.vb)
      vbTexto.value = `${L.vb.toFixed(2)} mm`
      botaoEixo.textContent = L.eixoLigado ? '■ Desligar eixo (E)' : '▶ Ligar eixo (E)'
      botaoEixo.classList.toggle('ligado', L.eixoLigado)
      botaoLong.setAttribute('aria-pressed', String(L.automatico === 'longitudinal'))
      botaoTrans.setAttribute('aria-pressed', String(L.automatico === 'transversal'))
      marchas.querySelectorAll<HTMLButtonElement>('button').forEach((b) => { b.setAttribute('aria-pressed', String(Number(b.dataset.rpm) === L.rpm)); b.disabled = L.eixoLigado })
      pastilha.disabled = L.eixoLigado
      botaoAresta.disabled = L.eixoLigado
      const vcPonta = L.vcEm(Math.max(2 * L.rFerramenta, peca.diametroBrutoMm * 0.5))
      const dica = `${L.rpm} rpm dá vc ≈ ${n0(vcPonta)} m/min neste diâmetro. Faixa do ${material.nome.toLowerCase()}: ${material.vcFaixa.min}–${material.vcFaixa.max} m/min.`
      if (vcDica.textContent !== dica) vcDica.textContent = dica
      status.textContent = L.eixoLigado ? `● EIXO ${L.rpm} rpm` : '○ EIXO PARADO'
      if (agora - objetivoMs > 300) {
        objetivoMs = agora
        const md = medidasTorno(L, peca)
        const seguro = L.quebras + L.colisoes + L.medicoesInseguras === 0
        // Medidas da peça não aparecem aqui: o operador descobre com os instrumentos (null = neutro).
        const itens: [boolean | null, string][] = peca.alvo
          ? [
            [md.faceRemovidaMm >= peca.alvo.facearMinMm, md.faceRemovidaMm > 0 ? 'faceada' : '—'],
            [null, 'meça (micrômetro)'],
            [null, 'meça (paquímetro)'],
            [null, 'meça (rugosímetro)'],
            [seguro, seguro ? 'ok' : `${L.quebras + L.colisoes + L.medicoesInseguras}×`],
          ]
          : [[L.volumeRemovidoMm3 > 0, `${n1(L.volumeRemovidoMm3 / 1000)} cm³`], [seguro, seguro ? 'ok' : `${L.quebras + L.colisoes}×`]]
        itens.forEach(([ok, t], i) => { if (ok === null) delete itensObjetivo[i].li.dataset.ok; else itensObjetivo[i].li.dataset.ok = String(ok); if (itensObjetivo[i].valor.textContent !== t) itensObjetivo[i].valor.textContent = t })
      }
      vista.desenhar(L, pode ? dt : 0)
      pedido = requestAnimationFrame(quadro)
    }
    pedido = requestAnimationFrame(quadro)
    return () => { cancelAnimationFrame(pedido); soltar(); tamanho.disconnect(); ouvintes.forEach((f) => f()); vista.destruir() }
  }, op.contexto ?? 'Treino · Torno')
}
