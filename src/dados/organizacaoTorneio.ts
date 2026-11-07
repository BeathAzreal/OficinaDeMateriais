import type { BaseTorneio } from './torneio'
import { rodadaVisivel } from './torneio'
/** Andamento e regras; não revela avaliação ainda não publicada. */
export function resumoOrganizacao(b: BaseTorneio) {
  const rodadas = b.torneio.config.rodadas.map((_, rodada) => {
    const entregas = b.entregas.filter(e => e.torneioId === b.torneio.id && e.rodada === rodada && b.torneio.participanteIds.includes(e.participanteId))
    const entregues = new Set(entregas.map(e => e.participanteId)).size
    const avaliadas = entregas.filter(e => b.avaliacoes.some(a => a.entregaId === e.id && a.final)).length
    const faltam = Math.max(0,b.torneio.participanteIds.length-entregues)
    return { rodada, entregues, faltam, avaliadas, visivel: rodadaVisivel(b,rodada), acao: faltam ? `Aguardar ${faltam} entrega(s)` : b.torneio.config.modo === 'professor' && avaliadas < entregas.length ? `Concluir ${entregas.length-avaliadas} avaliação(ões)` : b.torneio.config.modo === 'professor' && !b.torneio.publicadas[rodada] ? 'Publicar a rodada' : 'Resultados disponíveis' }
  })
  const ids = new Set(rodadas.filter(r => r.visivel).map(r => r.rodada))
  const versoes = [...new Set(b.tentativas.filter(t => t.torneioId === b.torneio.id && ids.has(t.rodada) && t.resultado).map(t => t.resultado!.versao))]
  return { rodadas, aviso: versoes.length > 1 ? 'Há mais de uma versão de pontuação nas rodadas publicadas. Normalizar notas não torna modelos distintos tecnicamente equivalentes.' : 'Compare jogadores na mesma rodada e grupo de dispositivo. A classificação geral resume a competição; não é certificação técnica.' }
}
