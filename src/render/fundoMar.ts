import * as THREE from 'three'

/*
 * H110: cenário da solda subaquática. Fundo de areia, pedras, a estrutura onde
 * a peça está presa (estaca, casco ou perna de plataforma), algas e a luz fraca
 * que desce da superfície. Escala em mm, como o resto da bancada: a peça fica
 * na origem e o fundo, 380 mm abaixo dela.
 */

/** Cor da água ao longe (fundo e névoa) para cada turbidez. */
export function corAgua(turbidez: number): THREE.Color {
  return new THREE.Color('#03161c').lerp(new THREE.Color('#07140d'), Math.max(0, Math.min(1, turbidez)))
}

/** Densidade da névoa exponencial (mm⁻¹): água turva esconde tudo a poucos palmos. */
export function densidadeAgua(turbidez: number): number {
  return 0.0009 + 0.0011 * Math.max(0, Math.min(1, turbidez))
}

/** Sorteio fixo (o cenário sai igual em toda partida). */
function sorteio(semente: number): () => number {
  let s = semente >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

export function criarFundoMar(piso: number, op: { estrutura: 'cais' | 'casco' | 'plataforma' }): THREE.Group {
  const g = new THREE.Group()
  g.name = 'Fundo do mar'
  const r = sorteio(110)
  // Areia ondulada (marcas da correnteza).
  const geoAreia = new THREE.PlaneGeometry(6000, 6000, 90, 90)
  geoAreia.rotateX(-Math.PI / 2)
  const pos = geoAreia.attributes.position as THREE.BufferAttribute
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i)
    pos.setY(i, 6 * Math.sin(x * 0.02 + z * 0.006) + 3 * Math.sin(z * 0.013) + 14 * Math.sin(x * 0.0021) * Math.cos(z * 0.0017))
  }
  geoAreia.computeVertexNormals()
  const areia = new THREE.Mesh(geoAreia, new THREE.MeshStandardMaterial({ color: '#8a7f62', roughness: 1, metalness: 0 }))
  areia.position.y = piso
  areia.receiveShadow = true
  g.add(areia)
  // Pedras.
  const pedra = new THREE.MeshStandardMaterial({ color: '#4c5352', roughness: 0.95, flatShading: true })
  for (let i = 0; i < 26; i++) {
    const raio = 20 + r() * 90
    const m = new THREE.Mesh(new THREE.DodecahedronGeometry(raio, 0), pedra)
    const ang = r() * Math.PI * 2, dist = 260 + r() * 1500
    m.position.set(Math.cos(ang) * dist, piso + raio * 0.3, Math.sin(ang) * dist)
    m.scale.set(1, 0.45 + r() * 0.4, 0.8 + r() * 0.4)
    m.rotation.set(r(), r() * 6, r())
    m.castShadow = m.receiveShadow = true
    g.add(m)
  }
  // Algas: fitas finas que balançam (o balanço é no shader, sem custo por quadro).
  const alga = new THREE.MeshStandardMaterial({ color: '#2f5a32', roughness: 0.9, side: THREE.DoubleSide })
  const tempo = { value: 0 }
  alga.onBeforeCompile = (shader) => {
    shader.uniforms.uTempo = tempo
    shader.vertexShader = 'uniform float uTempo;\n' + shader.vertexShader.replace('#include <begin_vertex>',
      '#include <begin_vertex>\nfloat hAlga = max(0.0, position.y) / 300.0;\ntransformed.x += sin(uTempo * 1.3 + position.y * 0.012 + modelMatrix[3].x * 0.01) * 26.0 * hAlga * hAlga;')
  }
  alga.customProgramCacheKey = () => 'alga-v1'
  for (let i = 0; i < 40; i++) {
    const altura = 160 + r() * 420
    const geo = new THREE.PlaneGeometry(10 + r() * 14, altura, 1, 10)
    geo.translate(0, altura / 2, 0)
    const m = new THREE.Mesh(geo, alga)
    const ang = r() * Math.PI * 2, dist = 330 + r() * 1300
    m.position.set(Math.cos(ang) * dist, piso, Math.sin(ang) * dist)
    m.rotation.y = r() * Math.PI
    g.add(m)
  }
  // Estrutura onde a peça está presa: aço com cracas e ferrugem.
  const aco = new THREE.MeshStandardMaterial({ color: '#4a4f4c', roughness: 0.85, metalness: 0.4 })
  const ferrugem = new THREE.MeshStandardMaterial({ color: '#6b4a32', roughness: 0.95, metalness: 0.2 })
  const craca = new THREE.MeshStandardMaterial({ color: '#b9b5a4', roughness: 1 })
  const cracas = (alvo: THREE.Object3D, n: number, area: () => THREE.Vector3) => {
    for (let i = 0; i < n; i++) {
      const c = new THREE.Mesh(new THREE.ConeGeometry(4 + r() * 5, 6 + r() * 6, 6), craca)
      c.position.copy(area())
      alvo.add(c)
    }
  }
  if (op.estrutura === 'plataforma') {
    // Perna da jaqueta (tubo grosso) atrás da peça e um contraventamento em diagonal.
    const perna = new THREE.Mesh(new THREE.CylinderGeometry(260, 260, 4000, 40), aco)
    perna.position.set(0, piso + 2000, -560)
    perna.castShadow = perna.receiveShadow = true
    g.add(perna)
    const diag = new THREE.Mesh(new THREE.CylinderGeometry(110, 110, 3400, 28), ferrugem)
    diag.position.set(900, piso + 1300, -700)
    diag.rotation.z = 0.75
    g.add(diag)
    cracas(perna, 60, () => { const a = r() * Math.PI * 2; return new THREE.Vector3(Math.cos(a) * 262, (r() - 0.5) * 1600, Math.sin(a) * 262) })
  } else if (op.estrutura === 'casco') {
    // Casco da balsa por cima: fundo plano escuro e o costado descendo atrás.
    const fundo = new THREE.Mesh(new THREE.BoxGeometry(5000, 60, 2400), aco)
    fundo.position.set(0, 900, -400)
    g.add(fundo)
    const costado = new THREE.Mesh(new THREE.BoxGeometry(5000, 1200, 60), ferrugem)
    costado.position.set(0, 300, -620)
    costado.receiveShadow = true
    g.add(costado)
    cracas(costado, 70, () => new THREE.Vector3((r() - 0.5) * 2400, (r() - 0.5) * 1000, 32))
  } else {
    // Estacas-prancha do cais: parede ondulada de aço atrás da peça.
    for (let i = -8; i <= 8; i++) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(150, 3000, 30), i % 2 ? aco : ferrugem)
      p.position.set(i * 140, piso + 1500, -600 + (i % 2 ? 50 : 0))
      p.rotation.y = i % 2 ? 0.5 : -0.5
      p.receiveShadow = true
      g.add(p)
    }
    cracas(g, 50, () => new THREE.Vector3((r() - 0.5) * 2000, piso + 60 + r() * 900, -560))
  }
  // Estrutura escura e ar na superfície: um teto de água clara bem acima.
  const superficie = new THREE.Mesh(new THREE.PlaneGeometry(9000, 9000), new THREE.MeshBasicMaterial({ color: '#1d6d7e', side: THREE.DoubleSide, fog: true }))
  superficie.rotation.x = Math.PI / 2
  superficie.position.y = 3500
  g.add(superficie)
  g.userData.tempo = tempo
  return g
}

/** Partículas em suspensão (neve marinha), bem fracas, flutuando com a correnteza. */
export function criarParticulas(n: number, turbidez: number): { pontos: THREE.Points; atualizar: (dt: number) => void } {
  const r = sorteio(7)
  const pos = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) pos.set([(r() - 0.5) * 900, -300 + r() * 700, (r() - 0.5) * 900], i * 3)
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  const mat = new THREE.PointsMaterial({ color: '#b8cfc4', size: 1.4 + turbidez, sizeAttenuation: true, transparent: true, opacity: 0.35 + 0.35 * turbidez, depthWrite: false })
  const pontos = new THREE.Points(geo, mat)
  pontos.frustumCulled = false
  let t = 0
  return {
    pontos,
    atualizar(dt: number) {
      t += dt
      for (let i = 0; i < n; i++) {
        pos[i * 3] += Math.sin(t * 0.3 + i) * dt * 4 + dt * 6
        pos[i * 3 + 1] += Math.cos(t * 0.21 + i * 1.7) * dt * 3
        if (pos[i * 3] > 450) pos[i * 3] -= 900
      }
      geo.attributes.position.needsUpdate = true
    },
  }
}
