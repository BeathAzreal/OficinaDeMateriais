import type { Cordao } from '../modelo/cordao'
import { aporteNecessario } from '../modelo/fusao'
import type { Percurso } from '../modelo/percurso'
import { EQUILIBRIO } from '../modelo/parametros'
import type { ContextoProcesso } from '../modelo/processo'
import type { PontoRegistro } from '../modelo/simulacao'
import type { Vista } from './vista'

/*
 * EFEITOS PURAMENTE VISUAIS (H8, H43).
 * Nada daqui alimenta o modelo nem qualquer avaliação. O brilho não é um
 * campo de temperatura calculado, as "escamas" não vêm de um modelo de
 * solidificação e as faíscas não são contagem de respingo: servem só para a
 * cena ser legível e reagir ao que o jogador faz.
 */

/** A cada quanto tempo de arco desenhamos uma escama (ilustrativo). */
const INTERVALO_ESCAMA_MS = 80
/** Tempo característico do esmaecimento do brilho (ilustrativo). */
export const TAU_BRILHO_MS = 1200
/** O halo na chapa esfria mais devagar que o brilho do cordão (ilustrativo). */
export const TAU_HALO_MS = TAU_BRILHO_MS * 4

/** "Quão recente" é o metal: 1 = agora, cai a zero com τ (só desenho). */
export function recencia(agoraMs: number, tUltimoMs: number, tauMs: number = TAU_BRILHO_MS): number {
  return tUltimoMs === -Infinity ? 0 : Math.exp(-(agoraMs - tUltimoMs) / tauMs)
}

/** Alcance do halo de calor além da borda do cordão (mm), pelo aquecimento acumulado (H32, H43). */
export function alcanceHalo(aquecimento: number): number {
  return 3 + 9 * Math.min(1.5, aquecimento)
}

/**
 * Taxa relativa de faíscas (H43): mais com CO₂ puro (mesma fonte de H29) e
 * com o arco fora do equilíbrio. Só visual; a mesma no 2D e no 3D.
 */
export function taxaFaiscas(contexto: ContextoProcesso | undefined, desvio: number): number {
  const excesso = contexto ? Math.max(0, Math.abs(desvio) - EQUILIBRIO.tolerancia) : 0
  return (contexto?.gas === 'co2' ? 1.6 : 1) * (1 + excesso)
}

/** Faíscas e fumaça por segundo de arco com taxa 1 (ilustrativo). */
export const FAISCAS_POR_S = 70
export const FUMACA_POR_S = 9

/**
 * Largura extra da faixa de coloração térmica do inox ao lado do cordão na
 * fatia i (mm, H8): média do aporte em ±4 fatias, relativa ao necessário.
 */
export function extraTintaTermica(aportes: ArrayLike<number>, i: number, passoMm: number, necessario: number): number {
  let soma = 0
  let n = 0
  for (let k = Math.max(0, i - 4); k <= Math.min(aportes.length - 1, i + 4); k++) {
    soma += aportes[k]
    n++
  }
  return Math.min(8, 1.5 * (soma / n / passoMm / necessario))
}

interface Escama {
  x: number
  /** Sentido de avanço quando a escama foi marcada. */
  dir: 1 | -1
}

/** Quadrilátero de uma fatia do cordão, de n0 a n1, entre s0 e s1. */
function fatia(ctx: CanvasRenderingContext2D, vista: Vista, s0: number, s1: number, n0: number, n1: number): void {
  const a = vista.ponto(s0, n0)
  const b = vista.ponto(s1, n0)
  const c = vista.ponto(s1, n1)
  const d = vista.ponto(s0, n1)
  ctx.beginPath()
  ctx.moveTo(a.x, a.y)
  ctx.lineTo(b.x, b.y)
  ctx.lineTo(c.x, c.y)
  ctx.lineTo(d.x, d.y)
  ctx.closePath()
  ctx.fill()
}

/**
 * Marca escamas em intervalos iguais de TEMPO DE ARCO. Como o tempo é fixo,
 * o espaçamento entre elas acompanha a velocidade de avanço: devagar → juntas,
 * rápido → espaçadas. Lê o registro da simulação, então não depende dos quadros.
 */
export class Escamas {
  private marcas: Escama[] = []
  private indice = 0
  private proxima = INTERVALO_ESCAMA_MS
  private direcao: 1 | -1 = 1
  private registroAtual: PontoRegistro[] | null = null

  atualizar(registro: PontoRegistro[]): void {
    if (registro !== this.registroAtual) {
      this.marcas = []
      this.indice = 0
      this.proxima = INTERVALO_ESCAMA_MS
      this.registroAtual = registro
    }
    while (this.indice + 1 < registro.length) {
      const a = registro[this.indice]
      const b = registro[this.indice + 1]
      if (b.x !== a.x) this.direcao = b.x > a.x ? 1 : -1
      const duracao = b.tempoArcoMs - a.tempoArcoMs
      while (this.proxima <= b.tempoArcoMs) {
        const f = duracao > 0 ? Math.min(1, Math.max(0, (this.proxima - a.tempoArcoMs) / duracao)) : 1
        this.marcas.push({ x: a.x + (b.x - a.x) * f, dir: this.direcao })
        this.proxima += INTERVALO_ESCAMA_MS
      }
      this.indice++
    }
  }

  desenhar(ctx: CanvasRenderingContext2D, vista: Vista, cordao: Cordao): void {
    ctx.save()
    ctx.strokeStyle = 'rgba(35, 38, 44, 0.45)'
    ctx.lineWidth = 1
    for (const m of this.marcas) {
      const s = cordao.secao(cordao.indiceEm(m.x))
      if (s.larguraMm < 1.5) continue
      const meia = s.larguraMm * 0.42
      // O vértice da escama aponta para trás (para onde a tocha já passou).
      const a = vista.ponto(m.x, s.yCentroMm - meia)
      const c = vista.ponto(m.x - m.dir * s.larguraMm * 0.5, s.yCentroMm)
      const b = vista.ponto(m.x, s.yCentroMm + meia)
      ctx.beginPath()
      ctx.moveTo(a.x, a.y)
      ctx.quadraticCurveTo(c.x, c.y, b.x, b.y)
      ctx.stroke()
    }
    ctx.restore()
  }
}

const PARADAS_BRILHO: readonly (readonly [number, number, number, number])[] = [
  [0, 110, 20, 10],
  [0.4, 225, 75, 20],
  [0.75, 255, 175, 60],
  [1, 255, 245, 205],
]

/**
 * Cor do metal quente para "quão recente" (1 = agora, 0 = frio): vermelho
 * escuro → laranja → amarelo → quase branco. Escreve [r, g, b] (0–255) e a
 * opacidade em `saida`, sem alocar (o 3D chama por vértice).
 */
export function brilhoRGBA(r: number, alfa: number, saida: number[]): number[] {
  let k = 1
  while (k < PARADAS_BRILHO.length - 1 && r > PARADAS_BRILHO[k][0]) k++
  const a = PARADAS_BRILHO[k - 1]
  const b = PARADAS_BRILHO[k]
  const f = Math.min(1, Math.max(0, (r - a[0]) / (b[0] - a[0])))
  for (let c = 1; c <= 3; c++) saida[c - 1] = Math.round(a[c] + (b[c] - a[c]) * f)
  saida[3] = Math.min(1, r * 1.2) * alfa
  return saida
}

/** Cor do brilho para "quão recente" (1 = agora, 0 = frio). */
function corBrilho(r: number, alfa = 0.85): string {
  const [cr, cg, cb, a] = brilhoRGBA(r, alfa, [0, 0, 0, 0])
  return `rgba(${cr}, ${cg}, ${cb}, ${a.toFixed(3)})`
}

/**
 * Brilho sobre o metal recém-depositado, que esmaece com o tempo.
 * `intensidade` < 1 para o alumínio, que quase não muda de cor ao aquecer.
 */
export function desenharBrilho(ctx: CanvasRenderingContext2D, vista: Vista, cordao: Cordao, agoraMs: number, intensidade = 1): void {
  ctx.save()
  ctx.globalAlpha = intensidade
  const p = cordao.passoMm
  for (let i = 0; i < cordao.nPosicoes; i++) {
    const s = cordao.secao(i)
    if (s.larguraMm < 0.5 || s.tUltimoDepositoMs === -Infinity) continue
    const r = recencia(agoraMs, s.tUltimoDepositoMs)
    if (r < 0.03) continue
    ctx.fillStyle = corBrilho(r)
    const largura = s.larguraMm * (0.55 + 0.35 * r)
    fatia(ctx, vista, s.xMm - p / 2 - 0.1, s.xMm + p / 2 + 0.1, s.yCentroMm - largura / 2, s.yCentroMm + largura / 2)
  }
  ctx.restore()
}

/**
 * Halo de calor na chapa em volta do trecho recém-soldado (H43): mais largo
 * quanto maior o aquecimento acumulado da peça (H32). Só visual.
 */
export function desenharHaloCalor(ctx: CanvasRenderingContext2D, vista: Vista, cordao: Cordao, agoraMs: number, aquecimento: number, intensidade = 1): void {
  if (aquecimento <= 0.02) return
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  const p = cordao.passoMm
  const alcance = alcanceHalo(aquecimento)
  for (let i = 0; i < cordao.nPosicoes; i += 2) {
    const s = cordao.secao(i)
    if (s.larguraMm < 0.5 || s.tUltimoDepositoMs === -Infinity) continue
    const r = recencia(agoraMs, s.tUltimoDepositoMs, TAU_HALO_MS)
    if (r < 0.04) continue
    for (const [fator, alfa] of [[1, 0.06], [0.55, 0.09]] as const) {
      const meia = s.larguraMm / 2 + alcance * fator * r
      ctx.fillStyle = `rgba(255, 110, 40, ${(alfa * r * intensidade).toFixed(3)})`
      fatia(ctx, vista, s.xMm - p, s.xMm + p + 0.1, s.yCentroMm - meia, s.yCentroMm + meia)
    }
  }
  ctx.restore()
}

/**
 * Coloração térmica ao lado do cordão de inox (só visual, H8): faixa mais
 * larga onde entrou mais calor por mm. Não é medida de temperatura.
 */
export function desenharTintaTermica(ctx: CanvasRenderingContext2D, vista: Vista, cordao: Cordao, percurso: Percurso, contexto: ContextoProcesso): void {
  const aportes = percurso.copiaDosAportes()
  const necessario = aporteNecessario(contexto)
  const p = cordao.passoMm
  ctx.save()
  for (let i = 0; i < cordao.nPosicoes; i++) {
    const s = cordao.secao(i)
    if (s.larguraMm < 1) continue
    // Média local simples (±4 fatias) só para a faixa não piscar.
    const extra = extraTintaTermica(aportes, i, p, necessario)
    for (const [fator, cor] of [[1, 'rgba(90, 96, 170, 0.35)'], [0.55, 'rgba(201, 160, 80, 0.45)']] as const) {
      const meia = s.larguraMm / 2 + extra * fator
      ctx.fillStyle = cor
      fatia(ctx, vista, s.xMm - p / 2 - 0.1, s.xMm + p / 2 + 0.1, s.yCentroMm - meia, s.yCentroMm + meia)
    }
  }
  ctx.restore()
}

/**
 * Clarão do arco: cintila de propósito, é só ambientação.
 *
 * `desvio` é tensão − tensão de equilíbrio do jogo (H10). Ele só muda o
 * DESENHO: arco longo → clarão maior e mais difuso; arco curto → menor e
 * mais concentrado. `cx`, `cy` já estão em pixels da tela.
 */
/** Como o clarão do arco aparece num quadro (só desenho, H45). Medidas em mm. */
export interface EstiloArco {
  /** Raio do clarão. */
  raioMm: number
  /** Fração central branca do degradê. */
  nucleo: number
  /** Opacidade (cai quando o arco curto "engasga"). */
  alfa: number
  /** Deslocamento do arco longo que "passeia". */
  dxMm: number
  dyMm: number
  /** Tamanho relativo (1 = equilibrado): maior no arco longo. */
  tamanho: number
}

/**
 * Sorteio do clarão de um quadro a partir do `desvio` (tensão − tensão de
 * equilíbrio do jogo, H10): arco curto engasga (piscadas, clarão menor e
 * mais concentrado); longo fica maior, difuso e passeia. Usado pela vista
 * de cima e pela 3D, para as duas reagirem do mesmo jeito.
 */
export function estiloArco(desvio: number, aleatorio: () => number = Math.random): EstiloArco {
  const curto = Math.min(1, Math.max(0, (-desvio - 0.5) / 2.5))
  const longo = Math.min(1, Math.max(0, (desvio - 0.5) / 2.5))
  const engasgo = curto > 0 && aleatorio() < 0.35 * curto
  const passeio = longo * 2
  const dxMm = (aleatorio() * 2 - 1) * passeio
  const dyMm = (aleatorio() * 2 - 1) * passeio
  const tamanho = Math.min(1.9, Math.max(0.5, 1 + 0.15 * desvio))
  const raioMm = 14 * tamanho * (0.88 + (0.24 + 0.5 * curto) * aleatorio())
  const nucleo = Math.min(0.3, Math.max(0.06, 0.12 / tamanho))
  return { raioMm, nucleo, alfa: engasgo ? 0.25 : 1, dxMm, dyMm, tamanho }
}

/**
 * Clarão do arco: cintila de propósito, é só ambientação.
 *
 * `desvio` é tensão − tensão de equilíbrio do jogo (H10). Ele só muda o
 * DESENHO: arco longo → clarão maior e mais difuso; arco curto → menor e
 * mais concentrado. `cx`, `cy` já estão em pixels da tela.
 */
export function desenharArco(ctx: CanvasRenderingContext2D, vista: Vista, cx: number, cy: number, desvio: number): void {
  const e = estiloArco(desvio)
  cx += e.dxMm * vista.escala
  cy += e.dyMm * vista.escala
  const raio = e.raioMm * vista.escala
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, raio)
  g.addColorStop(0, 'rgba(255, 255, 255, 0.95)')
  g.addColorStop(e.nucleo, 'rgba(215, 232, 255, 0.85)')
  g.addColorStop(0.45, 'rgba(130, 175, 255, 0.25)')
  g.addColorStop(1, 'rgba(90, 140, 255, 0)')
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  ctx.globalAlpha = e.alfa
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(cx, cy, raio, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

/** Poça brilhante sob a tocha, alongada no sentido da junta (só visual). */
export function desenharPoca(ctx: CanvasRenderingContext2D, vista: Vista, cx: number, cy: number, larguraMm: number, rumo: number, intensidade: number): void {
  const meia = Math.max(1.5, larguraMm / 2) * vista.escala
  ctx.save()
  ctx.translate(cx, cy)
  ctx.rotate(rumo)
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, meia * 1.6)
  g.addColorStop(0, `rgba(255, 250, 225, ${0.9 * intensidade})`)
  g.addColorStop(0.5, `rgba(255, 190, 80, ${0.6 * intensidade})`)
  g.addColorStop(1, 'rgba(255, 120, 30, 0)')
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.ellipse(-meia * 0.4, 0, meia * 1.6, meia, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

interface Particula {
  tipo: 'faisca' | 'fumaca'
  x: number
  y: number
  vx: number
  vy: number
  vida: number
  duracao: number
  tamanho: number
}

/**
 * Faíscas e fumaça (H43). Vivem em pixels da tela e são sorteadas a cada
 * quadro: não são guardadas nem contadas em lugar nenhum.
 */
export class Particulas {
  private lista: Particula[] = []
  private tAnterior: number | null = null
  private acumFaisca = 0
  private acumFumaca = 0

  /**
   * `emissor`: ponto do arco na tela (null = arco fechado). `taxa` multiplica
   * as faíscas (CO₂ puro e arco fora do equilíbrio soltam mais).
   */
  atualizar(agoraMs: number, emissor: { x: number; y: number } | null, escala: number, taxa: number): void {
    const dt = this.tAnterior === null ? 0 : Math.min(0.05, (agoraMs - this.tAnterior) / 1000)
    this.tAnterior = agoraMs
    if (emissor && dt > 0) {
      this.acumFaisca += dt * FAISCAS_POR_S * taxa
      this.acumFumaca += dt * FUMACA_POR_S
      while (this.acumFaisca >= 1) {
        this.acumFaisca--
        const ang = Math.random() * Math.PI * 2
        const v = (25 + Math.random() * 70) * escala
        this.lista.push({ tipo: 'faisca', x: emissor.x, y: emissor.y, vx: Math.cos(ang) * v, vy: Math.sin(ang) * v, vida: 0, duracao: 0.15 + Math.random() * 0.35, tamanho: 0.8 + Math.random() * 1.2 })
      }
      while (this.acumFumaca >= 1) {
        this.acumFumaca--
        this.lista.push({ tipo: 'fumaca', x: emissor.x + (Math.random() - 0.5) * 6, y: emissor.y, vx: (Math.random() - 0.5) * 10, vy: -12 - Math.random() * 14, vida: 0, duracao: 1.6 + Math.random() * 1.4, tamanho: 4 + Math.random() * 4 })
      }
    }
    for (const p of this.lista) {
      p.vida += dt
      p.x += p.vx * dt
      p.y += p.vy * dt
      if (p.tipo === 'faisca') {
        p.vx *= 1 - 2.5 * dt
        p.vy *= 1 - 2.5 * dt
      } else {
        p.tamanho += 9 * dt
      }
    }
    this.lista = this.lista.filter((p) => p.vida < p.duracao)
    if (this.lista.length > 600) this.lista.splice(0, this.lista.length - 600)
  }

  desenhar(ctx: CanvasRenderingContext2D): void {
    ctx.save()
    for (const p of this.lista) {
      const resto = 1 - p.vida / p.duracao
      if (p.tipo === 'fumaca') {
        ctx.fillStyle = `rgba(190, 195, 200, ${(0.12 * resto).toFixed(3)})`
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.tamanho, 0, Math.PI * 2)
        ctx.fill()
      }
    }
    ctx.globalCompositeOperation = 'lighter'
    ctx.lineCap = 'round'
    for (const p of this.lista) {
      if (p.tipo !== 'faisca') continue
      const resto = 1 - p.vida / p.duracao
      ctx.strokeStyle = `rgba(255, ${Math.round(150 + 90 * resto)}, ${Math.round(60 + 120 * resto)}, ${resto.toFixed(3)})`
      ctx.lineWidth = p.tamanho
      ctx.beginPath()
      ctx.moveTo(p.x, p.y)
      ctx.lineTo(p.x - p.vx * 0.03, p.y - p.vy * 0.03)
      ctx.stroke()
    }
    ctx.restore()
  }
}
