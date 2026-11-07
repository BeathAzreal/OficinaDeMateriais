import type { Cordao, SecaoLocal } from '../modelo/cordao'
import { MATERIAIS, type Material } from '../modelo/material'
import { EQUILIBRIO, PECA } from '../modelo/parametros'
import type { Percurso } from '../modelo/percurso'
import { equilibrioArco, movimentoDe, oscilacaoVisual, type ContextoProcesso } from '../modelo/processo'
import type { EstadoTocha } from '../modelo/simulacao'
import { desenharArco, desenharBrilho, desenharHaloCalor, desenharPoca, desenharTintaTermica, taxaFaiscas, type Escamas, type Particulas } from './efeitos'
import type { Vista } from './vista'

export interface DadosCena {
  cordao: Cordao
  estado: EstadoTocha
  escamas: Escamas
  agoraMs: number
  ponteiroDentro: boolean
  /** Opcionais (missões): material, trecho exigido e tolerância do desenho. */
  contexto?: ContextoProcesso
  percurso?: Percurso
  missao?: { inicioMm: number; fimMm: number; alinhamentoMm: number }
  /** Faíscas e fumaça (H43); sem isto a cena fica estática (inspeção, replay). */
  particulas?: Particulas
  /** Som do arco (H45); só nas telas ao vivo. */
  som?: { atualizar(soldando: boolean, desvio: number, tolerancia: number): void }
}

/** Riscos de "chapa escovada", gerados uma vez com sorteio fixo. */
const riscos = (() => {
  let semente = 7
  const sorteio = () => (semente = (semente * 16807) % 2147483647) / 2147483647
  return Array.from({ length: 90 }, () => {
    const x0 = sorteio() * PECA.comprimentoMm
    return {
      y: (sorteio() * 2 - 1) * PECA.larguraChapaMm,
      x0,
      x1: Math.min(PECA.comprimentoMm, x0 + 10 + sorteio() * 60),
      alfa: 0.04 + sorteio() * 0.08,
    }
  })
})()

export function desenharCena(ctx: CanvasRenderingContext2D, vista: Vista, d: DadosCena): void {
  ctx.fillStyle = '#17191c'
  ctx.fillRect(0, 0, vista.larguraCss, vista.alturaCss)

  const material = d.contexto ? MATERIAIS[d.contexto.material] : undefined
  desenharChapas(ctx, vista, material)
  desenharRegua(ctx, vista)
  if (d.missao) desenharMarcasMissao(ctx, vista, d.missao)
  if (material?.aparencia.tintaTermica && d.percurso && d.contexto) desenharTintaTermica(ctx, vista, d.cordao, d.percurso, d.contexto)
  desenharHaloCalor(ctx, vista, d.cordao, d.agoraMs, d.estado.aquecimento, material?.aparencia.brilhoFraco ? 0.35 : 1)
  desenharCordao(ctx, vista, d.cordao, material?.aparencia.cordao ?? CAMADAS_PADRAO)
  d.escamas.desenhar(ctx, vista, d.cordao)
  desenharBrilho(ctx, vista, d.cordao, d.agoraMs, material?.aparencia.brilhoFraco ? 0.25 : 1)

  const p0 = d.estado.posicao
  // H39: o vaivém da tocha é só desenho; o modelo usa o espalhamento médio.
  const osc = p0 && d.estado.arcoAberto && d.contexto ? oscilacaoVisual(movimentoDe(d.contexto), d.agoraMs) : { dx: 0, dy: 0 }
  const tela = p0 ? vista.ponto(p0.x + osc.dx, p0.y + osc.dy) : null
  const soldando = !!(tela && p0 && d.estado.arcoAberto && d.estado.sobreAPeca)
  if (soldando) {
    const { desvio } = equilibrioArco(d.estado.ajustes, d.contexto)
    const s = d.cordao.secao(d.cordao.indiceEm(p0!.x))
    desenharPoca(ctx, vista, tela!.x, tela!.y, s.larguraMm, vista.rumoNaTela(p0!.x), material?.aparencia.brilhoFraco ? 0.5 : 1)
    desenharArco(ctx, vista, tela!.x, tela!.y, desvio)
  }
  d.som?.atualizar(soldando, equilibrioArco(d.estado.ajustes, d.contexto).desvio, EQUILIBRIO.tolerancia)
  if (d.particulas) {
    // H43: mais faíscas com CO₂ puro (mesma fonte de H29) e com o arco fora do equilíbrio (só visual).
    const taxa = taxaFaiscas(d.contexto, equilibrioArco(d.estado.ajustes, d.contexto).desvio)
    d.particulas.atualizar(d.agoraMs, soldando ? tela : null, vista.escala, taxa)
    d.particulas.desenhar(ctx)
  }
  if (tela && d.ponteiroDentro) desenharTocha(ctx, vista, tela.x, tela.y, d.estado.arcoAberto)
}

/** Linha (polilinha) ao longo da junta, em n fixo, de s0 a s1. */
function caminho(ctx: CanvasRenderingContext2D, vista: Vista, s0: number, s1: number, n: number): void {
  ctx.beginPath()
  for (let s = s0; ; s += 1) {
    const q = vista.ponto(Math.min(s, s1), n)
    if (s === s0) ctx.moveTo(q.x, q.y)
    else ctx.lineTo(q.x, q.y)
    if (s >= s1) break
  }
}

/** Traço perpendicular à junta em s, de n0 a n1. */
function tracoNormal(ctx: CanvasRenderingContext2D, vista: Vista, s: number, n0: number, n1: number): void {
  const a = vista.ponto(s, n0)
  const b = vista.ponto(s, n1)
  ctx.beginPath()
  ctx.moveTo(a.x, a.y)
  ctx.lineTo(b.x, b.y)
  ctx.stroke()
}

/** Início e fim do trecho exigido e faixa de tolerância de alinhamento (desenho da missão). */
function desenharMarcasMissao(ctx: CanvasRenderingContext2D, vista: Vista, m: { inicioMm: number; fimMm: number; alinhamentoMm: number }): void {
  ctx.save()
  ctx.strokeStyle = 'rgba(255, 196, 64, 0.85)'
  ctx.fillStyle = 'rgba(255, 196, 64, 0.95)'
  ctx.lineWidth = 2
  ctx.font = 'bold 11px system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  for (const [x, rotulo] of [[m.inicioMm, 'INÍCIO'], [m.fimMm, 'FIM']] as const) {
    tracoNormal(ctx, vista, x, -14, -4)
    tracoNormal(ctx, vista, x, 4, 14)
    const q = vista.ponto(x, -19)
    ctx.fillText(rotulo, q.x, q.y)
  }
  ctx.setLineDash([4, 5])
  ctx.lineWidth = 1
  ctx.strokeStyle = 'rgba(255, 196, 64, 0.45)'
  for (const y of [-m.alinhamentoMm, m.alinhamentoMm]) {
    caminho(ctx, vista, m.inicioMm, m.fimMm, y)
    ctx.stroke()
  }
  ctx.restore()
}

function poligonoChapa(ctx: CanvasRenderingContext2D, vista: Vista, x0: number, x1: number, y0: number, y1: number): void {
  ctx.beginPath()
  for (const [x, y] of [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]) {
    const q = vista.daChapa(x, y)
    ctx.lineTo(q.x, q.y)
  }
  ctx.closePath()
}

function desenharChapas(ctx: CanvasRenderingContext2D, vista: Vista, material?: Material): void {
  const L = PECA.comprimentoMm
  const W = PECA.larguraChapaMm
  const fresta = 0.4 // mm, só para a junta aparecer
  const reta = vista.geometria.formato === 'reta'
  const a = vista.daChapa(L / 2, -W)
  const b = vista.daChapa(L / 2, W)
  const g = ctx.createLinearGradient(a.x, a.y, b.x, b.y)
  g.addColorStop(0, material?.aparencia.chapaClara ?? '#9aa1a8')
  g.addColorStop(0.5, material?.aparencia.chapaEscura ?? '#7f868d')
  g.addColorStop(1, material?.aparencia.chapaClara ?? '#9aa1a8')

  // Na reta são duas chapas; nos outros formatos, uma chapa recortada pela junta.
  const pecas: [number, number][] = reta ? [[-W, -fresta], [fresta, W]] : [[-W, W]]
  for (const [y0, y1] of pecas) {
    poligonoChapa(ctx, vista, 0, L, y0, y1)
    ctx.fillStyle = g
    ctx.fill()
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.45)'
    ctx.lineWidth = 1
    ctx.stroke()
  }

  const c = vista.geometria.centro
  if (c) {
    // Tampa circular: um tom levemente diferente dentro da junta.
    const q = vista.daChapa(c.x, c.y)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.06)'
    ctx.beginPath()
    ctx.arc(q.x, q.y, c.raio * vista.escala, 0, Math.PI * 2)
    ctx.fill()
  }

  ctx.lineWidth = 1
  for (const r of riscos) {
    const p0 = vista.daChapa(r.x0, r.y)
    const p1 = vista.daChapa(r.x1, r.y)
    ctx.strokeStyle = `rgba(255, 255, 255, ${r.alfa})`
    ctx.beginPath()
    ctx.moveTo(p0.x, p0.y)
    ctx.lineTo(p1.x, p1.y)
    ctx.stroke()
  }

  // Linha da junta (a fresta entre as bordas).
  ctx.save()
  ctx.lineJoin = 'round'
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)'
  ctx.lineWidth = Math.max(1, (2 * fresta + 0.8) * vista.escala)
  caminho(ctx, vista, 0, L, 0)
  ctx.stroke()
  ctx.strokeStyle = '#2b2f34'
  ctx.lineWidth = Math.max(1, 2 * fresta * vista.escala)
  ctx.stroke()
  ctx.restore()
}

/** Marcas a cada 10 mm AO LONGO da junta (ajudam a perceber a velocidade). */
function desenharRegua(ctx: CanvasRenderingContext2D, vista: Vista): void {
  ctx.save()
  ctx.strokeStyle = 'rgba(230, 233, 237, 0.55)'
  ctx.fillStyle = 'rgba(230, 233, 237, 0.75)'
  ctx.font = '10px system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.lineWidth = 1
  for (let x = 0; x <= PECA.comprimentoMm; x += 10) {
    const grande = x % 50 === 0
    tracoNormal(ctx, vista, x, -20, grande ? -25 : -22.5)
    if (grande) {
      const q = vista.ponto(x, -29)
      ctx.fillText(`${x}`, q.x, q.y)
    }
  }
  ctx.restore()
}

/** Desenha o cordão como "curvas de nível" claras no centro (lembra o domo da H3). */
function desenharCordao(ctx: CanvasRenderingContext2D, vista: Vista, cordao: Cordao, cores: readonly string[]): void {
  const secoes = Array.from({ length: cordao.nPosicoes }, (_, i) => cordao.secao(i))
  const LIMIAR_MM = 0.3
  let i = 0
  while (i < secoes.length) {
    if (secoes[i].larguraMm < LIMIAR_MM) {
      i++
      continue
    }
    let j = i
    while (j + 1 < secoes.length && secoes[j + 1].larguraMm >= LIMIAR_MM) j++
    desenharTrecho(ctx, vista, secoes.slice(i, j + 1), cores)
    i = j + 1
  }
}

/** Sem material (modo livre das etapas 1–4): o cinza original. */
const CAMADAS_PADRAO = ['#5b6169', '#858c94', '#b0b6bc', '#dfe3e6'] as const
const FRACOES = [1, 0.72, 0.42, 0.14]

function desenharTrecho(ctx: CanvasRenderingContext2D, vista: Vista, s: SecaoLocal[], cores: readonly string[]): void {
  for (const [k0, fracao] of FRACOES.entries()) {
    const cor = cores[k0]
    ctx.beginPath()
    s.forEach((p, k) => {
      const q = vista.ponto(p.xMm, p.yCentroMm - (fracao * p.larguraMm) / 2)
      if (k === 0) ctx.moveTo(q.x, q.y)
      else ctx.lineTo(q.x, q.y)
    })
    for (let k = s.length - 1; k >= 0; k--) {
      const q = vista.ponto(s[k].xMm, s[k].yCentroMm + (fracao * s[k].larguraMm) / 2)
      ctx.lineTo(q.x, q.y)
    }
    ctx.closePath()
    ctx.fillStyle = cor
    ctx.fill()
    if (fracao === 1) {
      ctx.strokeStyle = 'rgba(20, 22, 25, 0.6)'
      ctx.lineWidth = 1
      ctx.stroke()
    }
  }
}

function desenharTocha(ctx: CanvasRenderingContext2D, vista: Vista, cx: number, cy: number, soldando: boolean): void {
  const raio = 7 * vista.escala
  ctx.save()
  ctx.strokeStyle = soldando ? 'rgba(40, 40, 40, 0.55)' : 'rgba(235, 238, 242, 0.85)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.arc(cx, cy, raio, 0, Math.PI * 2)
  ctx.stroke()
  if (!soldando) {
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(cx - raio * 0.5, cy)
    ctx.lineTo(cx + raio * 0.5, cy)
    ctx.moveTo(cx, cy - raio * 0.5)
    ctx.lineTo(cx, cy + raio * 0.5)
    ctx.stroke()
  }
  ctx.restore()
}
