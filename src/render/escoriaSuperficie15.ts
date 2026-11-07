import { alturaMetalEletrodo } from './metalEletrodo'
import { DepositoEletrodo } from '../modelo/depositoEletrodo'
import * as THREE from 'three'
import type { Escoria15 } from '../modelo/escoria15'
import type { Cordao } from '../modelo/cordao'
import { cristaMm, type TipoJunta } from '../modelo/juntas'

export function alturaCrostaEletrodo(c:DepositoEletrodo,x:number,y:number,quantidade:number){
  return alturaMetalEletrodo(c,x,y)+.10+.18*Math.min(1,quantidade*3)
}

/** Crosta superficial contínua. A grade física é a máscara; não são grãos depositados. */
export function criarSuperficieEscoria15(superficie: (n: number) => number = () => 0, junta: TipoJunta = 'topo') {
  const colunas = 149, linhas = 199
  const passoX = 1, passoY = .5
  const inicioX = .5, inicioY = -49.75
  const vertices = (colunas + 1) * (linhas + 1)
  const posicoes = new Float32Array(vertices * 3), cores = new Float32Array(vertices * 3), uvs = new Float32Array(vertices * 2)
  const indices: number[] = []
  for (let j = 0; j <= linhas; j++) for (let i = 0; i <= colunas; i++) {
    const n = j * (colunas + 1) + i
    posicoes[n * 3] = inicioX + i * passoX - 75
    posicoes[n * 3 + 2] = inicioY + j * passoY
    uvs[n * 2] = i / colunas
    uvs[n * 2 + 1] = j / linhas
    if (i < colunas && j < linhas) {
      indices.push(n, n + colunas + 1, n + 1, n + 1, n + colunas + 1, n + colunas + 2)
    }
  }
  const geometria = new THREE.BufferGeometry()
  geometria.setAttribute('position', new THREE.BufferAttribute(posicoes, 3))
  geometria.setAttribute('color', new THREE.BufferAttribute(cores, 3))
  geometria.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))
  geometria.setIndex(indices)
  const pixels = new Uint8Array(colunas * linhas * 4)
  const textura = new THREE.DataTexture(pixels, colunas, linhas, THREE.RGBAFormat)
  textura.magFilter = textura.minFilter = THREE.LinearFilter
  // H75: crosta vítrea fissurada, em placas; não uma fileira de esferas.
  const imagem = document.createElement('canvas')
  imagem.width = 512; imagem.height = 256
  const ctx = imagem.getContext('2d')!
  const dados = ctx.createImageData(512, 256)
  const ruido = (x: number, y: number) => { const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return n - Math.floor(n) }
  for (let y = 0; y < 256; y++) for (let x = 0; x < 512; x++) {
    const u = x / 22, v = y / 18, a = Math.floor(u), b = Math.floor(v)
    let d1 = Infinity, d2 = Infinity
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
      const dx = a + i + ruido(a+i,b+j) - u, dy = b+j + ruido(b+j+83,a+i) - v
      const d = dx*dx+dy*dy
      if (d < d1) { d2 = d1; d1 = d } else if (d < d2) d2 = d
    }
    const fissura = Math.min(1, (Math.sqrt(d2)-Math.sqrt(d1)) / 0.06)
    const tom = 95 + fissura * 115 + ruido(x,y) * 28
    const k = (y*512+x)*4
    dados.data.set([tom, tom * 0.98, tom * 0.94, 255],k)
  }
  ctx.putImageData(dados,0,0)
  const crosta = new THREE.CanvasTexture(imagem)
  const material = new THREE.MeshStandardMaterial({ color: '#ffffff', vertexColors: true, map: crosta, bumpMap: crosta, bumpScale: 0.24, roughness: 0.78, metalness: 0.16, alphaMap: textura, alphaTest: 0.12, side: THREE.DoubleSide })
  const malha = new THREE.Mesh(geometria, material)
  malha.frustumCulled = false
  malha.receiveShadow = true
  const fria = new THREE.Color('#393b37'), quente = new THREE.Color('#c46b2c'), cor = new THREE.Color()
  const residuo = new THREE.Color('#6c6860')
  return {
    malha, textura, crosta,
    atualizar(escoria: Escoria15, cordao: Cordao | DepositoEletrodo) {
      malha.visible = escoria.cobertura > 0.001
      if (!malha.visible) return
      const amostrar = (dados: Float64Array, x: number, y: number) => {
        const u = Math.max(0, Math.min(49, x / 3 - 0.5)), v = Math.max(0, Math.min(33, (y + 50) / 3 - 0.5))
        const i = Math.floor(u), j = Math.floor(v), a = u-i, b = v-j
        const q = (c: number, l: number) => dados[Math.min(33,l)*50+Math.min(49,c)]
        return q(i,j)*(1-a)*(1-b)+q(i+1,j)*a*(1-b)+q(i,j+1)*(1-a)*b+q(i+1,j+1)*a*b
      }
      for (let j = 0; j < linhas; j++) for (let i = 0; i < colunas; i++) {
        const q = amostrar(escoria.quantidade, inicioX+(i+0.5)*passoX, inicioY+(j+0.5)*passoY)
        const alfa = Math.round(Math.min(1, q * 6) * 255)
        pixels.set([alfa, alfa, alfa, 255], (j*colunas+i)*4)
      }
      const local = cordao instanceof DepositoEletrodo ? cordao : null
      const cordoes = cordao instanceof DepositoEletrodo ? [] : [cordao, ...cordao.soltos]
      for (let j = 0; j <= linhas; j++) for (let i = 0; i <= colunas; i++) {
        const n = j * (colunas + 1) + i
        const x = inicioX + i * passoX, y = inicioY + j * passoY
        let topo = local ? local.altura(x,y) : superficie(y), calor = 0, quantidade = 0, fragmentos = 0, amostras = 0
        for (const c of cordoes) {
          const s = c.secao(c.indiceEm(x))
          const r = Math.abs(s.yCentroMm - y) / Math.max(0.2, s.larguraMm / 2)
          if (r < 1) topo = Math.max(topo, cristaMm(s, junta) * (1 - r * r))
        }
        quantidade = amostrar(escoria.quantidade,x,y)
        fragmentos = amostrar(escoria.fragmentos,x,y)
        calor = amostrar(escoria.calor,x,y) * quantidade
        amostras = 1
        // Sobre o cordão 3D (H86) a crosta volta à espessura da v1.5: a crista desenhada é mais alta que a parábola usada aqui.
        posicoes[n * 3 + 1] = local ? alturaCrostaEletrodo(local,x,y,quantidade) : topo + 0.35 + 0.25 * Math.min(1, quantidade / Math.max(1, amostras) * 3)
        cor.copy(fria).lerp(quente, quantidade > 0 ? calor / quantidade : 0)
        if (quantidade > 0) cor.lerp(residuo, fragmentos / quantidade)
        cores.set([cor.r, cor.g, cor.b], n * 3)
      }
      textura.needsUpdate = true
      geometria.attributes.position.needsUpdate = true
      geometria.attributes.color.needsUpdate = true
      geometria.computeVertexNormals()
    },
  }
}
