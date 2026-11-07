import type { CategoriaId, ResultadoPontuacao } from '../pontuacao/regras'
export interface Devolutiva { prioridade: string; evidencia: string; proximaAcao: string; verificar: string }
const ACOES: Record<CategoriaId, [string, string]> = {
  integridade: ['Revise os trechos de fusão prevista antes de buscar mais pontos.', 'Confira o mínimo de cada categoria no modo Difícil.'],
  desenho: ['Mantenha os ajustes e pratique o movimento sobre o desenho.', 'Compare largura, reforço e alinhamento com as faixas da missão.'],
  regularidade: ['Repita os ajustes e pratique um ritmo uniforme.', 'Compare a variação da largura entre as tentativas.'],
  deformacao: ['No treino, altere apenas o ritmo de avanço e observe o índice térmico.', 'Confira o índice térmico sem perder a aprovação.'],
  eficiencia: ['Planeje o início e o fim do passe e evite abrir o arco fora do trecho.', 'Confira tempo útil, reinícios e metal no trecho.'],
}
const fracao = (r: ResultadoPontuacao, id: CategoriaId) => { const c = r.categorias.find(c => c.id === id); return c && c.maximo > 0 ? c.pontos / c.maximo : 1 }
/** Evidência registrada, sem diagnóstico de defeitos reais nem causalidade inventada. */
export function devolverTentativa(r: ResultadoPontuacao): Devolutiva {
  // H90: no Difícil, a categoria abaixo do mínimo vem primeiro (a de menor fração).
  const falha = r.essenciais.filter(e => !e.cumprida).sort((a, b) => fracao(r, a.id) - fracao(r, b.id))[0]
  if (falha) return { prioridade: falha.descricao, evidencia: falha.justificativa, proximaAcao: ACOES[falha.id][0], verificar: 'No Difícil, cada categoria precisa do mínimo; uma nota maior nas outras não compensa.' }
  const menor = [...r.categorias].filter(c => c.maximo > 0).sort((a,b) => a.pontos/a.maximo - b.pontos/b.maximo)[0]
  if (!menor) return { prioridade: 'Registrar uma tentativa completa', evidencia: 'Sem categorias avaliáveis.', proximaAcao: 'Faça um passe no trecho da missão antes de comparar resultados.', verificar: 'Confira se existe cordão suficiente para avaliação.' }
  const [proximaAcao, verificar] = ACOES[menor.id]
  return { prioridade: `Próximo foco: ${menor.nome}`, evidencia: `${menor.nome}: ${Math.round(Math.max(0,Math.min(1,menor.pontos/menor.maximo))*100)}% dos pontos disponíveis. ${menor.explicacao}`, proximaAcao, verificar }
}
