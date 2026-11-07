import {describe,it,expect} from 'vitest'
import {DepositoEletrodo} from '../src/modelo/depositoEletrodo'
import {PECAS_ELETRODO} from '../src/missoes/pecasEletrodo'
import {avaliarEletrodo} from '../src/pontuacao/eletrodo'
import {Acionamento15} from '../src/modelo/acionamento15'

describe('objetivos geométricos das peças SMAW',()=>{
 for(const [i,p] of PECAS_ELETRODO.entries())it(p.titulo,()=>{
  const certa=new DepositoEletrodo(p),fora=new DepositoEletrodo(p),m=new Acionamento15('eletrodo');m.tempoArcoS=60
  // Mesmo metal, duas trajetórias: a emenda solicitada e a superfície lateral da chapa.
  for(let x=p.inicioMm-2;x<=p.fimMm+2;x+=.5){certa.depositar(x,0,[10,5,3.5,6,5,4,5][i]);fora.depositar(x,14,[10,5,3.5,6,5,4,5][i])}
  const boa=avaliarEletrodo(p,certa,m),ruim=avaliarEletrodo(p,fora,m)
  expect(boa.nota).toBeGreaterThan(700);expect(boa.cobertura).toBeGreaterThan(.9)
  expect(ruim.nota).toBe(0);expect(ruim.cobertura).toBe(0)
  expect(certa.volumeTotal()).toBeCloseTo(fora.volumeTotal(),8)
 })
})
