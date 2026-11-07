import { describe, expect, it } from 'vitest'
import { CONTROLES_PADRAO, gestoDaTecla, gestoDoBotao, nomeTecla, validarControles } from '../src/entrada/gestos'

describe('controles da câmera e da peça (v1.3)', () => {
  it('padrão: botão direito gira a peça, o do meio move a câmera; E/B e Espaço na caneta', () => {
    expect(gestoDoBotao(CONTROLES_PADRAO, 2)).toBe('peca')
    expect(gestoDoBotao(CONTROLES_PADRAO, 1)).toBe('camera')
    // O botão esquerdo é sempre o da solda.
    expect(gestoDoBotao(CONTROLES_PADRAO, 0)).toBeNull()
    expect(gestoDaTecla(CONTROLES_PADRAO, 'E')).toBe('peca')
    expect(gestoDaTecla(CONTROLES_PADRAO, 'b')).toBe('peca')
    expect(gestoDaTecla(CONTROLES_PADRAO, ' ')).toBe('camera')
    expect(gestoDaTecla(CONTROLES_PADRAO, 'q')).toBeNull()
    expect(nomeTecla(' ')).toBe('Espaço')
  })

  it('trocar o botão da peça troca o da câmera junto', () => {
    const c = validarControles({ botaoPeca: 'meio', botaoCamera: 'meio' })
    expect(c.botaoCamera).toBe('direito')
    expect(gestoDoBotao(c, 1)).toBe('peca')
    expect(gestoDoBotao(c, 2)).toBe('camera')
  })

  it('teclas inválidas ou reservadas voltam ao padrão; uma tecla não faz as duas coisas', () => {
    expect(validarControles({ teclasPeca: ['Enter', 'p'], teclaCamera: 'Escape' })).toMatchObject({ teclasPeca: ['e', 'b'], teclaCamera: ' ' })
    expect(validarControles({ teclasPeca: [' '], teclaCamera: ' ' })).toMatchObject({ teclasPeca: [' '], teclaCamera: '' })
    expect(validarControles({ teclasPeca: ['r', 'R', 't', 'y'] }).teclasPeca).toEqual(['r', 't'])
    expect(validarControles(null)).toEqual(CONTROLES_PADRAO)
  })
})
