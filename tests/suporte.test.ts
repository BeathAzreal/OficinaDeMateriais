import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { Palco3D } from '../src/render/palco3d'

describe('Colisão da peça com suporte fixo', () => {
  it('permite posição livre, bloqueia interseção e restaura a transformação após testar', () => {
    const cena = new THREE.Scene(), giro = new THREE.Group()
    cena.add(giro)
    const chapa = new THREE.Mesh(new THREE.BoxGeometry(100, 4, 20))
    giro.add(chapa)
    const coluna = new THREE.Mesh(new THREE.BoxGeometry(8, 30, 8))
    coluna.position.set(0, 0, 40); cena.add(coluna)
    const sapata = new THREE.Mesh(new THREE.BoxGeometry(10, 10, 10))
    sapata.position.set(0, -100, 40); cena.add(sapata)
    const garra = new THREE.Mesh(new THREE.BoxGeometry(5, 5, 5))
    garra.position.set(150, 0, 0); cena.add(garra)
    const alvo = { cena, giro, coluna, sapata, garra, chapasColisao: [chapa] } as unknown as Palco3D
    const posicaoSuporte = coluna.position.clone()
    expect(Palco3D.prototype.permitePosicao.call(alvo, 0, 0)).toBe(true)
    expect(Palco3D.prototype.permitePosicao.call(alvo, 90, 0)).toBe(false)
    expect(Palco3D.prototype.permitePosicao.call(alvo, 360, 0)).toBe(true)
    expect(giro.rotation.x).toBe(0)
    expect(giro.rotation.y).toBe(0)
    expect(coluna.position.equals(posicaoSuporte)).toBe(true)

  })
})

it('a orelha permanece no ponto de fixação ao girar em torno da garra', () => {
  const giro = new THREE.Group(), peca = new THREE.Group()
  const orelha = new THREE.Vector3(85, -3, 0)
  giro.position.copy(orelha); peca.position.copy(orelha).negate(); giro.add(peca)
  for (const [x,y] of [[0,0],[.2,.1],[-.4,-.2],[1,2]]) {
    giro.rotation.set(x,y,0); giro.updateMatrixWorld(true)
    expect(peca.localToWorld(orelha.clone()).distanceTo(orelha)).toBeLessThan(1e-9)
  }
})
