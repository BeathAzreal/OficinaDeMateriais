import { fatorApc, MATERIAIS_TORNO, type FormaCavaco, type MaterialTorno, type MaterialTornoId } from './materiais'

/*
 * Torno convencional didático (v2.2, H108). O jogador move a ferramenta com
 * as mãos (manivelas) ou liga o avanço automático; a física responde em
 * tempo real, como o calor da solda:
 * - a peça é um perfil de raio r(z) em células de 0,05 mm, com z medido da
 *   face da placa (z = 0) até a face livre;
 * - a ponta da ferramenta (círculo de raio rε) e o resto da aresta (largura
 *   `larguraArestaMm`) cortam o que estiver acima deles;
 * - do movimento saem o avanço por volta (f), a velocidade de corte (vc), a
 *   seção do cavaco, a força (Kienzle), a potência, o desgaste (Taylor), a
 *   rugosidade (f²/8rε, com aresta postiça, desgaste e vibração) e a
 *   vibração da peça em balanço;
 * - erros têm consequência: encostar com o eixo parado ou bater na placa
 *   quebra a ferramenta; carga demais para o motor faz o eixo parar.
 * Números do jogo (comportamento qualitativo), não de catálogo.
 */

export const TORNO = {
  /** Marchas do cabeçote (rpm): trocar só com o eixo parado. */
  rotacoes: [90, 180, 280, 450, 710, 1120, 1800] as readonly number[],
  /** Avanços da caixa Norton (mm/volta) para o avanço automático. */
  avancos: [0.05, 0.08, 0.12, 0.16, 0.2, 0.25, 0.3] as readonly number[],
  potenciaW: 4000,
  /** Abaixo desta rotação o motor não entrega a potência toda (torque limitado). */
  rotacaoPlenaRpm: 710,
  passoMm: 0.05,
  /** Aresta atrás da ponta que também corta (faceamento, mergulho). */
  larguraArestaMm: 3,
  /** Profundidade máxima da pastilha e força que a quebra. */
  apMaxMm: 4,
  forcaMaxN: 3800,
  vbLimite: 0.3,
  vbLasca: 0.6,
  /** Velocidades das manivelas (mm/s): normal, rápido (Shift) e fino (Ctrl). */
  manivela: { normal: 2.5, rapido: 12, fino: 0.4 },
  /** Placa: castanhas até este raio acima da peça e esta profundidade. */
  placa: { folgaRaioMm: 14 },
  /** Subpasso fixo: o resultado não depende da taxa de quadros. */
  passoS: 1 / 240,
  /** Rigidez do conjunto carro + porta-ferramenta (N/mm) e parte radial da força (Fp ≈ 0,4·Fc). */
  rigidezMaquinaNmm: 20000,
  fracaoRadial: 0.4,
  /** Quanto o desgaste recua a aresta no raio (mm por mm de VB). */
  recuoPorVb: 0.1,
  /** Quanto a ponta pode passar do centro da peça (mm). */
  alemDoCentroMm: 1.5,
  /** Esbeltez acima da qual a peça em balanço pode vibrar. */
  esbeltezVibra: 2.5,
} as const

export type EventoTorno = 'quebrou' | 'colisao-placa' | 'sobrecarga' | 'lascou' | 'medicao-insegura' | 'vibrando'

/** Fatores que pioraram a Ra numa célula (bits). */
export const CAUSA = { avanco: 1, apc: 2, desgaste: 4, vibracao: 8, lascada: 16 } as const

export interface PecaBruta {
  material: MaterialTornoId
  diametroMm: number
  /** Comprimento fora da placa (mm). */
  balancoMm: number
}

export class ModeloTorno {
  readonly material: MaterialTorno
  readonly raioBruto: number
  readonly balanco: number
  readonly n: number
  /** Raio da peça em cada célula (0 = sem material, além da face livre). */
  readonly raio: Float32Array
  /** Rugosidade Ra (µm) da última passada em cada célula; NaN = superfície bruta. */
  readonly ra: Float32Array
  /** Fatores que pioraram a Ra em cada célula (CAUSA). */
  readonly causa: Uint8Array

  // Máquina.
  eixoLigado = false
  rpm: number = TORNO.rotacoes[4]
  avancoMmVolta: number = TORNO.avancos[3]
  /** Avanço automático: longitudinal (para a placa) ou transversal (para o centro). */
  automatico: 'longitudinal' | 'transversal' | null = null
  /** Raio de ponta da pastilha (mm). */
  raioPonta = 0.8

  // Ferramenta: ponta (o ponto mais baixo do raio de ponta).
  zFerramenta: number
  rFerramenta: number
  /** Velocidade pedida pelas manivelas (mm/s). */
  vZ = 0
  vR = 0
  vb = 0
  lascada = false
  quebrada = false

  // Leituras do último subpasso.
  cortando = false
  vcMMin = 0
  fMmVolta = 0
  apMm = 0
  forcaN = 0
  potenciaW = 0
  vibrando = false
  /** Quanto a peça sai acima da ponta no raio (mm): deflexão (força do último passo) e recuo da aresta gasta. */
  afastamentoMm = 0
  cavaco: { forma: FormaCavaco; azul: boolean; taxaMm3S: number } = { forma: 'fita', azul: false, taxaMm3S: 0 }

  // Registro.
  tempoS = 0
  tempoCorteS = 0
  tempoVcBoaS = 0
  volumeRemovidoMm3 = 0
  quebras = 0
  colisoes = 0
  sobrecargas = 0
  lascas = 0
  trocasAresta = 0
  medicoesInseguras = 0
  /** Vezes que a peça entrou em vibração. */
  episodiosVibracao = 0

  private resto = 0
  private vibrandoAntes = false

  constructor(readonly peca: PecaBruta) {
    this.material = MATERIAIS_TORNO[peca.material]
    this.raioBruto = peca.diametroMm / 2
    this.balanco = peca.balancoMm
    this.n = Math.round(peca.balancoMm / TORNO.passoMm) + 1
    this.raio = new Float32Array(this.n).fill(this.raioBruto)
    this.ra = new Float32Array(this.n).fill(NaN)
    this.causa = new Uint8Array(this.n)
    this.zFerramenta = peca.balancoMm + 6
    this.rFerramenta = this.raioBruto + 4
  }

  /** z (mm, da placa) da célula i. */
  zDe(i: number): number { return i * TORNO.passoMm }
  celula(z: number): number { return Math.round(z / TORNO.passoMm) }
  raioEm(z: number): number {
    const i = this.celula(z)
    return i < 0 ? this.raioBruto : i >= this.n ? 0 : this.raio[i]
  }
  /** Posição da face livre (mm da placa). */
  get zFace(): number {
    for (let i = this.n - 1; i >= 0; i--) if (this.raio[i] > 0.01) return this.zDe(i)
    return 0
  }
  /** Velocidade de corte num diâmetro (m/min). */
  vcEm(diametroMm: number): number { return (Math.PI * diametroMm * this.rpm) / 1000 }

  /** Trocar marcha: só com o eixo parado (devolve false se recusou). */
  trocarRotacao(rpm: number): boolean {
    if (this.eixoLigado) return false
    this.rpm = rpm
    return true
  }
  trocarAresta(): boolean {
    if (this.eixoLigado) return false
    this.vb = 0
    this.lascada = false
    this.quebrada = false
    this.trocasAresta++
    return true
  }
  trocarPastilha(raioPonta: number): boolean {
    if (this.eixoLigado) return false
    this.raioPonta = raioPonta
    this.vb = 0
    this.lascada = false
    this.quebrada = false
    return true
  }
  /** Medir com o eixo girando é proibido na oficina: conta e não deixa medir. */
  podeMedir(eventos?: (e: EventoTorno) => void): boolean {
    if (!this.eixoLigado) return true
    this.medicoesInseguras++
    eventos?.('medicao-insegura')
    return false
  }

  avancar(dt: number, eventos?: (e: EventoTorno) => void): void {
    if (!(dt > 0)) return
    this.resto += Math.min(dt, 0.25)
    while (this.resto >= TORNO.passoS) {
      this.resto -= TORNO.passoS
      this.passo(TORNO.passoS, eventos)
    }
  }

  private passo(dt: number, eventos?: (e: EventoTorno) => void): void {
    this.tempoS += dt
    // Movimento: avanço automático (f · n) ou manivelas.
    let vz = this.vZ, vr = this.vR
    if (this.automatico && this.eixoLigado) {
      const v = (this.avancoMmVolta * this.rpm) / 60
      if (this.automatico === 'longitudinal') { vz = -v; vr = 0 } else { vz = 0; vr = -v }
    }
    this.zFerramenta += vz * dt
    // A ponta pode passar um pouco do centro (faceamento limpo); o avanço transversal para ali sozinho.
    this.rFerramenta = Math.max(-TORNO.alemDoCentroMm, this.rFerramenta + vr * dt)
    if (this.automatico === 'transversal' && this.rFerramenta <= -this.raioPonta) this.automatico = null
    const velocidade = Math.hypot(vz, vr)

    // Placa: a ferramenta bateu nas castanhas.
    if (this.zFerramenta - this.raioPonta < 0 && this.rFerramenta < this.raioBruto + TORNO.placa.folgaRaioMm) {
      this.zFerramenta = this.raioPonta
      this.automatico = null
      this.colidir('colisao-placa', eventos)
    }

    // O que a ferramenta toca: o raio de ponta do lado da placa e a aresta reta atrás da ponta.
    const [i0, i1] = this.alcance()
    let volume = 0, rMax = 0, diametro = 0, naCasca = false, tocou = false
    const cortadas: number[] = []
    for (let i = i0; i <= i1; i++) {
      const alvo = this.alvoEm(i)
      const r = this.raio[i]
      if (r <= alvo + 1e-6) continue
      tocou = true
      if (!this.eixoLigado || this.quebrada) continue
      const novo = Math.max(0, alvo)
      volume += Math.PI * (r * r - novo * novo) * TORNO.passoMm
      rMax = Math.max(rMax, r)
      diametro = Math.max(diametro, 2 * r)
      if (this.material.casca && r > this.raioBruto - this.material.casca.espessuraMm) naCasca = true
      this.raio[i] = novo
      cortadas.push(i)
    }
    // Encostar com o eixo parado (ou com a ferramenta quebrada empurrando a peça) quebra a ferramenta.
    if (tocou && !this.eixoLigado && velocidade > 0.05) this.colidir('quebrou', eventos)

    this.cortando = cortadas.length > 0
    if (!this.cortando) {
      this.afastamentoMm = TORNO.recuoPorVb * this.vb
      this.vcMMin = this.vcEm(2 * Math.max(this.rFerramenta, 0.1))
      this.fMmVolta = this.eixoLigado ? velocidade / Math.max(this.rpm / 60, 1e-6) : 0
      this.apMm = 0; this.forcaN = 0; this.potenciaW = 0; this.cavaco.taxaMm3S = 0
      this.vibrando = false
      this.vibrandoAntes = false
      return
    }

    // Corte: avanço, velocidade, seção, força e potência.
    // Profundidade de corte: do topo do material até a ponta. No avanço para a placa, o topo é o
    // material logo à frente da ferramenta (a célula que entra no corte pode não entrar neste subpasso).
    const rFrente = vz < 0 ? this.raioEm(this.zFerramenta - this.raioPonta - TORNO.passoMm) : 0
    const ap = Math.max(0, Math.max(rMax, rFrente) - Math.max(0, this.rFerramenta + this.afastamentoMm))
    const voltasS = this.rpm / 60
    const f = Math.max(0.005, velocidade / voltasS)
    const vc = this.vcEm(diametro)
    const q = volume / dt
    // Seção do cavaco pela geometria: avanço × engajamento da aresta, na direção do movimento
    // (longitudinal: profundidade radial; transversal: largura axial em contato).
    const largura = cortadas.length * TORNO.passoMm
    const wz = velocidade > 1e-6 ? Math.abs(vz) / velocidade : 0.5, wr = velocidade > 1e-6 ? Math.abs(vr) / velocidade : 0.5
    const area = f * (wz * ap + wr * Math.min(largura, TORNO.larguraArestaMm))
    const kc = this.material.kc11 * Math.max(f, 0.01) ** -this.material.mc
    const forca = kc * area
    const potencia = (forca * vc) / 60
    this.vcMMin = vc; this.fMmVolta = f; this.apMm = ap; this.forcaN = forca; this.potenciaW = potencia
    // Deflexão: a força radial empurra a ferramenta (máquina) e a peça em balanço (viga engastada).
    const fp = TORNO.fracaoRadial * forca, L = Math.max(this.zFerramenta, 1), I = (Math.PI * diametro ** 4) / 64
    const deflexao = fp / TORNO.rigidezMaquinaNmm + (fp * L ** 3) / (3 * this.material.moduloE * Math.max(I, 1))
    this.afastamentoMm = deflexao + TORNO.recuoPorVb * this.vb
    this.tempoCorteS += dt
    this.volumeRemovidoMm3 += volume
    if (vc >= this.material.vcFaixa.min && vc <= this.material.vcFaixa.max) this.tempoVcBoaS += dt

    // Ferramenta: profundidade ou força demais quebram; motor sem força para.
    if (ap > TORNO.apMaxMm || forca > TORNO.forcaMaxN) { this.colidir('quebrou', eventos); return }
    const disponivel = TORNO.potenciaW * Math.min(1, this.rpm / TORNO.rotacaoPlenaRpm)
    if (potencia > disponivel) {
      this.eixoLigado = false
      this.automatico = null
      this.sobrecargas++
      eventos?.('sobrecarga')
      return
    }

    // Desgaste (Taylor do jogo); a carepa gasta mais.
    const m = this.material
    const vida = m.vidaRefS * (m.vcRef / Math.max(vc, 1)) ** m.expoente
    this.vb += (TORNO.vbLimite * dt) / vida * (naCasca && m.casca ? m.casca.desgaste : 1)
    if (!this.lascada && this.vb > TORNO.vbLasca) { this.lascada = true; this.lascas++; eventos?.('lascou') }

    // Vibração da peça em balanço: esbelta e com seção grande de cavaco.
    const esbeltez = this.zFerramenta / Math.max(diametro, 1)
    this.vibrando = esbeltez > TORNO.esbeltezVibra && area > 0.6 / (esbeltez - 1.5)
    if (this.vibrando && !this.vibrandoAntes) { this.episodiosVibracao++; eventos?.('vibrando') }
    this.vibrandoAntes = this.vibrando

    // Rugosidade: teórica f²/(8 rε), piorada pela aresta postiça, desgaste, vibração e lasca.
    const teorica = ((f * f) / (8 * this.raioPonta)) * 1000
    const apc = fatorApc(m, vc)
    let ra = Math.max(m.raMinimo, teorica) * (1 + apc) * (1 + 2 * Math.min(this.vb, 0.6)) * (this.vibrando ? 2.5 : 1) * (this.lascada ? 3 : 1)
    ra = Math.min(ra, 25)
    let causa = 0
    if (teorica > m.raMinimo * 1.5) causa |= CAUSA.avanco
    if (apc > 0.3) causa |= CAUSA.apc
    if (this.vb > 0.15) causa |= CAUSA.desgaste
    if (this.vibrando) causa |= CAUSA.vibracao
    if (this.lascada) causa |= CAUSA.lascada
    for (const i of cortadas) { this.ra[i] = ra; this.causa[i] = causa }

    // Cavaco: a forma depende do material, do avanço e da aresta postiça.
    const c = m.cavaco
    const forma: FormaCavaco = c.forma === 'fita' && c.quebraAcimaF !== null && f >= c.quebraAcimaF ? 'espiral' : c.forma
    this.cavaco = { forma, azul: c.azulaAcimaVc !== null && vc >= c.azulaAcimaVc, taxaMm3S: q }
  }

  /** Células que a ferramenta alcança. */
  private alcance(): [number, number] {
    const z0 = this.zFerramenta - this.raioPonta, z1 = this.zFerramenta + TORNO.larguraArestaMm
    return [Math.max(0, Math.ceil(z0 / TORNO.passoMm)), Math.min(this.n - 1, Math.floor(z1 / TORNO.passoMm))]
  }
  /** Raio que a ferramenta deixa na célula i: arco da ponta à frente (lado da placa), reto atrás. */
  private alvoEm(i: number): number {
    const d = this.zDe(i) - this.zFerramenta, re = this.raioPonta
    const base = this.rFerramenta + this.afastamentoMm
    return d < 0 ? base + re - Math.sqrt(Math.max(0, re * re - d * d)) : base
  }
  /** A ferramenta está encostada na peça agora. */
  encostada(): boolean {
    const [i0, i1] = this.alcance()
    for (let i = i0; i <= i1; i++) if (this.raio[i] > this.alvoEm(i) + 1e-6) return true
    return false
  }
  /** Liga ou desliga a placa. Ligar com a ferramenta encostada quebra a ferramenta. */
  alternarEixo(eventos?: (e: EventoTorno) => void): void {
    if (this.eixoLigado) { this.eixoLigado = false; this.automatico = null; return }
    if (this.encostada()) { this.colidir('quebrou', eventos); return }
    this.eixoLigado = true
  }

  private colidir(e: 'quebrou' | 'colisao-placa', eventos?: (e: EventoTorno) => void): void {
    if (this.quebrada) return
    this.quebrada = true
    this.automatico = null
    this.eixoLigado = false
    if (e === 'colisao-placa') this.colisoes++
    else this.quebras++
    eventos?.(e)
  }

  /** Diâmetro na posição z (mm). */
  diametroEm(z: number): number { return 2 * this.raioEm(z) }
  raEm(z: number): number | null {
    const i = this.celula(z)
    if (i < 0 || i >= this.n) return null
    return Number.isNaN(this.ra[i]) ? null : this.ra[i]
  }
}
