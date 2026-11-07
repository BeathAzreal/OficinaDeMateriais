import {describe,it,expect} from 'vitest'
import {PECAS_ELETRODO,limitesPecaEletrodo} from '../src/missoes/pecasEletrodo'
import {Acionamento15} from '../src/modelo/acionamento15'
import {chapasNaJunta} from '../src/modelo/juntas'
describe('trabalhos de união no eletrodo',()=>{
 it('primeiro trabalho possui duas chapas separadas por uma abertura',()=>{
  const p=PECAS_ELETRODO[0],chapas=chapasNaJunta(p.junta,p)
  expect(chapas).toHaveLength(2);expect(p.aberturaMm).toBeGreaterThan(0)
  expect(Math.max(...chapas[0].map(v=>v[0]))).toBeLessThan(Math.min(...chapas[1].map(v=>v[0])))
 })
 it('a emenda da grade é limitada à barra de 40 mm, com objetivo dentro dela',()=>{
  const p=PECAS_ELETRODO.find(p=>p.conjunto==='grade')!,l=limitesPecaEletrodo(p)
  expect(l).toEqual({min:55,max:95});expect(p.inicioMm).toBeGreaterThanOrEqual(l.min);expect(p.fimMm).toBeLessThanOrEqual(l.max)
  expect(p.aberturaMm).toBeGreaterThan(0);expect(chapasNaJunta(p.junta,p)).toHaveLength(2)
 })
 it('a queima inclinada não mantém o arco fora da largura da barra',()=>{
  const m=new Acionamento15('eletrodo');m.limitesX={min:55,max:95}
  m.posicionar(94.99,0);m.orientar(0,45,0);m.abrirAoTocar=true;m.pressionado=true;m.definirDistancia(.2)
  m.avancar(.1)
  expect(m.xMm).toBeGreaterThan(95);expect(m.naPeca).toBe(false);expect(m.estado).toBe('afastado')
 })

})
