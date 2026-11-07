import * as THREE from 'three'
import { PENETRACAO, type AnaliseDefeitos } from '../modelo/defeitos'
import type { GeometriaJunta } from '../modelo/junta'
import { INFO_JUNTA, perfilNaJunta, pontoAoLadoDe, type DimensoesJunta, type TipoJunta } from '../modelo/juntas'
import type { MaterialId } from '../modelo/material'
import type { MalhaCordaoViva } from './cordaoVivo'
import { paraMundo } from './malha3d'

/*
 * Defeitos visíveis em 3D (H50–H57): gotas penduradas, respingos presos,
 * poros abertos, faixas de mordedura e de sobreposição nas bordas e as cores
 * de oxidação pelo calor. Só DESENHA a análise do modelo (defeitos.ts);
 * nada daqui volta para a nota. Vai no grupo "relevo" do palco.
 */

/** Cores de oxidação da chapa ao lado do cordão, de dentro para fora (cor, opacidade com calor alto). */
const OXIDACAO: Record<MaterialId, [string, number][]> = {
  // Aço carbono: marrom-palha perto do cordão, azulado mais longe, bem discreto.
  'aco-carbono': [
    ['#7a5c30', 0.45],
    ['#3d4a72', 0.32],
    ['#2c333c', 0.15],
  ],
  // Inox: a sequência clássica palha → roxo → azul.
  'inox-austenitico': [
    ['#c99a3c', 0.75],
    ['#8a3f74', 0.6],
    ['#3f58b0', 0.5],
  ],
  // Alumínio: faixa clara de limpeza do arco e fuligem escura em volta.
  aluminio: [
    ['#f3f6f9', 0.4],
    ['#1d1f22', 0.42],
    ['#1d1f22', 0.14],
  ],
  // Galvanizado: o zinco queimado deixa uma faixa branca e, mais longe, a oxidação do aço.
  'aco-galvanizado': [
    ['#e8ebe6', 0.5],
    ['#6b5a3a', 0.35],
    ['#2c333c', 0.15],
  ],
  'aco-medio-carbono': [
    ['#74552c', 0.45],
    ['#3a466c', 0.3],
    ['#2a3038', 0.15],
  ],
  // Inox ferrítico: a mesma sequência do inox, um pouco mais fraca.
  'inox-ferritico': [
    ['#c49a48', 0.65],
    ['#7d4470', 0.5],
    ['#3f58b0', 0.4],
  ],
  // Cobre: rosado perto do cordão e óxido escuro em volta.
  cobre: [
    ['#e0a070', 0.4],
    ['#3b2a2a', 0.45],
    ['#2a1d1a', 0.18],
  ],
}

/** Largura da faixa de oxidação por unidade do índice de fusão (mm): o inox conduz pouco calor e colore mais longe. */
const ALCANCE_OXIDACAO: Record<MaterialId, number> = { 'aco-carbono': 2.4, 'inox-austenitico': 3.6, aluminio: 2, 'aco-galvanizado': 3, 'aco-medio-carbono': 2.2, 'inox-ferritico': 3, cobre: 1.8 }

const COR_RESPINGO: Record<MaterialId, string> = { 'aco-carbono': '#646a72', 'inox-austenitico': '#8d877c', aluminio: '#a3acb6', 'aco-galvanizado': '#6a7078', 'aco-medio-carbono': '#5c6168', 'inox-ferritico': '#8a8781', cobre: '#8f5a3a' }

const lim01 = (v: number) => (v <= 0 ? 0 : v >= 1 ? 1 : v)

/** Faixa dos dois lados do cordão: 4 vértices por fatia (fora −, dentro −, dentro +, fora +), cor RGBA por vértice. */
class FaixaLados {
  readonly malha: THREE.Mesh
  readonly pos: Float32Array
  readonly cor: Float32Array

  constructor(n: number, alturaMm: number, ordem: number) {
    this.pos = new Float32Array(n * 4 * 3)
    this.cor = new Float32Array(n * 4 * 4)
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage))
    g.setAttribute('color', new THREE.BufferAttribute(this.cor, 4).setUsage(THREE.DynamicDrawUsage))
    const idx: number[] = []
    for (let i = 0; i + 1 < n; i++) {
      for (const k of [0, 2]) {
        const a = i * 4 + k
        idx.push(a, a + 1, a + 4, a + 1, a + 5, a + 4)
      }
    }
    g.setIndex(idx)
    this.malha = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }))
    this.malha.position.y = alturaMm
    this.malha.renderOrder = ordem
    this.malha.frustumCulled = false
  }

  ponto(v: number, x: number, y: number, z: number): void {
    this.pos[3 * v] = x
    this.pos[3 * v + 1] = y
    this.pos[3 * v + 2] = z
  }

  pintar(v: number, c: THREE.Color, alfa: number): void {
    this.cor[4 * v] = c.r
    this.cor[4 * v + 1] = c.g
    this.cor[4 * v + 2] = c.b
    this.cor[4 * v + 3] = alfa
  }

  enviar(): void {
    this.malha.geometry.getAttribute('position').needsUpdate = true
    this.malha.geometry.getAttribute('color').needsUpdate = true
  }
}

/** Esferas instanciadas que crescem quando falta lugar. */
class Bolinhas {
  malha: THREE.InstancedMesh
  constructor(
    private readonly grupo: THREE.Group,
    private readonly geometria: THREE.BufferGeometry,
    private readonly material: THREE.Material,
    private capacidade = 64,
  ) {
    this.malha = this.criar()
  }

  private criar(): THREE.InstancedMesh {
    const m = new THREE.InstancedMesh(this.geometria, this.material, this.capacidade)
    m.count = 0
    m.castShadow = true
    m.frustumCulled = false
    this.grupo.add(m)
    return m
  }

  garantir(n: number): void {
    if (n <= this.capacidade) return
    this.grupo.remove(this.malha)
    this.malha.dispose()
    while (this.capacidade < n) this.capacidade *= 2
    this.malha = this.criar()
  }
}

export class Defeitos3D {
  readonly grupo = new THREE.Group()
  private readonly oxidacao: FaixaLados[]
  private readonly mordedura: FaixaLados
  private readonly sobreposicao: FaixaLados
  private readonly gotas: Bolinhas
  private readonly respingos: Bolinhas
  private readonly poros: Bolinhas
  /** H94: metal no avesso (raiz e gotas penduradas) e furos. */
  private readonly avesso: Bolinhas
  private readonly furos: Bolinhas
  private readonly coresOxidacao: [THREE.Color, number][]
  private readonly alcanceOxidacao: number
  private readonly corEscura = new THREE.Color('#121316')
  private readonly m = new THREE.Matrix4()
  private readonly q = new THREE.Quaternion()
  private readonly v = new THREE.Vector3()
  private readonly e = new THREE.Vector3()
  private readonly geometrias: THREE.BufferGeometry[] = []
  private readonly filete: boolean
  /** Inclinação das chapas no empeno (H57): o que fica na chapa sobe junto com ela. */
  private tanEmpeno = 0
  private ultima: { a: AnaliseDefeitos | null; viva: MalhaCordaoViva | null } = { a: null, viva: null }

  constructor(
    private readonly geo: Pick<GeometriaJunta, 'pontoEm'>,
    private readonly n: number,
    private readonly passoMm: number,
    private readonly junta: TipoJunta,
    private readonly dim: DimensoesJunta,
    material: MaterialId,
    corCordao: THREE.Color,
  ) {
    this.filete = INFO_JUNTA[junta].familia === 'filete'
    this.coresOxidacao = OXIDACAO[material].map(([c, a]) => [new THREE.Color(c), a])
    this.alcanceOxidacao = ALCANCE_OXIDACAO[material]
    // Um pouco acima da chapa: menos que isso perde para a chapa na precisão de profundidade.
    this.oxidacao = [0, 1, 2].map((k) => new FaixaLados(n, 0.03 + 0.005 * k, 1))
    this.mordedura = new FaixaLados(n, 0.05, 2)
    this.sobreposicao = new FaixaLados(n, 0.055, 2)
    for (const f of [...this.oxidacao, this.mordedura, this.sobreposicao]) this.grupo.add(f.malha)
    const esfera = new THREE.SphereGeometry(1, 14, 10)
    const esferaPequena = new THREE.SphereGeometry(1, 8, 6)
    const disco = new THREE.CylinderGeometry(1, 1, 0.08, 12)
    this.geometrias.push(esfera, esferaPequena, disco)
    this.gotas = new Bolinhas(this.grupo, esfera, new THREE.MeshStandardMaterial({ color: corCordao, metalness: 0.7, roughness: 0.32 }))
    this.respingos = new Bolinhas(this.grupo, esferaPequena, new THREE.MeshStandardMaterial({ color: COR_RESPINGO[material], metalness: 0.5, roughness: 0.55 }))
    this.poros = new Bolinhas(this.grupo, disco, new THREE.MeshBasicMaterial({ color: '#0d0e10' }))
    this.avesso = new Bolinhas(this.grupo, esfera, new THREE.MeshStandardMaterial({ color: corCordao, metalness: 0.65, roughness: 0.4 }))
    // Furo: um cilindro escuro atravessando a chapa (visto de cima e de baixo), com a borda queimada.
    const tubo = new THREE.CylinderGeometry(1, 1, 1, 16)
    this.geometrias.push(tubo)
    this.furos = new Bolinhas(this.grupo, tubo, new THREE.MeshBasicMaterial({ color: '#07080a' }))
  }

  /** Material do metal no avesso: o buraco do H101 recorta ele também. */
  get materialAvesso(): THREE.Material {
    return this.avesso.malha.material as THREE.Material
  }

  /** Ponto (s, n, w) da junta no mundo. */
  private mundo(s: number, n: number, w: number): THREE.Vector3 {
    const p = this.geo.pontoEm(s, n)
    const [x, y, z] = paraMundo(p.x, p.y, w)
    return this.v.set(x, y, z)
  }

  /** Altura extra da chapa empenada no ponto lateral n (topo e V: as chapas giram na borda da junta). */
  private subidaEmpeno(n: number): number {
    if (this.tanEmpeno === 0 || this.filete) return 0
    return Math.max(0, Math.abs(n) - this.dim.aberturaMm / 2) * this.tanEmpeno
  }

  /** Empeno angular das chapas (graus): faixas e respingos acompanham a chapa. */
  definirEmpeno(graus: number): void {
    const t = Math.tan((graus * Math.PI) / 180)
    if (t === this.tanEmpeno) return
    this.tanEmpeno = t
    this.atualizar(this.ultima.a, this.ultima.viva)
  }

  /** Lado da fatia i a `dist` mm da borda do cordão, escrito no vértice v da faixa. */
  private aoLado(f: FaixaLados, vtx: number, i: number, viva: MalhaCordaoViva, lado: -1 | 1, dist: number): void {
    const [n, w] = pontoAoLadoDe(this.junta, this.dim, viva.largura[i], viva.centro[i], viva.perna1[i], viva.perna2[i], lado, dist)
    const p = this.mundo((i + 0.5) * this.passoMm, n, w + this.subidaEmpeno(n))
    f.ponto(vtx, p.x, p.y, p.z)
  }

  /** Redesenha tudo a partir da análise (null apaga). */
  atualizar(a: AnaliseDefeitos | null, viva: MalhaCordaoViva | null): void {
    this.ultima = { a, viva }
    this.grupo.visible = !!a && !!viva
    if (!a || !viva || a.n !== this.n) return
    const L = a.limiteMordeduraMm
    for (let i = 0; i < this.n; i++) {
      const tem = viva.visivel[i] === 1 && viva.largura[i] >= 1
      // Oxidação (H56): largura total pelo calor da fatia, três faixas de dentro para fora.
      const calor = a.calor[i]
      const total = tem ? Math.min(12, this.alcanceOxidacao * calor) : 0
      // Pouco calor quase não colore; calor demais deixa a sequência inteira bem marcada.
      const intensidade = lim01((calor - 0.8) / 1.4)
      this.oxidacao.forEach((f, k) => {
        const d0 = (total * k) / 3
        const d1 = (total * (k + 1)) / 3
        const [cor, alfa] = this.coresOxidacao[k]
        // Degradê: a borda de fora de cada faixa já tem a cor da seguinte; a última some.
        const [corFora, alfaFora] = k < 2 ? this.coresOxidacao[k + 1] : [cor, 0]
        for (const [lado, fora, dentro] of [[-1, 0, 1], [1, 3, 2]] as const) {
          this.aoLado(f, 4 * i + fora, i, viva, lado, d1)
          this.aoLado(f, 4 * i + dentro, i, viva, lado, d0)
          f.pintar(4 * i + fora, corFora, tem ? alfaFora * intensidade : 0)
          f.pintar(4 * i + dentro, cor, tem ? alfa * intensidade : 0)
        }
      })
      // Mordedura (H52): sulco escuro na chapa junto da borda, mais largo e escuro quanto mais fundo.
      for (const [lado, fora, dentro, mm] of [[-1, 0, 1, a.mordeduraMenos[i]], [1, 3, 2, a.mordeduraMais[i]]] as const) {
        const alfa = tem ? 0.85 * lim01((mm - 0.4 * L) / L) : 0
        this.aoLado(this.mordedura, 4 * i + fora, i, viva, lado, 0.4 + 1.5 * mm)
        this.aoLado(this.mordedura, 4 * i + dentro, i, viva, lado, -0.05)
        this.mordedura.pintar(4 * i + fora, this.corEscura, alfa * 0.5)
        this.mordedura.pintar(4 * i + dentro, this.corEscura, alfa)
      }
      // Sobreposição (H53): linha de sombra fina embaixo da borda "enrolada".
      for (const [lado, fora, dentro, sob] of [[-1, 0, 1, a.sobreposicaoMenos[i]], [1, 3, 2, a.sobreposicaoMais[i]]] as const) {
        const alfa = tem ? 0.75 * lim01((sob - 0.15) / 0.5) : 0
        this.aoLado(this.sobreposicao, 4 * i + fora, i, viva, lado, 0.35)
        this.aoLado(this.sobreposicao, 4 * i + dentro, i, viva, lado, -0.1)
        this.sobreposicao.pintar(4 * i + fora, this.corEscura, alfa * 0.4)
        this.sobreposicao.pintar(4 * i + dentro, this.corEscura, alfa)
      }
    }
    for (const f of [...this.oxidacao, this.mordedura, this.sobreposicao]) f.enviar()

    // Gotas penduradas (H50): na superfície do cordão; com a peça de cabeça para baixo, pendem para o chão.
    this.gotas.garantir(a.gotas.length)
    a.gotas.forEach((g, k) => {
      const i = Math.min(this.n - 1, Math.floor(g.xMm / this.passoMm))
      const [n, w] = this.superficie(viva, i, g.nMm)
      const p = this.mundo(g.xMm, n, w + 0.55 * g.raioMm)
      this.m.compose(p, this.q.identity(), this.e.set(g.raioMm, 1.3 * g.raioMm, g.raioMm))
      this.gotas.malha.setMatrixAt(k, this.m)
    })
    this.gotas.malha.count = a.gotas.length
    this.gotas.malha.instanceMatrix.needsUpdate = true

    // Respingos (H54): bolinhas achatadas presas na chapa.
    this.respingos.garantir(a.respingos.length)
    a.respingos.forEach((r, k) => {
      const i = Math.min(this.n - 1, Math.max(0, Math.floor(r.xMm / this.passoMm)))
      const [n, w] = r.lado !== undefined && this.filete ? pontoAoLadoDe(this.junta, this.dim, viva.largura[i], viva.centro[i], viva.perna1[i], viva.perna2[i], r.lado, r.distMm ?? 1) : [r.nMm, 0]
      const p = this.mundo(r.xMm, n, w + this.subidaEmpeno(n) + 0.25 * r.raioMm)
      this.m.compose(p, this.q.identity(), this.e.set(r.raioMm, 0.55 * r.raioMm, r.raioMm))
      this.respingos.malha.setMatrixAt(k, this.m)
    })
    this.respingos.malha.count = a.respingos.length
    this.respingos.malha.instanceMatrix.needsUpdate = true

    // Poros abertos na superfície (H57): pontinhos escuros no cordão.
    const abertos = a.poros.filter((p) => p.superficie)
    this.poros.garantir(abertos.length)
    abertos.forEach((po, k) => {
      const i = Math.min(this.n - 1, Math.floor(po.xMm / this.passoMm))
      const [n, w] = this.superficie(viva, i, po.nMm)
      const p = this.mundo(po.xMm, n, w + 0.02)
      this.m.compose(p, this.q.identity(), this.e.set(po.raioMm, 1, po.raioMm))
      this.poros.malha.setMatrixAt(k, this.m)
    })
    this.poros.malha.count = abertos.length
    this.poros.malha.instanceMatrix.needsUpdate = true

    // H94: avesso da junta (só topo e V). Raiz contínua a cada 1 mm e gotas grandes penduradas.
    const esp = this.dim.espessuraMm
    const raiz: [number, number, number, number, boolean][] = []
    if (!this.filete) {
      const cada = Math.max(1, Math.round(1 / this.passoMm))
      for (let i = 0; i < this.n; i += cada) {
        const mm = a.penetracaoMm[i]
        if (mm < 0.12 || viva.visivel[i] !== 1) continue
        // H101: a faixa que vazou acompanha o calor para os lados; o buraco é recortado dela (lábio em volta).
        raiz.push([(i + 0.5) * this.passoMm, viva.centro[i], Math.max(0.7 + 0.5 * mm, a.larguraAvessoMm[i] / 2), Math.max(mm, a.furoMm[i] > 0 ? PENETRACAO.penduradoMaxMm : 0), false])
      }
      for (const g of a.gotasAvesso) raiz.push([g.xMm, g.nMm, g.raioMm, 1.6 * g.raioMm, true])
    }
    this.avesso.garantir(raiz.length)
    raiz.forEach(([x, n, larg, altura, gota], k) => {
      const p = this.mundo(x, n, -esp - 0.4 * altura)
      // Ao longo da junta, largo o bastante para as fatias se fundirem numa massa só (sem serrilhado).
      this.m.compose(p, this.q.identity(), this.e.set(gota ? larg : Math.max(0.6, this.passoMm * 1.4, 0.35 * larg), Math.max(0.15, altura), larg))
      this.avesso.malha.setMatrixAt(k, this.m)
    })
    this.avesso.malha.count = raiz.length
    this.avesso.malha.instanceMatrix.needsUpdate = true

    const furos: [number, number, number][] = []
    // H101: no topo e no V o buraco é recortado de verdade na chapa (palco3d); o cilindro escuro fica só no filete.
    if (this.filete) for (let i = 0; i < this.n; i++) if (a.furoMm[i] > 0 && viva.visivel[i] === 1) furos.push([(i + 0.5) * this.passoMm, viva.centro[i], a.furoMm[i]])
    this.furos.garantir(furos.length)
    furos.forEach(([x, n, larg], k) => {
      // Do avesso até um pouco acima da face, para aparecer por cima do pouco metal que sobrou.
      const p = this.mundo(x, n, (0.35 - esp) / 2)
      this.m.compose(p, this.q.identity(), this.e.set(this.passoMm * 0.75, esp + 0.4, larg / 2))
      this.furos.malha.setMatrixAt(k, this.m)
    })
    this.furos.malha.count = furos.length
    this.furos.malha.instanceMatrix.needsUpdate = true
  }

  /** Ponto (n, w) da superfície do cordão na fatia i: no topo reto, o domo em n; nas outras juntas, o meio do perfil. */
  private superficie(viva: MalhaCordaoViva, i: number, n: number): [number, number] {
    if (this.junta === 'topo') {
      const w = viva.largura[i]
      if (w <= 0) return [n, 0]
      const r = Math.max(-1, Math.min(1, (2 * (n - viva.centro[i])) / w))
      return [n, Math.max(0, viva.altura[i] * (1 - r * r))]
    }
    const sec = { xMm: 0, areaMm2: 0, larguraMm: viva.largura[i], alturaMm: viva.altura[i], razaoAlturaLargura: 0, yCentroMm: viva.centro[i], espalhamentoMm: 0, larguraSemOscilacaoMm: viva.largura[i], instabilidade: 0, tUltimoDepositoMs: 0, pernasMm: this.filete ? ([viva.perna1[i], viva.perna2[i]] as [number, number]) : undefined }
    const [pn, pw] = perfilNaJunta(sec, this.junta, this.dim, 8).topo[4]
    return [pn, pw]
  }

  destruir(): void {
    for (const g of this.geometrias) g.dispose()
  }
}
