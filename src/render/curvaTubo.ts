import * as THREE from 'three'

/*
 * H103: a emenda de dois tubos desenhada a partir da peça plana.
 *
 * O jogo inteiro trabalha com a junta desenrolada: x ao longo da junta (no
 * mundo da peça, x = s − 75 mm), y para fora da face e z para o lado. A
 * curvatura enrola esse plano num cilindro de raio R com o eixo em z, alto
 * do tubo em x = 0:
 *   a = x/R + giro,  X = (R + y)·sen a,  Y = (R + y)·cos a − R,  Z = z.
 * Chapa, cordão, defeitos e faixas de calor são curvados no vertex shader
 * (curvarMaterial); tocha, mira e ferramentas, que não podem entortar, são
 * postas no ponto curvado e inclinadas pela tangente (pose). A entrada faz
 * o caminho de volta (desdobrar). O modelo não muda: só o desenho.
 */

export interface CurvaTubo {
  /** Raio externo do tubo (mm). */
  readonly raio: number
  /** Rotação do tubo no próprio eixo (rad), a mesma do "giro" da posição. */
  giro: number
}

/** Ângulo do ponto x em volta do tubo, medido do alto (rad). */
export function anguloNoTubo(c: CurvaTubo, x: number): number {
  return x / c.raio + c.giro
}

/** Plano (x, y, z) → tubo. */
export function curvarPonto(c: CurvaTubo, x: number, y: number, z: number, saida = new THREE.Vector3()): THREE.Vector3 {
  const a = anguloNoTubo(c, x)
  const r = c.raio + y
  return saida.set(r * Math.sin(a), r * Math.cos(a) - c.raio, z)
}

/** Tubo → plano: o ângulo vira x (no intervalo de uma volta em torno do alto) e a distância ao eixo vira y. */
export function desdobrarPonto(c: CurvaTubo, X: number, Y: number, Z: number): { x: number; y: number; z: number } {
  let a = Math.atan2(X, Y + c.raio) - c.giro
  a = Math.atan2(Math.sin(a), Math.cos(a))
  return { x: a * c.raio, y: Math.hypot(X, Y + c.raio) - c.raio, z: Z }
}

/**
 * Raio (no espaço da peça) → ponto da superfície externa do tubo mais perto
 * da câmera, ou null se o raio não acerta o tubo.
 */
export function acertarTubo(c: CurvaTubo, origem: THREE.Vector3, direcao: THREE.Vector3): THREE.Vector3 | null {
  // Cilindro X² + (Y + R)² = R², eixo em z.
  const ox = origem.x, oy = origem.y + c.raio, dx = direcao.x, dy = direcao.y
  const a = dx * dx + dy * dy
  if (a < 1e-12) return null
  const b = 2 * (ox * dx + oy * dy)
  const cc = ox * ox + oy * oy - c.raio * c.raio
  const disc = b * b - 4 * a * cc
  if (disc < 0) return null
  const t = (-b - Math.sqrt(disc)) / (2 * a)
  if (t < 0) return null
  return origem.clone().addScaledVector(direcao, t)
}

/**
 * Pose de um objeto rígido: matriz que leva o referencial plano em torno de
 * (x, z) ao tubo, encostado e inclinado pela tangente. Dentro dela o objeto
 * continua com as coordenadas planas de sempre.
 */
export function poseNoTubo(c: CurvaTubo, x: number, z: number, saida = new THREE.Matrix4()): THREE.Matrix4 {
  const a = anguloNoTubo(c, x)
  const p = curvarPonto(c, x, 0, z)
  // Leva (x, 0, z) à origem, gira −a em torno de z e põe no ponto curvado.
  const ida = new THREE.Matrix4().makeTranslation(-x, 0, -z)
  const giro = new THREE.Matrix4().makeRotationZ(-a)
  const vinda = new THREE.Matrix4().makeTranslation(p.x, p.y, p.z)
  return saida.copy(vinda).multiply(giro).multiply(ida)
}

/** Uniformes compartilhados por todos os materiais curvados de uma peça. */
export function uniformesCurva(c: CurvaTubo) {
  return { uRaioTubo: { value: c.raio }, uGiroTubo: { value: c.giro } }
}

const FUNCOES_GLSL = `
uniform float uRaioTubo;
uniform float uGiroTubo;
vec3 curvarTubo(vec3 p) {
  float a = p.x / uRaioTubo + uGiroTubo;
  float r = uRaioTubo + p.y;
  return vec3(r * sin(a), r * cos(a) - uRaioTubo, p.z);
}
vec3 girarNormalTubo(vec3 n, float x) {
  float a = x / uRaioTubo + uGiroTubo;
  float c = cos(a), s = sin(a);
  return vec3(n.x * c + n.y * s, -n.x * s + n.y * c, n.z);
}
`

/**
 * Curva o material no vertex shader: a posição depois da instância (as
 * coordenadas planas da peça) e a normal pelo mesmo ângulo. Encadeia com um
 * onBeforeCompile que já exista. O objeto que usa o material tem de estar no
 * referencial da peça (sem rotação; deslocar em z não muda nada).
 */
export function curvarMaterial(mat: THREE.Material, u: ReturnType<typeof uniformesCurva>): void {
  const anterior = mat.onBeforeCompile
  const chaveAnterior = mat.customProgramCacheKey()
  mat.onBeforeCompile = (shader, renderer) => {
    anterior.call(mat, shader, renderer)
    shader.uniforms.uRaioTubo = u.uRaioTubo
    shader.uniforms.uGiroTubo = u.uGiroTubo
    let v = FUNCOES_GLSL + shader.vertexShader
    v = v.replace(
      'transformedNormal = normalMatrix * transformedNormal;',
      `{
        vec3 pTubo = position;
        #ifdef USE_INSTANCING
        pTubo = (instanceMatrix * vec4(position, 1.0)).xyz;
        #endif
        transformedNormal = girarNormalTubo(transformedNormal, pTubo.x);
      }
      transformedNormal = normalMatrix * transformedNormal;`,
    )
    v = v.replace(
      '#include <project_vertex>',
      `vec4 mvPosition = vec4( transformed, 1.0 );
      #ifdef USE_INSTANCING
      mvPosition = instanceMatrix * mvPosition;
      #endif
      mvPosition.xyz = curvarTubo(mvPosition.xyz);
      mvPosition = modelViewMatrix * mvPosition;
      gl_Position = projectionMatrix * mvPosition;`,
    )
    shader.vertexShader = v
  }
  mat.customProgramCacheKey = () => `${chaveAnterior}|tubo-v1`
  mat.needsUpdate = true
}

/**
 * Curva tudo o que estiver dentro de `raiz` (exceto os objetos de
 * `exceto` e seus filhos): materiais no shader, sem sombra projetada (o
 * mapa de sombra veria a peça plana) e sem recorte pela esfera envolvente
 * (calculada da forma plana). Materiais já curvados não são tocados de novo.
 */
export function curvarArvore(raiz: THREE.Object3D, u: ReturnType<typeof uniformesCurva>, curvados: WeakSet<THREE.Material>, exceto: Set<THREE.Object3D> = new Set()): void {
  const visitar = (o: THREE.Object3D) => {
    if (exceto.has(o)) return
    const m = (o as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined
    if (m) {
      for (const mat of Array.isArray(m) ? m : [m]) {
        if (curvados.has(mat)) continue
        curvados.add(mat)
        curvarMaterial(mat, u)
      }
      o.castShadow = false
      o.frustumCulled = false
    }
    for (const f of o.children) visitar(f)
  }
  visitar(raiz)
}
