import type { SecaoLocal } from '../modelo/cordao'
import { DESCRICAO_ESTADO, type EstadoFusao, type PontoFusao } from '../modelo/fusao'
import { PECA } from '../modelo/parametros'
import { prepararCanvas } from './graficos'

/*
 * Perfil de largura das missões: largura do modelo, faixa de largura do
 * desenho, trecho exigido e uma faixa com a previsão de fusão (sintética).
 * As cores da faixa de fusão vêm sempre acompanhadas de legenda com texto e
 * da lista de trechos na tela — a informação não depende só da cor.
 */

export const COR_ESTADO: Record<EstadoFusao, string> = {
  adequada: '#3f9f6b',
  falta: '#5b8de0',
  excessiva: '#e0a33a',
  perfuracao: '#e05a4f',
  enchimento: '#d77fa1',
  borda: '#b07cd8',
  'sem-cordao': '#3a3f46',
}

/** Padrão de texto curto para cada estado (aparece na faixa quando há espaço). */
export const SIGLA_ESTADO: Record<EstadoFusao, string> = {
  adequada: 'OK',
  falta: 'FF',
  excessiva: 'EX',
  perfuracao: 'PF',
  enchimento: 'EN',
  borda: 'BD',
  'sem-cordao': '—',
}

const M = { esq: 44, dir: 12, topo: 12, base: 52 }
const fmt = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

export function xMmNoPerfilMissao(pxCss: number, larguraCss: number): number {
  const util = larguraCss - M.esq - M.dir
  return Math.min(PECA.comprimentoMm, Math.max(0, ((pxCss - M.esq) / util) * PECA.comprimentoMm))
}

export function desenharPerfilMissao(
  canvas: HTMLCanvasElement,
  secoes: SecaoLocal[],
  fusao: PontoFusao[],
  req: { larguraMinMm: number; larguraMaxMm: number },
  trecho: { inicioMm: number; fimMm: number },
  xCorte: number | null,
  xHover: number | null,
): void {
  const { ctx, w, h } = prepararCanvas(canvas)
  const util = { w: w - M.esq - M.dir, h: h - M.topo - M.base }
  const yMax = Math.max(12, Math.ceil((Math.max(...secoes.map((s) => s.larguraMm)) * 1.15) / 2) * 2)
  const px = (x: number) => M.esq + (x / PECA.comprimentoMm) * util.w
  const py = (v: number) => M.topo + util.h - (v / yMax) * util.h

  ctx.fillStyle = '#16181b'
  ctx.fillRect(0, 0, w, h)
  ctx.font = '11px system-ui, sans-serif'
  ctx.lineWidth = 1
  ctx.textAlign = 'right'
  ctx.textBaseline = 'middle'
  const passo = yMax <= 12 ? 2 : yMax <= 24 ? 4 : 8
  for (let v = 0; v <= yMax; v += passo) {
    ctx.strokeStyle = '#2a2e33'
    ctx.beginPath()
    ctx.moveTo(M.esq, Math.round(py(v)) + 0.5)
    ctx.lineTo(w - M.dir, Math.round(py(v)) + 0.5)
    ctx.stroke()
    ctx.fillStyle = '#9aa1a8'
    ctx.fillText(`${v} mm`, M.esq - 6, py(v))
  }

  // Faixa de largura do desenho no trecho exigido.
  ctx.fillStyle = 'rgba(63, 159, 107, 0.25)'
  ctx.fillRect(px(trecho.inicioMm), py(req.larguraMaxMm), px(trecho.fimMm) - px(trecho.inicioMm), py(req.larguraMinMm) - py(req.larguraMaxMm))
  ctx.strokeStyle = 'rgba(255, 196, 64, 0.8)'
  for (const x of [trecho.inicioMm, trecho.fimMm]) {
    ctx.beginPath()
    ctx.moveTo(Math.round(px(x)) + 0.5, M.topo)
    ctx.lineTo(Math.round(px(x)) + 0.5, M.topo + util.h)
    ctx.stroke()
  }

  // Largura do modelo.
  ctx.beginPath()
  secoes.forEach((s, k) => (k === 0 ? ctx.moveTo(px(s.xMm), py(s.larguraMm)) : ctx.lineTo(px(s.xMm), py(s.larguraMm))))
  ctx.strokeStyle = '#7fb2ff'
  ctx.lineWidth = 2
  ctx.stroke()

  // Faixa de previsão de fusão (sintética).
  const yFaixa = M.topo + util.h + 8
  const altura = 14
  for (const p of fusao) {
    ctx.fillStyle = COR_ESTADO[p.estado]
    ctx.fillRect(px(p.xMm - 0.25), yFaixa, Math.max(1, px(0.5) - px(0)), altura)
  }
  ctx.fillStyle = '#9aa1a8'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  ctx.fillText('fusão prevista (sintética) — ver lista de trechos', M.esq, yFaixa + altura + 4)
  ctx.textAlign = 'right'
  for (let x = 0; x <= PECA.comprimentoMm; x += 25) ctx.fillText(`${x}`, px(x) + 6, yFaixa + altura + 20)

  const linhaV = (x: number, cor: string, largura: number) => {
    ctx.strokeStyle = cor
    ctx.lineWidth = largura
    ctx.beginPath()
    ctx.moveTo(Math.round(px(x)) + 0.5, M.topo)
    ctx.lineTo(Math.round(px(x)) + 0.5, yFaixa + altura)
    ctx.stroke()
  }
  if (xCorte !== null) linhaV(xCorte, '#e4e7ea', 1.5)
  if (xHover === null) return
  const i = Math.min(secoes.length - 1, Math.max(0, Math.floor(xHover / (PECA.comprimentoMm / secoes.length))))
  const s = secoes[i]
  const f = fusao[i]
  linhaV(s.xMm, 'rgba(228,231,234,0.4)', 1)
  const linhas = [`x = ${fmt(s.xMm)} mm`, s.larguraMm >= 1 ? `largura ${fmt(s.larguraMm)} mm · reforço ${fmt(s.alturaMm)} mm` : 'sem cordão', `F = ${fmt(f.indice)} · ${DESCRICAO_ESTADO[f.estado]}`]
  ctx.font = '12px system-ui, sans-serif'
  const lw = Math.max(...linhas.map((l) => ctx.measureText(l).width)) + 16
  const x0 = px(s.xMm) + 12 + lw > w ? px(s.xMm) - 12 - lw : px(s.xMm) + 12
  ctx.fillStyle = 'rgba(29, 32, 36, 0.95)'
  ctx.strokeStyle = '#3a3f46'
  ctx.beginPath()
  ctx.roundRect(x0, M.topo + 4, lw, linhas.length * 16 + 10, 4)
  ctx.fill()
  ctx.stroke()
  ctx.textAlign = 'left'
  linhas.forEach((l, k) => {
    ctx.fillStyle = k === 0 ? '#9aa1a8' : '#e4e7ea'
    ctx.fillText(l, x0 + 8, M.topo + 10 + k * 16)
  })
}
