import { describe, expect, it } from 'vitest'
import { detectorSenha } from '../src/arcade/segredo'

const digitar = (texto: string) => {
  const d = detectorSenha()
  return [...texto].map((c) => d('Key' + c.toUpperCase()))
}

describe('fase escondida do Arcade', () => {
  it('abre só com A, L, A, N, A em ordem', () => {
    expect(digitar('alana').at(-1)).toBe(true)
    expect(digitar('alan').some(Boolean)).toBe(false)
    expect(digitar('anala').some(Boolean)).toBe(false)
  })
  it('recomeça depois de errar, aproveitando um A', () => {
    expect(digitar('alaalana').at(-1)).toBe(true)
    expect(digitar('xxalana').at(-1)).toBe(true)
  })
})
