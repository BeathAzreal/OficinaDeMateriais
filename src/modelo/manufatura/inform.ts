/*
 * Subconjunto do INFORM (linguagem de job dos controladores Yaskawa Motoman)
 * aceito pela Manufatura Aditiva (H106). Controlador de referência: DX200
 * (INFORM III), pelo manual de referência do INFORM do DX200 e pelos artigos
 * da base de conhecimento da Yaskawa citados em docs/MANUFATURA-ADITIVA.md.
 *
 * O editor trata só o CORPO do job: as linhas entre NOP e END. Cabeçalho
 * (/JOB, //NAME, //POS...) e posições ficam fora do texto: os pontos C são
 * a tabela de posições ensinadas. Por isso nada aqui gera um .JBI.
 *
 * Nada de eval: cada linha vira um objeto; o executor só lê esses objetos.
 * Comando fora do subconjunto nunca é ignorado: vira erro com o motivo.
 */

import { LIMITES } from './celula'

export type TipoNumerica = 'B' | 'I' | 'D'
export interface Variavel { tipo: TipoNumerica; n: number }
export interface VariavelPosicao { tipo: 'P'; n: number }
export type Valor = { tipo: 'const'; valor: number } | { tipo: 'var'; ref: Variavel }
export type Alvo = { tipo: 'C'; n: number } | { tipo: 'P'; n: number }
export type Comparacao = '=' | '<' | '>'

export type Comando =
  | { op: 'NOP' }
  | { op: 'END' }
  | { op: 'COMENTARIO'; texto: string }
  | { op: 'ROTULO'; nome: string }
  | { op: 'MOVJ'; alvo: Alvo; vj: number }
  | { op: 'MOVL'; alvo: Alvo; v: number }
  | { op: 'TIMER'; t: number }
  | { op: 'ARCON'; asf: number }
  | { op: 'ARCOF'; aef: number | null }
  | { op: 'SET'; destino: Variavel; valor: Valor }
  | { op: 'ADD'; destino: Variavel; valor: Valor }
  | { op: 'INC'; destino: Variavel }
  | { op: 'SETP'; destino: VariavelPosicao; origem: VariavelPosicao }
  | { op: 'ADDP'; destino: VariavelPosicao; origem: VariavelPosicao }
  | { op: 'SETE'; destino: VariavelPosicao; elemento: 1 | 2 | 3; valor: Valor }
  | { op: 'JUMP'; rotulo: string; condicao: { ref: Variavel; comparacao: Comparacao; valor: Valor } | null }
  | { op: 'SFTON'; p: VariavelPosicao }
  | { op: 'SFTOF' }

/** Instrução já lida, com a linha do editor (1 = primeira linha). */
export type Instrucao = Comando & { linha: number }

export interface Diagnostico {
  linha: number
  gravidade: 'erro' | 'aviso'
  /** O que está errado. */
  mensagem: string
  /** Como corrigir. */
  correcao: string
}

export interface Programa {
  instrucoes: Instrucao[]
  diagnosticos: Diagnostico[]
  rotulos: Map<string, number>
  /** Sem erros (avisos não impedem a execução). */
  valido: boolean
}

export interface ContextoValidacao {
  /** Quantos pontos C existem na tabela (C00000 até C(n-1)). */
  pontos: number
  /** Arquivos de condição existentes (1..n). */
  arquivosAsf: number
  arquivosAef: number
}

/** Faixas aceitas. V e VJ: faixas do DX200; TIMER: limite deste simulador. */
export const FAIXAS = {
  v: { min: 0.1, max: 1500 },
  vj: { min: 0.01, max: 100 },
  timer: { min: 0.01, max: 655.35 },
  B: { min: 0, max: 255 },
  I: { min: -32768, max: 32767 },
  D: { min: -2147483648, max: 2147483647 },
}

/** Comandos que existem no INFORM, mas não neste simulador: erro claro em vez de silêncio. */
const NAO_IMPLEMENTADOS: Record<string, string> = {
  MOVC: 'movimento circular',
  MOVS: 'movimento spline',
  IMOV: 'movimento incremental',
  REFP: 'ponto de referência (para oscilação)',
  CALL: 'chamada de outro job',
  RET: 'retorno de job chamado',
  WAIT: 'espera por entrada ou condição',
  DOUT: 'saída digital',
  DIN: 'leitura de entrada digital',
  PULSE: 'pulso em saída digital',
  AOUT: 'saída analógica',
  CWAIT: 'espera de coordenação',
  PAUSE: 'pausa programada',
  MSG: 'mensagem no pendente',
  SPEED: 'ajuste de velocidade',
  DEC: 'decremento de variável',
  SUB: 'subtração',
  MUL: 'multiplicação',
  DIV: 'divisão',
  AND: 'operação lógica E',
  OR: 'operação lógica OU',
  NOT: 'operação lógica NÃO',
  XOR: 'operação lógica OU exclusivo',
  CNVRT: 'conversão de sistema de coordenadas',
  GETE: 'leitura de elemento de variável',
  GETS: 'leitura de variável de sistema',
  CLEAR: 'limpeza de variáveis',
  ARCSET: 'troca de condição com o arco aberto',
  ARCCTS: 'mudança gradual de condição (início)',
  ARCCTE: 'mudança gradual de condição (fim)',
  WVON: 'oscilação (tecimento) da tocha',
  WVOF: 'fim da oscilação',
  COMARCON: 'rastreamento de junta pelo arco',
  COMARCOF: 'fim do rastreamento de junta',
  IF: 'instrução condicional isolada',
  ENDIF: 'fim de bloco condicional',
  WHILE: 'laço WHILE',
  ENDWHILE: 'fim de laço WHILE',
  FOR: 'laço FOR',
  NEXT: 'fim de laço FOR',
}

/** Todos os nomes que este subconjunto entende (para sugerir o mais parecido). */
export const COMANDOS = ['NOP', 'END', 'MOVJ', 'MOVL', 'TIMER', 'ARCON', 'ARCOF', 'SET', 'ADD', 'INC', 'SETE', 'JUMP', 'SFTON', 'SFTOF'] as const

/** Ajuda acessível: cada comando com a forma aceita e um exemplo. */
export const AJUDA_COMANDOS: { comando: string; forma: string; exemplo: string; explicacao: string }[] = [
  { comando: 'NOP', forma: 'NOP', exemplo: 'NOP', explicacao: 'Primeira linha do job. Não faz nada.' },
  { comando: 'END', forma: 'END', exemplo: 'END', explicacao: 'Última linha do job. Com o arco aberto, ele é cortado sem preencher a cratera.' },
  { comando: "'", forma: "'texto", exemplo: "'CAMADA DE IDA", explicacao: 'Comentário, numa linha só dele.' },
  { comando: '*', forma: '*ROTULO', exemplo: '*CAMADA', explicacao: 'Rótulo, destino do JUMP. Até 8 letras, números ou _ (limite do simulador).' },
  { comando: 'MOVJ', forma: 'MOVJ Cnnnnn VJ=x.xx  |  MOVJ Pnnn VJ=x.xx', exemplo: 'MOVJ C00001 VJ=25.00', explicacao: 'Movimento de juntas, VJ em % da velocidade máxima. O caminho não é reto: use longe da peça e com o arco fechado.' },
  { comando: 'MOVL', forma: 'MOVL Cnnnnn V=x.x  |  MOVL Pnnn V=x.x', exemplo: 'MOVL C00003 V=8.0', explicacao: 'Movimento linear do TCP, V em mm/s (0,1 a 1500). É o movimento de soldar.' },
  { comando: 'TIMER', forma: 'TIMER T=x.xx', exemplo: 'TIMER T=30.00', explicacao: 'Espera em segundos (resolução de 0,01 s). Entre camadas, deixa a parede esfriar.' },
  { comando: 'ARCON', forma: 'ARCON ASF#(n)', exemplo: 'ARCON ASF#(1)', explicacao: 'Abre o arco com o arquivo de início de arco n (alimentação e correção do arco vão para a fonte).' },
  { comando: 'ARCOF', forma: 'ARCOF  |  ARCOF AEF#(n)', exemplo: 'ARCOF AEF#(1)', explicacao: 'Fecha o arco. Com AEF#(n), preenche a cratera pelo tempo do arquivo de fim de arco.' },
  { comando: 'SET', forma: 'SET Bnnn valor  |  SET Pnnn Pmmm', exemplo: 'SET B000 0', explicacao: 'Guarda um valor (constante ou outra variável B, I ou D). Com P, copia uma posição.' },
  { comando: 'ADD', forma: 'ADD Innn valor  |  ADD Pnnn Pmmm', exemplo: 'ADD D000 2200', explicacao: 'Soma à variável. Com P, soma posição a posição.' },
  { comando: 'INC', forma: 'INC Bnnn', exemplo: 'INC B000', explicacao: 'Soma 1 à variável B, I ou D.' },
  { comando: 'SETE', forma: 'SETE Pnnn (e) valor', exemplo: 'SETE P000 (3) D000', explicacao: 'Muda um elemento da posição: (1) X, (2) Y, (3) Z, em mícrons (0,001 mm). Valor constante ou variável D.' },
  { comando: 'JUMP', forma: 'JUMP *ROTULO  |  JUMP *ROTULO IF Bnnn<valor', exemplo: 'JUMP *CAMADA IF B000<4', explicacao: 'Salta para o rótulo, sempre ou se a condição (=, < ou >) for verdadeira.' },
  { comando: 'SFTON', forma: 'SFTON Pnnn', exemplo: 'SFTON P000', explicacao: 'Desloca todos os pontos seguintes pela posição Pnnn, no sistema da base (o padrão).' },
  { comando: 'SFTOF', forma: 'SFTOF', exemplo: 'SFTOF', explicacao: 'Desliga o deslocamento.' },
]

const NUMERO = /^[+-]?\d+(\.\d+)?$/
const INTEIRO = /^[+-]?\d+$/

class Leitor {
  readonly diagnosticos: Diagnostico[] = []
  constructor(readonly linha: number) {}
  erro(mensagem: string, correcao: string): null {
    this.diagnosticos.push({ linha: this.linha, gravidade: 'erro', mensagem, correcao })
    return null
  }
}

/** Reconhece outra linguagem de robô ou de CNC e explica que não é INFORM. */
export function outraLinguagem(texto: string): string | null {
  const t = texto.trim()
  if (/^(MoveL|MoveJ|MoveC|MoveAbsJ|ArcL|ArcLStart|ArcLEnd|ArcC|WaitTime|SetDO|TPWrite)\b/.test(t) || /^(PROC|ENDPROC|MODULE|ENDMODULE)\b/.test(t) || /^(CONST|PERS|VAR)\s+(robtarget|num|speeddata|zonedata|tooldata)\b/i.test(t)) {
    return 'RAPID (robôs ABB)'
  }
  if (/^(PTP|LIN|CIRC|SPTP|SLIN|SCIRC)\s/i.test(t) || /^(DEF|DEFFCT|ENDFCT|DECL|ENDLOOP|LOOP|ENDFOR|ENDWHILE|BAS)\b/i.test(t) || /^\$[A-Z_]+/i.test(t) || /^WAIT\s+SEC\b/i.test(t) || /^(FOLD|ENDFOLD|;FOLD|;ENDFOLD)/i.test(t)) {
    return 'KRL (robôs KUKA)'
  }
  if (/^(N\d+\s+)?[GM]\d{1,3}(\.\d)?(\s|$)/i.test(t) || /^%$/.test(t) || /^\(.*\)$/.test(t) || /^[XYZF][+-]?\d/i.test(t)) {
    return 'G-code (CNC ou impressora 3D)'
  }
  return null
}

function distanciaEdicao(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)])
  for (let j = 1; j <= b.length; j++) d[0][j] = j
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) {
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
  }
  return d[a.length][b.length]
}

function parecido(nome: string): string | null {
  let melhor: string | null = null, menor = 3
  for (const c of COMANDOS) {
    const d = distanciaEdicao(nome, c)
    if (d < menor) { menor = d; melhor = c }
  }
  return melhor
}

function lerVariavel(l: Leitor, token: string | undefined, aceitas: TipoNumerica[], papel: string): Variavel | null {
  if (!token) return l.erro(`Falta a variável (${papel}).`, `Escreva a variável com três dígitos, por exemplo ${aceitas[0]}000.`)
  const m = /^([A-Z])(\d+)$/.exec(token)
  if (!m) return l.erro(`"${token}" não é uma variável (${papel}).`, `Use ${aceitas.join(', ')} seguido de três dígitos, por exemplo ${aceitas[0]}000.`)
  const [, tipo, num] = m
  if (tipo === 'R' || tipo === 'S') return l.erro(`Variáveis ${tipo} (${tipo === 'R' ? 'reais' : 'texto'}) não estão implementadas neste simulador.`, `Use ${aceitas.join(', ')}. Para frações de milímetro, use D em mícrons.`)
  if (!(aceitas as string[]).includes(tipo)) return l.erro(`${token} não serve aqui (${papel}).`, `Aqui vale ${aceitas.join(', ')}.`)
  if (num.length !== 3) return l.erro(`${token}: o número da variável tem três dígitos.`, `Escreva ${tipo}${num.padStart(3, '0').slice(-3)}.`)
  const n = Number(num)
  if (n >= LIMITES.variaveis) return l.erro(`${token} não existe: este simulador tem ${tipo}000 a ${tipo}${String(LIMITES.variaveis - 1).padStart(3, '0')}.`, 'Use um número menor.')
  return { tipo: tipo as TipoNumerica, n }
}

function lerPosicao(l: Leitor, token: string | undefined, papel: string): VariavelPosicao | null {
  if (!token) return l.erro(`Falta a variável de posição (${papel}).`, 'Escreva P seguido de três dígitos, por exemplo P000.')
  const m = /^P(\d+)$/.exec(token)
  if (!m) return l.erro(`"${token}" não é uma variável de posição (${papel}).`, 'Use P seguido de três dígitos, por exemplo P000.')
  if (m[1].length !== 3) return l.erro(`${token}: o número da variável tem três dígitos.`, `Escreva P${m[1].padStart(3, '0').slice(-3)}.`)
  const n = Number(m[1])
  if (n >= LIMITES.variaveis) return l.erro(`${token} não existe: este simulador tem P000 a P${LIMITES.variaveis - 1}.`, 'Use um número menor.')
  return { tipo: 'P', n }
}

function lerValor(l: Leitor, token: string | undefined, destino: TipoNumerica | 'elemento', papel: string): Valor | null {
  if (!token) return l.erro(`Falta o valor (${papel}).`, 'Escreva um número inteiro ou uma variável B, I ou D.')
  if (INTEIRO.test(token)) {
    const v = Number(token)
    const f = destino === 'elemento' ? FAIXAS.D : FAIXAS[destino]
    if (v < f.min || v > f.max) return l.erro(`${token} está fora da faixa de ${destino === 'elemento' ? 'um elemento de posição' : `uma variável ${destino}`} (${f.min} a ${f.max}).`, 'Use um valor dentro da faixa.')
    return { tipo: 'const', valor: v }
  }
  if (NUMERO.test(token)) return l.erro(`${token} tem casas decimais, mas B, I e D só guardam inteiros.`, destino === 'elemento' ? 'Posições vão em mícrons: 2,2 mm = 2200.' : 'Use um inteiro (para milímetros com fração, guarde em mícrons numa D).')
  const ref = lerVariavel(l, token, destino === 'elemento' ? ['D'] : ['B', 'I', 'D'], papel)
  return ref ? { tipo: 'var', ref } : null
}

function lerAlvo(l: Leitor, token: string | undefined, comando: string): Alvo | null {
  const exemplo = comando === 'MOVL' ? 'MOVL C00001 V=10.0' : 'MOVJ C00001 VJ=25.00'
  if (!token || token.includes('=')) return l.erro(`${comando} sem o ponto de destino.`, `No arquivo do job o ponto é escrito: ${exemplo}. (No pendente ele fica implícito na linha.)`)
  const c = /^C(\d+)$/.exec(token)
  if (c) {
    if (c[1].length !== 5) return l.erro(`${token}: o ponto ensinado tem cinco dígitos.`, `Escreva C${c[1].padStart(5, '0').slice(-5)}.`)
    return { tipo: 'C', n: Number(c[1]) }
  }
  if (/^P\d+$/.test(token)) {
    const p = lerPosicao(l, token, 'destino')
    return p ? { tipo: 'P', n: p.n } : null
  }
  if (/^(BP|EX)\d+$/.test(token)) return l.erro(`${token}: posições de eixo de base e externo não estão implementadas.`, 'Esta célula não tem eixos externos: use um ponto C ou uma variável P.')
  return l.erro(`"${token}" não é um ponto de destino.`, `Use um ponto ensinado (C00001) ou uma variável de posição (P001): ${exemplo}.`)
}

function lerDecimal(l: Leitor, texto: string, nome: string, faixa: { min: number; max: number }, casas: number, unidade: string): number | null {
  if (!NUMERO.test(texto)) return l.erro(`${nome}=${texto}: o valor precisa ser um número.`, `Escreva, por exemplo, ${nome}=${faixa.min < 1 ? (10).toFixed(casas) : faixa.min.toFixed(casas)}. Variável no lugar do número não está implementada.`)
  const dec = texto.split('.')[1]?.length ?? 0
  if (dec > casas) return l.erro(`${nome}=${texto}: a resolução é de ${casas} casa(s) decimal(is).`, `Arredonde para ${Number(texto).toFixed(casas)}.`)
  const v = Number(texto)
  if (v < faixa.min || v > faixa.max) return l.erro(`${nome}=${texto} está fora da faixa (${faixa.min} a ${faixa.max} ${unidade}).`, 'Use um valor dentro da faixa.')
  return v
}

function opcaoNaoImplementada(l: Leitor, token: string): null {
  if (/^PL=/.test(token)) return l.erro('PL (nível de posicionamento) não está implementado.', 'Apague o PL=: aqui todo movimento chega exatamente ao ponto, como PL=0.')
  if (token === 'NWAIT') return l.erro('NWAIT não está implementado.', 'Apague o NWAIT: aqui a instrução seguinte só começa depois do movimento.')
  if (/^(ACC|DEC)=/.test(token)) return l.erro(`${token.split('=')[0]} (aceleração) não está implementado.`, 'Apague esta opção.')
  if (/^VR=/.test(token)) return l.erro('VR (velocidade de rotação) não está implementado.', 'Use V= para a velocidade do TCP.')
  if (token === 'UNTIL') return l.erro('UNTIL não está implementado.', 'Apague a condição: o movimento sempre vai até o ponto.')
  return l.erro(`"${token}" não é uma opção aceita aqui.`, 'Veja a forma aceita na lista de comandos.')
}

function lerMovimento(l: Leitor, partes: string[]): Comando | null {
  const [op, alvoTxt, ...resto] = partes
  const alvo = lerAlvo(l, alvoTxt, op)
  if (!alvo) return null
  const chave = op === 'MOVL' ? 'V' : 'VJ'
  const outra = op === 'MOVL' ? 'VJ' : 'V'
  let vel: number | null = null
  for (const token of resto) {
    const m = /^([A-Z]+)=(.*)$/.exec(token)
    if (m && m[1] === chave) {
      if (vel !== null) return l.erro(`${chave}= repetido.`, `Deixe um só ${chave}=.`)
      vel = op === 'MOVL'
        ? lerDecimal(l, m[2], 'V', FAIXAS.v, 1, 'mm/s')
        : lerDecimal(l, m[2], 'VJ', FAIXAS.vj, 2, '%')
      if (vel === null) return null
    } else if (m && m[1] === outra) {
      return l.erro(`${op} usa ${chave}=, não ${outra}=.`, op === 'MOVL' ? 'MOVL leva a velocidade do TCP em mm/s: V=10.0.' : 'MOVJ leva a velocidade em % do máximo das juntas: VJ=25.00.')
    } else return opcaoNaoImplementada(l, token)
  }
  if (vel === null) return l.erro(`${op} sem velocidade.`, op === 'MOVL' ? 'Acrescente V=, por exemplo MOVL C00001 V=10.0.' : 'Acrescente VJ=, por exemplo MOVJ C00001 VJ=25.00.')
  return op === 'MOVL' ? { op: 'MOVL', alvo, v: vel } : { op: 'MOVJ', alvo, vj: vel }
}

function lerArquivoCondicao(l: Leitor, token: string, nome: 'ASF' | 'AEF'): number | null {
  const m = new RegExp(`^${nome}#\\((\\d+)\\)$`).exec(token)
  if (!m) return l.erro(`"${token}" não é um arquivo de condição.`, `Escreva ${nome}#(1).`)
  const n = Number(m[1])
  if (n < 1) return l.erro(`${nome}#(${n}) não existe: os arquivos começam em 1.`, `Use ${nome}#(1).`)
  return n
}

function lerArco(l: Leitor, partes: string[]): Comando | null {
  const [op, ...resto] = partes
  if (op === 'ARCON') {
    if (resto.length === 0) return l.erro('ARCON sem condição.', 'Neste simulador a condição vem do arquivo de início de arco: ARCON ASF#(1).')
    if (resto.length > 1 || /^(AC|AV|AVP|V|T|ACOND)=/.test(resto[0])) {
      return l.erro('Condição escrita na própria linha do ARCON não está implementada.', 'Guarde corrente/alimentação e correção do arco no arquivo de condição e use ARCON ASF#(1).')
    }
    const asf = lerArquivoCondicao(l, resto[0], 'ASF')
    return asf === null ? null : { op: 'ARCON', asf }
  }
  if (resto.length === 0) return { op: 'ARCOF', aef: null }
  if (resto.length > 1 || resto[0].includes('=')) return l.erro('Condição de fim escrita na linha do ARCOF não está implementada.', 'Use ARCOF sozinho ou ARCOF AEF#(1).')
  const aef = lerArquivoCondicao(l, resto[0], 'AEF')
  return aef === null ? null : { op: 'ARCOF', aef }
}

function lerJump(l: Leitor, partes: string[]): Comando | null {
  const [, destino, ...resto] = partes
  if (!destino) return l.erro('JUMP sem destino.', 'Escreva JUMP *ROTULO.')
  if (/^JOB:/.test(destino)) return l.erro('JUMP para outro job não está implementado.', 'Este simulador tem um job só: salte para um rótulo dele (JUMP *ROTULO).')
  if (!destino.startsWith('*')) return l.erro(`"${destino}" não é um rótulo.`, 'O destino do JUMP começa com *, por exemplo JUMP *CAMADA.')
  const rotulo = destino.slice(1)
  if (resto.length === 0) return { op: 'JUMP', rotulo, condicao: null }
  if (resto[0] !== 'IF') return l.erro(`"${resto[0]}" depois do rótulo não é entendido.`, 'Para saltar com condição, escreva JUMP *ROTULO IF B000<4.')
  const cond = resto.slice(1).join('')
  if (!cond) return l.erro('IF sem condição.', 'Escreva a condição, por exemplo IF B000<4.')
  if (/^IN#|^OT#|^SIN#|^SOUT#/.test(cond)) return l.erro('Condição por entrada ou saída digital não está implementada.', 'Use uma condição com variável B, I ou D, por exemplo IF B000<4.')
  const m = /^([A-Z]\d+)(<>|<=|>=|=|<|>)(.+)$/.exec(cond)
  if (!m) return l.erro(`Condição "${cond}" não entendida.`, 'Use variável, comparação e valor: IF B000<4.')
  if (m[2].length === 2) return l.erro(`A comparação ${m[2]} não está implementada.`, 'Use =, < ou >. Por exemplo, "menor ou igual a 3" é <4 para inteiros.')
  const ref = lerVariavel(l, m[1], ['B', 'I', 'D'], 'condição')
  if (!ref) return null
  const valor = lerValor(l, m[3], ref.tipo, 'condição')
  if (!valor) return null
  return { op: 'JUMP', rotulo, condicao: { ref, comparacao: m[2] as Comparacao, valor } }
}

function lerSete(l: Leitor, partes: string[]): Comando | null {
  const [, pTxt, eTxt, vTxt, ...resto] = partes
  const destino = lerPosicao(l, pTxt, 'destino do SETE')
  if (!destino) return null
  const e = /^\((\d)\)$/.exec(eTxt ?? '')
  if (!e) return l.erro('SETE sem o número do elemento entre parênteses.', 'Escreva SETE P000 (3) 2200: (1) X, (2) Y, (3) Z.')
  const elemento = Number(e[1])
  if (elemento >= 4 && elemento <= 6) return l.erro(`O elemento (${elemento}) (rotação) não está implementado no SETE.`, 'Use (1) X, (2) Y ou (3) Z. Para girar a tocha, ensine outro ponto.')
  if (elemento < 1 || elemento > 6) return l.erro(`O elemento (${elemento}) não existe.`, 'Use (1) X, (2) Y ou (3) Z.')
  const valor = lerValor(l, vTxt, 'elemento', 'valor em mícrons')
  if (!valor) return null
  if (resto.length) return l.erro(`"${resto.join(' ')}" sobrando no fim do SETE.`, 'O SETE tem só variável, elemento e valor.')
  return { op: 'SETE', destino, elemento: elemento as 1 | 2 | 3, valor }
}

function lerAritmetica(l: Leitor, partes: string[]): Comando | null {
  const [op, dTxt, vTxt, ...resto] = partes
  if (resto.length) return l.erro(`"${resto.join(' ')}" sobrando no fim do ${op}.`, `${op} tem destino e valor: ${op} I000 1.`)
  if (dTxt && /^P\d/.test(dTxt)) {
    if (op === 'INC') return l.erro('INC não serve para posição.', 'Para somar a uma posição, use SETE ou ADD Pnnn Pmmm.')
    const destino = lerPosicao(l, dTxt, 'destino')
    if (!destino) return null
    if (vTxt && !/^P\d/.test(vTxt)) return l.erro(`${op} de posição só aceita outra posição.`, `Escreva ${op} ${dTxt} P001, ou mude um elemento com SETE.`)
    const origem = lerPosicao(l, vTxt, 'origem')
    if (!origem) return null
    return op === 'SET' ? { op: 'SETP', destino, origem } : { op: 'ADDP', destino, origem }
  }
  const destino = lerVariavel(l, dTxt, ['B', 'I', 'D'], 'destino')
  if (!destino) return null
  if (op === 'INC') {
    if (vTxt) return l.erro(`"${vTxt}" sobrando no INC.`, 'INC soma sempre 1: INC B000.')
    return { op: 'INC', destino }
  }
  const valor = lerValor(l, vTxt, destino.tipo, 'valor')
  if (!valor) return null
  return op === 'SET' ? { op: 'SET', destino, valor } : { op: 'ADD', destino, valor }
}

function lerSft(l: Leitor, partes: string[]): Comando | null {
  const [op, pTxt, ...resto] = partes
  if (op === 'SFTOF') return resto.length || pTxt ? l.erro('SFTOF não leva argumentos.', 'Escreva só SFTOF.') : { op: 'SFTOF' }
  const p = lerPosicao(l, pTxt, 'deslocamento')
  if (!p) return null
  if (resto.length) {
    return l.erro(`Deslocamento em "${resto.join(' ')}" não está implementado.`, 'Este simulador só desloca no sistema da base, o padrão: escreva SFTON P000, sem sistema.')
  }
  return { op: 'SFTON', p }
}

/** Lê uma linha. Devolve o comando, ou null se a linha estiver vazia ou errada. */
function lerLinha(l: Leitor, bruta: string): Comando | null {
  const texto = bruta.trim()
  if (!texto) return null
  if (texto.startsWith("'")) return { op: 'COMENTARIO', texto: texto.slice(1) }
  const lingua = outraLinguagem(texto)
  if (lingua) return l.erro(`Isto parece ${lingua}, não INFORM.`, 'Este modo usa só o INFORM do controlador Yaskawa. Por exemplo, um movimento linear é MOVL C00001 V=10.0.')
  const sup = texto.toUpperCase()
  if (sup.includes("'")) return l.erro('Comentário no fim da linha não é aceito.', "Ponha o comentário numa linha própria, começando com '.")
  if (sup.startsWith('*')) {
    const nome = sup.slice(1)
    if (!/^[A-Z0-9_]{1,8}$/.test(nome)) return l.erro(`Rótulo "${texto}" inválido.`, 'Use * e até 8 letras, números ou _ (limite do simulador), sem espaço: *CAMADA.')
    return { op: 'ROTULO', nome }
  }
  if (/;\s*$/.test(sup)) return l.erro('INFORM não termina linha com ponto e vírgula.', 'Apague o ; do fim.')
  const partes = sup.split(/\s+/)
  const op = partes[0]
  switch (op) {
    case 'NOP':
    case 'END':
    case 'SFTOF':
      if (partes.length > 1 && op !== 'SFTOF') return l.erro(`${op} não leva argumentos.`, `Escreva só ${op}.`)
      return op === 'SFTOF' ? lerSft(l, partes) : { op }
    case 'MOVJ':
    case 'MOVL':
      return lerMovimento(l, partes)
    case 'TIMER': {
      const m = /^T=(.*)$/.exec(partes[1] ?? '')
      if (!m || partes.length > 2) return l.erro('TIMER sem o tempo.', 'Escreva TIMER T=1.00 (segundos).')
      const t = lerDecimal(l, m[1], 'T', FAIXAS.timer, 2, 's')
      return t === null ? null : { op: 'TIMER', t }
    }
    case 'ARCON':
    case 'ARCOF':
      return lerArco(l, partes)
    case 'SET':
    case 'ADD':
    case 'INC':
      return lerAritmetica(l, partes)
    case 'SETE':
      return lerSete(l, partes)
    case 'JUMP':
      return lerJump(l, partes)
    case 'SFTON':
      return lerSft(l, partes)
  }
  if (NAO_IMPLEMENTADOS[op]) return l.erro(`${op} (${NAO_IMPLEMENTADOS[op]}) existe no INFORM, mas não está implementado neste simulador.`, 'Reescreva com os comandos da lista (botão Comandos).')
  const sugestao = parecido(op)
  return l.erro(`"${op}" não é um comando deste subconjunto do INFORM.`, sugestao ? `Você quis dizer ${sugestao}? Veja a lista de comandos.` : 'Veja a lista de comandos aceitos (botão Comandos).')
}

/** Lê e valida o corpo do job inteiro. */
export function lerPrograma(texto: string, ctx: ContextoValidacao): Programa {
  const linhas = texto.replace(/\r\n?/g, '\n').split('\n')
  const diagnosticos: Diagnostico[] = []
  const instrucoes: Instrucao[] = []
  if (linhas.length > LIMITES.linhas) {
    diagnosticos.push({ linha: LIMITES.linhas + 1, gravidade: 'erro', mensagem: `O programa passa de ${LIMITES.linhas} linhas (limite do simulador).`, correcao: 'Use JUMP e variáveis para repetir trechos em vez de copiá-los.' })
  }
  linhas.slice(0, LIMITES.linhas).forEach((bruta, i) => {
    const l = new Leitor(i + 1)
    const c = lerLinha(l, bruta)
    diagnosticos.push(...l.diagnosticos)
    if (c) instrucoes.push({ ...c, linha: i + 1 } as Instrucao)
  })
  const rotulos = new Map<string, number>()
  validarEstrutura(instrucoes, ctx, diagnosticos, rotulos, linhas.length)
  diagnosticos.sort((a, b) => a.linha - b.linha || (a.gravidade === 'erro' ? -1 : 1))
  return { instrucoes, diagnosticos, rotulos, valido: !diagnosticos.some((d) => d.gravidade === 'erro') }
}

function validarEstrutura(ins: Instrucao[], ctx: ContextoValidacao, diag: Diagnostico[], rotulos: Map<string, number>, totalLinhas: number): void {
  const erro = (linha: number, mensagem: string, correcao: string) => diag.push({ linha, gravidade: 'erro', mensagem, correcao })
  const aviso = (linha: number, mensagem: string, correcao: string) => diag.push({ linha, gravidade: 'aviso', mensagem, correcao })
  const executaveis = ins.filter((i) => i.op !== 'COMENTARIO' && i.op !== 'ROTULO')
  const primeira = executaveis[0]
  if (!primeira || primeira.op !== 'NOP') erro(primeira?.linha ?? 1, 'O job começa com NOP.', 'Ponha NOP na primeira linha.')
  const ends = executaveis.filter((i) => i.op === 'END')
  const ultima = executaveis[executaveis.length - 1]
  if (!ends.length) erro(Math.max(1, totalLinhas), 'Falta o END no fim do job.', 'Ponha END na última linha.')
  for (const e of ends) if (e !== ultima) erro(e.linha, 'END só pode aparecer uma vez, na última linha.', 'Apague este END ou mova-o para o fim. Para encerrar antes, salte para um rótulo antes do END.')
  ins.forEach((i, k) => {
    if (i.op === 'ROTULO') {
      if (rotulos.has(i.nome)) erro(i.linha, `O rótulo *${i.nome} aparece duas vezes.`, 'Dê um nome diferente a cada rótulo.')
      else rotulos.set(i.nome, k)
    }
  })
  const pAtribuidas = new Set<number>()
  for (const i of ins) if (i.op === 'SETP' || i.op === 'ADDP' || i.op === 'SETE') pAtribuidas.add(i.destino.n)
  let temArco = false
  for (const i of ins) {
    if (i.op === 'JUMP' && !rotulos.has(i.rotulo)) erro(i.linha, `O rótulo *${i.rotulo} não existe.`, `Crie a linha *${i.rotulo} onde o salto deve chegar, ou corrija o nome.`)
    if ((i.op === 'MOVJ' || i.op === 'MOVL') && i.alvo.tipo === 'C' && i.alvo.n >= ctx.pontos) {
      erro(i.linha, `O ponto C${String(i.alvo.n).padStart(5, '0')} não está na tabela de posições.`, `Ensine o ponto na tabela (há ${ctx.pontos}: C00000 a C${String(ctx.pontos - 1).padStart(5, '0')}) ou use outro.`)
    }
    if ((i.op === 'MOVJ' || i.op === 'MOVL') && i.alvo.tipo === 'P' && !pAtribuidas.has(i.alvo.n)) {
      erro(i.linha, `P${String(i.alvo.n).padStart(3, '0')} nunca recebe uma posição neste programa.`, 'Antes do movimento, copie um ponto para ela (SET Pnnn Pmmm) ou monte com SETE.')
    }
    if (i.op === 'SFTON' && !pAtribuidas.has(i.p.n)) aviso(i.linha, `P${String(i.p.n).padStart(3, '0')} nunca é ajustada: o deslocamento é zero.`, 'Monte o deslocamento com SETE antes do SFTON.')
    if (i.op === 'ARCON') {
      temArco = true
      if (i.asf > ctx.arquivosAsf) erro(i.linha, `O arquivo ASF#(${i.asf}) não existe.`, `Há ${ctx.arquivosAsf} arquivo(s) de início de arco: use ASF#(1) a ASF#(${ctx.arquivosAsf}), ou crie mais na aba Condições.`)
    }
    if (i.op === 'ARCOF' && i.aef !== null && i.aef > ctx.arquivosAef) erro(i.linha, `O arquivo AEF#(${i.aef}) não existe.`, `Há ${ctx.arquivosAef} arquivo(s) de fim de arco: use AEF#(1) a AEF#(${ctx.arquivosAef}).`)
  }
  if (!temArco && executaveis.length) aviso(executaveis[0].linha, 'O programa não tem ARCON: nada será depositado.', 'Para fabricar, abra o arco com ARCON ASF#(1) antes do movimento de soldar.')
  // Na ordem do texto: MOVJ com o arco aberto deposita num caminho que não é reto.
  let aberto = false
  for (const i of ins) {
    if (i.op === 'ARCON') aberto = true
    else if (i.op === 'ARCOF') aberto = false
    else if (i.op === 'MOVJ' && aberto) aviso(i.linha, 'MOVJ com o arco aberto: o caminho não é reto e a velocidade de soldagem não é controlada.', 'Solde com MOVL; deixe o MOVJ para longe da peça.')
  }
}

/** Nome do ponto/variável como aparece no programa. */
export const nomePonto = (n: number) => `C${String(n).padStart(5, '0')}`
export const nomeVariavel = (v: { tipo: string; n: number }) => `${v.tipo}${String(v.n).padStart(3, '0')}`
