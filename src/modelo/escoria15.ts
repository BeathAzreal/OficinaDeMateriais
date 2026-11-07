export type FerramentaBancada15 = 'soldar' | 'martelo' | 'escova'
/** H63–H67: relações qualitativas SMAW; parâmetros sintéticos, sem qualificação de solda. */
export class Escoria15 {
  readonly colunas = 50
  readonly linhas = 34
  readonly quantidade = new Float64Array(1700)
  readonly calor = new Float64Array(1700)
  readonly fragmentos = new Float64Array(1700)
  inclusaoMm3 = 0
  gerada = 0
  private indice(x: number, y: number): number {
    return Math.max(0, Math.min(33, Math.floor((y + 50) / 3))) * 50 + Math.max(0, Math.min(49, Math.floor(x / 3)))
  }
  /** `raioMm` espalha o volume pelas células cujo centro está dentro do raio (largura do cordão). */
  depositar(x: number, y: number, volume: number, raioMm = 0): void {
    const alvos = raioMm > 0 ? this.celulasEm(x, y, raioMm) : []
    if (!alvos.length) alvos.push(this.indice(x, y))
    const parte = volume / alvos.length
    for (const i of alvos) {
      if (this.calor[i] < 0.15) this.inclusaoMm3 += this.quantidade[i] * parte
      const antes = this.quantidade[i]
      this.quantidade[i] = Math.min(1, this.quantidade[i] + parte / 5)
      this.gerada += this.quantidade[i] - antes
      this.fragmentos[i] = 0
      this.calor[i] = 1
    }
  }
  private celulasEm(x: number, y: number, raio: number): number[] {
    const r: number[] = []
    const c0 = Math.max(0, Math.floor((x - raio) / 3)), c1 = Math.min(49, Math.floor((x + raio) / 3))
    const l0 = Math.max(0, Math.floor((y - raio + 50) / 3)), l1 = Math.min(33, Math.floor((y + raio + 50) / 3))
    for (let l = l0; l <= l1; l++) for (let c = c0; c <= c1; c++) {
      if (Math.hypot(c * 3 + 1.5 - x, l * 3 - 48.5 - y) <= raio) r.push(l * 50 + c)
    }
    return r
  }
  /** Área coberta (mm²): cada célula tem 3 × 3 mm. */
  get areaMm2(): number { return this.cobertura * 9 }
  /** Fração da escória que ainda está quente demais para limpar. */
  get fracaoQuente(): number {
    let q = 0, t = 0
    for (let i = 0; i < this.quantidade.length; i++) { t += this.quantidade[i]; if (this.calor[i] > 0.15) q += this.quantidade[i] }
    return t > 0 ? q / t : 0
  }
  esfriar(dt: number): void {
    const fator = Math.exp(-dt / 2.2)
    for (let i = 0; i < this.calor.length; i++) this.calor[i] *= fator
  }
  martelar(x: number, y: number): number {
    let removido = 0
    for (let i = 0; i < this.quantidade.length; i++) {
      const px = (i % 50) * 3 + 1.5, py = Math.floor(i / 50) * 3 - 48.5
      if (Math.hypot(px - x, py - y) > 5 || this.calor[i] > 0.15) continue
      const crosta = Math.max(0, this.quantidade[i] - this.fragmentos[i])
      removido += crosta * 0.8
      this.quantidade[i] -= crosta * 0.8
      this.fragmentos[i] += crosta * 0.2
    }
    return removido
  }
  escovar(x: number, y: number): number {
    let removido = 0
    for (let i = 0; i < this.quantidade.length; i++) {
      const px = (i % 50) * 3 + 1.5, py = Math.floor(i / 50) * 3 - 48.5
      if (Math.hypot(px - x, py - y) > 8 || this.calor[i] > 0.15) continue
      removido += this.fragmentos[i]
      this.quantidade[i] = Math.max(0, this.quantidade[i] - this.fragmentos[i])
      if (this.quantidade[i] < 1e-10) this.quantidade[i] = 0
      this.fragmentos[i] = 0
    }
    return removido
  }
  get residuos(): number { return this.fragmentos.reduce((a, b) => a + b, 0) }
  get cobertura(): number { return this.quantidade.reduce((a, b) => a + b, 0) }
}
