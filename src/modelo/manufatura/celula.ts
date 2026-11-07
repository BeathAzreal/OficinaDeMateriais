/*
 * Manufatura aditiva por deposição a arco (H106): a célula robotizada.
 *
 * Tudo aqui é puro (sem DOM e sem Three.js). As coordenadas são do sistema
 * da BASE do robô, em mm; a orientação da tocha vai em graus (Rx, Ry, Rz),
 * como o pendente mostra a posição cartesiana. A mesa foi posta de modo que
 * o topo do substrato fique em Z = 0, para as contas da parede ficarem
 * legíveis. O robô é ilustrativo: não há cinemática do MA1440 (H106-a).
 */

export interface Pose {
  x: number
  y: number
  z: number
  rx: number
  ry: number
  rz: number
}

/** Ponto ensinado do job (no arquivo do job, C00000, C00001...). */
export interface PontoEnsinado {
  pose: Pose
  /** Nome livre só para a tabela (não vai ao programa). */
  nome: string
}

export const POSE_ZERO: Pose = { x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0 }

/** Tocha vertical apontando para baixo, na convenção usada pelo simulador. */
export const ORIENTACAO_VERTICAL = { rx: 180, ry: 0, rz: 0 }

/** Limites do simulador (não são limites do controlador real). */
export const LIMITES = {
  linhas: 400,
  pontos: 100,
  variaveis: 100,
  instrucoesExecutadas: 20000,
  saltosParaTras: 2000,
  tempoSimuladoS: 3600,
  /** Envelope ilustrativo: o alcance nominal do MA1440 é 1440 mm. */
  alcanceMm: 1440,
  alcanceMinimoMm: 250,
}

/** Substrato e mesa. O topo do substrato fica em Z = 0 (H106). */
export const SUBSTRATO = {
  xMin: 660,
  xMax: 840,
  yMin: -40,
  yMax: 40,
  espessuraMm: 10,
  material: 'Aço inoxidável 316L',
}

/** Missão da parede: onde ela deve ficar e o que se exige (regras da missão, não de norma). */
export const MISSAO_PAREDE = {
  xInicio: 700,
  xFim: 800,
  y: 0,
  alturaMinMm: 15,
  larguraMinMm: 5,
  /** Desvio-padrão máximo da altura no trecho útil para nota cheia. */
  desvioAlturaBomMm: 0.5,
  /** Limite de interpasse que a missão adota (procedimento da missão, não norma). */
  interpasseMaxC: 200,
  /** Trecho útil: descarta as pontas, onde início e fim de cordão sempre deixam marca. */
  margemPontasMm: 10,
}

export const copiaPose = (p: Pose): Pose => ({ ...p })

export function somaPose(a: Pose, b: Pose): Pose {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z, rx: a.rx + b.rx, ry: a.ry + b.ry, rz: a.rz + b.rz }
}

export function distancia(a: Pose, b: Pose): number {
  return Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z)
}

/** Ângulo da tocha em relação à vertical (graus), pelo Rx/Ry. */
export function inclinacaoTocha(p: Pose): number {
  // Tocha para baixo = Rx 180, Ry 0. O desvio combina as duas rotações.
  const dx = normalizarAngulo(p.rx - 180), dy = normalizarAngulo(p.ry)
  return Math.hypot(dx, dy)
}

export function normalizarAngulo(a: number): number {
  let r = ((a + 180) % 360 + 360) % 360 - 180
  if (r === -180) r = 180
  return r
}

/** Fora do envelope ilustrativo? Devolve a mensagem ou null. */
export function foraDoAlcance(p: Pose): string | null {
  const r = Math.hypot(p.x, p.y, p.z)
  if (r > LIMITES.alcanceMm) return `fica a ${r.toFixed(0)} mm da base, além do alcance de ${LIMITES.alcanceMm} mm`
  if (Math.hypot(p.x, p.y) < LIMITES.alcanceMinimoMm && p.z < 400) return 'fica perto demais da base do robô'
  return null
}

/** Pontos ensinados do programa inicial (missão da parede reta). */
export function pontosIniciais(): PontoEnsinado[] {
  const v = ORIENTACAO_VERTICAL
  return [
    { nome: 'Repouso (longe da peça)', pose: { x: 560, y: -220, z: 260, ...v } },
    { nome: 'Aproximação sobre A', pose: { x: 700, y: 0, z: 40, ...v } },
    { nome: 'Início A (TCP no topo)', pose: { x: 700, y: 0, z: 0, ...v } },
    { nome: 'Fim B (TCP no topo)', pose: { x: 800, y: 0, z: 0, ...v } },
    { nome: 'Afastamento sobre B', pose: { x: 800, y: 0, z: 40, ...v } },
  ]
}
