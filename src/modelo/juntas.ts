import type { SecaoLocal } from './cordao'

/*
 * Tipos de junta (H46) e posição de soldagem (H47). Funções puras.
 *
 * Seção transversal no plano (n, w):
 *   n = desvio lateral (o mesmo n da junta, H41);
 *   w = normal à "face" da junta, para fora (para cima com a peça em 0°).
 * Em juntas de topo a face é o topo das chapas (w = 0). Em solda de ângulo
 * (filete: T, sobreposta, canto) a junta é um entalhe de 90° e w é a
 * bissetriz; w = 0 passa pela raiz (o canto). A tocha mira no plano w = 0.
 *
 * Os números são do jogo (docs/HIPOTESES.md). As formas (entalhe de 90°,
 * chanfro de 60°, convexidade pela tensão) seguem a prática; nada aqui é
 * norma nem medida.
 */

export type TipoJunta = 'topo' | 'v' | 't' | 'sobreposta' | 'canto'
export const TIPOS_JUNTA: TipoJunta[] = ['topo', 'v', 't', 'sobreposta', 'canto']

/** Chanfro: o metal enche uma abertura entre as chapas. Filete: o metal enche um entalhe de 90°. */
export type FamiliaJunta = 'chanfro' | 'filete'

export interface InfoJunta {
  nome: string
  resumo: string
  familia: FamiliaJunta
  /** Como a peça chega (H47): 0° = face da junta para cima. */
  rolagemInicialGraus: number
  /** Multiplica o aporte necessário para fundir (H46): mais chapas puxando calor pedem mais. */
  fatorFusao: number
  /** Espessura da peça de teste com esta junta (mm): o V só faz sentido em chapa grossa. */
  espessuraTesteMm: number
  /** Abertura (fresta) da peça de teste (mm). */
  aberturaTesteMm: number
  /** Velocidade de avanço típica com os ajustes de fábrica (mm/s): o V cheio pede andar devagar. */
  velocidadeReferenciaMms: number
}

export const INFO_JUNTA: Record<TipoJunta, InfoJunta> = {
  topo: {
    nome: 'Topo reto',
    resumo: 'Bordas retas frente a frente, com uma pequena abertura. A referência.',
    familia: 'chanfro',
    rolagemInicialGraus: 0,
    fatorFusao: 1,
    espessuraTesteMm: 3,
    aberturaTesteMm: 1,
    velocidadeReferenciaMms: 6,
  },
  v: {
    nome: 'Topo em V (60°)',
    resumo: 'Chapa grossa com as bordas chanfradas: o metal precisa encher o V. Ande devagar ou faça mais de um passe.',
    familia: 'chanfro',
    rolagemInicialGraus: 0,
    fatorFusao: 1.1,
    espessuraTesteMm: 6,
    aberturaTesteMm: 1,
    velocidadeReferenciaMms: 2.5,
  },
  t: {
    nome: 'Em T (filete)',
    resumo: 'Uma chapa em pé sobre a outra; solda de ângulo no canto. Chega na horizontal: tombe a peça 45° para soldar na plana.',
    familia: 'filete',
    rolagemInicialGraus: 45,
    fatorFusao: 1.3,
    espessuraTesteMm: 3,
    aberturaTesteMm: 0,
    velocidadeReferenciaMms: 6,
  },
  sobreposta: {
    nome: 'Sobreposta (filete)',
    resumo: 'Uma chapa por cima da outra; solda de ângulo na borda de cima. Chega na horizontal.',
    familia: 'filete',
    rolagemInicialGraus: 45,
    fatorFusao: 1.55,
    espessuraTesteMm: 2,
    aberturaTesteMm: 0,
    velocidadeReferenciaMms: 7,
  },
  canto: {
    nome: 'De canto (externa)',
    resumo: 'Duas chapas formando um L, soldadas por fora. Chega quase de cabeça para baixo: tombe até a face ficar para cima.',
    familia: 'filete',
    rolagemInicialGraus: 135,
    fatorFusao: 1.1,
    espessuraTesteMm: 3,
    aberturaTesteMm: 0,
    velocidadeReferenciaMms: 6,
  },
}

export function juntaDe(ctx: { junta?: TipoJunta }): TipoJunta {
  return ctx.junta ?? 'topo'
}

/** Medidas da peça que a geometria da junta usa. */
export interface DimensoesJunta {
  espessuraMm: number
  aberturaMm: number
}

const TAN30 = Math.tan(Math.PI / 6)
/** Quanto o reforço do V passa da abertura do chanfro, no mínimo (mm, os dois lados somados). */
const SOBRA_V_MM = 1.4
const R2 = Math.SQRT2

/** Face de raiz do chanfro em V (mm): a parte reta que sobra embaixo. */
export function faceRaizMm(d: DimensoesJunta): number {
  return Math.min(1, d.espessuraMm / 3)
}

/** Área do chanfro em V por mm de junta (mm²): abertura × espessura + os dois chanfros de 30°. */
export function areaChanfroMm2(d: DimensoesJunta): number {
  const p = faceRaizMm(d)
  return d.aberturaMm * d.espessuraMm + (d.espessuraMm - p) ** 2 * TAN30
}

/** Largura da abertura do V no topo das chapas (mm). */
export function larguraTopoChanfroMm(d: DimensoesJunta): number {
  return d.aberturaMm + 2 * (d.espessuraMm - faceRaizMm(d)) * TAN30
}

/** Abertura que o cordão precisa cobrir na face (H34): a fresta no topo reto, o V no chanfro; nada no filete. */
export function aberturaNaFaceMm(junta: TipoJunta, d: DimensoesJunta): number {
  if (junta === 'topo') return d.aberturaMm
  if (junta === 'v') return larguraTopoChanfroMm(d)
  return 0
}

/** Altura do metal no V (mm, medida da raiz) para uma área depositada A < área do chanfro. */
function nivelNoChanfro(area: number, d: DimensoesJunta): number {
  const a = d.aberturaMm
  const p = faceRaizMm(d)
  if (area <= a * p) return a > 0 ? area / a : 0
  // Acima da face de raiz: a·y + (y − p)²·tan30 = A  →  equação do 2º grau em (y − p).
  const resto = area - a * p
  const k = TAN30
  const u = (-a + Math.sqrt(a * a + 4 * k * resto)) / (2 * k)
  return Math.min(d.espessuraMm, p + u)
}

/** Convexidade do filete pela forma do arco (H9): tensão baixa (razão alta) → convexo; alta → plano ou côncavo. */
export function convexidadeFilete(razao: number): number {
  return Math.min(0.25, Math.max(-0.15, razao - 0.25))
}

/**
 * Seção do cordão NA JUNTA (H46), a partir da seção de metal depositado
 * (cordao.ts). Na junta de topo é a seção de sempre (domo sobre a face; o
 * metal que entra na fresta não é modelado, H18). No V o metal enche
 * primeiro o chanfro e só o que sobra vira reforço; se faltar, o V fica
 * aberto (altura negativa = abaixo do topo). No filete o metal enche o
 * entalhe de 90°: pernas iguais com a tocha na raiz, convexidade pela tensão.
 * Oscilação lateral e arco instável (H39, H44) entram pela razão entre a
 * largura de base e a largura só pela área.
 */
export function secaoNaJunta(base: SecaoLocal, junta: TipoJunta, d: DimensoesJunta, razao: number): SecaoLocal {
  if (base.areaMm2 <= 0 || (junta === 'topo' && d.aberturaMm <= 0)) return { ...base, areaReforcoMm2: base.areaMm2, enchimento: junta === 'v' ? 0 : 1 }
  const A = base.areaMm2
  if (junta === 'topo') {
    // v1.3: o metal enche primeiro a fresta entre as bordas (abertura × espessura); só o resto é reforço.
    // Só enche o pedaço da fresta que fica embaixo do cordão: fora dela o metal fica sobre a chapa.
    const a2 = d.aberturaMm / 2
    const esq = Math.max(-a2, base.yCentroMm - base.larguraMm / 2)
    const dir = Math.min(a2, base.yCentroMm + base.larguraMm / 2)
    const sobreFresta = Math.max(0, dir - esq)
    if (sobreFresta <= 0) return { ...base, areaReforcoMm2: A, enchimento: 1 }
    const Af = sobreFresta * d.espessuraMm
    if (A < Af) {
      const nivel = A / sobreFresta
      return { ...base, larguraMm: sobreFresta, yCentroMm: (esq + dir) / 2, alturaMm: -(d.espessuraMm - nivel), razaoAlturaLargura: 0, areaReforcoMm2: 0, enchimento: A / Af }
    }
    const excesso = A - Af
    // Mesma forma (razão) de antes, só com o metal que sobra acima da face; a largura nunca fica menor que a fresta.
    const largura = Math.max(d.aberturaMm, base.larguraMm * Math.sqrt(excesso / A))
    const altura = (1.5 * excesso) / largura
    return { ...base, larguraMm: largura, alturaMm: altura, razaoAlturaLargura: altura / largura, areaReforcoMm2: excesso, enchimento: A / Af }
  }
  if (junta === 'v') {
    const Ach = areaChanfroMm2(d)
    const wTopo = larguraTopoChanfroMm(d)
    if (A < Ach) {
      // Chanfro ainda aberto: a superfície do metal fica dentro do V.
      const y = nivelNoChanfro(A, d)
      const p = faceRaizMm(d)
      const largura = d.aberturaMm + 2 * Math.max(0, y - p) * TAN30
      return { ...base, larguraMm: largura, alturaMm: -(d.espessuraMm - y), razaoAlturaLargura: 0, areaReforcoMm2: 0, enchimento: A / Ach }
    }
    const excesso = A - Ach
    // A largura pela área cresce com a raiz da área (forma fixa): o reforço só com o excesso.
    // Cheio, o reforço sempre passa das bordas do V (com a folga de H34).
    const pelaArea = base.larguraMm * Math.sqrt(excesso / A)
    const largura = Math.max(wTopo + SOBRA_V_MM, pelaArea)
    const altura = (1.5 * excesso) / largura
    return { ...base, larguraMm: largura, alturaMm: altura, razaoAlturaLargura: altura / largura, areaReforcoMm2: excesso, enchimento: A / Ach }
  }
  // Filete: área = z²/2 (triângulo) + (2/3)·face·convexidade·face.
  const c = convexidadeFilete(razao)
  const z0 = Math.sqrt(A / (0.5 + (4 / 3) * c))
  // Mesma variação de largura que a seção de base teve por oscilação ou arco instável (H39, H44).
  const soPelaArea = Math.sqrt(A / ((2 / 3) * razao))
  const fator = soPelaArea > 0 ? base.larguraMm / soPelaArea : 1
  const z = z0 * fator
  // Tocha fora da raiz: uma perna cresce e a outra encolhe.
  const delta = Math.max(-0.8 * z, Math.min(0.8 * z, base.yCentroMm * R2))
  const z1 = z + delta
  const z2 = z - delta
  const face = Math.hypot(z1, z2)
  return {
    ...base,
    larguraMm: face,
    alturaMm: c * face,
    razaoAlturaLargura: c,
    yCentroMm: delta / R2,
    areaReforcoMm2: A,
    enchimento: 1,
    pernasMm: [z1, z2],
  }
}

/**
 * Metal (mm² de seção) que dá uma largura de face na junta (o inverso de
 * secaoNaJunta, sem oscilação nem desvio): usado para a faixa de velocidade
 * da tela e para os testes que procuram uma solução.
 */
export function areaParaLargura(junta: TipoJunta, d: DimensoesJunta, larguraMm: number, razao: number): number {
  if (junta === 'topo') return d.aberturaMm * d.espessuraMm + (2 / 3) * razao * larguraMm ** 2
  if (junta === 'v') {
    const minima = larguraTopoChanfroMm(d) + SOBRA_V_MM
    return areaChanfroMm2(d) + (2 / 3) * razao * Math.max(larguraMm, minima) ** 2 * (larguraMm > minima ? 1 : 0.3)
  }
  const z = larguraMm / R2
  return z * z * (0.5 + (4 / 3) * convexidadeFilete(razao))
}

/** Ponto no plano (n, w). */
export type Ponto2 = [number, number]

/** Direções das paredes do entalhe de 90° (filete), a partir da raiz. */
const U1: Ponto2 = [1 / R2, 1 / R2]
const U2: Ponto2 = [-1 / R2, 1 / R2]

/** Altura da crista do cordão acima do plano w = 0 (mm), para pôr a tocha em cima. */
export function cristaMm(s: SecaoLocal, junta: TipoJunta): number {
  if (INFO_JUNTA[junta].familia === 'filete' && s.pernasMm) {
    const [z1, z2] = s.pernasMm
    return (z1 + z2) / (2 * R2) + Math.max(0, s.alturaMm)
  }
  return s.alturaMm
}

/** Quantos pontos o contorno de baixo do perfil tem entre as duas bordas (fixo por junta). */
export function pontosDeBaixo(junta: TipoJunta): number {
  return junta === 'topo' ? 0 : junta === 'v' ? 6 : 1
}

export interface PerfilSecao {
  /** Superfície do cordão, da borda esquerda (−n) à direita (+n): M + 1 pontos. */
  topo: Ponto2[]
  /** Contorno de baixo, da esquerda para a direita, sem as bordas: pontosDeBaixo(junta) pontos. */
  baixo: Ponto2[]
  /** Centro para fechar as pontas do cordão. */
  centro: Ponto2
  /** |r| de cada ponto do topo (0 na crista, 1 na borda): escolhe a cor da camada. */
  raios: number[]
}

/**
 * Contorno da seção do cordão na junta (para o 3D e o corte). No topo reto
 * é o domo de H3: z = h·(1 − r²), r = 2(u − yCentro)/largura.
 */
export function perfilNaJunta(s: SecaoLocal, junta: TipoJunta, d: DimensoesJunta, M: number): PerfilSecao {
  const raios = Array.from({ length: M + 1 }, (_, k) => Math.abs(-1 + (2 * k) / M))
  const domo = (n0: number, w0: number, n1: number, w1: number, h: number): Ponto2[] => {
    // Curva de (n0, w0) a (n1, w1) com o domo de H3 na normal (para fora).
    const dn = n1 - n0
    const dw = w1 - w0
    const comp = Math.hypot(dn, dw) || 1
    const [nn, nw] = [-dw / comp, dn / comp]
    return Array.from({ length: M + 1 }, (_, k) => {
      const f = k / M
      const r = -1 + 2 * f
      const z = h * (1 - r * r)
      return [n0 + dn * f + nn * z, w0 + dw * f + nw * z] as Ponto2
    })
  }
  if (junta === 'topo') {
    const e = s.yCentroMm - s.larguraMm / 2
    return { topo: domo(e, 0, e + s.larguraMm, 0, s.alturaMm), baixo: [], centro: [s.yCentroMm, 0], raios }
  }
  if (junta === 'v') {
    const p = faceRaizMm(d)
    const a2 = d.aberturaMm / 2
    const t2 = larguraTopoChanfroMm(d) / 2
    const e = d.espessuraMm
    if (s.alturaMm < 0) {
      // Chanfro aberto: superfície do metal no nível, entre as paredes do V.
      const nivel = s.alturaMm
      const meia = s.larguraMm / 2
      const topo = domo(-meia, nivel, meia, nivel, -0.12 * Math.min(1, meia))
      const raiz = Math.max(-(e - p), nivel)
      return { topo, baixo: [[-a2, raiz], [-a2, -e], [-a2 * 0.3, -e], [a2 * 0.3, -e], [a2, -e], [a2, raiz]], centro: [0, (nivel - e) / 2], raios }
    }
    const esq = s.yCentroMm - s.larguraMm / 2
    const dir = s.yCentroMm + s.larguraMm / 2
    const topo = domo(esq, 0, dir, 0, s.alturaMm)
    // Embaixo: o V cheio (as paredes do chanfro até a raiz).
    const baixo: Ponto2[] = [[Math.max(esq, -t2), 0], [-a2, -(e - p)], [-a2, -e], [a2, -e], [a2, -(e - p)], [Math.min(dir, t2), 0]]
    return { topo, baixo, centro: [s.yCentroMm, -e / 3], raios }
  }
  // Filete: da perna esquerda (parede U2) à direita (parede U1), passando pela raiz embaixo.
  const [z1, z2] = s.pernasMm ?? [s.larguraMm / R2, s.larguraMm / R2]
  const P1: Ponto2 = [U1[0] * z1, U1[1] * z1]
  const P2: Ponto2 = [U2[0] * z2, U2[1] * z2]
  const topo = domo(P2[0], P2[1], P1[0], P1[1], s.alturaMm)
  return { topo, baixo: [[0, 0]], centro: [(P1[0] + P2[0]) / 3, (P1[1] + P2[1]) / 3], raios }
}

/**
 * Chapas da junta em corte (polígonos no plano (n, w), sentido anti-horário).
 * Cada chapa tem `largura` mm a partir da junta (a peça de teste usa 50).
 */
export function chapasNaJunta(junta: TipoJunta, d: DimensoesJunta, largura = 50): Ponto2[][] {
  const e = d.espessuraMm
  const a2 = d.aberturaMm / 2
  if (junta === 'topo') {
    return [
      [[-largura, -e], [-a2, -e], [-a2, 0], [-largura, 0]],
      [[a2, -e], [largura, -e], [largura, 0], [a2, 0]],
    ]
  }
  if (junta === 'v') {
    const p = faceRaizMm(d)
    const t2 = larguraTopoChanfroMm(d) / 2
    return [
      [[-largura, -e], [-a2, -e], [-a2, -(e - p)], [-t2, 0], [-largura, 0]],
      [[a2, -e], [largura, -e], [largura, 0], [t2, 0], [a2, -(e - p)]],
    ]
  }
  const mais = (p: Ponto2, u: Ponto2, k: number): Ponto2 => [p[0] + u[0] * k, p[1] + u[1] * k]
  // Normais das paredes, para o lado de dentro de cada chapa (longe do entalhe).
  const N1: Ponto2 = [1 / R2, -1 / R2]
  const N2: Ponto2 = [-1 / R2, -1 / R2]
  const O: Ponto2 = [0, 0]
  if (junta === 't') {
    // Base: superfície ao longo de U1 (passa por baixo da alma); alma: em pé ao longo de U2.
    const b0 = mais(O, U1, -(e + 15))
    const b1 = mais(O, U1, largura)
    const base: Ponto2[] = [b0, mais(b0, N1, e), mais(b1, N1, e), b1]
    const alma: Ponto2[] = [O, mais(O, N2, e), mais(mais(O, N2, e), U2, largura), mais(O, U2, largura)]
    return [base, alma].map((p) => antiHorario(p))
  }
  if (junta === 'sobreposta') {
    // Chapa de baixo ao longo de U1 (dos dois lados da raiz); a de cima, com espessura e, deitada nela.
    const b0 = mais(O, U1, -largura)
    const b1 = mais(O, U1, largura)
    const baixo: Ponto2[] = [b0, mais(b0, N1, e), mais(b1, N1, e), b1]
    const topoBorda = mais(O, U2, e)
    const cima: Ponto2[] = [O, mais(O, U1, -largura), mais(mais(O, U1, -largura), U2, e), topoBorda]
    return [baixo, cima].map((p) => antiHorario(p))
  }
  // Canto externo: as paredes do entalhe são as pontas das chapas (comprimento e); as chapas descem em "Λ".
  const a: Ponto2[] = [O, mais(O, U1, e), mais(mais(O, U1, e), N1, largura), mais(O, N1, largura)]
  const b: Ponto2[] = [O, mais(O, N2, largura), mais(mais(O, U2, e), N2, largura), mais(O, U2, e)]
  return [a, b].map((p) => antiHorario(p))
}

function antiHorario(p: Ponto2[]): Ponto2[] {
  let area = 0
  for (let i = 0; i < p.length; i++) {
    const [x0, y0] = p[i]
    const [x1, y1] = p[(i + 1) % p.length]
    area += x0 * y1 - x1 * y0
  }
  return area >= 0 ? p : [...p].reverse()
}

/**
 * Superfície visível das chapas de um lado da junta, a partir da linha da
 * junta (polilinha no plano (n, w)): o topo das chapas no topo reto e no V;
 * as paredes do entalhe e o que vem depois delas no filete.
 */
function superficieDoLado(junta: TipoJunta, d: DimensoesJunta, lado: -1 | 1, largura: number): Ponto2[] {
  const O: Ponto2 = [0, 0]
  const mais = (p: Ponto2, u: Ponto2, k: number): Ponto2 => [p[0] + u[0] * k, p[1] + u[1] * k]
  const e = d.espessuraMm
  if (INFO_JUNTA[junta].familia === 'chanfro') return [O, [lado * largura, 0]]
  const U = lado > 0 ? U1 : U2
  const N: Ponto2 = lado > 0 ? [1 / R2, -1 / R2] : [-1 / R2, -1 / R2]
  if (junta === 't') return [O, mais(O, U, largura)]
  if (junta === 'sobreposta') return lado > 0 ? [O, mais(O, U1, largura)] : [O, mais(O, U2, e), mais(mais(O, U2, e), U1, -largura)]
  return [O, mais(O, U, e), mais(mais(O, U, e), N, largura)]
}

/** Anda `distancia` mm pela polilinha. */
function andar(linha: Ponto2[], distancia: number): Ponto2 {
  let resto = Math.max(0, distancia)
  for (let k = 0; k + 1 < linha.length; k++) {
    const [a, b] = [linha[k], linha[k + 1]]
    const comp = Math.hypot(b[0] - a[0], b[1] - a[1])
    if (resto <= comp || k + 2 === linha.length) {
      const f = comp > 0 ? Math.min(1, resto / comp) : 0
      return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]
    }
    resto -= comp
  }
  return linha[linha.length - 1]
}

/**
 * Ponto na superfície das chapas a um desvio lateral n da junta, como visto
 * de frente (marcas da missão, régua): na face (w = 0) nas juntas de topo;
 * subindo pelas paredes no filete (o desvio n na face é n·√2 na parede).
 */
export function pontoNaSuperficie(junta: TipoJunta, d: DimensoesJunta, n: number): Ponto2 {
  if (INFO_JUNTA[junta].familia === 'chanfro') return [n, 0]
  return andar(superficieDoLado(junta, d, n >= 0 ? 1 : -1, 200), Math.abs(n) * R2)
}

/**
 * Ponto na superfície das chapas ao lado do cordão, a `distanciaMm` da
 * borda dele (halo de calor e tinta térmica).
 */
export function pontoAoLado(s: SecaoLocal, junta: TipoJunta, d: DimensoesJunta, lado: -1 | 1, distanciaMm: number): Ponto2 {
  const [z1, z2] = s.pernasMm ?? [s.larguraMm / R2, s.larguraMm / R2]
  return pontoAoLadoDe(junta, d, s.larguraMm, s.yCentroMm, z1, z2, lado, distanciaMm)
}

/** O mesmo de pontoAoLado, com as medidas soltas (o 3D guarda só os números). */
export function pontoAoLadoDe(junta: TipoJunta, d: DimensoesJunta, larguraMm: number, yCentroMm: number, perna1: number, perna2: number, lado: -1 | 1, distanciaMm: number): Ponto2 {
  if (INFO_JUNTA[junta].familia === 'filete') return andar(superficieDoLado(junta, d, lado, 200), (lado > 0 ? perna1 : perna2) + distanciaMm)
  return [yCentroMm + lado * (larguraMm / 2 + distanciaMm), 0]
}

// ------------------------------------------------------------ posição (H47)

/** Como a peça está posicionada: tombada em torno do eixo horizontal da tela e girada no próprio plano (H42). */
export interface PosicaoPeca {
  /** 0° = face da junta para cima; 90° = de pé; 180° = de cabeça para baixo. */
  rolagemGraus: number
  /** Giro no plano da peça (H42), positivo = horário na tela. */
  giroGraus: number
}

export const POSICAO_PLANA: PosicaoPeca = { rolagemGraus: 0, giroGraus: 0 }
export const ROLAGEM_MAX_GRAUS = 180

/** Gravidade (vetor unitário) nos eixos da junta: t ao longo da junta, n lateral, w para fora da face. */
export interface GravidadeJunta {
  t: number
  n: number
  w: number
}

/**
 * Gravidade vista da junta. A câmera olha sempre de frente para a face;
 * tombar a peça φ leva a gravidade de "para dentro da face" (plana) para
 * "para baixo na tela" (90°) e "para fora da face" (180°, sobrecabeça). O
 * giro θ no plano decide se ela fica de lado (horizontal) ou ao longo da
 * junta (vertical).
 */
export function gravidade(p: PosicaoPeca): GravidadeJunta {
  const f = (p.rolagemGraus * Math.PI) / 180
  const q = (p.giroGraus * Math.PI) / 180
  return { t: Math.sin(q) * Math.sin(f), n: Math.cos(q) * Math.sin(f), w: -Math.cos(f) }
}

/**
 * H103: gravidade num ponto da emenda de dois tubos. A junta de topo é a
 * circunferência desenrolada: o ponto s fica a φ = (s − topo)/R + giro do
 * tubo do alto do tubo. Em cima é plana; no lado, vertical (descendo ou
 * subindo conforme o sentido); embaixo, sobrecabeça. Tombar a peça
 * (rolagem) põe o eixo do tubo de pé: aí a solda em volta é horizontal (2G).
 * No tubo, o "giro" da posição é a rotação do tubo no próprio eixo.
 */
/** H103: ângulo em que o tubo chega: a emenda da volta (INÍCIO e FIM da junta) no alto. */
export const GIRO_INICIAL_TUBO_GRAUS = 180

export function gravidadeTubo(p: PosicaoPeca, sMm: number, diametroMm: number, topoMm: number): GravidadeJunta {
  const f = (p.rolagemGraus * Math.PI) / 180
  const phi = (sMm - topoMm) / (diametroMm / 2) + (p.giroGraus * Math.PI) / 180
  return { t: Math.sin(phi) * Math.cos(f), n: Math.sin(f), w: -Math.cos(phi) * Math.cos(f) }
}

export type CodigoPosicao = 'plana' | 'horizontal' | 'vertical' | 'sobrecabeca'

export const NOME_POSICAO: Record<CodigoPosicao, string> = {
  plana: 'Plana',
  horizontal: 'Horizontal',
  vertical: 'Vertical',
  sobrecabeca: 'Sobrecabeça',
}

/** Códigos usuais (AWS/ASME e ISO 6947) de cada posição, por família. */
export const SIGLAS_POSICAO: Record<FamiliaJunta, Record<CodigoPosicao, string>> = {
  chanfro: { plana: '1G · PA', horizontal: '2G · PC', vertical: '3G · PF/PG', sobrecabeca: '4G · PE' },
  filete: { plana: '1F · PA', horizontal: '2F · PB', vertical: '3F · PF/PG', sobrecabeca: '4F · PD' },
}

/** Nome da posição pela direção da gravidade (limites do jogo: 30° da plana, 45° da sobrecabeça). */
export function posicaoDe(g: GravidadeJunta): CodigoPosicao {
  if (g.w <= -Math.cos(Math.PI / 6)) return 'plana'
  if (g.w >= Math.cos(Math.PI / 4)) return 'sobrecabeca'
  return Math.abs(g.t) > Math.abs(g.n) ? 'vertical' : 'horizontal'
}

export interface EfeitoPosicao {
  /** Multiplica a razão altura/largura (forma, H9). */
  razao: number
  /** Multiplica o aporte efetivo (fusão, H33). */
  fusao: number
  /** Deslocamento lateral do metal para o lado de baixo (mm). */
  desvioMm: number
}

export const SEM_EFEITO: EfeitoPosicao = { razao: 1, fusao: 1, desvioMm: 0 }

/**
 * Efeito da gravidade sobre a poça (H47), em `sentido` de avanço ao longo
 * da junta (+1, −1 ou 0 parado). Direções da prática: de cabeça para baixo
 * o metal tende a pingar (cordão mais convexo, funde menos); na vertical a
 * poça escorre — subindo funde mais e fica convexo, descendo funde menos e
 * fica raso; na horizontal o metal escorre para a chapa de baixo. Na plana
 * nada muda (as etapas anteriores ficam iguais). Os números são do jogo.
 */
export function efeitoPosicao(g: GravidadeJunta, sentido: number): EfeitoPosicao {
  if (g.w <= -0.999999) return SEM_EFEITO
  const cabeca = Math.max(0, g.w)
  const aoLongo = g.t * Math.sign(sentido)
  const descendo = Math.max(0, aoLongo)
  const subindo = Math.max(0, -aoLongo)
  const lado = Math.abs(g.n)
  return {
    razao: 1 + 0.35 * cabeca + 0.25 * subindo - 0.25 * descendo + 0.1 * lado,
    fusao: Math.max(0.3, 1 - 0.2 * cabeca + 0.15 * subindo - 0.3 * descendo),
    desvioMm: 0.8 * g.n,
  }
}
