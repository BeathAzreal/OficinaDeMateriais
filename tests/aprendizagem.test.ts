import { describe, expect, it } from 'vitest'
import { MISSOES } from '../src/missoes/catalogo'
import { roteiroDaMissao } from '../src/missoes/aprendizagem'
import { chaveProgresso, missaoLiberada, progressoDoPerfil, type PerfilParticipante } from '../src/dados/participantes'
import { devolverTentativa } from '../src/didatica/devolutiva'
import { gerarDesafio, VERSAO_ARCADE } from '../src/arcade/desafios'
import { chaveRankingArcade } from '../src/dados/recordesArcade'
import { PESOS_PADRAO, type ResultadoPontuacao } from '../src/pontuacao/regras'
const perfil = (aprovadas: string[]): PerfilParticipante => ({ id: 'p', nome: 'Aluno', criadoEm: '', origem: 'arcade', aprovadas })
const resultado = (): ResultadoPontuacao => ({ versao:'pontuacao-v5', total:800, aprovada:true, pesos:PESOS_PADRAO, categorias:[{id:'integridade',nome:'Fusão',pontos:200,maximo:400,explicacao:'Evidência registrada.',detalhes:[]},{id:'regularidade',nome:'Regularidade',pontos:20,maximo:100,explicacao:'Largura variável.',detalhes:[]}], essenciais:[],penalidades:[],problemas:[],medidas:{fracaoIntegra:1,larguraMediaMm:7,alturaMediaMm:1,cvLargura:.1,deformacao:1,rendimento:1,fracaoTempoUtil:1} })

describe('roteiros e progressão', () => {
 it('todas as missões têm habilidade e ciclo preparar, executar, inspecionar e experimentar', () => {
  expect(new Set(MISSOES.map(m=>roteiroDaMissao(m).habilidade)).size).toBe(MISSOES.length)
  for(const m of MISSOES) for(const texto of Object.values(roteiroDaMissao(m))) expect(texto.length).toBeGreaterThan(15)
 })
 it('começa no primeiro capítulo, só no Difícil, e ignora chaves antigas e desconhecidas (H90)', () => {
  expect(progressoDoPerfil(undefined).proximaId).toBe(MISSOES[0].id)
  const p=perfil([chaveProgresso(MISSOES[0].id,'profissional'),chaveProgresso(MISSOES[1].id,'aprendiz'),'inexistente|profissional'])
  expect(progressoDoPerfil(p).profissional).toBe(1)
  expect(progressoDoPerfil(p).proximaId).toBe(MISSOES[1].id)
  expect(progressoDoPerfil(p).dificuldade).toBe('profissional')
  expect(missaoLiberada(p,'inexistente','profissional').liberada).toBe(false)
  // A aprovação antiga no Fácil não libera nada: a História é só no Difícil.
  expect(missaoLiberada(p,MISSOES[2].id,'profissional').liberada).toBe(false)
  expect(missaoLiberada(p,MISSOES[0].id,'aprendiz').liberada).toBe(false)
 })
 it('depois do Aprendiz recomenda aprofundamento e encerra a trilha completa sem apagar dados', () => {
  const chaves=MISSOES.map(m=>chaveProgresso(m.id,'aprendiz'));const p=perfil(chaves)
  expect(progressoDoPerfil(p).dificuldade).toBe('profissional')
  expect(progressoDoPerfil(p).proximaId).toBe(MISSOES[0].id)
  const completo=perfil([...chaves,...MISSOES.map(m=>chaveProgresso(m.id,'profissional'))])
  expect(progressoDoPerfil(completo).proximaId).toBeNull()
  expect(p.aprovadas).toEqual(chaves)
 })
})
describe('feedback baseado em evidência', () => {
 it('no Difícil prioriza a categoria abaixo do mínimo (H90)', () => {
  const r=resultado();r.aprovada=false;r.essenciais=[{id:'integridade',descricao:'Fusão: pelo menos 20 %',cumprida:false,justificativa:'50 de 400 (13 %).'}]
  expect(devolverTentativa(r).prioridade).toBe('Fusão: pelo menos 20 %')
  expect(devolverTentativa(r).evidencia).toBe('50 de 400 (13 %).')
  expect(devolverTentativa(r).proximaAcao).toContain('fusão')
 })
 it('compara proporção da categoria, não pontos absolutos, e é determinístico', () => {
  const r=resultado();expect(devolverTentativa(r).prioridade).toContain('Regularidade')
  const antes=structuredClone(r);expect(devolverTentativa(r)).toEqual(devolverTentativa(r));expect(r).toEqual(antes)
  r.categorias[1].maximo=0;expect(devolverTentativa(r).prioridade).toContain('Fusão')
 })
 it('trata ausência de avaliação sem inventar diagnóstico', () => {
  const r=resultado();r.categorias=[];expect(devolverTentativa(r).evidencia).toContain('Sem categorias')
 })
})
describe('Arcade progressivo', () => {
 it('introduz missões e condições por etapas e não repete a condição anterior', () => {
  let seed=123;const random=()=> (seed=seed*16807%2147483647)/2147483647
  let anterior: ReturnType<typeof gerarDesafio>|undefined
  for(let n=1;n<=80;n++) {
   const d=gerarDesafio(n,random,anterior)
   if(n===1)expect(d.missaoId).toBe(MISSOES[0].id)
   expect(d.dificuldade).toBe('profissional') // H90: desafios só no Difícil
   if(n<=4) expect(['tecnica','tempo-arco']).not.toContain(d.condicao.tipo)
   if(n<7)expect(d.condicao.tipo).not.toBe('tempo-arco')
   if(n>2 && anterior)expect(d.condicao.tipo).not.toBe(anterior.condicao.tipo)
   anterior=d
  }
 })
 it('separa recordes novos e antigos por versão', () => {
  const base={dispositivo:'mouse' as const,versaoPontuacao:'pontuacao-v5'}
  expect(VERSAO_ARCADE).toBe('arcade-v2')
  expect(chaveRankingArcade({...base,versaoArcade:VERSAO_ARCADE})).not.toBe(chaveRankingArcade({...base,versaoArcade:'arcade-v1'}))
 })
})
