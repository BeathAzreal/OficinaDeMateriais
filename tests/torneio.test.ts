import { resumoOrganizacao } from '../src/dados/organizacaoTorneio'
import { describe, expect, it } from 'vitest'
import { alterarConfig, classificacaoGeral, classificacaoRodada, CONFIG_PADRAO, concluirTentativa, criarTorneio, duplicarConfig, entregar, ErroTorneio, evidenciaJulgamento, iniciar, iniciarTentativa, listaJulgamento, marcarInterrompidas, notaDeClassificacao, podePublicar, prepararJulgamento, publicar, registrarFinal, registrarInicial, revisar, selecionarEntrega, tentativasRestantes, vezAtual, type Ambiente, type BaseTorneio, type ConfigTorneio, type ItemFicha, type Participante, missaoDaRodada, descreverRodada, validarConfig } from '../src/dados/torneio'
import { MISSOES, contextoDaMissao, preparoPadrao } from '../src/missoes/catalogo'
import { CATEGORIAS, PESOS_PADRAO, type ResultadoPontuacao } from '../src/pontuacao/regras'

const missao = MISSOES[0]

function ambiente(): Ambiente {
  let n = 0
  let semente = 12345
  let relogio = Date.parse('2026-10-20T12:00:00Z')
  return {
    agora: () => new Date((relogio += 1000)),
    aleatorio: () => (semente = (semente * 16807) % 2147483647) / 2147483647,
    novoId: (p) => `${p}-${++n}`,
  }
}

function resultado(total: number, aprovada = true, integridade = total * 0.4, desenho = total * 0.25): ResultadoPontuacao {
  const pontos = { integridade, desenho, regularidade: 0, deformacao: 0, eficiencia: 0 }
  return {
    versao: 'pontuacao-v11',
    pesos: { ...PESOS_PADRAO },
    total,
    aprovada,
    categorias: CATEGORIAS.map((id) => ({ id, nome: id, pontos: pontos[id], maximo: PESOS_PADRAO[id], explicacao: '', detalhes: [] })),
    essenciais: [],
    penalidades: [],
    problemas: [],
    medidas: { fracaoIntegra: 1, larguraMediaMm: 7, alturaMediaMm: 2, cvLargura: 0.05, deformacao: 1, rendimento: 1, fracaoTempoUtil: 1 },
  }
}

function config(extra: Partial<ConfigTorneio> = {}): ConfigTorneio {
  return {
    ...CONFIG_PADRAO,
    nome: 'Turma A',
    participantes: ['Ana', 'Bruno'],
    rodadas: [
      { missaoId: missao.id, missaoVersao: missao.versao, dificuldade: 'aprendiz', tentativas: 2 },
      { missaoId: missao.id, missaoVersao: missao.versao, dificuldade: 'profissional', tentativas: 2 },
    ],
    ...extra,
  }
}

function novaBase(extra: Partial<ConfigTorneio> = {}, amb = ambiente()): { base: BaseTorneio; amb: Ambiente } {
  const c = config(extra)
  const participantes: Participante[] = c.participantes.map((nome) => ({ id: amb.novoId('par'), nome, criadoEm: '' }))
  const torneio = criarTorneio(c, participantes, amb)
  return { base: iniciar({ torneio, participantes, tentativas: [], entregas: [], avaliacoes: [] }, amb), amb }
}

/** Faz uma tentativa oficial completa do jogador da vez, com a nota dada. */
function tentar(base: BaseTorneio, amb: Ambiente, total: number, aprovada = true, dispositivo: 'mouse' | 'controle' = 'mouse') {
  const vez = vezAtual(base)!
  const preparo = preparoPadrao(missao)
  const r = iniciarTentativa(
    base,
    { participanteId: vez.participanteId, dispositivo, preparo, ajustes: { alimentacao: 5, tensao: 5.5 }, contexto: contextoDaMissao(missao, preparo) },
    amb,
  )
  const b = concluirTentativa(r.base, r.tentativa.id, { eventos: { versao: 1, t0: 0, lista: [] }, resultado: resultado(total, aprovada) }, amb)
  return { base: b, id: r.tentativa.id }
}

const nomeDe = (b: BaseTorneio, id: string) => b.participantes.find((p) => p.id === id)!.nome

describe('junta da rodada no torneio (H46)', () => {
  it('é a da peça escolhida e a mesma para todos os participantes', () => {
    const outra = MISSOES.find((m) => m.geometria.junta === 't')!
    const { base } = novaBase({
      rodadas: [
        { missaoId: outra.id, missaoVersao: outra.versao, dificuldade: 'aprendiz', tentativas: 2 },
        { missaoId: missao.id, missaoVersao: missao.versao, dificuldade: 'aprendiz', tentativas: 2 },
      ],
    })
    const [r1, r2] = base.torneio.config.rodadas
    expect(missaoDaRodada(r1).geometria.junta).toBe('t')
    expect(missaoDaRodada(r2).geometria.junta).toBe(missao.geometria.junta)
    expect(descreverRodada(r1)).toContain('em t')
  })

  it('torneios antigos com rota/traçado (H41) continuam válidos e a cópia não leva esses campos', () => {
    const antiga = { missaoId: missao.id, missaoVersao: missao.versao, dificuldade: 'aprendiz' as const, tentativas: 2, rota: 'circular' as const, formato: 'circular' as const }
    expect(validarConfig(config({ rodadas: [antiga] }))).toEqual([])
    const { base } = novaBase({ rodadas: [antiga] })
    expect(missaoDaRodada(base.torneio.config.rodadas[0]).geometria.junta).toBe(missao.geometria.junta)
    const copia = duplicarConfig(base.torneio)
    expect(copia.rodadas[0].rota).toBeUndefined()
    expect(copia.rodadas[0].formato).toBeUndefined()
  })
})

describe('turnos e rodadas', () => {
  it('alterna os jogadores e avança as rodadas (rodízio)', () => {
    let { base, amb } = novaBase()
    const ordem: string[] = []
    while (vezAtual(base)) {
      const v = vezAtual(base)!
      ordem.push(`${v.rodada}:${nomeDe(base, v.participanteId)}`)
      base = tentar(base, amb, 80).base
      base = entregar(base, v.participanteId, undefined, amb)
    }
    expect(ordem).toEqual(['0:Ana', '0:Bruno', '1:Bruno', '1:Ana'])
    expect(base.torneio.status).toBe('concluido')
  })

  it('respeita o limite de tentativas e permite entregar antes de esgotar', () => {
    let { base, amb } = novaBase()
    const pid = vezAtual(base)!.participanteId
    base = tentar(base, amb, 50).base
    expect(tentativasRestantes(base, pid, 0)).toBe(1)
    base = tentar(base, amb, 60).base
    expect(tentativasRestantes(base, pid, 0)).toBe(0)
    expect(() => tentar(base, amb, 70)).toThrow(ErroTorneio)

    // Outro torneio: entrega com só uma tentativa feita.
    let b2 = novaBase().base
    const amb2 = ambiente()
    b2 = tentar(b2, amb2, 40).base
    const pid2 = vezAtual(b2)!.participanteId
    b2 = entregar(b2, pid2, undefined, amb2)
    expect(vezAtual(b2)!.participanteId).not.toBe(pid2)
  })

  it('não deixa outro jogador agir fora da vez nem entregar duas vezes', () => {
    let { base, amb } = novaBase()
    const [a, b] = base.torneio.ordemPorRodada[0]
    expect(() => entregar(base, b, undefined, amb)).toThrow(ErroTorneio)
    base = tentar(base, amb, 50).base
    base = entregar(base, a, undefined, amb)
    expect(() => entregar(base, a, undefined, amb)).toThrow(ErroTorneio)
  })

  it('tentativa interrompida (recarregar a página) conta no limite e não é entregue', () => {
    let { base, amb } = novaBase()
    const vez = vezAtual(base)!
    const preparo = preparoPadrao(missao)
    base = iniciarTentativa(base, { participanteId: vez.participanteId, dispositivo: 'mouse', preparo, ajustes: { alimentacao: 5, tensao: 5.5 }, contexto: contextoDaMissao(missao, preparo) }, amb).base
    const r = marcarInterrompidas(base)
    expect(r.alteradas).toBe(1)
    base = r.base
    expect(tentativasRestantes(base, vez.participanteId, 0)).toBe(1)
    base = tentar(base, amb, 70).base
    base = entregar(base, vez.participanteId, undefined, amb)
    const entrega = base.entregas[0]
    expect(base.tentativas.find((t) => t.id === entrega.tentativaId)!.status).toBe('concluida')
  })

  it('não duplica tentativa já concluída', () => {
    const { base, amb } = novaBase()
    const r = tentar(base, amb, 50)
    expect(() => concluirTentativa(r.base, r.id, { eventos: { versao: 1, t0: 0, lista: [] }, resultado: resultado(90) }, amb)).toThrow(ErroTorneio)
  })
})

describe('regra de entrega', () => {
  const tentativas = [50, 90, 70].map((total, i) => ({ id: `t${i + 1}`, numero: i + 1, status: 'concluida', resultado: resultado(total) })) as never[]

  it('última, melhor e escolhida pelo jogador', () => {
    expect(selecionarEntrega('ultima', tentativas, 'integridade-desenho')!.id).toBe('t3')
    expect(selecionarEntrega('melhor', tentativas, 'integridade-desenho')!.id).toBe('t2')
    expect(selecionarEntrega('escolha', tentativas, 'integridade-desenho', 't1')!.id).toBe('t1')
    expect(() => selecionarEntrega('escolha', tentativas, 'integridade-desenho', 'xx')).toThrow(ErroTorneio)
  })

  it('"melhor" fica com a maior nota, aprovada ou não (v1.8, H89)', () => {
    const lista = [
      { id: 'a', numero: 1, status: 'concluida', resultado: resultado(95, false) },
      { id: 'b', numero: 2, status: 'concluida', resultado: resultado(60, true) },
    ] as never[]
    expect(selecionarEntrega('melhor', lista, 'integridade-desenho')!.id).toBe('a')
  })

  it('a regra aplicada fica registrada na entrega', () => {
    let { base, amb } = novaBase({ regraEntrega: 'ultima' })
    const pid = vezAtual(base)!.participanteId
    const primeira = tentar(base, amb, 90)
    const segunda = tentar(primeira.base, amb, 40)
    base = entregar(segunda.base, pid, undefined, amb)
    expect(base.entregas[0].tentativaId).toBe(segunda.id)
    expect(base.entregas[0].regra).toBe('ultima')
  })
})

describe('regras bloqueadas e duplicação', () => {
  it('não deixa mudar regras depois do início; duplicar gera configuração editável', () => {
    const { base } = novaBase()
    expect(() => alterarConfig(base, config({ regraEntrega: 'ultima' }))).toThrow(/bloqueadas/)
    const copia = duplicarConfig(base.torneio)
    expect(copia.nome).toContain('cópia')
    expect(copia.regraEntrega).toBe(base.torneio.config.regraEntrega)
  })

  it('dispositivo exigido é obrigatório; no modo separar o jogador mantém o seu', () => {
    const { base, amb } = novaBase({ dispositivo: { tipo: 'exigir', dispositivo: 'controle' } })
    expect(() => tentar(base, amb, 50, true, 'mouse')).toThrow(/dispositivo/)
    expect(() => tentar(base, amb, 50, true, 'controle')).not.toThrow()

    const sep = novaBase()
    const b1 = tentar(sep.base, sep.amb, 50, true, 'mouse').base
    expect(() => tentar(b1, sep.amb, 50, true, 'controle')).toThrow(/mesmo dispositivo/)
  })
})

describe('classificação automática e desempates', () => {
  function jogarRodada(base: BaseTorneio, amb: Ambiente, notas: Record<string, [number, boolean]>) {
    while (vezAtual(base) && vezAtual(base)!.rodada === vezAtual(base)!.rodada) {
      const v = vezAtual(base)!
      const [total, ok] = notas[nomeDe(base, v.participanteId)]
      base = tentar(base, amb, total, ok).base
      base = entregar(base, v.participanteId, undefined, amb)
      if (!vezAtual(base) || vezAtual(base)!.rodada !== v.rodada) break
    }
    return base
  }

  it('a maior nota fica à frente, aprovada ou não (v1.8, H89)', () => {
    let { base, amb } = novaBase()
    base = jogarRodada(base, amb, { Ana: [60, true], Bruno: [95, false] })
    const grupos = classificacaoRodada(base, 0)!
    expect(grupos[0].linhas.map((l) => l.nome)).toEqual(['Bruno', 'Ana'])
  })

  it('empate na nota é decidido pela integridade', () => {
    let { base, amb } = novaBase()
    // Mesma nota total, integridades diferentes.
    const v1 = vezAtual(base)!
    const p = preparoPadrao(missao)
    let r = iniciarTentativa(base, { participanteId: v1.participanteId, dispositivo: 'mouse', preparo: p, ajustes: { alimentacao: 5, tensao: 5.5 }, contexto: contextoDaMissao(missao, p) }, amb)
    base = concluirTentativa(r.base, r.tentativa.id, { eventos: { versao: 1, t0: 0, lista: [] }, resultado: resultado(80, true, 30, 30) }, amb)
    base = entregar(base, v1.participanteId, undefined, amb)
    const v2 = vezAtual(base)!
    r = iniciarTentativa(base, { participanteId: v2.participanteId, dispositivo: 'mouse', preparo: p, ajustes: { alimentacao: 5, tensao: 5.5 }, contexto: contextoDaMissao(missao, p) }, amb)
    base = concluirTentativa(r.base, r.tentativa.id, { eventos: { versao: 1, t0: 0, lista: [] }, resultado: resultado(80, true, 38, 20) }, amb)
    base = entregar(base, v2.participanteId, undefined, amb)
    expect(classificacaoRodada(base, 0)![0].linhas[0].participanteId).toBe(v2.participanteId)
  })

  it('classificação geral soma as notas das rodadas, aprovadas ou não (v1.8, H89)', () => {
    let { base, amb } = novaBase()
    base = jogarRodada(base, amb, { Ana: [70, true], Bruno: [99, false] })
    base = jogarRodada(base, amb, { Ana: [70, true], Bruno: [99, false] })
    const geral = classificacaoGeral(base)!
    expect(geral.grupos[0].linhas[0].nome).toBe('Bruno')
    expect(geral.grupos[0].linhas[0].nota).toBe(198)
  })

  it('modo "separar" cria uma classificação por dispositivo', () => {
    let { base, amb } = novaBase()
    const v1 = vezAtual(base)!
    base = tentar(base, amb, 80, true, 'mouse').base
    base = entregar(base, v1.participanteId, undefined, amb)
    const v2 = vezAtual(base)!
    base = tentar(base, amb, 70, true, 'controle').base
    base = entregar(base, v2.participanteId, undefined, amb)
    const grupos = classificacaoRodada(base, 0)!
    expect(grupos.map((g) => g.dispositivo).sort()).toEqual(['controle', 'mouse'])
  })
})

describe('torneio com professor', () => {
  function rodadaEntregue() {
    let { base, amb } = novaBase({ modo: 'professor', classificacao: 'professor' })
    for (const total of [85, 65]) {
      const v = vezAtual(base)!
      base = tentar(base, amb, total).base
      base = entregar(base, v.participanteId, undefined, amb)
    }
    return { base: prepararJulgamento(base, 0, amb), amb }
  }

  const ficha = (n: number | null) => ({
    itens: { acabamento: n, dimensoes: n, continuidade: n, alinhamento: n, fusao: null } as Record<ItemFicha, number | null>,
    geral: n,
    observacoes: '',
  })

  it('organização mostra pendências sem antecipar nota ou versão oculta', () => {
    const { base } = rodadaEntregue()
    const r = resumoOrganizacao(base)
    expect(r.rodadas[0].acao).toContain('avaliação')
    expect(r.rodadas[0].visivel).toBe(false)
    expect(r.rodadas[1].faltam).toBe(2)
    expect(r.aviso).not.toContain('mais de uma versão')
  })

  it('nota igual do professor não cria empate se o desempate automático é diferente', () => {
    let { base, amb } = rodadaEntregue()
    for (const t of base.tentativas) if(t.resultado) {
      t.resultado.categorias.find(c=>c.id==='integridade')!.pontos=20
      t.resultado.categorias.find(c=>c.id==='desenho')!.pontos=20
    }
    for (const item of listaJulgamento(base,0)) {
      base=registrarInicial(base,item.entregaId,ficha(8),amb)
      base=registrarFinal(base,item.entregaId,{nota:8,justificativa:'Mesma nota do professor.'},amb)
    }
    base=publicar(base,0,amb)
    const linhas=classificacaoRodada(base,0)![0].linhas
    expect(linhas[0].automatico).not.toBe(linhas[1].automatico)
    expect(linhas.map(l=>l.posicao)).toEqual([1,2])
    expect(resumoOrganizacao(base).rodadas[0].acao).toBe('Resultados disponíveis')
  })

  it('julgamento por código: sem nome e sem nota automática antes da avaliação inicial', () => {
    const { base, amb } = rodadaEntregue()
    const lista = listaJulgamento(base, 0)
    expect(lista).toHaveLength(2)
    expect(Object.keys(lista[0]).sort()).toEqual(['codigo', 'entregaId', 'situacao'])
    const nomes = base.participantes.map((p) => p.nome)
    const ids = base.participantes.map((p) => p.id)
    for (const item of lista) {
      const ev = evidenciaJulgamento(base, item.entregaId)
      const texto = JSON.stringify(ev) + JSON.stringify(item)
      for (const n of [...nomes, ...ids]) expect(texto).not.toContain(n)
      expect(ev.automatico).toBeNull()
      expect(item.codigo).toMatch(/^E-[A-Z2-9]{5}$/)
    }
    const b = registrarInicial(base, lista[0].entregaId, ficha(7), amb)
    expect(evidenciaJulgamento(b, lista[0].entregaId).automatico).not.toBeNull()
    expect(evidenciaJulgamento(b, lista[1].entregaId).automatico).toBeNull()
  })

  it('aceita "não avaliado" e exige a inicial antes da final', () => {
    const { base, amb } = rodadaEntregue()
    const [e1] = listaJulgamento(base, 0)
    expect(() => registrarFinal(base, e1.entregaId, { nota: 8, justificativa: 'Cordão regular e contínuo.' }, amb)).toThrow(ErroTorneio)
    const b = registrarInicial(base, e1.entregaId, ficha(null), amb)
    expect(b.avaliacoes.find((a) => a.entregaId === e1.entregaId)!.inicial!.geral).toBeNull()
  })

  it('publica só quando todas as entregas têm nota final', () => {
    let { base, amb } = rodadaEntregue()
    const lista = listaJulgamento(base, 0)
    expect(classificacaoRodada(base, 0)).toBeNull()
    base = registrarInicial(base, lista[0].entregaId, ficha(7), amb)
    base = registrarFinal(base, lista[0].entregaId, { nota: 7, justificativa: 'Boa largura, leve desvio.' }, amb)
    expect(podePublicar(base, 0)).toBe(false)
    expect(() => publicar(base, 0, amb)).toThrow(ErroTorneio)
    base = registrarInicial(base, lista[1].entregaId, ficha(9), amb)
    base = registrarFinal(base, lista[1].entregaId, { nota: 9, justificativa: 'Cordão muito regular.' }, amb)
    base = publicar(base, 0, amb)
    expect(classificacaoRodada(base, 0)).not.toBeNull()
  })

  it('revisão registra anterior, novo, data e motivo; após publicar, recalcula e entra no histórico', () => {
    let { base, amb } = rodadaEntregue()
    const lista = listaJulgamento(base, 0)
    for (const [i, nota] of [8, 6].entries()) {
      base = registrarInicial(base, lista[i].entregaId, ficha(nota), amb)
      base = registrarFinal(base, lista[i].entregaId, { nota, justificativa: 'Avaliação conforme a ficha.' }, amb)
    }
    base = publicar(base, 0, amb)
    const lider = classificacaoRodada(base, 0)![0].linhas[0].participanteId
    expect(() => revisar(base, lista[0].entregaId, 'final.nota', 2, '', amb)).toThrow(/motivo/)
    base = revisar(base, lista[0].entregaId, 'final.nota', 2, 'Reavaliei o corte sintético.', amb)
    const rev = base.avaliacoes.find((a) => a.entregaId === lista[0].entregaId)!.revisoes[0]
    expect(rev).toMatchObject({ campo: 'final.nota', anterior: '8', novo: '2', motivo: 'Reavaliei o corte sintético.', aposPublicacao: true })
    expect(rev.data).toMatch(/^2026-/)
    expect(base.torneio.historico.at(-1)!.descricao).toContain('Classificação recalculada')
    expect(classificacaoRodada(base, 0)![0].linhas[0].participanteId).not.toBe(lider)
  })

  it('média ponderada normaliza as escalas', () => {
    const { base } = novaBase({ modo: 'professor', classificacao: 'ponderada', pesosMedia: { professor: 3, sistema: 1 } })
    // Escala de 1000 (pontuacao-v3): professor 8/10 → 800; sistema 600 → (3·800 + 1·600) ÷ 4 = 750.
    expect(notaDeClassificacao(base.torneio.config, 600, 8)).toBe(750)
    expect(notaDeClassificacao({ ...base.torneio.config, classificacao: 'professor' }, 600, 8)).toBe(800)
    expect(notaDeClassificacao({ ...base.torneio.config, classificacao: 'sistema' }, 600, 8)).toBe(600)
  })
})
