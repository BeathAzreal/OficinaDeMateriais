import { describe, it, expect } from 'vitest'
import { codigoDoConvite, linkDaSala } from '../src/rede/convite'
import { criarWorker } from '../servidor/worker'

describe('convites online', () => {
  it('compartilha somente a sala, removendo credenciais e parâmetros da origem', () => {
    const link = linkDaSala('ABC234', 'https://usuario:senha@oficina.test/outra?token=segredo#credencial')
    expect(link).toBe('https://oficina.test/?rede=1&sala=ABC234')
    expect(codigoDoConvite(link)).toBe('ABC234')
  })
  it('aceita código minúsculo no convite e rejeita códigos inválidos', () => {
    expect(codigoDoConvite('https://oficina.test/?rede=1&sala=abc234')).toBe('ABC234')
    for (const valor of ['ABC', 'ABC2345', '<b>XYZ', 'ABC120']) {
      expect(codigoDoConvite('https://oficina.test/?sala=' + encodeURIComponent(valor))).toBe('')
      expect(() => linkDaSala(valor, 'https://oficina.test')).toThrow()
    }
    expect(() => linkDaSala('ABC234', 'file:///jogo.html')).toThrow()
  })
  it('abre convites pela página do Worker e informa indisponibilidade sem banco', async () => {
    const worker = criarWorker('<html>Oficina</html>')
    const pagina = await worker.fetch(new Request('https://oficina.test/?rede=1&sala=ABC234'), {})
    expect(pagina.status).toBe(200)
    expect(await pagina.text()).toContain('Oficina')
    const api = await worker.fetch(new Request('https://oficina.test/api/rede/info'), {})
    expect(api.status).toBe(503)
    expect((await api.json()).erro).toContain('indisponível')
    expect(api.headers.get('Cache-Control')).toBe('no-store')
  })
})
