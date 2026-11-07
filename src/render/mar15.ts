import * as THREE from 'three'
import type { Palco3D } from './palco3d'
import { criarParticulas } from './fundoMar'

/*
 * H110: o que só existe no mar, por cima da bancada do eletrodo:
 * - a lanterna do capacete (luz de foco que sai de perto da câmera e vai até o
 *   ponto escolhido, com o feixe visível na água);
 * - as bolhas do arco (vapor e gás do revestimento) e as da respiração;
 * - a neve marinha (partículas em suspensão).
 * As bolhas e o arco ficam no grupo da peça (mm da peça); a lanterna, na cena.
 */

const MAX_BOLHAS = 260

/** Bolha: anel claro com reflexo, em textura pequena gerada em código. */
function texturaBolha(): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const g = c.getContext('2d')!
  const r = g.createRadialGradient(32, 32, 18, 32, 32, 31)
  r.addColorStop(0, 'rgba(255,255,255,0.05)')
  r.addColorStop(0.75, 'rgba(220,245,255,0.55)')
  r.addColorStop(1, 'rgba(220,245,255,0)')
  g.fillStyle = r
  g.beginPath(); g.arc(32, 32, 31, 0, Math.PI * 2); g.fill()
  g.fillStyle = 'rgba(255,255,255,0.9)'
  g.beginPath(); g.arc(23, 22, 5, 0, Math.PI * 2); g.fill()
  return new THREE.CanvasTexture(c)
}

export function criarMar(palco: Palco3D, camera: THREE.Camera, brilho: THREE.Texture, turbidez: number) {
  // Lanterna: foco estreito e forte, com sombra (a vareta e o alicate projetam sombra na chapa).
  const lanterna = new THREE.SpotLight('#eaf6ff', 0, 0, 0.3, 0.55, 2)
  lanterna.castShadow = true
  lanterna.shadow.mapSize.set(1024, 1024)
  lanterna.shadow.camera.near = 20
  lanterna.shadow.camera.far = 3000
  lanterna.shadow.bias = -0.0005
  palco.cena.add(lanterna, lanterna.target)
  const intensidade = 700000 * (1 - 0.35 * turbidez)
  // Feixe na água: cone aditivo bem fraco, do vidro da lanterna até o ponto iluminado.
  const geoFeixe = new THREE.CylinderGeometry(1, 0.04, 1, 28, 1, true)
  geoFeixe.translate(0, -0.5, 0)
  geoFeixe.rotateX(-Math.PI / 2)
  const feixe = new THREE.Mesh(geoFeixe, new THREE.MeshBasicMaterial({
    color: '#bfe6ff', transparent: true, opacity: 0.035 + 0.05 * turbidez, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
  }))
  feixe.frustumCulled = false
  palco.cena.add(feixe)
  // Mancha no ponto iluminado (o espalhamento da água em volta do foco).
  const mancha = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({
    map: brilho, color: '#9fd8ff', transparent: true, opacity: 0.12 + 0.15 * turbidez, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
  }))
  palco.cena.add(mancha)
  const alvoLocal = new THREE.Vector3(0, 0, 0)
  const alvoMundo = new THREE.Vector3()
  const direita = new THREE.Vector3(), cima = new THREE.Vector3(), frente = new THREE.Vector3()
  let ligada = true

  // Bolhas: as do arco sobem da poça; as da respiração passam na frente da máscara.
  const textura = texturaBolha()
  palco.guardarTexturas(textura)
  const pos = new Float32Array(MAX_BOLHAS * 3)
  const vel = new Float32Array(MAX_BOLHAS * 3)
  const vida = new Float32Array(MAX_BOLHAS)
  const tam = new Float32Array(MAX_BOLHAS)
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  geo.setAttribute('tamanho', new THREE.BufferAttribute(tam, 1))
  const mat = new THREE.PointsMaterial({ map: textura, color: '#e6f8ff', size: 3, sizeAttenuation: true, transparent: true, depthWrite: false, opacity: 0.9 })
  // Tamanho por bolha (atributo), no shader do PointsMaterial.
  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = 'attribute float tamanho;\n' + shader.vertexShader.replace('gl_PointSize = size;', 'gl_PointSize = size * tamanho;')
  }
  mat.customProgramCacheKey = () => 'bolhas-v1'
  const bolhas = new THREE.Points(geo, mat)
  bolhas.frustumCulled = false
  palco.peca.add(bolhas)
  let proxima = 0, acumulado = 0, respiracao = 2.5
  const soltar = (x: number, y: number, z: number, vx: number, vy: number, vz: number, t: number, s: number) => {
    const i = proxima
    proxima = (proxima + 1) % MAX_BOLHAS
    pos.set([x, y, z], i * 3); vel.set([vx, vy, vz], i * 3); vida[i] = t; tam[i] = s
  }
  // Bolha de vapor em volta do arco: cresce, se solta e começa outra.
  const bolhao = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), new THREE.MeshStandardMaterial({
    color: '#d8f4ff', transparent: true, opacity: 0.22, roughness: 0.05, metalness: 0, depthWrite: false,
  }))
  palco.peca.add(bolhao)
  let crescimento = 0
  const neve = criarParticulas(500, turbidez)
  palco.cena.add(neve.pontos)
  const camLocal = new THREE.Vector3()

  return {
    get ligada() { return ligada },
    ligar(l: boolean) { ligada = l },
    /** Ponto da peça (coordenadas do grupo da peça) para onde a lanterna aponta. */
    apontar(x: number, y: number, z: number) { alvoLocal.set(x, y, z) },
    atualizar(dt: number, arco: boolean, x: number, y: number, z: number, agoraMs: number) {
      // Lanterna presa ao capacete: um pouco acima e à direita dos olhos.
      direita.setFromMatrixColumn(camera.matrixWorld, 0)
      cima.setFromMatrixColumn(camera.matrixWorld, 1)
      lanterna.position.copy(camera.position).addScaledVector(direita, 45).addScaledVector(cima, 30)
      palco.peca.updateMatrixWorld()
      alvoMundo.copy(alvoLocal)
      palco.peca.localToWorld(alvoMundo)
      lanterna.target.position.copy(alvoMundo)
      lanterna.target.updateMatrixWorld()
      lanterna.intensity = ligada ? intensidade : 0
      const dist = lanterna.position.distanceTo(alvoMundo)
      frente.subVectors(alvoMundo, lanterna.position).normalize()
      feixe.visible = mancha.visible = ligada
      feixe.position.copy(lanterna.position)
      feixe.lookAt(alvoMundo)
      const abertura = Math.tan(lanterna.angle) * dist
      feixe.scale.set(abertura, abertura, dist)
      mancha.position.copy(alvoMundo).addScaledVector(frente, -6)
      mancha.lookAt(lanterna.position)
      mancha.scale.setScalar(abertura * 2.2)

      // Bolhas do arco: muitas, pequenas, e o bolhão que se solta.
      if (arco) {
        acumulado += dt * 70
        crescimento += dt * (2.2 + Math.random())
        if (crescimento >= 1) {
          crescimento = 0
          soltar(x, y + 9, z, (Math.random() - 0.5) * 20, 90, (Math.random() - 0.5) * 20, 4, 6 + Math.random() * 3)
        }
      } else crescimento = Math.max(0, crescimento - dt * 3)
      while (acumulado >= 1) {
        acumulado -= 1
        soltar(x + (Math.random() - 0.5) * 6, y + 2, z + (Math.random() - 0.5) * 6,
          (Math.random() - 0.5) * 40, 60 + Math.random() * 90, (Math.random() - 0.5) * 40, 2.5 + Math.random() * 2, 0.6 + Math.random() * 1.4)
      }
      const r = 3 + 8 * crescimento
      bolhao.visible = arco
      bolhao.position.set(x, y + r * 0.7, z)
      bolhao.scale.set(r, r * 0.9, r)
      // Respiração: a cada poucos segundos, um jato de bolhas sobe na frente da máscara.
      respiracao -= dt
      if (respiracao <= 0) {
        respiracao = 3.5 + Math.random() * 1.5
        palco.peca.worldToLocal(camLocal.copy(camera.position))
        for (let k = 0; k < 26; k++) {
          soltar(camLocal.x * 0.55 + (Math.random() - 0.5) * 40, camLocal.y * 0.55 - 40 + Math.random() * 20, camLocal.z * 0.55 + (Math.random() - 0.5) * 40,
            (Math.random() - 0.5) * 30, 120 + Math.random() * 120, (Math.random() - 0.5) * 30, 3, 1.5 + Math.random() * 4)
        }
      }
      for (let i = 0; i < MAX_BOLHAS; i++) {
        if (vida[i] <= 0) { tam[i] = 0; continue }
        vida[i] -= dt
        // Sobem cada vez mais rápido e balançam de lado (zigue-zague das bolhas).
        vel[i * 3 + 1] += dt * 40
        pos[i * 3] += (vel[i * 3] + Math.sin(agoraMs * 0.008 + i) * 25) * dt
        pos[i * 3 + 1] += vel[i * 3 + 1] * dt
        pos[i * 3 + 2] += (vel[i * 3 + 2] + Math.cos(agoraMs * 0.007 + i * 1.3) * 25) * dt
        if (vida[i] <= 0) tam[i] = 0
      }
      geo.attributes.position.needsUpdate = true
      geo.attributes.tamanho.needsUpdate = true
      neve.atualizar(dt)
    },
  }
}
