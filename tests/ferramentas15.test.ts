import { describe, it, expect } from 'vitest'
import { Escoria15 } from '../src/modelo/escoria15'
import { migrarControles15, PADRAO15 } from '../src/dados/controles15'
describe('martelinho, escova e controles de altura', () => {
  it('escova não remove crosta intacta; martelinho deixa resíduos que a escova remove', () => {
    const s = new Escoria15()
    s.depositar(75, 0, 5); s.esfriar(6)
    expect(s.escovar(75, 0)).toBe(0)
    expect(s.cobertura).toBe(1)
    expect(s.martelar(75, 0)).toBeCloseTo(0.8)
    expect(s.residuos).toBeCloseTo(0.2)
    expect(s.cobertura).toBeCloseTo(0.2)
    expect(s.martelar(75, 0)).toBeCloseTo(0)
    expect(s.escovar(75, 0)).toBeCloseTo(0.2)
    expect(s.cobertura).toBe(0)
    expect(s.residuos).toBe(0)
  })
  it('nenhuma das ferramentas remove escória quente', () => {
    const s = new Escoria15(); s.depositar(75, 0, 5)
    expect(s.martelar(75, 0)).toBe(0)
    expect(s.escovar(75, 0)).toBe(0)
    expect(s.cobertura).toBe(1)
  })
  it('limpeza fora do golpe não afeta a crosta distante', () => {
    const s = new Escoria15(); s.depositar(25, 0, 5); s.esfriar(6)
    s.martelar(120, 0); s.escovar(120, 0)
    expect(s.cobertura).toBe(1)
  })
  it('inverte o par W/S antigo sem mexer nas demais preferências', () => {
    const antigo = { ...PADRAO15, versao: undefined, sensibilidade: 0.7, teclas: { ...PADRAO15.teclas, aproximar: 'KeyW', afastar: 'KeyS' } }
    const novo = migrarControles15(antigo)!
    expect(novo.teclas.aproximar).toBe('KeyS')
    expect(novo.teclas.afastar).toBe('KeyW')
    expect(novo.sensibilidade).toBe(0.7)
    expect(antigo.teclas.aproximar).toBe('KeyW')
  })
  it('preserva atalhos personalizados e permite escolhas posteriores ao novo padrão', () => {
    expect(migrarControles15({ ...PADRAO15, versao: undefined, teclas: { ...PADRAO15.teclas, aproximar: 'KeyZ' } })!.teclas.aproximar).toBe('KeyZ')
    expect(migrarControles15({ ...PADRAO15, teclas: { ...PADRAO15.teclas, aproximar: 'KeyW', afastar: 'KeyS' } })!.teclas.aproximar).toBe('KeyW')
  })
})
