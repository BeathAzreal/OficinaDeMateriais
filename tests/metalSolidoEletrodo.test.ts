import {describe,it,expect} from 'vitest'
import {DepositoEletrodo,baseEletrodo} from '../src/modelo/depositoEletrodo'
import {PECAS_ELETRODO} from '../src/missoes/pecasEletrodo'
import {criarMetalEletrodo} from '../src/render/metalEletrodo'

describe('cordão SMAW sólido H80',()=>{
 for(const p of [PECAS_ELETRODO[0],PECAS_ELETRODO[1],PECAS_ELETRODO[2]])it(`fecha topo, fundo e laterais: ${p.junta}`,()=>{
  const c=new DepositoEletrodo(p);for(let x=70;x<=80;x++)c.depositar(x,0,5)
  const v=criarMetalEletrodo();v.atualizar(c)
  const pos=v.malha.geometry.getAttribute('position'),idx=v.malha.geometry.index!
  const arestas=new Map<string,number>();let volume=0
  for(let t=0;t<idx.count;t+=3){
   const [a,b,d]=[idx.getX(t),idx.getX(t+1),idx.getX(t+2)]
   for(const [i,j] of [[a,b],[b,d],[d,a]]){const k=i<j?`${i}:${j}`:`${j}:${i}`;arestas.set(k,(arestas.get(k)??0)+1)}
   const ax=pos.getX(a),ay=pos.getY(a),az=pos.getZ(a),bx=pos.getX(b),by=pos.getY(b),bz=pos.getZ(b),dx=pos.getX(d),dy=pos.getY(d),dz=pos.getZ(d)
   volume+=(ax*(by*dz-bz*dy)+ay*(bz*dx-bx*dz)+az*(bx*dy-by*dx))/6
  }
  expect([...arestas.values()].every(n=>n===2)).toBe(true)
  expect(volume).toBeGreaterThan(0)
  const k=100*c.nx+75,n=c.nx*c.ny
  expect(pos.getY(k+n)).toBeCloseTo(baseEletrodo(p,c.y(100)),6)
  expect(pos.getY(k)).toBeGreaterThan(pos.getY(k+n))
  v.malha.geometry.dispose();v.malha.material.dispose()
 })
})
