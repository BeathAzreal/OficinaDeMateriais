import {describe,it,expect} from 'vitest'
import {DepositoEletrodo} from '../src/modelo/depositoEletrodo'
import {PECAS_ELETRODO} from '../src/missoes/pecasEletrodo'
import {alturaCrostaEletrodo} from '../src/render/escoriaSuperficie15'
import {criarMetalEletrodo,alturaMetalEletrodo} from '../src/render/metalEletrodo'
describe('superfícies SMAW coerentes H79',()=>{
 it('a crosta acompanha o metal abaixo da face sem ficar suspensa na chapa',()=>{
  const c=new DepositoEletrodo(PECAS_ELETRODO[2]);c.depositar(75,0,10)
  const h=alturaMetalEletrodo(c,75,0),crosta=alturaCrostaEletrodo(c,75,0,1)
  expect(h).toBeLessThan(-5);expect(crosta).toBeLessThan(0)
  expect(crosta-h).toBeCloseTo(.28,8)
 })
 it('o 3D usa as mesmas alturas do modelo, inclusive os depósitos fora da junta',()=>{
  const c=new DepositoEletrodo(PECAS_ELETRODO[0]);c.depositar(75,0,5);c.depositar(75,14,10)
  const v=criarMetalEletrodo();v.atualizar(c)
  const pos=v.malha.geometry.getAttribute('position')
  for(const j of [99,100,127,128]){
   const k=j*c.nx+75
   expect(pos.getY(k)).toBeCloseTo(alturaMetalEletrodo(c,c.x(75),c.y(j)),5)
  }
  expect(v.malha.geometry.index!.count).toBeGreaterThan(0)
  v.malha.geometry.dispose();v.malha.material.dispose()
 })
})
