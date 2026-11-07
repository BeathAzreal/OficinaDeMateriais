import { describe, expect, it } from 'vitest'
import { Acionamento15, velocidadeDescida15 } from '../src/modelo/acionamento15'

describe('H74: acompanhar a vareta sem interromper o arco', () => {
  function ensaio(fps: number, corrente: number, ajuda: number) {
    const m = new Acionamento15('eletrodo')
    m.regular(corrente); m.assistencia = ajuda; m.compensar = true
    m.abrirAoTocar = true; m.pressionado = true; m.definirDistancia(0.2);m.avancar(1/60)
    m.compensar = false;m.definirDistancia(3)
    const inicial = m.distanciaMm
    for(let i=0;i<fps*0.15;i++) {
      const v = velocidadeDescida15((i+1)/fps,1,m.consumoMmS,ajuda,m.cosInclinado,m.estado==='arco')
      m.avancar(1/fps,-v)
    }
    return {m,inicial}
  }
  // H91 (v1.9): a descida não soma mais o consumo; um toque curto (0,15 s) com
  // corrente alta só segura o arco, mas segurar S ganha da queima em qualquer corrente.
  it('com corrente alta, segurar S ganha da queima da vareta (sem ajuda automática, segurando 0,5 s)',()=>{
    for(const ajuda of [0,0.8,1]) {
      const {m,inicial}=ensaio(120,180,ajuda)
      expect(m.distanciaMm).toBeLessThan(inicial+0.5)
      expect(m.estado).toBe('arco');expect(m.grudadas).toBe(0)
    }
    const m=new Acionamento15('eletrodo');m.regular(180)
    expect(velocidadeDescida15(0.5,1,m.consumoMmS,0,1,true)).toBeGreaterThan(m.consumoMmS)
  })
  it('sem comando não há compensação manual nem movimento de aproximação',()=>{
    expect(velocidadeDescida15(0,1,8,0,1,true)).toBe(0)
    expect(velocidadeDescida15(.1,3,8,0,1,false)).toBeLessThan(3)
  })
  it('não muda consumo entre taxas de quadros',()=>{
    const a=ensaio(60,130,.8).m,b=ensaio(120,130,.8).m
    expect(a.restanteMm).toBeCloseTo(b.restanteMm,5)
    expect(a.distanciaMm).toBeCloseTo(b.distanciaMm,1)
  })
  it('permite consumir a vareta inteira sem parar para recuperar a altura, inclusive com controle lento',()=>{
    for(const fps of [30,144]) for(const corrente of [75,130,180]) for(const ajuda of [0,.8]) {
      const m=new Acionamento15('eletrodo');m.regular(corrente);m.assistencia=ajuda
      m.abrirAoTocar=true;m.pressionado=true;m.definirDistancia(.2);m.avancar(1/120);m.definirDistancia(2.5)
      let descendo=false,segurado=0,tempo=0
      // H91: consumo de 1,5 mm/s → a vareta dura mais; dá até 120 s para chegar ao fim.
      while(tempo<120 && m.estado!=='fim') {
        if(m.distanciaMm>=3)descendo=true
        if(m.distanciaMm<=2.2)descendo=false
        segurado=descendo?segurado+1/fps:0
        m.avancar(1/fps,-velocidadeDescida15(segurado,1,m.consumoMmS,ajuda,1,m.estado==='arco'))
        tempo+=1/fps
      }
      expect(m.estado).toBe('fim');expect(m.grudadas).toBe(0)
      expect(m.tempoArcoS/tempo).toBeGreaterThan(.97)
    }
  })

})
