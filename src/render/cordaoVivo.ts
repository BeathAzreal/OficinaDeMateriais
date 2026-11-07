import { padraoIrregular, type FormaCordao, type SecaoLocal } from '../modelo/cordao'
import { formaDomo, HUMPING, type AnaliseDefeitos } from '../modelo/defeitos'
import type { GeometriaJunta } from '../modelo/junta'
import { perfilNaJunta, pontoNaSuperficie, pontosDeBaixo, type DimensoesJunta, type TipoJunta } from '../modelo/juntas'
import { DIVISOES_PERFIL, LARGURA_MINIMA_3D_MM, paraMundo } from './malha3d'

/*
 * Malha do cordão AO VIVO (parte pura, sem Three nem DOM). Produz os mesmos
 * triângulos de malhaCordao() no topo reto (domo de H3, tampas e base) e o
 * perfil de cada junta nas outras (H46: V cheio ou aberto, filete com a
 * raiz), em buffers alocados uma vez: cada fatia tem lugares fixos para
 * seus vértices, e a cada quadro só as fatias que mudaram são reescritas.
 * Os índices só são refeitos quando uma fatia aparece ou some.
 *
 * Perfil de cada fatia: superfície do cordão (M + 1 pontos, da borda −n à
 * +n) e contorno de baixo (B pontos entre as bordas: 0 no topo reto, o V no
 * chanfro, a raiz no filete). Lugares da fatia i (V vértices a partir de i·V):
 *   anéis A, B, C: superfície em s = (i + ½)·passo, i·passo e (i + 1)·passo   3 × (M + 1)
 *   tampas inicial e final: centro + superfície + contorno de baixo           2 × (M + 2 + B)
 *   base: borda esquerda, contorno de baixo, borda direita, nos anéis A, B, C  3 × (B + 2)
 */

/** O que a malha viva precisa do cordão (a classe Cordao satisfaz). */
export interface FonteCordao {
  readonly nPosicoes: number
  readonly passoMm: number
  readonly forma?: FormaCordao | null
  secao(i: number): SecaoLocal
}

type Geo = Pick<GeometriaJunta, 'pontoEm' | 'rumoEm'>

/**
 * Trecho da junta onde pode ter caído metal desde o último quadro: do
 * último ponto do registro já visto (início do trecho seguinte) até o fim,
 * com a margem do espalhamento do depósito. Cobre quadros perdidos (aba
 * oculta, quadro lento), porque lê o registro, não só a tocha.
 * Devolve null se o registro está vazio.
 */
export function janelaDoRegistro(registro: readonly { x: number }[], lidos: number, margemMm: number): { s0: number; s1: number } | null {
  if (registro.length === 0) return null
  let s0 = Infinity
  let s1 = -Infinity
  for (let k = Math.max(0, Math.min(lidos, registro.length) - 1); k < registro.length; k++) {
    if (registro[k].x < s0) s0 = registro[k].x
    if (registro[k].x > s1) s1 = registro[k].x
  }
  return { s0: s0 - margemMm, s1: s1 + margemMm }
}

export class MalhaCordaoViva {
  readonly M: number
  /** Pontos do contorno de baixo (entre as bordas) de cada perfil. */
  readonly B: number
  /** Vértices por fatia. */
  readonly V: number
  readonly junta: TipoJunta
  readonly posicoes: Float32Array
  readonly normais: Float32Array
  /** |r| de cada vértice (0 na crista, 1 na borda): fixo, escolhe a cor da camada. */
  readonly raios: Float32Array
  readonly indices: Uint32Array
  /** Quantos índices valem (o resto do buffer não é desenhado). */
  nIndices = 0
  /** Faixa de vértices reescrita na última atualização: [inicioMudado, fimMudado). */
  inicioMudado = 0
  fimMudado = 0
  /** Os índices mudaram na última atualização. */
  indicesMudaram = false

  /** 1 se a fatia aparece (largura ≥ 0,3 mm). */
  readonly visivel: Uint8Array
  // Última forma conhecida de cada fatia (para saber o que mudou e para os efeitos de calor).
  readonly largura: Float64Array
  readonly altura: Float64Array
  readonly centro: Float64Array
  /** Pernas do filete (mm, lado +n e −n); zero nas juntas de chanfro (H46). */
  readonly perna1: Float64Array
  readonly perna2: Float64Array
  /** Último depósito de cada fatia (ms; −Infinity se nunca), para o brilho esfriar sem reler o cordão. */
  readonly tUltimo: Float64Array
  /** Defeitos visíveis aplicados na forma (H50–H56); null = cordão liso. */
  private defeitos: AnaliseDefeitos | null = null
  /** Reescrever todas as fatias na próxima atualização (os defeitos mudaram). */
  private forcar = false

  constructor(
    readonly nPosicoes: number,
    readonly passoMm: number,
    private readonly geo: Geo,
    divisoes = DIVISOES_PERFIL,
    private readonly forma: FormaCordao | null = null,
    /**
     * Cordão solto (H58): o domo fica apoiado na superfície das chapas desta
     * junta (chapa plana ou parede do filete), na posição lateral em que caiu.
     */
    private readonly superficie: { junta: TipoJunta; dimensoes: DimensoesJunta } | null = null,
  ) {
    const M = (this.M = divisoes)
    this.junta = forma?.junta ?? 'topo'
    const B = (this.B = pontosDeBaixo(this.junta))
    this.V = 3 * (M + 1) + 2 * (M + 2 + B) + 3 * (B + 2)
    const nV = nPosicoes * this.V
    this.posicoes = new Float32Array(nV * 3)
    this.normais = new Float32Array(nV * 3)
    this.raios = new Float32Array(nV)
    // Pior caso: toda fatia é um trecho sozinho (3 anéis, 2 tampas, 2 faixas de base).
    this.indices = new Uint32Array(nPosicoes * (2 * 6 * M + 2 * 3 * (M + 1 + B) + 2 * 6 * (B + 1)))
    this.visivel = new Uint8Array(nPosicoes)
    this.largura = new Float64Array(nPosicoes).fill(-1)
    this.altura = new Float64Array(nPosicoes)
    this.centro = new Float64Array(nPosicoes)
    this.perna1 = new Float64Array(nPosicoes)
    this.perna2 = new Float64Array(nPosicoes)
    this.tUltimo = new Float64Array(nPosicoes).fill(-Infinity)

    // O |r| de cada lugar não depende do cordão: preenchido uma vez.
    const r = (k: number) => Math.abs(-1 + (2 * k) / M)
    for (let i = 0; i < nPosicoes; i++) {
      const b = i * this.V
      for (let anel = 0; anel < 3; anel++) for (let k = 0; k <= M; k++) this.raios[b + anel * (M + 1) + k] = r(k)
      for (const t of [this.tampaIni(i), this.tampaFim(i)]) {
        this.raios[t] = 0
        for (let k = 0; k <= M; k++) this.raios[t + 1 + k] = r(k)
        for (let k = 0; k < B; k++) this.raios[t + M + 2 + k] = 1
      }
      for (let k = 0; k < 3 * (B + 2); k++) this.raios[this.base(i, 0) + k] = 1
    }
  }

  private anel(i: number, qual: 0 | 1 | 2): number {
    return i * this.V + qual * (this.M + 1)
  }

  private tampaIni(i: number): number {
    return i * this.V + 3 * (this.M + 1)
  }

  private tampaFim(i: number): number {
    return this.tampaIni(i) + this.M + 2 + this.B
  }

  /** Base do anel `qual` (0 = A, 1 = B, 2 = C): B + 2 vértices da esquerda para a direita. */
  private base(i: number, qual: 0 | 1 | 2): number {
    return this.tampaFim(i) + this.M + 2 + this.B + qual * (this.B + 2)
  }

  /**
   * Lê as fatias de i0 a i1 (todas, se omitido), reescreve as que mudaram
   * (e as vizinhas, cujas normais dependem delas) e refaz os índices se
   * alguma apareceu ou sumiu. Devolve true se algo mudou.
   */
  /** Troca os defeitos desenhados na forma; a próxima atualização reescreve tudo. */
  definirDefeitos(a: AnaliseDefeitos | null): void {
    if (a === this.defeitos) return
    this.defeitos = a && a.n === this.nPosicoes ? a : null
    this.forcar = true
  }

  atualizar(cordao: FonteCordao, i0 = 0, i1 = cordao.nPosicoes - 1): boolean {
    const forcar = this.forcar
    this.forcar = false
    i0 = forcar ? 0 : Math.max(0, i0)
    i1 = forcar ? this.nPosicoes - 1 : Math.min(this.nPosicoes - 1, i1)
    let menor = Infinity
    let maior = -Infinity
    let topologia = false
    for (let i = i0; i <= i1; i++) {
      const s = cordao.secao(i)
      if (!forcar && s.larguraMm === this.largura[i] && s.alturaMm === this.altura[i] && s.yCentroMm === this.centro[i]) continue
      this.largura[i] = s.larguraMm
      this.altura[i] = s.alturaMm
      this.centro[i] = s.yCentroMm
      this.perna1[i] = s.pernasMm?.[0] ?? 0
      this.perna2[i] = s.pernasMm?.[1] ?? 0
      this.tUltimo[i] = s.tUltimoDepositoMs
      const vis = s.larguraMm >= LARGURA_MINIMA_3D_MM ? 1 : 0
      if (vis !== this.visivel[i]) topologia = true
      this.visivel[i] = vis
      if (vis) this.escreverPosicoes(i, s)
      if (i < menor) menor = i
      if (i > maior) maior = i
    }
    this.indicesMudaram = topologia
    if (menor > maior) {
      this.inicioMudado = this.fimMudado = 0
      return false
    }
    // As normais das vizinhas usam as posições destas fatias.
    const a = Math.max(0, menor - 1)
    const b = Math.min(this.nPosicoes - 1, maior + 1)
    for (let i = a; i <= b; i++) if (this.visivel[i]) this.escreverNormais(i)
    this.inicioMudado = a * this.V
    this.fimMudado = (b + 1) * this.V
    if (topologia) this.refazerIndices()
    return true
  }

  private escrever(v: number, s: number, u: number, z: number): void {
    if (this.superficie) {
      // Ponto na superfície em u e a normal para o lado do ar (tangente girada 90°).
      const { junta, dimensoes } = this.superficie
      const [n0, w0] = pontoNaSuperficie(junta, dimensoes, u)
      const a = pontoNaSuperficie(junta, dimensoes, u - 0.05)
      const b = pontoNaSuperficie(junta, dimensoes, u + 0.05)
      const tn = b[0] - a[0]
      const tw = b[1] - a[1]
      const t = Math.hypot(tn, tw) || 1
      u = n0 - (tw / t) * z
      z = w0 + (tn / t) * z
    }
    const p = this.geo.pontoEm(s, u)
    const [x, y, w] = paraMundo(p.x, p.y, z)
    this.posicoes[3 * v] = x
    this.posicoes[3 * v + 1] = y
    this.posicoes[3 * v + 2] = w
  }

  /**
   * Fator da altura no ponto (s, r) pelos defeitos da fatia i (1 sem
   * defeitos): cratera (H55), ondas de metal escorrido (H50) e escamas
   * (H56), com o vértice da escama apontando para onde a tocha já passou.
   */
  private fatorAltura(i: number, s: number, r: number, larguraMm: number): number {
    const a = this.defeitos
    if (!a) return 1
    // Ondas de metal escorrido com espaçamento irregular (padrão fixo, o mesmo do arco instável, H44).
    let f = 1 - 0.8 * a.cratera[i] + 0.25 * a.rolos[i] * Math.sin((2 * Math.PI * s) / 3.6 + 2.2 * padraoIrregular(s * 0.7))
    // H94: a poça que caiu pela raiz deixa a face afundada; no furo quase não sobra metal em cima.
    f *= (1 - 0.65 * a.afundamento[i]) * (a.furoMm[i] > 0 ? 0.15 : 1)
    // H98: corcovas com pescoços estreitos entre elas (o volume médio fica o mesmo).
    if (a.humping[i] > 0) f *= 1 + 0.6 * a.humping[i] * Math.cos((2 * Math.PI * s) / HUMPING.passoCorcovaMm)
    const dir = a.escamaDir[i]
    if (dir !== 0) {
      const p = this.passoMm
      const ant = i > 0 && a.escamaDir[i - 1] !== 0 ? a.escamaFase[i - 1] : a.escamaFase[i]
      const prox = i + 1 < a.n && a.escamaDir[i + 1] !== 0 ? a.escamaFase[i + 1] : a.escamaFase[i]
      const g = (prox - ant) / (2 * p)
      const fase = a.escamaFase[i] + (s - (i + 0.5) * p) * g + g * dir * 0.8 * (larguraMm / 2) * (1 - r * r)
      f *= 1 + 0.07 * Math.cos(2 * Math.PI * fase)
    }
    return Math.max(0, f)
  }

  /** Domo do topo reto, o mesmo de perfilSecao (malha3d.ts), sem criar listas; com os defeitos na forma. */
  private escreverDomo(v: number, s: number, sec: SecaoLocal, i: number): void {
    const esq = sec.yCentroMm - sec.larguraMm / 2
    const a = this.defeitos
    for (let k = 0; k <= this.M; k++) {
      const u = esq + (sec.larguraMm * k) / this.M
      const r = (2 * (u - sec.yCentroMm)) / sec.larguraMm
      const forma = a ? formaDomo(r, a.caimento[i], a.sobreposicaoMenos[i], a.sobreposicaoMais[i]) : 1 - r * r
      this.escrever(v + k, s, u, sec.alturaMm * forma * this.fatorAltura(i, s, r, sec.larguraMm))
    }
  }

  private escreverPosicoes(i: number, sec: SecaoLocal): void {
    const p = this.passoMm
    const [sIni, sMeio, sFim] = [i * p, (i + 0.5) * p, (i + 1) * p]
    const M = this.M
    if (this.junta === 'topo') {
      this.escreverDomo(this.anel(i, 0), sMeio, sec, i)
      this.escreverDomo(this.anel(i, 1), sIni, sec, i)
      this.escreverDomo(this.anel(i, 2), sFim, sec, i)
      const ti = this.tampaIni(i)
      this.escrever(ti, sIni, sec.yCentroMm, 0)
      this.escreverDomo(ti + 1, sIni, sec, i)
      const tf = this.tampaFim(i)
      this.escrever(tf, sFim, sec.yCentroMm, 0)
      this.escreverDomo(tf + 1, sFim, sec, i)
      const [e, d] = [sec.yCentroMm - sec.larguraMm / 2, sec.yCentroMm + sec.larguraMm / 2]
      for (const [qual, s] of [[0, sMeio], [1, sIni], [2, sFim]] as const) {
        this.escrever(this.base(i, qual), s, e, 0)
        this.escrever(this.base(i, qual) + 1, s, d, 0)
      }
      return
    }
    // H46: perfil na junta (V, filete); os defeitos só mudam a altura do reforço em cada anel.
    const perfil = perfilNaJunta(sec, this.junta, this.forma!.dimensoes, M)
    const superficie = (v: number, s: number) => {
      const f = this.fatorAltura(i, s, 0, sec.larguraMm)
      const topo = f === 1 || sec.alturaMm <= 0 ? perfil.topo : perfilNaJunta({ ...sec, alturaMm: sec.alturaMm * f }, this.junta, this.forma!.dimensoes, M).topo
      topo.forEach(([n, w], k) => this.escrever(v + k, s, n, w))
    }
    superficie(this.anel(i, 0), sMeio)
    superficie(this.anel(i, 1), sIni)
    superficie(this.anel(i, 2), sFim)
    for (const [t, s] of [[this.tampaIni(i), sIni], [this.tampaFim(i), sFim]] as const) {
      this.escrever(t, s, perfil.centro[0], perfil.centro[1])
      superficie(t + 1, s)
      perfil.baixo.forEach(([n, w], k) => this.escrever(t + M + 2 + k, s, n, w))
    }
    for (const [qual, s] of [[0, sMeio], [1, sIni], [2, sFim]] as const) {
      const b = this.base(i, qual)
      this.escrever(b, s, perfil.topo[0][0], perfil.topo[0][1])
      perfil.baixo.forEach(([n, w], k) => this.escrever(b + 1 + k, s, n, w))
      this.escrever(b + 1 + this.B, s, perfil.topo[M][0], perfil.topo[M][1])
    }
  }

  private normal(v: number, nx: number, ny: number, nz: number): void {
    const n = Math.hypot(nx, ny, nz) || 1
    this.normais[3 * v] = nx / n
    this.normais[3 * v + 1] = ny / n
    this.normais[3 * v + 2] = nz / n
  }

  /** Normal do domo: (∂P/∂u) × (∂P/∂s), por diferenças entre vizinhos (aponta para fora). */
  private normalDomo(v: number, k: number, antes: number, depois: number): void {
    const P = this.posicoes
    const ka = Math.max(0, k - 1)
    const kb = Math.min(this.M, k + 1)
    const [ux, uy, uz] = [P[3 * (v - k + kb)] - P[3 * (v - k + ka)], P[3 * (v - k + kb) + 1] - P[3 * (v - k + ka) + 1], P[3 * (v - k + kb) + 2] - P[3 * (v - k + ka) + 2]]
    const [sx, sy, sz] = [P[3 * (depois + k)] - P[3 * (antes + k)], P[3 * (depois + k) + 1] - P[3 * (antes + k) + 1], P[3 * (depois + k) + 2] - P[3 * (antes + k) + 2]]
    this.normal(v, uy * sz - uz * sy, uz * sx - ux * sz, ux * sy - uy * sx)
  }

  private escreverNormais(i: number): void {
    const M = this.M
    const ini = i === 0 || !this.visivel[i - 1]
    const fim = i === this.nPosicoes - 1 || !this.visivel[i + 1]
    const A = this.anel(i, 0)
    const B = this.anel(i, 1)
    const C = this.anel(i, 2)
    // Anel vizinho de cada lado, seguindo a ordem em que os anéis são ligados.
    const antesA = ini ? B : this.anel(i - 1, 0)
    const depoisA = fim ? C : this.anel(i + 1, 0)
    for (let k = 0; k <= M; k++) {
      this.normalDomo(A + k, k, antesA, depoisA)
      this.normalDomo(B + k, k, B, A)
      this.normalDomo(C + k, k, A, C)
    }
    // Tampas: normal ao longo da junta (para trás na inicial, para a frente na final).
    for (const [t, s, sentido] of [[this.tampaIni(i), i * this.passoMm, -1], [this.tampaFim(i), (i + 1) * this.passoMm, 1]] as const) {
      const r = this.geo.rumoEm(s)
      // Chapa (cos r, sin r) → mundo (x, 0, z).
      for (let k = 0; k <= M + 1 + this.B; k++) this.normal(t + k, sentido * Math.cos(r), 0, sentido * Math.sin(r))
    }
    // Base: para fora do cordão, perpendicular ao contorno de baixo (no topo reto, para baixo).
    const P = this.posicoes
    for (const qual of [0, 1, 2] as const) {
      const b = this.base(i, qual)
      const n = this.B + 2
      for (let k = 0; k < n; k++) {
        const a = b + Math.max(0, k - 1)
        const c = b + Math.min(n - 1, k + 1)
        // Contorno no plano (z = n, y = w): normal (dw, −dn) → mundo (0, −dn, dw).
        const dn = P[3 * c + 2] - P[3 * a + 2]
        const dw = P[3 * c + 1] - P[3 * a + 1]
        this.normal(b + k, 0, -dn, dw)
      }
    }
  }

  /** Mesma ordem de ligação de malhaCordao: B, A…A, C em cada trecho, tampas e base. */
  private refazerIndices(): void {
    const M = this.M
    const nb = this.B + 2
    const I = this.indices
    let n = 0
    const faixa = (r0: number, r1: number) => {
      for (let k = 0; k < M; k++) {
        const a = r0 + k
        const b = a + 1
        const c = r1 + k
        const d = c + 1
        I[n++] = a
        I[n++] = b
        I[n++] = c
        I[n++] = b
        I[n++] = d
        I[n++] = c
      }
    }
    const base = (e0: number, e1: number) => {
      // e0, e1: primeiro vértice da base de cada anel (da esquerda para a direita).
      for (let k = 0; k + 1 < nb; k++) {
        I[n++] = e0 + k
        I[n++] = e1 + k
        I[n++] = e0 + k + 1
        I[n++] = e0 + k + 1
        I[n++] = e1 + k
        I[n++] = e1 + k + 1
      }
    }
    /** Tampa em leque: superfície da esquerda para a direita e, se houver, o contorno de baixo de volta. */
    const tampa = (t: number, frente: boolean) => {
      const nLaco = M + 1 + this.B
      const ponto = (k: number) => {
        // 0…M: superfície; depois, o contorno de baixo da direita para a esquerda.
        if (k <= M) return t + 1 + k
        return t + M + 2 + (this.B - 1 - (k - M - 1))
      }
      const ultimo = this.B > 0 ? nLaco : M
      for (let k = 0; k < ultimo; k++) {
        const p0 = ponto(k)
        const p1 = ponto((k + 1) % nLaco)
        I[n++] = t
        if (frente) {
          I[n++] = p0
          I[n++] = p1
        } else {
          I[n++] = p1
          I[n++] = p0
        }
      }
    }
    for (let i = 0; i < this.nPosicoes; i++) {
      if (!this.visivel[i]) continue
      let j = i
      while (j + 1 < this.nPosicoes && this.visivel[j + 1]) j++
      // Superfície: B(i) → A(i) → … → A(j) → C(j).
      faixa(this.anel(i, 1), this.anel(i, 0))
      for (let q = i; q < j; q++) faixa(this.anel(q, 0), this.anel(q + 1, 0))
      faixa(this.anel(j, 0), this.anel(j, 2))
      tampa(this.tampaIni(i), false)
      tampa(this.tampaFim(j), true)
      // Base: B(i), A(i)…A(j), C(j).
      base(this.base(i, 1), this.base(i, 0))
      for (let q = i; q < j; q++) base(this.base(q, 0), this.base(q + 1, 0))
      base(this.base(j, 0), this.base(j, 2))
      i = j
    }
    this.nIndices = n
  }
}
