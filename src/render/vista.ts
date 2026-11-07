import { geometriaDa, type GeometriaJunta } from '../modelo/junta'
import { PECA } from '../modelo/parametros'

/**
 * Converte entre a tela (pixels CSS) e a peça. A peça pode GIRAR em torno do
 * seu centro (H42) e a junta pode ter vários formatos (H41):
 *   tela ⇄ chapa (X, Y em mm, girada) ⇄ junta (s, n).
 * O modelo só vê (s, n). Na junta reta sem giro, (s, n) = (X, Y) e a
 * conversão é a mesma das etapas 1–7.
 */
export class Vista {
  escala = 1
  larguraCss = 0
  alturaCss = 0
  /** Giro da peça (radianos; positivo = sentido horário na tela). */
  angulo = 0
  private geo: GeometriaJunta = geometriaDa('reta')
  private cx = 0
  private cy = 0

  /**
   * O zoom enquadra a JUNTA sem giro (com folga para a régua e as marcas),
   * não a chapa inteira, e não muda ao girar: a peça não encolhe; girada, as
   * pontas podem sair da tela, como numa câmera fixa.
   */
  ajustar(larguraCss: number, alturaCss: number): void {
    this.larguraCss = larguraCss
    this.alturaCss = alturaCss
    this.cx = larguraCss / 2
    this.cy = alturaCss / 2
    const c = this.geometria.caixa
    const folgaMm = 34
    const margemPx = 16
    this.escala = Math.max(
      0.5,
      Math.min(
        (larguraCss - 2 * margemPx) / (c.xMax - c.xMin + 2 * folgaMm),
        (alturaCss - 2 * margemPx) / (c.yMax - c.yMin + 2 * folgaMm),
      ),
    )
  }

  /** Formato da junta (H41); trocar refaz o enquadramento. */
  get geometria(): GeometriaJunta {
    return this.geo
  }

  set geometria(g: GeometriaJunta) {
    this.geo = g
    if (this.larguraCss > 0) this.ajustar(this.larguraCss, this.alturaCss)
  }

  /** Gira a peça (H42) em torno do pivô: o centro da chapa, ou o centro da junta circular (posicionador). */
  definirAngulo(angulo: number): void {
    this.angulo = angulo
  }

  private pivo(): { x: number; y: number } {
    return this.geometria.centro ?? { x: PECA.comprimentoMm / 2, y: 0 }
  }

  /** Chapa (X, Y) → tela. */
  daChapa(X: number, Y: number): { x: number; y: number } {
    const p = this.pivo()
    const sx = this.cx + (p.x - PECA.comprimentoMm / 2) * this.escala
    const sy = this.cy + p.y * this.escala
    const dx = (X - p.x) * this.escala
    const dy = (Y - p.y) * this.escala
    const c = Math.cos(this.angulo)
    const s = Math.sin(this.angulo)
    return { x: sx + dx * c - dy * s, y: sy + dx * s + dy * c }
  }

  /** Tela → chapa (X, Y). */
  paraChapa(px: number, py: number): { x: number; y: number } {
    const p = this.pivo()
    const dx = px - (this.cx + (p.x - PECA.comprimentoMm / 2) * this.escala)
    const dy = py - (this.cy + p.y * this.escala)
    const c = Math.cos(this.angulo)
    const s = Math.sin(this.angulo)
    return { x: (dx * c + dy * s) / this.escala + p.x, y: (-dx * s + dy * c) / this.escala + p.y }
  }

  /** Junta (s, n) → tela. */
  ponto(s: number, n = 0): { x: number; y: number } {
    const p = this.geometria.pontoEm(s, n)
    return this.daChapa(p.x, p.y)
  }

  /** Direção da junta em s, já na tela (radianos). */
  rumoNaTela(s: number): number {
    return this.geometria.rumoEm(s) + this.angulo
  }

  /** Tela → junta (s, n): é o que as fontes de entrada mandam para o modelo. */
  paraPeca(px: number, py: number): { x: number; y: number } {
    const p = this.paraChapa(px, py)
    return this.geometria.projetar(p.x, p.y)
  }

  // Atalhos das etapas 1–7 (só valem na junta reta sem giro).
  px(xMm: number): number {
    return this.daChapa(xMm, 0).x
  }

  py(yMm: number): number {
    return this.daChapa(0, yMm).y
  }

  xMm(px: number): number {
    return this.paraChapa(px, this.cy).x
  }

  yMm(py: number): number {
    return this.paraChapa(this.cx, py).y
  }
}
