import type { Dispositivo } from '../entrada/tipos'
import type { FormatoJunta } from '../modelo/junta'
import { INFO_JUNTA } from '../modelo/juntas'
import { MATERIAIS } from '../modelo/material'
import { buscarMissao, validarPreparo, type Dificuldade, type Missao, type Preparo } from '../missoes/catalogo'
import type { Ajustes, ContextoProcesso } from '../modelo/processo'
import {
  compararPontuacoes,
  ESCALA_PONTUACAO,
  VERSAO_PONTUACAO,
  escalaDaPontuacao,
  notaCategoria,
  PESOS_PADRAO,
  validarPesos,
  type CriterioDesempate,
  type Pesos,
  type ResultadoPontuacao,
} from '../pontuacao/regras'
import type { EventosCompactos } from './eventos'
import { normalizarNome } from './recordes'

/*
 * Motor do torneio local por turnos (docs/TORNEIO.md).
 *
 * Funções puras sobre um retrato dos dados (BaseTorneio): cada ação devolve
 * uma cópia nova ou lança ErroTorneio. A interface só chama estas ações e
 * salva o resultado — as regras (vez, limite de tentativas, entrega,
 * anonimato, publicação) vivem aqui e são testadas sem navegador.
 */

export class ErroTorneio extends Error {}

export interface Participante {
  id: string
  nome: string
  criadoEm: string
}

export interface RodadaConfig {
  missaoId: string
  missaoVersao: number
  dificuldade: Dificuldade
  /** Limite MÁXIMO de tentativas oficiais por jogador. */
  tentativas: number
  /** Só em torneios antigos (traçado da junta, H41); a junta agora vem da peça escolhida (H46). */
  rota?: FormatoJunta | 'sorteada'
  formato?: FormatoJunta
}

/** Missão da rodada: a peça escolhida, com a junta e a posição dela (H46, H47). */
export function missaoDaRodada(r: RodadaConfig): Missao {
  return buscarMissao(r.missaoId)!
}

/** Peça de uma missão pelo material: "Inox austenítico · 2,0 mm". */
export function nomePeca(missaoId: string): string {
  const m = buscarMissao(missaoId)
  if (!m) return missaoId
  return `${MATERIAIS[m.material].nome} · ${m.geometria.espessuraMm.toLocaleString('pt-BR', { minimumFractionDigits: 1 })} mm`
}

/** Rótulo da rodada: material, espessura e junta. */
export function descreverRodada(r: RodadaConfig): string {
  const m = buscarMissao(r.missaoId)
  return m ? `${nomePeca(r.missaoId)} · junta ${INFO_JUNTA[m.geometria.junta].nome.toLowerCase()}` : nomePeca(r.missaoId)
}

export type OrdemJogadores = 'fixa' | 'rodizio' | 'sorteio'
export type RegraEntrega = 'ultima' | 'melhor' | 'escolha'
export type ModoAvaliacao = 'automatico' | 'professor'
export type ClassificacaoProfessor = 'professor' | 'sistema' | 'ponderada'
export type RegraDispositivo = { tipo: 'exigir'; dispositivo: Dispositivo } | { tipo: 'separar' }

export interface ConfigTorneio {
  nome: string
  /** Nomes na ordem de cadastro. */
  participantes: string[]
  rodadas: RodadaConfig[]
  ordem: OrdemJogadores
  modo: ModoAvaliacao
  regraEntrega: RegraEntrega
  desempate: CriterioDesempate
  pesos: Pesos
  /** Só no modo com professor. Padrão: nota final do professor. */
  classificacao: ClassificacaoProfessor
  pesosMedia: { professor: number; sistema: number }
  dispositivo: RegraDispositivo
}

export interface Torneio {
  id: string
  versao: 1
  /** Ausente em torneios antigos: inferida dos resultados salvos. */
  versaoPontuacao?: string
  config: ConfigTorneio
  participanteIds: string[]
  status: 'preparado' | 'em-andamento' | 'concluido'
  criadoEm: string
  iniciadoEm: string | null
  concluidoEm: string | null
  /** Ordem de jogo de cada rodada, fixada no início. */
  ordemPorRodada: string[][]
  /** Ordem embaralhada de julgamento (ids de entrega) por rodada. */
  ordemJulgamento: Record<number, string[]>
  /** Rodada → data de publicação dos resultados. */
  publicadas: Record<number, string>
  historico: { data: string; descricao: string }[]
  /** Torneio de onde a configuração foi duplicada. */
  origemId: string | null
}

export type StatusTentativa = 'em-andamento' | 'concluida' | 'interrompida'

export interface TentativaRegistro {
  id: string
  torneioId: string
  participanteId: string
  rodada: number
  /** 1, 2, ... dentro da rodada (só oficiais; treino nunca é registrado aqui). */
  numero: number
  status: StatusTentativa
  dispositivo: Dispositivo
  preparo: Preparo
  ajustes: Ajustes
  contexto: ContextoProcesso
  eventos: EventosCompactos | null
  resultado: ResultadoPontuacao | null
  iniciadaEm: string
  concluidaEm: string | null
}

export interface Entrega {
  id: string
  torneioId: string
  rodada: number
  participanteId: string
  /** null se todas as tentativas foram interrompidas. */
  tentativaId: string | null
  regra: RegraEntrega
  /** Código anônimo usado no julgamento. Nunca mostrado ao jogador. */
  codigo: string
  entregueEm: string
}

export const ITENS_FICHA = ['acabamento', 'dimensoes', 'continuidade', 'alinhamento', 'fusao'] as const
export type ItemFicha = (typeof ITENS_FICHA)[number]
export const NOME_ITEM_FICHA: Record<ItemFicha, string> = {
  acabamento: 'Aspecto do cordão (vista de cima)',
  dimensoes: 'Dimensões em relação ao desenho',
  continuidade: 'Continuidade, início e fim',
  alinhamento: 'Alinhamento com a junta',
  fusao: 'Indícios de fusão no corte sintético',
}

/** 0 a 10, ou null = "não avaliado" (sem evidência suficiente). */
export type NotaFicha = number | null

export interface FichaInicial {
  itens: Record<ItemFicha, NotaFicha>
  geral: NotaFicha
  observacoes: string
  confirmadaEm: string
}

export interface AvaliacaoFinal {
  /** 0 a 10. */
  nota: number
  justificativa: string
  confirmadaEm: string
}

export interface Revisao {
  campo: string
  anterior: string
  novo: string
  data: string
  motivo: string
  aposPublicacao: boolean
}

export interface Avaliacao {
  id: string
  torneioId: string
  entregaId: string
  rodada: number
  inicial: FichaInicial | null
  final: AvaliacaoFinal | null
  revisoes: Revisao[]
}

export interface BaseTorneio {
  torneio: Torneio
  participantes: Participante[]
  tentativas: TentativaRegistro[]
  entregas: Entrega[]
  avaliacoes: Avaliacao[]
}

/** Fontes de aleatoriedade e de identificadores, injetáveis nos testes. */
export interface Ambiente {
  agora: () => Date
  aleatorio: () => number
  novoId: (prefixo: string) => string
}

export const CONFIG_PADRAO: Omit<ConfigTorneio, 'nome' | 'participantes' | 'rodadas'> = {
  ordem: 'rodizio',
  modo: 'automatico',
  regraEntrega: 'melhor',
  desempate: 'integridade-desenho',
  pesos: { ...PESOS_PADRAO },
  classificacao: 'professor',
  pesosMedia: { professor: 50, sistema: 50 },
  dispositivo: { tipo: 'separar' },
}

const copiar = <T>(v: T): T => structuredClone(v)

// ---------------------------------------------------------------- configuração

export function validarConfig(c: ConfigTorneio): string[] {
  const erros: string[] = []
  if (!normalizarNome(c.nome)) erros.push('Dê um nome ao torneio.')
  const nomes = c.participantes.map(normalizarNome)
  if (nomes.length < 2) erros.push('Cadastre pelo menos dois participantes.')
  if (nomes.some((n) => !n)) erros.push('Há participante sem nome.')
  if (new Set(nomes.map((n) => n.toLocaleLowerCase('pt-BR'))).size !== nomes.length) erros.push('Há nomes repetidos.')
  if (c.rodadas.length < 1) erros.push('Configure pelo menos uma rodada.')
  c.rodadas.forEach((r, i) => {
    const m = buscarMissao(r.missaoId)
    if (!m) erros.push(`Rodada ${i + 1}: missão inexistente.`)
    else if (m.versao !== r.missaoVersao) erros.push(`Rodada ${i + 1}: versão da missão desatualizada.`)
    if (!Number.isInteger(r.tentativas) || r.tentativas < 1 || r.tentativas > 10) erros.push(`Rodada ${i + 1}: tentativas devem ser de 1 a 10.`)
  })
  erros.push(...validarPesos(c.pesos))
  if (c.modo === 'professor' && c.classificacao === 'ponderada') {
    const { professor, sistema } = c.pesosMedia
    if (!(professor >= 0 && sistema >= 0 && professor + sistema > 0)) erros.push('Pesos da média ponderada inválidos.')
  }
  return erros
}

export function criarTorneio(config: ConfigTorneio, participantes: Participante[], amb: Ambiente, origemId: string | null = null): Torneio {
  const erros = validarConfig(config)
  if (erros.length) throw new ErroTorneio(erros.join(' '))
  if (participantes.length !== config.participantes.length) throw new ErroTorneio('Participantes não conferem com a configuração.')
  return {
    id: amb.novoId('tor'),
    versao: 1,
    versaoPontuacao: VERSAO_PONTUACAO,
    config: copiar(config),
    participanteIds: participantes.map((p) => p.id),
    status: 'preparado',
    criadoEm: amb.agora().toISOString(),
    iniciadoEm: null,
    concluidoEm: null,
    ordemPorRodada: [],
    ordemJulgamento: {},
    publicadas: {},
    historico: [],
    origemId,
  }
}

/** As regras só mudam antes de começar. Depois, só duplicando (nova configuração). */
export function alterarConfig(base: BaseTorneio, config: ConfigTorneio): BaseTorneio {
  if (base.torneio.status !== 'preparado') {
    throw new ErroTorneio('As regras ficam bloqueadas depois do início. Duplique a configuração em um novo torneio.')
  }
  const erros = validarConfig(config)
  if (erros.length) throw new ErroTorneio(erros.join(' '))
  const b = copiar(base)
  b.torneio.config = copiar(config)
  return b
}

export function duplicarConfig(t: Torneio): ConfigTorneio {
  const c = copiar(t.config)
  c.nome = normalizarNome(`${c.nome} (cópia)`)
  // Campos de traçado de versões antigas não seguem para a cópia.
  for (const r of c.rodadas) {
    delete r.formato
    delete r.rota
  }
  return c
}

function embaralhar<T>(lista: T[], aleatorio: () => number): T[] {
  const v = [...lista]
  for (let i = v.length - 1; i > 0; i--) {
    const j = Math.floor(aleatorio() * (i + 1))
    ;[v[i], v[j]] = [v[j], v[i]]
  }
  return v
}

export function iniciar(base: BaseTorneio, amb: Ambiente): BaseTorneio {
  if (base.torneio.status !== 'preparado') throw new ErroTorneio('O torneio já começou.')
  const b = copiar(base)
  const ids = b.torneio.participanteIds
  b.torneio.ordemPorRodada = b.torneio.config.rodadas.map((_, r) => {
    if (b.torneio.config.ordem === 'fixa') return [...ids]
    if (b.torneio.config.ordem === 'rodizio') return ids.map((_, k) => ids[(k + r) % ids.length])
    return embaralhar(ids, amb.aleatorio)
  })
  b.torneio.status = 'em-andamento'
  b.torneio.iniciadoEm = amb.agora().toISOString()
  b.torneio.historico.push({ data: b.torneio.iniciadoEm, descricao: 'Torneio iniciado; regras bloqueadas.' })
  return b
}

// ---------------------------------------------------------------- turnos

export interface Vez {
  rodada: number
  participanteId: string
  /** 1-based, dentro da rodada. */
  posicao: number
  total: number
}

const entregaDe = (b: BaseTorneio, pid: string, rodada: number) =>
  b.entregas.find((e) => e.participanteId === pid && e.rodada === rodada)

export function rodadaCompleta(b: BaseTorneio, rodada: number): boolean {
  return b.torneio.ordemPorRodada[rodada]?.every((pid) => entregaDe(b, pid, rodada)) ?? false
}

/** De quem é a vez: primeiro jogador sem entrega da primeira rodada incompleta. */
export function vezAtual(b: BaseTorneio): Vez | null {
  if (b.torneio.status !== 'em-andamento') return null
  for (let r = 0; r < b.torneio.ordemPorRodada.length; r++) {
    const ordem = b.torneio.ordemPorRodada[r]
    const k = ordem.findIndex((pid) => !entregaDe(b, pid, r))
    if (k >= 0) return { rodada: r, participanteId: ordem[k], posicao: k + 1, total: ordem.length }
  }
  return null
}

export function tentativasOficiais(b: BaseTorneio, pid: string, rodada: number): TentativaRegistro[] {
  return b.tentativas.filter((t) => t.participanteId === pid && t.rodada === rodada).sort((x, y) => x.numero - y.numero)
}

export function tentativasRestantes(b: BaseTorneio, pid: string, rodada: number): number {
  return b.torneio.config.rodadas[rodada].tentativas - tentativasOficiais(b, pid, rodada).length
}

/** Dispositivo que o jogador já fixou (modo "separar" exige o mesmo em todo o torneio). */
export function dispositivoFixado(b: BaseTorneio, pid: string): Dispositivo | null {
  return b.tentativas.find((t) => t.participanteId === pid)?.dispositivo ?? null
}

export function iniciarTentativa(
  base: BaseTorneio,
  dados: { participanteId: string; dispositivo: Dispositivo; preparo: Preparo; ajustes: Ajustes; contexto: ContextoProcesso },
  amb: Ambiente,
): { base: BaseTorneio; tentativa: TentativaRegistro } {
  const vez = vezAtual(base)
  if (!vez || vez.participanteId !== dados.participanteId) throw new ErroTorneio('Não é a vez deste participante.')
  const regra = base.torneio.config.dispositivo
  if (regra.tipo === 'exigir' && dados.dispositivo !== regra.dispositivo) {
    throw new ErroTorneio('Este torneio exige outro dispositivo.')
  }
  const fixado = dispositivoFixado(base, dados.participanteId)
  if (regra.tipo === 'separar' && fixado && fixado !== dados.dispositivo) {
    throw new ErroTorneio('Neste torneio cada participante mantém o mesmo dispositivo do início ao fim.')
  }
  if (tentativasOficiais(base, dados.participanteId, vez.rodada).some((t) => t.status === 'em-andamento')) {
    throw new ErroTorneio('Já existe uma tentativa em andamento.')
  }
  if (tentativasRestantes(base, dados.participanteId, vez.rodada) <= 0) throw new ErroTorneio('Limite de tentativas atingido.')
  const versoes = new Set(base.tentativas.flatMap((t) => t.resultado ? [t.resultado.versao] : []))
  if ((base.torneio.versaoPontuacao && base.torneio.versaoPontuacao !== VERSAO_PONTUACAO) ||
      [...versoes].some((v) => v !== VERSAO_PONTUACAO)) {
    throw new ErroTorneio('Este torneio usa regras anteriores. Seus resultados foram preservados; duplique a configuração para jogar com as regras atuais.')
  }
  const rodada = base.torneio.config.rodadas[vez.rodada]
  const missao = missaoDaRodada(rodada)
  const erros = validarPreparo(missao, dados.preparo)
  if (erros.length) throw new ErroTorneio(erros.join(' '))

  const b = copiar(base)
  b.torneio.versaoPontuacao = VERSAO_PONTUACAO
  const tentativa: TentativaRegistro = {
    id: amb.novoId('ten'),
    torneioId: b.torneio.id,
    participanteId: dados.participanteId,
    rodada: vez.rodada,
    numero: tentativasOficiais(b, dados.participanteId, vez.rodada).length + 1,
    status: 'em-andamento',
    dispositivo: dados.dispositivo,
    preparo: copiar(dados.preparo),
    ajustes: copiar(dados.ajustes),
    contexto: copiar(dados.contexto),
    eventos: null,
    resultado: null,
    iniciadaEm: amb.agora().toISOString(),
    concluidaEm: null,
  }
  b.tentativas.push(tentativa)
  return { base: b, tentativa }
}

export function concluirTentativa(
  base: BaseTorneio,
  tentativaId: string,
  dados: { eventos: EventosCompactos; resultado: ResultadoPontuacao },
  amb: Ambiente,
): BaseTorneio {
  const t = base.tentativas.find((x) => x.id === tentativaId)
  if (!t) throw new ErroTorneio('Tentativa não encontrada.')
  if (t.status !== 'em-andamento') throw new ErroTorneio('Esta tentativa já foi encerrada.')
  const b = copiar(base)
  const alvo = b.tentativas.find((x) => x.id === tentativaId)!
  alvo.status = 'concluida'
  alvo.eventos = copiar(dados.eventos)
  alvo.resultado = copiar(dados.resultado)
  alvo.concluidaEm = amb.agora().toISOString()
  return b
}

/**
 * Ao retomar (página recarregada no meio de uma tentativa), a tentativa em
 * andamento vira "interrompida": conta no limite e não pode ser entregue.
 * Isso evita recarregar a página para apagar uma tentativa ruim.
 */
export function marcarInterrompidas(base: BaseTorneio): { base: BaseTorneio; alteradas: number } {
  const n = base.tentativas.filter((t) => t.status === 'em-andamento').length
  if (n === 0) return { base, alteradas: 0 }
  const b = copiar(base)
  for (const t of b.tentativas) if (t.status === 'em-andamento') t.status = 'interrompida'
  return { base: b, alteradas: n }
}

// ---------------------------------------------------------------- entrega

/** Escolhe a tentativa entregue segundo a regra definida antes do início. */
export function selecionarEntrega(
  regra: RegraEntrega,
  concluidas: TentativaRegistro[],
  desempate: CriterioDesempate,
  escolhaId?: string,
): TentativaRegistro | null {
  if (concluidas.length === 0) return null
  if (regra === 'ultima') return [...concluidas].sort((a, b) => b.numero - a.numero)[0]
  if (regra === 'melhor') {
    return [...concluidas].sort((a, b) => compararPontuacoes(a.resultado!, b.resultado!, desempate) || a.numero - b.numero)[0]
  }
  const escolhida = concluidas.find((t) => t.id === escolhaId)
  if (!escolhida) throw new ErroTorneio('Selecione uma das tentativas concluídas.')
  return escolhida
}

const ALFABETO_CODIGO = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

export function gerarCodigo(existentes: Set<string>, aleatorio: () => number): string {
  for (;;) {
    let c = 'E-'
    for (let i = 0; i < 5; i++) c += ALFABETO_CODIGO[Math.floor(aleatorio() * ALFABETO_CODIGO.length)]
    if (!existentes.has(c)) return c
  }
}

export function entregar(base: BaseTorneio, pid: string, escolhaId: string | undefined, amb: Ambiente): BaseTorneio {
  const vez = vezAtual(base)
  if (!vez || vez.participanteId !== pid) throw new ErroTorneio('Não é a vez deste participante.')
  if (entregaDe(base, pid, vez.rodada)) throw new ErroTorneio('A entrega desta rodada já foi feita.')
  const oficiais = tentativasOficiais(base, pid, vez.rodada)
  if (oficiais.length === 0) throw new ErroTorneio('Faça pelo menos uma tentativa oficial antes de entregar.')
  if (oficiais.some((t) => t.status === 'em-andamento')) throw new ErroTorneio('Termine a tentativa em andamento antes de entregar.')
  const { regraEntrega, desempate } = base.torneio.config
  const escolhida = selecionarEntrega(regraEntrega, oficiais.filter((t) => t.status === 'concluida'), desempate, escolhaId)

  const b = copiar(base)
  b.entregas.push({
    id: amb.novoId('ent'),
    torneioId: b.torneio.id,
    rodada: vez.rodada,
    participanteId: pid,
    tentativaId: escolhida?.id ?? null,
    regra: regraEntrega,
    codigo: gerarCodigo(new Set(b.entregas.filter((e) => e.torneioId === b.torneio.id).map((e) => e.codigo)), amb.aleatorio),
    entregueEm: amb.agora().toISOString(),
  })
  atualizarConclusao(b, amb)
  return b
}

function atualizarConclusao(b: BaseTorneio, amb: Ambiente): void {
  const todas = b.torneio.config.rodadas.every((_, r) => rodadaCompleta(b, r))
  const publicadas = b.torneio.config.modo === 'automatico' || b.torneio.config.rodadas.every((_, r) => b.torneio.publicadas[r])
  if (todas && publicadas && b.torneio.status !== 'concluido') {
    b.torneio.status = 'concluido'
    b.torneio.concluidoEm = amb.agora().toISOString()
    b.torneio.historico.push({ data: b.torneio.concluidoEm, descricao: 'Torneio concluído.' })
  }
}

// ---------------------------------------------------------------- julgamento

/** Prepara a rodada para o professor: avaliações em branco e ordem embaralhada. */
export function prepararJulgamento(base: BaseTorneio, rodada: number, amb: Ambiente): BaseTorneio {
  if (base.torneio.config.modo !== 'professor') throw new ErroTorneio('Este torneio não tem avaliação de professor.')
  if (!rodadaCompleta(base, rodada)) throw new ErroTorneio('A rodada ainda não terminou.')
  const b = copiar(base)
  const entregas = b.entregas.filter((e) => e.torneioId === b.torneio.id && e.rodada === rodada)
  if (!b.torneio.ordemJulgamento[rodada]) {
    b.torneio.ordemJulgamento[rodada] = embaralhar(entregas.map((e) => e.id), amb.aleatorio)
  }
  for (const e of entregas) {
    if (!b.avaliacoes.some((a) => a.entregaId === e.id)) {
      b.avaliacoes.push({ id: amb.novoId('ava'), torneioId: b.torneio.id, entregaId: e.id, rodada, inicial: null, final: null, revisoes: [] })
    }
  }
  return b
}

export type SituacaoJulgamento = 'pendente' | 'inicial-registrada' | 'finalizada'

/** O que o professor vê na lista: só código e situação. Nada de nome, ordem de jogo ou ranking. */
export interface ItemListaJulgamento {
  codigo: string
  entregaId: string
  situacao: SituacaoJulgamento
}

export function listaJulgamento(b: BaseTorneio, rodada: number): ItemListaJulgamento[] {
  return (b.torneio.ordemJulgamento[rodada] ?? []).map((id) => {
    const e = b.entregas.find((x) => x.id === id)!
    const a = b.avaliacoes.find((x) => x.entregaId === id)
    return {
      codigo: e.codigo,
      entregaId: id,
      situacao: a?.final ? 'finalizada' : a?.inicial ? 'inicial-registrada' : 'pendente',
    }
  })
}

/**
 * Evidências de uma entrega para o professor. A pontuação automática só vem
 * depois que a avaliação inicial foi confirmada. Não inclui nome, participante,
 * número da tentativa, dispositivo nem horário.
 */
export interface EvidenciaJulgamento {
  codigo: string
  rodada: number
  missaoId: string
  dificuldade: Dificuldade
  temSolda: boolean
  contexto: ContextoProcesso | null
  preparo: Preparo | null
  ajustes: Ajustes | null
  eventos: EventosCompactos | null
  inicial: FichaInicial | null
  final: AvaliacaoFinal | null
  /** null até a avaliação inicial ser confirmada. */
  automatico: ResultadoPontuacao | null
}

export function evidenciaJulgamento(b: BaseTorneio, entregaId: string): EvidenciaJulgamento {
  const e = b.entregas.find((x) => x.id === entregaId)
  if (!e) throw new ErroTorneio('Entrega não encontrada.')
  const a = b.avaliacoes.find((x) => x.entregaId === entregaId)
  const t = e.tentativaId ? b.tentativas.find((x) => x.id === e.tentativaId) ?? null : null
  const rodada = b.torneio.config.rodadas[e.rodada]
  return {
    codigo: e.codigo,
    rodada: e.rodada,
    missaoId: rodada.missaoId,
    dificuldade: rodada.dificuldade,
    temSolda: !!t,
    contexto: t ? copiar(t.contexto) : null,
    preparo: t ? copiar(t.preparo) : null,
    ajustes: t ? copiar(t.ajustes) : null,
    eventos: t?.eventos ? copiar(t.eventos) : null,
    inicial: a?.inicial ? copiar(a.inicial) : null,
    final: a?.final ? copiar(a.final) : null,
    automatico: a?.inicial && t?.resultado ? copiar(t.resultado) : null,
  }
}

function validarNota(v: NotaFicha, rotulo: string): void {
  if (v === null) return
  if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > 10) throw new ErroTorneio(`${rotulo}: nota de 0 a 10.`)
}

function avaliacaoDe(b: BaseTorneio, entregaId: string): Avaliacao {
  const a = b.avaliacoes.find((x) => x.entregaId === entregaId)
  if (!a) throw new ErroTorneio('Prepare o julgamento da rodada antes de avaliar.')
  return a
}

export function registrarInicial(
  base: BaseTorneio,
  entregaId: string,
  ficha: Omit<FichaInicial, 'confirmadaEm'>,
  amb: Ambiente,
): BaseTorneio {
  for (const i of ITENS_FICHA) validarNota(ficha.itens[i], NOME_ITEM_FICHA[i])
  validarNota(ficha.geral, 'Avaliação geral inicial')
  if (avaliacaoDe(base, entregaId).inicial) throw new ErroTorneio('A avaliação inicial já foi registrada; use a revisão.')
  const b = copiar(base)
  avaliacaoDe(b, entregaId).inicial = { ...copiar(ficha), confirmadaEm: amb.agora().toISOString() }
  return b
}

export function registrarFinal(base: BaseTorneio, entregaId: string, final: { nota: number; justificativa: string }, amb: Ambiente): BaseTorneio {
  const a = avaliacaoDe(base, entregaId)
  if (!a.inicial) throw new ErroTorneio('Registre a avaliação inicial antes da nota final.')
  if (a.final) throw new ErroTorneio('A nota final já foi registrada; use a revisão.')
  validarNota(final.nota, 'Nota final')
  if (final.nota === null || final.justificativa.trim().length < 10) throw new ErroTorneio('Informe a nota final e uma justificativa (10 caracteres ou mais).')
  const b = copiar(base)
  avaliacaoDe(b, entregaId).final = { nota: final.nota, justificativa: final.justificativa.trim(), confirmadaEm: amb.agora().toISOString() }
  return b
}

export type CampoRevisao = `inicial.${ItemFicha}` | 'inicial.geral' | 'final.nota' | 'final.justificativa'

const textoNota = (v: unknown) =>
  v === null ? 'não avaliado' : typeof v === 'number' ? v.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) : String(v)

/** Nome legível de um campo revisável (para telas e histórico). */
export function rotuloCampo(campo: string): string {
  if (campo === 'final.nota') return 'nota final'
  if (campo === 'final.justificativa') return 'justificativa final'
  if (campo === 'inicial.geral') return 'avaliação geral inicial'
  const item = campo.slice('inicial.'.length) as ItemFicha
  return NOME_ITEM_FICHA[item] ? `ficha inicial — ${NOME_ITEM_FICHA[item].toLowerCase()}` : campo
}

/** Revisão com rastro: valor anterior, novo, data e motivo. */
export function revisar(base: BaseTorneio, entregaId: string, campo: CampoRevisao, novo: NotaFicha | string, motivo: string, amb: Ambiente): BaseTorneio {
  if (motivo.trim().length < 5) throw new ErroTorneio('Informe o motivo da alteração.')
  const b = copiar(base)
  const a = avaliacaoDe(b, entregaId)
  const data = amb.agora().toISOString()
  let anterior: string
  if (campo === 'final.nota' || campo === 'final.justificativa') {
    if (!a.final) throw new ErroTorneio('Ainda não há nota final para revisar.')
    if (campo === 'final.nota') {
      if (typeof novo !== 'number') throw new ErroTorneio('Nota final: valor numérico.')
      validarNota(novo, 'Nota final')
      anterior = textoNota(a.final.nota)
      a.final.nota = novo
    } else {
      if (typeof novo !== 'string' || novo.trim().length < 10) throw new ErroTorneio('Justificativa com 10 caracteres ou mais.')
      anterior = a.final.justificativa
      a.final.justificativa = novo.trim()
    }
  } else {
    if (!a.inicial) throw new ErroTorneio('Ainda não há avaliação inicial para revisar.')
    if (typeof novo === 'string') throw new ErroTorneio('Valor inválido.')
    validarNota(novo, campo)
    const item = campo.slice('inicial.'.length) as ItemFicha | 'geral'
    if (item === 'geral') {
      anterior = textoNota(a.inicial.geral)
      a.inicial.geral = novo
    } else {
      anterior = textoNota(a.inicial.itens[item])
      a.inicial.itens[item] = novo
    }
  }
  const publicada = !!b.torneio.publicadas[a.rodada]
  a.revisoes.push({ campo, anterior, novo: textoNota(novo), data, motivo: motivo.trim(), aposPublicacao: publicada })
  if (publicada) {
    const codigo = b.entregas.find((e) => e.id === entregaId)!.codigo
    b.torneio.historico.push({
      data,
      descricao: `Revisão após a publicação (rodada ${a.rodada + 1}, ${codigo}, ${rotuloCampo(campo)}: ${anterior} → ${textoNota(novo)}). Classificação recalculada.`,
    })
  }
  return b
}

export function podePublicar(b: BaseTorneio, rodada: number): boolean {
  const entregas = b.entregas.filter((e) => e.torneioId === b.torneio.id && e.rodada === rodada)
  return rodadaCompleta(b, rodada) && entregas.every((e) => b.avaliacoes.find((a) => a.entregaId === e.id)?.final)
}

export function publicar(base: BaseTorneio, rodada: number, amb: Ambiente): BaseTorneio {
  if (base.torneio.publicadas[rodada]) throw new ErroTorneio('Esta rodada já foi publicada.')
  if (!podePublicar(base, rodada)) throw new ErroTorneio('Todas as entregas da rodada precisam da nota final antes da publicação.')
  const b = copiar(base)
  const data = amb.agora().toISOString()
  b.torneio.publicadas[rodada] = data
  b.torneio.historico.push({ data, descricao: `Resultados da rodada ${rodada + 1} publicados.` })
  atualizarConclusao(b, amb)
  return b
}

// ---------------------------------------------------------------- classificação

export interface LinhaClassificacao {
  participanteId: string
  nome: string
  dispositivo: Dispositivo | null
  /** Nota usada para classificar (0–ESCALA_PONTUACAO). */
  nota: number
  /** Pontuação automática (referência separada no modo com professor). */
  automatico: number
  aprovada: boolean
  /** Nota final do professor (0–10), quando houver. */
  professor: number | null
  tentativasUsadas: number
  integridade: number
  desenho: number
  posicao: number
}

export interface GrupoClassificacao {
  /** null = todos os dispositivos juntos. */
  dispositivo: Dispositivo | null
  linhas: LinhaClassificacao[]
}

/** Nota de classificação de uma entrega conforme a configuração. */
export function normalizarNotaSalva(valor: number, versao: string): number {
  return valor * (ESCALA_PONTUACAO / escalaDaPontuacao(versao))
}

export function notaDeClassificacao(c: ConfigTorneio, automatico: number, professor: number | null, versao = VERSAO_PONTUACAO): number {
  automatico = normalizarNotaSalva(automatico, versao)
  if (c.modo === 'automatico' || c.classificacao === 'sistema') return automatico
  // Professor dá 0–10; a nota automática vai até ESCALA_PONTUACAO (1000 na pontuacao-v3).
  const prof = (professor ?? 0) * (ESCALA_PONTUACAO / 10)
  if (c.classificacao === 'professor') return prof
  const { professor: wp, sistema: ws } = c.pesosMedia
  return (wp * prof + ws * automatico) / (wp + ws)
}

/** Resultados visíveis? No modo com professor, só depois da publicação. */
export function rodadaVisivel(b: BaseTorneio, rodada: number): boolean {
  return rodadaCompleta(b, rodada) && (b.torneio.config.modo === 'automatico' || !!b.torneio.publicadas[rodada])
}

function linhaDaRodada(b: BaseTorneio, pid: string, rodada: number): LinhaClassificacao {
  const e = entregaDe(b, pid, rodada)!
  const t = e.tentativaId ? b.tentativas.find((x) => x.id === e.tentativaId) : undefined
  const r = t?.resultado
  const a = b.avaliacoes.find((x) => x.entregaId === e.id)
  const professor = a?.final?.nota ?? null
  const automatico = r ? normalizarNotaSalva(r.total, r.versao) : 0
  return {
    participanteId: pid,
    nome: b.participantes.find((p) => p.id === pid)?.nome ?? '?',
    dispositivo: t?.dispositivo ?? dispositivoFixado(b, pid),
    nota: notaDeClassificacao(b.torneio.config, automatico, professor),
    automatico,
    aprovada: r?.aprovada ?? false,
    professor,
    tentativasUsadas: tentativasOficiais(b, pid, rodada).length,
    integridade: r ? normalizarNotaSalva(notaCategoria(r, 'integridade'), r.versao) : 0,
    desenho: r ? normalizarNotaSalva(notaCategoria(r, 'desenho'), r.versao) : 0,
    posicao: 0,
  }
}

function ordenar(c: ConfigTorneio, linhas: LinhaClassificacao[], _aprovadasPorId?: Map<string, number>): LinhaClassificacao[] {
  const desempate = c.desempate === 'integridade-desenho' ? (['integridade', 'desenho'] as const) : (['desenho', 'integridade'] as const)
  const automaticoPuro = c.modo === 'automatico'
  const comparar = (x: LinhaClassificacao, y: LinhaClassificacao): number => {
    // v1.8 (H89): aprovação não passa à frente da nota; a classificação é pela nota.
    if (x.nota !== y.nota) return y.nota - x.nota
    if (!automaticoPuro && x.automatico !== y.automatico) return y.automatico - x.automatico
    for (const k of desempate) if (x[k] !== y[k]) return y[k] - x[k]
    return x.tentativasUsadas - y.tentativasUsadas
  }
  const v = [...linhas].sort(comparar)
  v.forEach((l, i) => {
    const anterior = v[i - 1]
    l.posicao = anterior && comparar(anterior, l) === 0 ? anterior.posicao : i + 1
  })
  return v
}

function agruparPorDispositivo(c: ConfigTorneio, linhas: LinhaClassificacao[], ordenarGrupo: (l: LinhaClassificacao[]) => LinhaClassificacao[]): GrupoClassificacao[] {
  if (c.dispositivo.tipo === 'exigir') return [{ dispositivo: c.dispositivo.dispositivo, linhas: ordenarGrupo(linhas) }]
  const grupos = new Map<Dispositivo | null, LinhaClassificacao[]>()
  for (const l of linhas) grupos.set(l.dispositivo, [...(grupos.get(l.dispositivo) ?? []), l])
  return [...grupos.entries()].map(([dispositivo, ls]) => ({ dispositivo, linhas: ordenarGrupo(ls) }))
}

/** Classificação de uma rodada, ou null enquanto ela não é visível. */
export function classificacaoRodada(b: BaseTorneio, rodada: number): GrupoClassificacao[] | null {
  if (!rodadaVisivel(b, rodada)) return null
  const linhas = b.torneio.ordemPorRodada[rodada].map((pid) => linhaDaRodada(b, pid, rodada))
  return agruparPorDispositivo(b.torneio.config, linhas, (ls) => ordenar(b.torneio.config, ls))
}

/** Classificação geral: soma das rodadas visíveis. Null se nenhuma estiver visível. */
export function classificacaoGeral(b: BaseTorneio): { grupos: GrupoClassificacao[]; rodadasConsideradas: number[] } | null {
  const visiveis = b.torneio.config.rodadas.map((_, r) => r).filter((r) => rodadaVisivel(b, r))
  if (visiveis.length === 0) return null
  const somas = new Map<string, LinhaClassificacao>()
  const aprovadas = new Map<string, number>()
  for (const r of visiveis) {
    for (const pid of b.torneio.ordemPorRodada[r]) {
      const l = linhaDaRodada(b, pid, r)
      const s = somas.get(pid)
      aprovadas.set(pid, (aprovadas.get(pid) ?? 0) + Number(l.aprovada))
      if (!s) {
        somas.set(pid, { ...l })
      } else {
        s.nota += l.nota
        s.automatico += l.automatico
        s.integridade += l.integridade
        s.desenho += l.desenho
        s.tentativasUsadas += l.tentativasUsadas
        s.professor = s.professor === null || l.professor === null ? null : s.professor + l.professor
        s.aprovada = s.aprovada && l.aprovada
      }
    }
  }
  const arred = (v: number) => Math.round(v * 10) / 10
  const linhas = [...somas.values()].map((l) => ({ ...l, nota: arred(l.nota), automatico: arred(l.automatico) }))
  return {
    grupos: agruparPorDispositivo(b.torneio.config, linhas, (ls) => ordenar(b.torneio.config, ls, aprovadas)),
    rodadasConsideradas: visiveis,
  }
}

/** Seleciona do conjunto completo só o que pertence a um torneio. */
export function recortarBase(
  torneio: Torneio,
  todos: { participantes: Participante[]; tentativas: TentativaRegistro[]; entregas: Entrega[]; avaliacoes: Avaliacao[] },
): BaseTorneio {
  return {
    torneio,
    participantes: todos.participantes.filter((p) => torneio.participanteIds.includes(p.id)),
    tentativas: todos.tentativas.filter((t) => t.torneioId === torneio.id),
    entregas: todos.entregas.filter((e) => e.torneioId === torneio.id),
    avaliacoes: todos.avaliacoes.filter((a) => a.torneioId === torneio.id),
  }
}
