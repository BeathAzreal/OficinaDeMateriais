import { PECA } from './parametros'

/*
 * Formato da junta vista de cima (H41). Função pura: converte posições na
 * chapa (X, Y em mm) para coordenadas da junta (s, n) e de volta.
 *   s = distância percorrida ao longo da junta (0 a 150 mm);
 *   n = desvio lateral, na perpendicular (positivo à direita de quem avança,
 *       que na junta reta é "para baixo" na tela, como o y das etapas 1–7).
 * A chapa ocupa X de 0 a 150 mm e Y de −50 a 50 mm; a junta reta vai de
 * (0, 0) a (150, 0), então nela (s, n) = (X, Y) e nada muda no modelo.
 */

export type FormatoJunta = 'reta' | 'curva' | 'canto' | 'circular'
export const FORMATOS: FormatoJunta[] = ['reta', 'curva', 'canto', 'circular']

export const INFO_FORMATO: Record<FormatoJunta, { nome: string; resumo: string }> = {
  reta: { nome: 'Reta', resumo: 'Junta reta: a referência.' },
  curva: { nome: 'Curva em S', resumo: 'Duas curvas suaves: acompanhe a junta sem mudar a velocidade.' },
  canto: { nome: 'Canto', resumo: 'Junta em L com canto arredondado: cuidado para não parar na virada.' },
  circular: { nome: 'Circular', resumo: 'Quase uma volta completa, como uma tampa: gire a peça para facilitar.' },
}

type Trecho = { tipo: 'linha'; comprimento: number } | { tipo: 'arco'; raio: number; angulo: number }

const L = PECA.comprimentoMm
/** Raio mínimo de curvatura de todos os formatos (H41). */
export const RAIO_MINIMO_MM = 15

const TRECHOS: Record<FormatoJunta, Trecho[]> = {
  reta: [{ tipo: 'linha', comprimento: L }],
  curva: [
    { tipo: 'linha', comprimento: (L - 2 * 40 * 0.7) / 2 },
    { tipo: 'arco', raio: 40, angulo: -0.7 },
    { tipo: 'arco', raio: 40, angulo: 0.7 },
    { tipo: 'linha', comprimento: (L - 2 * 40 * 0.7) / 2 },
  ],
  canto: [
    { tipo: 'linha', comprimento: 60 },
    { tipo: 'arco', raio: RAIO_MINIMO_MM, angulo: Math.PI / 2 },
    { tipo: 'linha', comprimento: L - 60 - (RAIO_MINIMO_MM * Math.PI) / 2 },
  ],
  circular: [{ tipo: 'arco', raio: L / (2 * Math.PI * 0.9), angulo: 2 * Math.PI * 0.9 }],
}

const PASSO_MM = 0.25

export class GeometriaJunta {
  readonly comprimentoMm = L
  /** Pontos da linha da junta a cada PASSO_MM (X, Y na chapa). */
  readonly pontos: { x: number; y: number }[]
  /** Centro da circunferência (só no formato circular), para o desenho da tampa. */
  readonly centro: { x: number; y: number; raio: number } | null = null

  constructor(readonly formato: FormatoJunta) {
    const pts: { x: number; y: number }[] = [{ x: 0, y: 0 }]
    let x = 0
    let y = 0
    let rumo = 0
    let centro: { x: number; y: number; raio: number } | null = null
    for (const t of TRECHOS[formato]) {
      const comprimento = t.tipo === 'linha' ? t.comprimento : t.raio * Math.abs(t.angulo)
      const n = Math.round(comprimento / PASSO_MM)
      if (t.tipo === 'arco') {
        const lado = Math.sign(t.angulo)
        centro = { x: x - lado * Math.sin(rumo) * t.raio, y: y + lado * Math.cos(rumo) * t.raio, raio: t.raio }
      }
      for (let k = 1; k <= n; k++) {
        if (t.tipo === 'linha') {
          x += Math.cos(rumo) * (comprimento / n)
          y += Math.sin(rumo) * (comprimento / n)
        } else {
          const c = centro!
          const lado = Math.sign(t.angulo)
          rumo += t.angulo / n
          x = c.x + lado * Math.sin(rumo) * t.raio
          y = c.y - lado * Math.cos(rumo) * t.raio
        }
        pts.push({ x, y })
      }
    }
    // Centraliza o desenho na chapa (centro em X = 75, Y = 0).
    const xs = pts.map((p) => p.x)
    const ys = pts.map((p) => p.y)
    const dx = L / 2 - (Math.min(...xs) + Math.max(...xs)) / 2
    const dy = -(Math.min(...ys) + Math.max(...ys)) / 2
    this.pontos = pts.map((p) => ({ x: p.x + dx, y: p.y + dy }))
    if (formato === 'circular' && centro) this.centro = { x: centro.x + dx, y: centro.y + dy, raio: centro.raio }
    // Pequenas sobras de arredondamento: a última amostra fecha exatamente em L.
    this.passo = L / (this.pontos.length - 1)
    // No circular, as pontas só se prolongam até o meio da abertura; senão o
    // prolongamento do fim "rouba" pontos do começo.
    const a = this.pontos[0]
    const b = this.pontos[this.pontos.length - 1]
    this.prolongamentoMaxMm = formato === 'circular' ? Math.hypot(b.x - a.x, b.y - a.y) / 2 : 40
  }

  private readonly prolongamentoMaxMm: number

  /** Retângulo que contém a linha da junta (na chapa, sem giro). */
  get caixa(): { xMin: number; xMax: number; yMin: number; yMax: number } {
    const xs = this.pontos.map((p) => p.x)
    const ys = this.pontos.map((p) => p.y)
    return { xMin: Math.min(...xs), xMax: Math.max(...xs), yMin: Math.min(...ys), yMax: Math.max(...ys) }
  }

  private readonly passo: number

  /** Ponto da chapa em (s, n). Fora de [0, L], continua em linha reta pela tangente. */
  pontoEm(s: number, n = 0): { x: number; y: number } {
    const { i, f } = this.segmento(s)
    const a = this.pontos[i]
    const b = this.pontos[i + 1]
    const comp = Math.hypot(b.x - a.x, b.y - a.y)
    const tx = (b.x - a.x) / comp
    const ty = (b.y - a.y) / comp
    return { x: a.x + (b.x - a.x) * f - ty * n, y: a.y + (b.y - a.y) * f + tx * n }
  }

  /** Direção da junta em s (radianos, no sistema da chapa). */
  rumoEm(s: number): number {
    const { i } = this.segmento(s)
    const a = this.pontos[i]
    const b = this.pontos[i + 1]
    return Math.atan2(b.y - a.y, b.x - a.x)
  }

  /** Converte (X, Y) da chapa para (s, n) pelo ponto mais próximo da junta. */
  projetar(X: number, Y: number): { x: number; y: number } {
    const ult = this.pontos.length - 2
    let melhor = Infinity
    let s = 0
    let n = 0
    for (let i = 0; i <= ult; i++) {
      const a = this.pontos[i]
      const b = this.pontos[i + 1]
      const vx = b.x - a.x
      const vy = b.y - a.y
      const comp2 = vx * vx + vy * vy
      let u = ((X - a.x) * vx + (Y - a.y) * vy) / comp2
      // Só as pontas continuam além da junta (pela tangente), até um limite.
      const extra = this.prolongamentoMaxMm / Math.sqrt(comp2)
      u = i > 0 ? Math.max(0, u) : Math.max(-extra, u)
      u = i < ult ? Math.min(1, u) : Math.min(1 + extra, u)
      const px = a.x + vx * u
      const py = a.y + vy * u
      const d2 = (X - px) ** 2 + (Y - py) ** 2
      if (d2 < melhor) {
        melhor = d2
        const comp = Math.sqrt(comp2)
        s = (i + u) * this.passo
        n = ((X - px) * -vy + (Y - py) * vx) / comp
      }
    }
    return { x: s, y: n }
  }

  private segmento(s: number): { i: number; f: number } {
    const ult = this.pontos.length - 2
    const k = s / this.passo
    const i = Math.min(ult, Math.max(0, Math.floor(k)))
    return { i, f: k - i }
  }
}

const cache = new Map<FormatoJunta, GeometriaJunta>()
export function geometriaDa(formato: FormatoJunta = 'reta'): GeometriaJunta {
  let g = cache.get(formato)
  if (!g) cache.set(formato, (g = new GeometriaJunta(formato)))
  return g
}
