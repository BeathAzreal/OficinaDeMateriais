import type { AnaliseMovimento } from '../modelo/movimento'
import { PECA } from '../modelo/parametros'

/*
 * Gráficos ao longo da junta usados na inspeção. Só desenham o que a
 * avaliação já calculou; não fazem conta de modelo.
 */

const COR = {
  fundo: '#16181b',
  grade: '#2a2e33',
  texto: '#9aa1a8',
  textoForte: '#e4e7ea',
  linha: '#7fb2ff',
  alvo: 'rgba(63, 159, 107, 0.28)',
  selecao: '#e4e7ea',
}

const fmt = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

/** Ajusta o canvas à densidade de pixels e devolve o contexto em pixels CSS. */
export function prepararCanvas(canvas: HTMLCanvasElement): { ctx: CanvasRenderingContext2D; w: number; h: number } {
  const dpr = window.devicePixelRatio || 1
  const w = canvas.clientWidth
  const h = canvas.clientHeight
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
    canvas.width = Math.round(w * dpr)
    canvas.height = Math.round(h * dpr)
  }
  const ctx = canvas.getContext('2d')!
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  return { ctx, w, h }
}

const MARGEM = { esq: 44, dir: 12, topo: 12, base: 28 }

function tetoBonito(v: number): number {
  return Math.max(8, Math.ceil((v * 1.15) / 2) * 2)
}

interface Plano {
  ctx: CanvasRenderingContext2D
  w: number
  h: number
  util: { w: number; h: number }
  px: (x: number) => number
  py: (v: number) => number
}

/**
 * Fundo, grade e eixos comuns aos gráficos ao longo da junta. O eixo x é
 * sempre 0–150 mm, para os gráficos ficarem alinhados um sobre o outro.
 */
function prepararPlano(canvas: HTMLCanvasElement, yMax: number, unidade: string): Plano {
  const { ctx, w, h } = prepararCanvas(canvas)
  const util = { w: w - MARGEM.esq - MARGEM.dir, h: h - MARGEM.topo - MARGEM.base }
  const px = (x: number) => MARGEM.esq + (x / PECA.comprimentoMm) * util.w
  const py = (v: number) => MARGEM.topo + util.h - (v / yMax) * util.h

  ctx.fillStyle = COR.fundo
  ctx.fillRect(0, 0, w, h)
  ctx.font = '11px system-ui, sans-serif'
  ctx.lineWidth = 1
  const passoY = yMax <= 12 ? 2 : yMax <= 24 ? 4 : yMax <= 48 ? 8 : 16
  ctx.textAlign = 'right'
  ctx.textBaseline = 'middle'
  for (let v = 0; v <= yMax; v += passoY) {
    ctx.strokeStyle = COR.grade
    ctx.beginPath()
    ctx.moveTo(MARGEM.esq, Math.round(py(v)) + 0.5)
    ctx.lineTo(w - MARGEM.dir, Math.round(py(v)) + 0.5)
    ctx.stroke()
    ctx.fillStyle = COR.texto
    ctx.fillText(`${v}${unidade}`, MARGEM.esq - 6, py(v))
  }
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  for (let x = 0; x <= PECA.comprimentoMm; x += 25) ctx.fillText(`${x}`, px(x), h - MARGEM.base + 6)
  ctx.textAlign = 'right'
  ctx.fillText('posição na junta (mm)', w - MARGEM.dir, h - 13)
  return { ctx, w, h, util, px, py }
}

function linhaVertical(p: Plano, xMm: number, cor: string, largura: number): void {
  const x = Math.round(p.px(xMm)) + 0.5
  p.ctx.strokeStyle = cor
  p.ctx.lineWidth = largura
  p.ctx.beginPath()
  p.ctx.moveTo(x, MARGEM.topo)
  p.ctx.lineTo(x, MARGEM.topo + p.util.h)
  p.ctx.stroke()
}

/** Caixa de dica ao lado de x (vira para a esquerda perto da borda). */
function caixaDica(p: Plano, x: number, linhas: string[]): void {
  const { ctx } = p
  ctx.font = '12px system-ui, sans-serif'
  const largura = Math.max(...linhas.map((l) => ctx.measureText(l).width)) + 16
  const altura = linhas.length * 16 + 10
  const cx = x + 12 + largura > p.w ? x - 12 - largura : x + 12
  ctx.fillStyle = 'rgba(29, 32, 36, 0.95)'
  ctx.strokeStyle = '#3a3f46'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.roundRect(cx, MARGEM.topo + 4, largura, altura, 4)
  ctx.fill()
  ctx.stroke()
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  linhas.forEach((l, k) => {
    ctx.fillStyle = k === 0 ? COR.texto : COR.textoForte
    ctx.fillText(l, cx + 8, MARGEM.topo + 10 + k * 16)
  })
}

/**
 * Velocidade efetiva por trecho de 5 mm (H20), em barras alinhadas com o
 * perfil de largura. A faixa verde é a faixa-alvo do jogo para o ajuste usado
 * (só quando a tentativa teve um único ajuste).
 */
export function desenharVelocidades(
  canvas: HTMLCanvasElement,
  mov: AnaliseMovimento,
  faixa: { minMms: number; maxMms: number } | null,
  xCorteMm: number | null,
  xHoverMm: number | null,
): void {
  const valores = mov.trechos.map((t) => t.velocidadeMms ?? 0)
  const p = prepararPlano(canvas, tetoBonito(Math.max(...valores, faixa?.maxMms ?? 0)), '')
  const { ctx, px, py } = p
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  ctx.fillStyle = COR.texto
  ctx.fillText('mm/s', 4, 2)

  if (faixa) {
    ctx.fillStyle = COR.alvo
    ctx.fillRect(MARGEM.esq, py(faixa.maxMms), p.util.w, py(faixa.minMms) - py(faixa.maxMms))
  }

  const pausas = new Set(mov.pausas)
  for (const t of mov.trechos) {
    const x0 = px(t.inicioMm) + 1
    const largura = Math.max(1, px(t.fimMm) - px(t.inicioMm) - 2)
    if (t.velocidadeMms === null) {
      ctx.fillStyle = COR.texto
      ctx.textAlign = 'center'
      ctx.textBaseline = 'bottom'
      ctx.fillText('—', x0 + largura / 2, py(0) - 2)
      continue
    }
    const topo = py(t.velocidadeMms)
    ctx.fillStyle = COR.linha
    ctx.beginPath()
    ctx.roundRect(x0, topo, largura, py(0) - topo, [3, 3, 0, 0])
    ctx.fill()
    if (pausas.has(t)) {
      ctx.fillStyle = COR.textoForte
      ctx.textAlign = 'center'
      ctx.textBaseline = 'bottom'
      ctx.fillText('pausa', x0 + largura / 2, topo - 2)
    }
  }

  // Média (comprimento ÷ tempo).
  ctx.setLineDash([4, 4])
  ctx.strokeStyle = 'rgba(228, 231, 234, 0.6)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(MARGEM.esq, Math.round(py(mov.velocidadeMediaMms)) + 0.5)
  ctx.lineTo(p.w - MARGEM.dir, Math.round(py(mov.velocidadeMediaMms)) + 0.5)
  ctx.stroke()
  ctx.setLineDash([])

  if (xCorteMm !== null) linhaVertical(p, xCorteMm, COR.selecao, 1.5)
  if (xHoverMm === null) return
  const t = mov.trechos.find((tr) => xHoverMm >= tr.inicioMm && xHoverMm < tr.fimMm)
  if (!t) return
  caixaDica(p, px((t.inicioMm + t.fimMm) / 2), [
    `${fmt.format(t.inicioMm)} a ${fmt.format(t.fimMm)} mm`,
    t.velocidadeMms === null ? 'tocha não passou com arco' : `${fmt.format(t.velocidadeMms)} mm/s`,
    `${fmt.format(t.permanenciaMs / 1000)} s neste trecho`,
  ])
}
