/*
 * O que faz: as ordens de serviço (OS) da fábrica e o progresso de cada uma,
 * sem DOM. Uma OS passa por setores, como numa indústria: cada etapa é feita
 * num setor e registra o resultado; a qualidade só libera a OS com todas as
 * etapas registradas.
 * Onde mexer: para criar uma OS, acrescente um item em ORDENS (veja
 * docs/FABRICA.md). Os ids das etapas e das OS entram no progresso salvo:
 * não mude os que já existem.
 */

export type SetorId = 'laboratorio' | 'usinagem' | 'soldagem' | 'manufatura'

export interface InfoSetor {
  id: SetorId
  nome: string
  /** O que se faz no setor, na linguagem da fábrica. */
  funcao: string
}

export const SETORES: Record<SetorId, InfoSetor> = {
  laboratorio: { id: 'laboratorio', nome: 'Laboratório de Materiais', funcao: 'Análise de falhas: inspeção visual, metalografia e microdureza.' },
  usinagem: { id: 'usinagem', nome: 'Usinagem', funcao: 'Torno CNC: torneamento e furação sob desenho e tolerância.' },
  soldagem: { id: 'soldagem', nome: 'Soldagem', funcao: 'MIG/MAG, eletrodo revestido, TIG e brasagem.' },
  manufatura: { id: 'manufatura', nome: 'Manufatura Aditiva', funcao: 'Célula robotizada: deposição a arco (WAAM) programada em INFORM.' },
}

export interface Etapa {
  id: string
  setor: SetorId
  titulo: string
  /** O que a etapa pede, como na OS impressa. */
  instrucao: string
  /** Por que a etapa existe nesta OS (ligação com as outras). */
  porque: string
}

export interface OrdemServico {
  id: string
  codigo: string
  titulo: string
  cliente: string
  /** Situação que gerou a OS. */
  situacao: string
  etapas: Etapa[]
  /** Perguntas da liberação final (o que o aluno deve conseguir explicar). */
  perguntasLiberacao: string[]
}

export const ORDENS: OrdemServico[] = [
  {
    id: 'os-01-braco-tensor',
    codigo: 'OS-01',
    titulo: 'Braço tensor da peneira vibratória',
    cliente: 'Mineradora (linha de peneiramento, setor de manutenção)',
    situacao:
      'O braço tensor BT-07 de uma peneira vibratória rompeu junto à solda depois de cerca de 8 meses de serviço. ' +
      'Dois braços do mesmo lote continuam operando. A manutenção abriu uma não conformidade: descobrir a causa, ' +
      'refazer o pino de articulação e a emenda soldada com o procedimento corrigido e liberar a peça nova.',
    etapas: [
      {
        id: 'analise-falha',
        setor: 'laboratorio',
        titulo: 'Análise da falha',
        instrucao: 'Investigue o braço que rompeu (caso "A junta que falhou"): formule hipóteses, escolha os ensaios e envie o relatório.',
        porque: 'Sem saber a causa, a peça nova falha do mesmo jeito. O relatório diz o que mudar na fabricação.',
      },
      {
        id: 'usinar-pino',
        setor: 'usinagem',
        titulo: 'Usinar o pino de articulação',
        instrucao: 'Encomenda OM-01 no torno convencional: facear e tornear o eixo de Ø 36 (0/−0,05) × 50 ± 0,5 mm com Ra ≤ 1,6 µm, aprovado no Difícil.',
        porque: 'O pino trabalha em flexão alternada: diâmetro fora da tolerância e marcas de usinagem viram concentradores de tensão.',
      },
      {
        id: 'soldar-emenda',
        setor: 'soldagem',
        titulo: 'Soldar a emenda do braço novo',
        instrucao: 'Solde a emenda de topo em aço médio carbono (SAE 1045) e entregue a melhor tentativa.',
        porque: 'O laboratório mostra o que causou a trinca. Aqui você aplica a correção: aquecer a peça, evitar mordedura e reinícios bruscos.',
      },
    ],
    perguntasLiberacao: [
      'Qual foi o mecanismo da falha e qual a causa provável?',
      'O que mudou no procedimento de soldagem da peça nova?',
      'Por que a tolerância e a rugosidade do pino importam neste braço?',
    ],
  },
]

export function buscarOrdem(id: string): OrdemServico | undefined {
  return ORDENS.find((o) => o.id === id)
}

/** Resultado de uma etapa, no formato comum a todos os setores. */
export interface RegistroEtapa {
  /** 0 a 100. */
  nota: number
  /** Atende ao que a OS pede (conforme / aprovada). */
  conforme: boolean
  /** Uma linha com o que foi entregue. */
  resumo: string
  em: string
}

export interface ProgressoOrdem {
  ordemId: string
  etapas: Record<string, RegistroEtapa>
  liberadaEm: string | null
  /** Respostas às perguntas da liberação, na ordem de `perguntasLiberacao`. */
  respostas?: string[]
}

export interface DadosFabrica {
  versao: 1
  ordens: ProgressoOrdem[]
}

export function dadosFabricaIniciais(): DadosFabrica {
  return { versao: 1, ordens: [] }
}

export function validarDadosFabrica(d: unknown): DadosFabrica | null {
  if (!d || typeof d !== 'object') return null
  const x = d as Partial<DadosFabrica>
  if (x.versao !== 1 || !Array.isArray(x.ordens)) return null
  const ordens = x.ordens.filter(
    (o): o is ProgressoOrdem =>
      !!o && typeof o === 'object' && typeof o.ordemId === 'string' && !!o.etapas && typeof o.etapas === 'object' && (o.liberadaEm === null || typeof o.liberadaEm === 'string'),
  )
  return { versao: 1, ordens }
}

export function progressoDa(dados: DadosFabrica, ordemId: string): ProgressoOrdem {
  return dados.ordens.find((o) => o.ordemId === ordemId) ?? { ordemId, etapas: {}, liberadaEm: null }
}

/**
 * Registra o resultado de uma etapa. Fica o MELHOR registro (como a entrega
 * do Arcade): refazer não apaga um resultado melhor. Depois da liberação a OS
 * fica fechada.
 */
export function registrarEtapa(dados: DadosFabrica, ordemId: string, etapaId: string, r: RegistroEtapa): DadosFabrica {
  const ordem = buscarOrdem(ordemId)
  if (!ordem || !ordem.etapas.some((e) => e.id === etapaId)) throw new Error('Etapa desconhecida.')
  const atual = progressoDa(dados, ordemId)
  if (atual.liberadaEm) return dados
  const anterior = atual.etapas[etapaId]
  const melhor = !anterior || (r.conforme && !anterior.conforme) || (r.conforme === anterior.conforme && r.nota > anterior.nota)
  if (!melhor) return dados
  const novo: ProgressoOrdem = { ...atual, etapas: { ...atual.etapas, [etapaId]: r } }
  return { ...dados, ordens: [...dados.ordens.filter((o) => o.ordemId !== ordemId), novo] }
}

export type SituacaoEtapa = 'pendente' | 'feita' | 'nao-conforme'

export function situacaoEtapa(p: ProgressoOrdem, etapaId: string): SituacaoEtapa {
  const r = p.etapas[etapaId]
  return !r ? 'pendente' : r.conforme ? 'feita' : 'nao-conforme'
}

/** Próxima etapa sugerida: a primeira sem registro conforme. */
export function proximaEtapa(ordem: OrdemServico, p: ProgressoOrdem): Etapa | null {
  return ordem.etapas.find((e) => situacaoEtapa(p, e.id) !== 'feita') ?? null
}

/** A qualidade libera quando todas as etapas estão conformes. */
export function podeLiberar(ordem: OrdemServico, p: ProgressoOrdem): boolean {
  return !p.liberadaEm && ordem.etapas.every((e) => situacaoEtapa(p, e.id) === 'feita')
}

export function liberarOrdem(dados: DadosFabrica, ordemId: string, em: string, respostas: string[] = []): DadosFabrica {
  const ordem = buscarOrdem(ordemId)
  const p = progressoDa(dados, ordemId)
  if (!ordem || !podeLiberar(ordem, p)) return dados
  return { ...dados, ordens: [...dados.ordens.filter((o) => o.ordemId !== ordemId), { ...p, liberadaEm: em, respostas }] }
}

/** Nota da OS: média das etapas (0 a 100). */
export function notaDaOrdem(ordem: OrdemServico, p: ProgressoOrdem): number {
  const notas = ordem.etapas.map((e) => p.etapas[e.id]?.nota ?? 0)
  return Math.round(notas.reduce((a, b) => a + b, 0) / notas.length)
}

/** Reabre a OS do zero (o professor pede para refazer). */
export function reiniciarOrdem(dados: DadosFabrica, ordemId: string): DadosFabrica {
  return { ...dados, ordens: dados.ordens.filter((o) => o.ordemId !== ordemId) }
}
