/** Endereço público verificado da oficina; o portátil encaminha o x1 para ele. */
export const OFICINA_ONLINE = 'https://oficinadesolda.beath.chatgpt.site'

export function codigoDoConvite(endereco: string): string {
  try {
    const codigo = new URL(endereco).searchParams.get('sala')?.toUpperCase() ?? ''
    return /^[A-Z2-9]{6}$/.test(codigo) ? codigo : ''
  } catch { return '' }
}

/** Convites levam somente o código público, nunca a credencial do jogador. */
export function linkDaSala(codigo: string, origem: string): string {
  if (!/^[A-Z2-9]{6}$/.test(codigo)) throw new Error('Código de sala inválido.')
  const base = new URL(origem)
  if (!['http:', 'https:'].includes(base.protocol)) throw new Error('Abra a versão online para compartilhar uma sala.')
  const link = new URL('/', base.origin)
  link.searchParams.set('rede', '1')
  link.searchParams.set('sala', codigo)
  return link.href
}
