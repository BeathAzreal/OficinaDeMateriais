
import { describe, expect, it } from 'vitest'
import { Simulacao } from '../src/modelo/simulacao'
import { contextoDaMissao, MISSOES, preparoPadrao } from '../src/missoes/catalogo'
import { margemCoberturaBordas } from '../src/modelo/fusao'
import { compactar, descompactar } from '../src/dados/eventos'
import { reproduzir } from '../src/modelo/replay'
import { relatorioDoRegistro } from '../src/pontuacao/oficial'
import { pontuar, VERSAO_PONTUACAO } from '../src/pontuacao/regras'
import { conceito } from '../src/ui/componentes/pontuacao'
import { explicar } from '../src/didatica/explicacao'
import { comparar } from '../src/didatica/comparacao'
import { CONFIG_PADRAO, criarTorneio, iniciar, iniciarTentativa, concluirTentativa, notaDeClassificacao } from '../src/dados/torneio'

const m = MISSOES[0]
const preparo = { ...preparoPadrao(m), diametroArameMm: 1 }
const ctx = contextoDaMissao(m, preparo)
function passe(y = 0, velocidade = 10) {
 const s = new Simulacao(ctx)
 s.definirAjustes({ alimentacao: 5, tensao: 5.5 })
 let t = 0
 s.iniciarArco({ t, x: 6, y })
 for (let x = 6; x < 143;) { t += 8; x = Math.min(143, x + velocidade * 0.008); s.moverTocha({ t, x, y }) }
 s.encerrarArco({ t, x: 143, y })
 return s
}
describe('correções da revisão técnica', () => {
 it('a pausa congela o calor, o metal e o tempo; o replay compacto permanece idêntico', () => {
  const executar = (espera: number) => {
   const s = new Simulacao(ctx)
   s.iniciarArco({ t: 0, x: 40, y: 0 }); s.avancarTempo(1000)
   s.pausar(1000); s.pausar(2000)
   const antes = s.cordao.volumeTotal()
   s.avancarTempo(1000 + espera)
   expect(s.cordao.volumeTotal()).toBe(antes)
   s.retomar(1000 + espera)
   s.iniciarArco({ t: 1000 + espera, x: 45, y: 0 })
   s.encerrarArco({ t: 1200 + espera, x: 45, y: 0 })
   return s
  }
  const a = executar(0), b = executar(60000)
  expect(b.eventos).toEqual(a.eventos)
  expect(b.cordao.volumeTotal()).toBe(a.cordao.volumeTotal())
  expect(b.estado(61200).aquecimento).toBe(a.estado(1200).aquecimento)
  const replay = reproduzir(ctx, descompactar(compactar(b.eventos)))
  expect(replay.cordao.volumeTotal()).toBeCloseTo(b.cordao.volumeTotal(), 9)
  expect(replay.estado(1200).aquecimento).toBeCloseTo(b.estado(61200).aquecimento, 9)
  b.pausar(61200); b.retomar(121200)
  b.iniciarArco({ t: 121200, x: 50, y: 0 }); b.avancarTempo(121500); b.interromperArco()
  expect(b.eventos.filter(e => e.tipo === 'fim').at(-1)).toMatchObject({ t: 1450 })
 })
 it('preserva a proporção da nota antiga e o conceito histórico', () => {
  const c = { ...CONFIG_PADRAO, nome: 'Antigo', participantes: ['A','B'], rodadas: [], modo: 'professor' as const, classificacao: 'ponderada' as const }
  expect(notaDeClassificacao(c, 90, 8, 'pontuacao-v1')).toBe(850)
  expect(notaDeClassificacao(c, 900, 8)).toBe(850)
  expect(conceito(95, true, 100)).toBe('S')
 })
 it('não permite continuar um torneio com versões diferentes; os dados ficam intactos', () => {
  let id = 0
  const amb = { agora: () => new Date(0), aleatorio: () => 0.5, novoId: () => String(++id) }
  const config = { ...CONFIG_PADRAO, nome: 'Teste', participantes: ['A','B'], rodadas: [{ missaoId: m.id, missaoVersao: m.versao, dificuldade: 'aprendiz' as const, tentativas: 3 }] }
  const participantes = config.participantes.map(nome => ({ nome, id: amb.novoId(), criadoEm: '' }))
  const torneio = criarTorneio(config, participantes, amb)
  let base = iniciar({ torneio, participantes, tentativas: [], entregas: [], avaliacoes: [] }, amb)
  const dados = { participanteId: participantes[0].id, dispositivo: 'mouse' as const, preparo, ajustes: { alimentacao: 5, tensao: 5.5 }, contexto: ctx }
  const primeira = iniciarTentativa(base, dados, amb)
  const resultado = relatorioDoRegistro(m, 'aprendiz', ctx, compactar(passe().eventos)).resultado
  base = concluirTentativa(primeira.base, primeira.tentativa.id, { eventos: compactar(passe().eventos), resultado: { ...resultado, total: 90, versao: 'pontuacao-v1' } }, amb)
  delete base.torneio.versaoPontuacao
  const antes = JSON.stringify(base)
  expect(() => iniciarTentativa(base, dados, amb)).toThrow('duplique')
  expect(JSON.stringify(base)).toBe(antes)
 })
 it('a ocorrência de borda mostra margem negativa usando o mesmo critério do modelo', () => {
  const r = relatorioDoRegistro(m, 'aprendiz', ctx, compactar(passe(3).eventos))
  const bordas = r.relatorio.ocorrencias.filter(o => o.tipo === 'borda')
  expect(bordas.length).toBeGreaterThan(0)
  expect(bordas.every(o => o.magnitude.valor < o.magnitude.limiar)).toBe(true)
  const secao = passe().cordao.secao(100)
  expect(margemCoberturaBordas({ ...secao, pernasMm: [1, 3] }, { ...ctx, junta: 't' })).toBe(-0.5)
  expect(margemCoberturaBordas({ ...secao, pernasMm: [2, 3] }, { ...ctx, junta: 't' })).toBe(0.5)
 })
 it('uma abertura planejada extra não conta como reinício excedente', () => {
  const sim = passe()
  const base = { dificuldade: 'aprendiz' as const, contexto: ctx, cordao: sim.cordao, percurso: sim.percurso, tempoArcoMs: sim.tempoDeArcoMs }
  const uma = pontuar({ ...base, missao: m, aberturasDeArco: 1 })
  const duas = pontuar({ ...base, missao: { ...m, aberturasPlanejadas: 2 }, aberturasDeArco: 2 })
  expect(uma.aprovada).toBe(true)
  expect(duas.total).toBe(uma.total)
  expect(duas.medidas.reiniciosArco).toBe(0)
  expect(MISSOES.find(missao => missao.geometria.junta === 'v')!.aberturasPlanejadas).toBe(2)
  expect(duas.versao).toBe(VERSAO_PONTUACAO)
 })
 it('a didática não aplica decomposição de chapa sem fresta às missões', () => {
  const a = passe().finalizar()!, b = passe(0, 11).finalizar()!
  const textos = explicar(a).map(i => i.texto).join(' ')
  expect(textos).toContain('nem toda essa área vira reforço')
  expect(textos).not.toContain('mm de largura em todo o cordão')
  expect(comparar(a, b)!.frases.some(f => f.includes('comparação é descritiva'))).toBe(true)
 })
})
