/*
 * Fase escondida do Arcade: digitar a senha na tela de descrição do desafio.
 * Não entra na pontuação, nas vidas nem nos recordes.
 */

export const SENHA_SEGREDO = ['KeyA', 'KeyL', 'KeyA', 'KeyN', 'KeyA'] as const

/** Acompanha as teclas digitadas e avisa quando a senha inteira sai em ordem. */
export function detectorSenha(senha: readonly string[] = SENHA_SEGREDO): (codigo: string) => boolean {
  let pos = 0
  return (codigo) => {
    if (codigo === senha[pos]) pos++
    else pos = codigo === senha[0] ? 1 : 0
    if (pos < senha.length) return false
    pos = 0
    return true
  }
}

export const TEXTO_SEGREDO = {
  titulo: 'DESAFIO URGENTE',
  historia: [
    'Alana faltou à aula. Um alienígena passou pela oficina e transformou o gato dela.',
    'Como é um ser evoluído, ele deu uma chance: se Alana completar esta solda, o gato volta ao normal.',
  ],
  regra: 'Uma tentativa, no Difícil: pelo menos 40 % em cada categoria. Não custa vida e não conta no placar.',
  vitoria: 'O alienígena cumpriu a promessa: o gato da Alana voltou ao normal!',
  derrota: 'O alienígena balançou a cabeça. O gato continua transformado… tente de novo.',
}
