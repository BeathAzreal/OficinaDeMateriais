import { describe,it,expect } from 'vitest'
import { DepositoEletrodo,baseEletrodo,trechoEletrodo } from '../src/modelo/depositoEletrodo'
import { PECAS_ELETRODO } from '../src/missoes/pecasEletrodo'
import { avaliarEletrodo } from '../src/pontuacao/eletrodo'
import { Acionamento15 } from '../src/modelo/acionamento15'
const p=PECAS_ELETRODO[0]
describe('depósito SMAW local H79',()=>{
 it('conserva o volume inclusive nos limites da barra real',()=>{
  const c=new DepositoEletrodo(PECAS_ELETRODO[3])
  c.depositar(55.01,0,25);c.depositar(94.99,0,30);c.depositar(30,0,100)
  expect(c.volumeTotal()).toBe(55)
  expect(c.metal.reduce((a,v)=>a+v*c.dx*c.dy,0)).toBeCloseTo(55,8)
 })
 it('deposita onde a ponta está sem transferir para a raiz ou unir depósitos separados',()=>{
  for(const p of [PECAS_ELETRODO[0],PECAS_ELETRODO[1],PECAS_ELETRODO[2]]){
   const c=new DepositoEletrodo(p);c.depositar(75,14,30);c.depositar(75,-14,30)
   expect(c.espessura(75,14)).toBeGreaterThan(.1)
   expect(c.espessura(75,-14)).toBeGreaterThan(.1)
   expect(c.espessura(75,0)).toBe(0)
   expect(trechoEletrodo(c,75).coberto).toBe(false)
  }
 })
 it('começa no fundo real e sobe progressivamente sem saltar para a face',()=>{
  const c=new DepositoEletrodo(p),antes=c.altura(75,0)
  expect(antes).toBe(-8);c.depositar(75,0,1)
  expect(c.altura(75,0)).toBeGreaterThan(antes);expect(c.altura(75,0)).toBeLessThan(0)
  expect(baseEletrodo(p,3)).toBe(0)
  expect(baseEletrodo(PECAS_ELETRODO[2],0)).toBe(-12)
 })
 it('forma coroa convexa depois de preencher, em vez de espalhar uma película plana',()=>{
  const c=new DepositoEletrodo({...p,aberturaMm:0})
  for(let n=0;n<30;n++)c.depositar(75,0,1)
  expect(c.altura(75,0)).toBeGreaterThan(c.altura(75,1.5)+.4)
  expect(c.altura(75,0)).toBeGreaterThan(1)
 })
 it('a altura entre células acompanha a malha sem abrir uma depressão falsa na borda',()=>{
  const c=new DepositoEletrodo(p)
  for(let x=70;x<=80;x+=.5)c.depositar(x,0,8)
  const a=c.altura(75,.75),b=c.altura(75,1.25)
  expect(c.altura(75,1)).toBeCloseTo((a+b)/2,8)
 })
 it('avalia o trecho pedido sem pontuar solda em outro lugar',()=>{
  const c=new DepositoEletrodo({...p,aberturaMm:0}),m=new Acionamento15('eletrodo');m.tempoArcoS=10
  for(let x=0;x<15;x+=.5)c.depositar(x,0,5)
  const r=avaliarEletrodo(p,c,m)
  expect(r.nota).toBe(0);expect(r.cobertura).toBe(0)
 })
 it('avalia o passe de raiz abaixo da face, sem exigir encher 12 mm',()=>{
  const p=PECAS_ELETRODO[2],c=new DepositoEletrodo(p),m=new Acionamento15('eletrodo');m.tempoArcoS=30
  for(let x=p.inicioMm-2;x<=p.fimMm+2;x+=.5)c.depositar(x,0,3.5)
  const r=avaliarEletrodo(p,c,m)
  expect(c.altura(75,0)).toBeLessThan(0)
  expect(r.preenchimento).toBeGreaterThan(.8)
  expect(r.nota!).toBeGreaterThan(500)
  expect(r.criterioISO).toContain('passe de raiz')
 })
 it('não concede união só porque há dois cordões dos lados',()=>{
  const c=new DepositoEletrodo(p),m=new Acionamento15('eletrodo');m.tempoArcoS=20
  for(let x=20;x<=130;x+=.5){c.depositar(x,7,10);c.depositar(x,-7,10)}
  const r=avaliarEletrodo(p,c,m)
  expect(r.cobertura).toBe(0);expect(r.nota).toBe(0)
 })
})
