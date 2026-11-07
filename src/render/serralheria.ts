import * as THREE from 'three'
import { criarOficinaTreino } from './oficinaTreino'

/** Posto de fabricação de suportes. Tudo fica fora da área central de trabalho. */
export function criarSerralheria(piso: number): { grupo: THREE.Group; texturas: THREE.Texture[] } {
  const grupo = criarOficinaTreino(piso, { armario: false })
  grupo.name = 'Serralheria — suporte de prateleira'
  const aco = new THREE.MeshStandardMaterial({ color: '#68727a', metalness: 0.65, roughness: 0.62 })
  const escuro = new THREE.MeshStandardMaterial({ color: '#313b43', metalness: 0.5, roughness: 0.75 })
  const amarelo = new THREE.MeshStandardMaterial({ color: '#a88c43', metalness: 0.25, roughness: 0.8 })
  const caixa = (l: number, a: number, p: number, x: number, y: number, z: number, mat = aco) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(l, a, p), mat)
    m.position.set(x, y, z)
    m.castShadow = m.receiveShadow = true
    grupo.add(m)
    return m
  }
  // Cavalete lateral com perfis cortados: faces abertas deixam claro o tubo quadrado.
  for (const x of [-357, -245]) {
    caixa(10, 250, 10, x, piso + 125, -245, escuro)
    caixa(12, 12, 135, x, piso + 8, -190, escuro)
    for (const y of [piso + 55, piso + 155]) caixa(8, 8, 120, x, y, -190, amarelo)
  }
  caixa(122, 8, 8, -301, piso + 235, -245, escuro)
  for (let camada = 0; camada < 2; camada++) for (let i = 0; i < 5; i++) {
    const x = -345 + i * 21
    const y = piso + 68 + camada * 100
    const z = -167 - (i % 2) * 12
    const comprimento = 166 + (i % 3) * 12
    caixa(14, 2, comprimento, x, y - 6, z)
    caixa(14, 2, comprimento, x, y + 6, z)
    caixa(2, 10, comprimento, x - 6, y, z)
    caixa(2, 10, comprimento, x + 6, y, z)
  }
  // Suportes acabados na bancada: contexto do serviço, sem mudar a junta da missão.
  for (const x of [-80, -25]) {
    caixa(34, 4, 48, x, -107, -210)
    caixa(34, 42, 4, x, -84, -232)
    const reforco = caixa(5, 48, 5, x, -88, -211)
    reforco.rotation.x = -Math.PI / 4
  }
  // Barras de reposição apoiadas no piso e presas em abraçadeiras na parede.
  for (const x of [208, 233, 258]) {
    caixa(12, 330, 12, x, piso + 165, -264, escuro)
    caixa(18, 7, 19, x, piso + 220, -266, amarelo)
  }
  // Quadro fixado à parede: identifica o serviço e mostra uma vista esquemática.
  const tela = document.createElement('canvas')
  tela.width = 768
  tela.height = 256
  const ctx = tela.getContext('2d')!
  ctx.fillStyle = '#23343f'
  ctx.fillRect(0, 0, 768, 256)
  ctx.strokeStyle = '#a18c59'
  ctx.lineWidth = 5
  ctx.strokeRect(7, 7, 754, 242)
  ctx.fillStyle = '#e0e4df'
  ctx.font = 'bold 36px sans-serif'
  ctx.fillText('SERRALHERIA', 30, 60)
  ctx.font = '26px sans-serif'
  ctx.fillText('SUPORTE DE PRATELEIRA', 30, 104)
  ctx.font = '21px sans-serif'
  ctx.fillStyle = '#b9c7cb'
  ctx.fillText('Cortar · montar · soldar', 30, 157)
  ctx.strokeStyle = '#c7d6d9'
  ctx.lineWidth = 8
  ctx.beginPath()
  ctx.moveTo(570, 45)
  ctx.lineTo(570, 200)
  ctx.lineTo(715, 200)
  ctx.moveTo(575, 75)
  ctx.lineTo(690, 195)
  ctx.stroke()
  const textura = new THREE.CanvasTexture(tela)
  textura.colorSpace = THREE.SRGBColorSpace
  const placa = new THREE.Mesh(new THREE.PlaneGeometry(180, 60), new THREE.MeshStandardMaterial({ map: textura, roughness: 0.9 }))
  placa.position.set(200, 5, -279)
  grupo.add(placa)
  return { grupo, texturas: [textura] }
}
