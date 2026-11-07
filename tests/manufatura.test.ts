import { describe, expect, it } from 'vitest'
import { MemoriaChaveValor, Repositorio } from '../src/dados/armazenamento'
import { dadosManufaturaIniciais, validarDadosManufatura } from '../src/dados/manufatura'
import { MISSAO_PAREDE, pontosIniciais, type PontoEnsinado } from '../src/modelo/manufatura/celula'
import { condicoesPadrao } from '../src/modelo/manufatura/condicoes'
import { Deposito } from '../src/modelo/manufatura/deposicao'
import { Controlador, PASSO_S, type ModoExecucao } from '../src/modelo/manufatura/executor'
import { lerPrograma, outraLinguagem, type Programa } from '../src/modelo/manufatura/inform'
import { PROGRAMA_INICIAL, PROGRAMA_LIVRE, projetoLivre } from '../src/modelo/manufatura/missao'
import { avaliarParede, inspecionarLivre } from '../src/pontuacao/manufatura'

/*
 * Manufatura Aditiva (H106): parser do subconjunto INFORM, executor com
 * passo fixo, deposição só com o arco aberto, limites, persistência e nota.
 */

const CTX = { pontos: 5, arquivosAsf: 2, arquivosAef: 1 }
const ler = (texto: string, ctx = CTX) => lerPrograma(texto, ctx)
const erros = (p: Programa) => p.diagnosticos.filter((d) => d.gravidade === 'erro')
const job = (...linhas: string[]) => ['NOP', ...linhas, 'END'].join('\n')

function controlador(texto: string, modo: ModoExecucao = 'fabricar', pontos: PontoEnsinado[] = pontosIniciais(), deposito = new Deposito()) {
  const programa = lerPrograma(texto, { pontos: pontos.length, arquivosAsf: 2, arquivosAef: 1 })
  if (!programa.valido) throw new Error(JSON.stringify(erros(programa)))
  return new Controlador({ programa, pontos, condicoes: condicoesPadrao(), celula: { ctwdMm: 15 }, modo, deposito, inicio: pontos[0].pose })
}

/** Uma camada reta de A (C00002) a B (C00003). */
const UMA_CAMADA = job('MOVJ C00001 VJ=15.00', 'MOVL C00002 V=20.0', 'ARCON ASF#(1)', 'MOVL C00003 V=8.0', 'ARCOF AEF#(1)', 'MOVL C00004 V=50.0')
const corrigido = PROGRAMA_INICIAL.replace(/ADD D000 2800/g, 'ADD D000 2200').replace(/TIMER T=20.00/g, 'TIMER T=60.00')

describe('parser do INFORM (subconjunto DX200)', () => {
  it('o programa inicial da missão é válido e sem avisos', () => {
    const p = ler(PROGRAMA_INICIAL)
    expect(erros(p)).toEqual([])
    expect(p.diagnosticos).toEqual([])
    expect(p.rotulos.has('CAMADA')).toBe(true)
  })

  it('lê cada forma aceita como o objeto certo', () => {
    const p = ler(job("'COMENTARIO", '*VOLTA', 'MOVJ C00001 VJ=25.00', 'MOVL P001 V=8.0', 'TIMER T=1.50', 'ARCON ASF#(2)', 'ARCOF', 'ARCOF AEF#(1)',
      'SET B000 3', 'SET I001 B000', 'ADD D002 -2200', 'INC B000', 'SET P001 P000', 'ADD P001 P002', 'SETE P000 (3) D002', 'JUMP *VOLTA IF B000<4', 'JUMP *VOLTA', 'SFTON P000', 'SFTOF'))
    expect(erros(p)).toEqual([])
    const ops = p.instrucoes.map((i) => i.op)
    expect(ops).toEqual(['NOP', 'COMENTARIO', 'ROTULO', 'MOVJ', 'MOVL', 'TIMER', 'ARCON', 'ARCOF', 'ARCOF', 'SET', 'SET', 'ADD', 'INC', 'SETP', 'ADDP', 'SETE', 'JUMP', 'JUMP', 'SFTON', 'SFTOF', 'END'])
    expect(p.instrucoes[3]).toMatchObject({ op: 'MOVJ', alvo: { tipo: 'C', n: 1 }, vj: 25, linha: 4 })
    expect(p.instrucoes[4]).toMatchObject({ op: 'MOVL', alvo: { tipo: 'P', n: 1 }, v: 8 })
    expect(p.instrucoes[7]).toMatchObject({ op: 'ARCOF', aef: null })
    expect(p.instrucoes[11]).toMatchObject({ op: 'ADD', destino: { tipo: 'D', n: 2 }, valor: { tipo: 'const', valor: -2200 } })
    expect(p.instrucoes[16]).toMatchObject({ op: 'JUMP', rotulo: 'VOLTA', condicao: { comparacao: '<', valor: { tipo: 'const', valor: 4 } } })
  })

  it('cada erro diz a linha, o motivo e como corrigir', () => {
    const casos: [string, RegExp][] = [
      ['MOVL C00003', /sem velocidade/],
      ['MOVL V=10.0', /sem o ponto/],
      ['MOVL C00003 VJ=10.00', /usa V=/],
      ['MOVL C00003 V=2000.0', /fora da faixa/],
      ['MOVL C00003 V=8.25', /resolução/],
      ['MOVJ C0003 VJ=10.00', /cinco dígitos/],
      ['MOVL C00009 V=8.0', /não está na tabela/],
      ['MOVL P007 V=8.0', /nunca recebe/],
      ['TIMER T=0.001', /resolução/],
      ['SET B000 300', /fora da faixa/],
      ['SET I000 1.5', /casas decimais/],
      ['JUMP *NADA', /não existe/],
      ['*NOME_LONGO_DEMAIS', /Rótulo/],
      ["MOVL C00003 V=8.0 'comentario", /Comentário no fim/],
      ['ARCON ASF#(5)', /não existe/],
      ['ARCON', /sem condição/],
      ['FAZ ISSO', /não é um comando/],
      ['MOVK C00001 V=8.0', /Você quis dizer MOV/],
    ]
    for (const [linha, msg] of casos) {
      const p = ler(job(linha))
      const e = erros(p)
      expect(e.length, linha).toBeGreaterThan(0)
      expect(e.some((d) => msg.test(d.mensagem) || msg.test(d.correcao)), `${linha}: ${e.map((d) => d.mensagem).join(' | ')}`).toBe(true)
      for (const d of e) {
        expect(d.linha).toBeGreaterThan(0)
        expect(d.correcao.length).toBeGreaterThan(5)
      }
    }
  })

  it('estrutura: NOP no começo, um END só no fim, rótulos únicos', () => {
    expect(erros(ler('MOVJ C00001 VJ=10.00\nEND')).some((d) => /NOP/.test(d.mensagem))).toBe(true)
    expect(erros(ler('NOP\nMOVJ C00001 VJ=10.00')).some((d) => /END/.test(d.mensagem))).toBe(true)
    expect(erros(ler('NOP\nEND\nTIMER T=1.00\nEND')).some((d) => /uma vez/.test(d.mensagem))).toBe(true)
    expect(erros(ler(job('*A', '*A'))).some((d) => /duas vezes/.test(d.mensagem))).toBe(true)
  })

  it('comandos fora do subconjunto nunca passam em silêncio', () => {
    for (const linha of ['MOVL C00003 V=8.0 PL=0', 'MOVL C00003 V=8.0 NWAIT', 'DEC B000', 'SUB I000 1', 'MOVC C00001 V=8.0', 'CALL JOB:CAMADA', 'ARCON AC=200 AVP=100', 'SFTON P000 UF#(1)', 'JUMP *A IF B000<=3', 'SET R000 1', 'SETE P000 (4) 0', 'WVON WEV#(1)', 'JUMP *A IF IN#(1)=ON']) {
      const p = ler(job('*A', linha))
      expect(erros(p).length, linha).toBeGreaterThan(0)
      expect(erros(p).some((d) => /não (está |estão )?implementad/.test(d.mensagem)), `${linha}: ${erros(p).map((d) => d.mensagem).join(' | ')}`).toBe(true)
    }
  })

  it('reconhece G-code, RAPID e KRL e diz que não são INFORM', () => {
    expect(outraLinguagem('G1 X10 Y20 F600')).toMatch(/G-code/)
    expect(outraLinguagem('N10 G01 X5')).toMatch(/G-code/)
    expect(outraLinguagem('MoveL p10, v100, z10, tool0;')).toMatch(/RAPID/)
    expect(outraLinguagem('PROC main()')).toMatch(/RAPID/)
    expect(outraLinguagem('LIN P1 C_DIS')).toMatch(/KRL/)
    expect(outraLinguagem('$VEL.CP = 0.2')).toMatch(/KRL/)
    expect(outraLinguagem('MOVL C00001 V=10.0')).toBeNull()
    expect(erros(ler(job('PTP HOME'))).some((d) => /KRL.*não INFORM/.test(d.mensagem))).toBe(true)
  })

  it('aceita minúsculas e limita o tamanho do programa', () => {
    expect(erros(ler(job('movl c00003 v=8.0')))).toEqual([])
    const longo = ['NOP', ...Array.from({ length: 450 }, () => 'TIMER T=0.01'), 'END'].join('\n')
    expect(erros(ler(longo)).some((d) => /limite do simulador/.test(d.mensagem))).toBe(true)
  })
})

describe('movimentos e referências de coordenadas', () => {
  it('MOVL vai em linha reta na velocidade V', () => {
    const c = controlador(job('MOVL C00002 V=20.0', 'MOVL C00003 V=10.0'), 'teste')
    c.executar()
    // Até chegar em C00002 (de C00000): depois, 100 mm a 10 mm/s.
    while (c.pc < 2 && c.estado === 'executando') c.avancar(PASSO_S)
    const t0 = c.tempo
    for (let k = 0; k < 500; k++) {
      c.avancar(PASSO_S)
      expect(Math.abs(c.pose.y)).toBeLessThan(1e-9)
      expect(Math.abs(c.pose.z)).toBeLessThan(1e-9)
    }
    expect(c.pose.x).toBeCloseTo(700 + 10 * (c.tempo - t0), 6)
    c.rodarAteOFim()
    expect(c.estado).toBe('concluido')
    expect(c.pose).toMatchObject({ x: 800, y: 0, z: 0 })
  })

  it('MOVJ não faz linha reta (aproximação ilustrativa, sem cinemática)', () => {
    const c = controlador(job('MOVJ C00004 VJ=10.00'), 'teste')
    let desvio = 0
    c.executar()
    while (c.estado === 'executando') {
      c.avancar(PASSO_S)
      const a = pontosIniciais()[0].pose, b = pontosIniciais()[4].pose
      const s = (c.pose.x - a.x) / (b.x - a.x)
      desvio = Math.max(desvio, Math.abs(c.pose.y - (a.y + s * (b.y - a.y))))
    }
    expect(desvio).toBeGreaterThan(5)
    expect(c.pose).toMatchObject(pontosIniciais()[4].pose)
  })

  it('SFTON desloca os pontos pela variável P (SETE em mícrons); SFTOF desliga', () => {
    const c = controlador(job('SETE P000 (3) 12500', 'SETE P000 (2) -1000', 'SFTON P000', 'MOVL C00004 V=50.0', 'SFTOF', 'MOVL C00001 V=50.0'), 'teste')
    c.executar()
    while (c.pc < 4 && c.estado === 'executando') c.avancar(PASSO_S)
    while (c.emMovimento) c.avancar(PASSO_S)
    expect(c.pose.z).toBeCloseTo(52.5, 9)
    expect(c.pose.y).toBeCloseTo(-1, 9)
    c.rodarAteOFim()
    expect(c.pose).toMatchObject({ x: 700, y: 0, z: 40 })
  })

  it('MOVL para uma variável P montada no programa', () => {
    const c = controlador(job('SETE P001 (1) 750000', 'SETE P001 (3) 30000', 'SET P002 P001', 'MOVL P002 V=50.0'), 'teste')
    expect(c.rodarAteOFim()).toBe('concluido')
    expect(c.pose).toMatchObject({ x: 750, y: 0, z: 30 })
  })

  it('ponto fora do alcance e colisão param o programa com alarme', () => {
    const longe = pontosIniciais()
    longe[1] = { nome: 'longe', pose: { ...longe[1].pose, x: 1600 } }
    const a = controlador(job('MOVL C00001 V=50.0'), 'teste', longe)
    expect(a.rodarAteOFim()).toBe('alarme')
    expect(a.eventos.at(-1)?.texto).toMatch(/alcance/)
    const baixo = pontosIniciais()
    baixo[2] = { nome: 'dentro da chapa', pose: { ...baixo[2].pose, z: -20 } }
    const b = controlador(job('MOVL C00001 V=50.0', 'MOVL C00002 V=20.0'), 'teste', baixo)
    expect(b.rodarAteOFim()).toBe('alarme')
    expect(b.eventos.at(-1)?.texto).toMatch(/Colisão/)
  })
})

describe('sequência do arco', () => {
  it('só deposita entre ARCON e ARCOF, no trecho percorrido', () => {
    const d = new Deposito()
    const c = controlador(UMA_CAMADA, 'fabricar', pontosIniciais(), d)
    c.executar()
    while (c.estado === 'executando' && !c.arco) { c.avancar(PASSO_S); if (!c.arco) expect(d.volumeTotal).toBe(0) }
    expect(c.rodarAteOFim()).toBe('concluido')
    expect(d.volumeTotal).toBeGreaterThan(0)
    expect(d.alturaEm(750, 0)).toBeGreaterThan(1.5)
    for (const [x, y] of [[750, 15], [750, -15], [690, 0], [812, 0], [680, 30]]) expect(d.alturaEm(x, y), `${x}, ${y}`).toBe(0)
    expect(c.passes).toHaveLength(1)
    expect(c.passes[0].fechamento).toBe('ARCOF com AEF')
    expect(c.passes[0].comprimentoMm).toBeCloseTo(100, 0)
  })

  it('as pontas do cordão não ficam mais largas que o meio (robô parado não espalha a poça)', () => {
    const largura = (d: Deposito, x: number) => { let w = 0; for (let y = -20; y < 20; y += 0.5) if (d.alturaEm(x + 0.25, y + 0.25) > 0.2) w += 0.5; return w }
    const uma = new Deposito()
    controlador(UMA_CAMADA, 'fabricar', pontosIniciais(), uma).rodarAteOFim()
    for (const x of [698, 700, 702, 798, 800, 802]) expect(largura(uma, x), `x ${x}`).toBeLessThanOrEqual(largura(uma, 750) + 0.5)
    const parede = controlador(PROGRAMA_INICIAL)
    parede.rodarAteOFim()
    const meio = largura(parede.deposito, 750)
    for (let x = 694; x <= 806; x += 2) expect(largura(parede.deposito, x), `x ${x}`).toBeLessThanOrEqual(meio + 1.5)
  }, 30000)

  it('o teste sem deposição percorre o mesmo caminho e não deposita nada', () => {
    const d = new Deposito()
    const t = controlador(UMA_CAMADA, 'teste', pontosIniciais(), d)
    expect(t.rodarAteOFim()).toBe('concluido')
    expect(d.volumeTotal).toBe(0)
    expect(t.passes).toHaveLength(0)
    expect(t.eventos.some((e) => /inibido/.test(e.texto))).toBe(true)
  })

  it('ARCON com o arco aberto, ARCON longe da peça e END com arco têm consequência', () => {
    const dois = controlador(job('MOVL C00002 V=20.0', 'ARCON ASF#(1)', 'ARCON ASF#(1)'))
    expect(dois.rodarAteOFim()).toBe('alarme')
    expect(dois.eventos.at(-1)?.texto).toMatch(/já aberto/)
    const longe = controlador(job('MOVL C00001 V=50.0', 'ARCON ASF#(1)'))
    expect(longe.rodarAteOFim()).toBe('alarme')
    expect(longe.eventos.at(-1)?.texto).toMatch(/Falha na abertura/)
    const semArcof = controlador(job('MOVL C00002 V=20.0', 'ARCON ASF#(1)', 'MOVL C00003 V=8.0'))
    expect(semArcof.rodarAteOFim()).toBe('concluido')
    expect(semArcof.passes[0].fechamento).toBe('END')
    expect(semArcof.eventos.some((e) => /END com o arco aberto/.test(e.texto))).toBe(true)
  })

  it('o preenchimento da cratera (AEF) enche o fim do cordão', () => {
    const fim = (texto: string) => {
      const d = new Deposito()
      controlador(texto, 'fabricar', pontosIniciais(), d).rodarAteOFim()
      return d.alturaEm(797, 0)
    }
    expect(fim(UMA_CAMADA)).toBeGreaterThan(fim(UMA_CAMADA.replace('ARCOF AEF#(1)', 'ARCOF')) + 0.2)
  })
})

describe('repetições e limites', () => {
  it('o laço do programa inicial faz 8 camadas', () => {
    const c = controlador(PROGRAMA_INICIAL)
    expect(c.rodarAteOFim()).toBe('concluido')
    expect(c.passes).toHaveLength(8)
    expect(c.B[0]).toBe(4)
  }, 30000)

  it('laço sem saída e salto sobre si mesmo param no limite', () => {
    const a = controlador(job('*A', 'TIMER T=0.01', 'JUMP *A'), 'teste')
    expect(a.rodarAteOFim()).toBe('alarme')
    expect(a.eventos.at(-1)?.texto).toMatch(/limite do simulador|repetições/)
    const b = controlador(job('*A', 'JUMP *A'), 'teste')
    expect(b.rodarAteOFim()).toBe('alarme')
  })

  it('estouro de variável é alarme', () => {
    const c = controlador(job('SET B000 255', 'INC B000'), 'teste')
    expect(c.rodarAteOFim()).toBe('alarme')
    expect(c.eventos.at(-1)?.texto).toMatch(/Estouro/)
  })
})

describe('pausar, continuar, passo, parar e reiniciar', () => {
  it('pausa congela tudo; continuar retoma', () => {
    const c = controlador(UMA_CAMADA)
    c.executar()
    for (let k = 0; k < 500; k++) c.avancar(1 / 60)
    c.pausar()
    const t = c.tempo, pose = { ...c.pose }, volume = c.deposito.volumeTotal, temp = c.termico.temperaturaC
    for (let k = 0; k < 300; k++) c.avancar(1 / 60)
    expect(c.estado).toBe('pausado')
    expect(c.tempo).toBe(t)
    expect(c.pose).toEqual(pose)
    expect(c.deposito.volumeTotal).toBe(volume)
    expect(c.termico.temperaturaC).toBe(temp)
    c.continuar()
    c.avancar(0.1)
    expect(c.tempo).toBeGreaterThan(t)
  })

  it('passo executa uma instrução (o movimento inteiro) e pausa', () => {
    const c = controlador(job('SET B000 1', 'MOVL C00002 V=20.0', 'INC B000'), 'teste')
    c.passo()
    c.avancar(0.05)
    expect(c.estado).toBe('pausado')
    expect(c.linhaAtual).toBe(2)
    c.passo()
    for (let k = 0; k < 50; k++) c.avancar(0.05)
    expect(c.estado).toBe('pausado')
    expect(c.B[0]).toBe(1)
    c.passo()
    for (let k = 0; k < 2000 && c.estado === 'executando'; k++) c.avancar(0.05)
    expect(c.estado).toBe('pausado')
    expect(c.pose).toMatchObject({ x: 700, y: 0, z: 0 })
    expect(c.B[0]).toBe(1)
  })

  it('parar fecha o arco na hora e encerra a deposição', () => {
    const c = controlador(UMA_CAMADA)
    c.executar()
    while (!(c.arco && c.pose.x > 750)) c.avancar(PASSO_S)
    c.parar()
    const v = c.deposito.volumeTotal
    expect(c.estado).toBe('parado')
    expect(c.arco).toBe(false)
    expect(c.passes[0].fechamento).toBe('parada')
    c.avancar(1)
    c.continuar()
    c.avancar(1)
    expect(c.deposito.volumeTotal).toBe(v)
    expect(c.deposito.alturaEm(790, 0)).toBe(0)
  })

  it('reiniciar (executor novo) repete exatamente o mesmo resultado', () => {
    const a = controlador(UMA_CAMADA), b = controlador(UMA_CAMADA)
    a.rodarAteOFim(); b.rodarAteOFim()
    expect(Array.from(b.deposito.altura)).toEqual(Array.from(a.deposito.altura))
  })
})

describe('determinismo e taxa de quadros', () => {
  it('a parede não depende da taxa de quadros nem do multiplicador de velocidade', () => {
    const rodar = (dt: number) => {
      const c = controlador(PROGRAMA_INICIAL)
      c.executar()
      while (c.estado === 'executando') c.avancar(dt)
      return c
    }
    const a = rodar(1 / 60), b = rodar(1 / 23), r = rodar(30 / 60)
    expect(b.tempo).toBeCloseTo(a.tempo, 9)
    expect(r.tempo).toBeCloseTo(a.tempo, 9)
    expect(Array.from(b.deposito.altura)).toEqual(Array.from(a.deposito.altura))
    expect(Array.from(r.deposito.altura)).toEqual(Array.from(a.deposito.altura))
    expect(avaliarParede(b).nota).toBe(avaliarParede(a).nota)
  }, 60000)
})

describe('modelo da parede e inspeção', () => {
  it('o programa inicial reprova: incremento maior que a camada e interpasse alto', () => {
    const c = controlador(PROGRAMA_INICIAL)
    c.rodarAteOFim()
    const a = avaliarParede(c)
    expect(a.aprovada).toBe(false)
    expect(a.camadas).toBe(8)
    const nomes = a.achados.map((x) => x.nome)
    expect(nomes).toContain('Tocha subindo mais que a parede')
    expect(nomes).toContain('Interpasse acima do limite')
    // A folga do TCP cresce camada a camada.
    expect(c.passes[7].folgaInicialMm).toBeGreaterThan(c.passes[1].folgaInicialMm + 2)
  }, 30000)

  it('com incremento pela altura medida e espera maior, a parede é aprovada', () => {
    const c = controlador(corrigido)
    expect(c.rodarAteOFim()).toBe('concluido')
    const a = avaliarParede(c)
    expect(a.aprovada).toBe(true)
    expect(a.medidas.alturaUtilMm).toBeGreaterThanOrEqual(MISSAO_PAREDE.alturaMinMm)
    expect(a.medidas.falhas).toEqual([])
    expect(a.interpasseMaxC).toBeLessThanOrEqual(MISSAO_PAREDE.interpasseMaxC)
    expect(a.nota).toBeGreaterThan(900)
  }, 30000)

  it('incremento grande demais acaba em perda/falha de arco; pequeno demais faz o arame mergulhar', () => {
    const alto = controlador(PROGRAMA_INICIAL.replace(/2800/g, '4200'))
    expect(alto.rodarAteOFim()).toBe('alarme')
    expect(alto.eventos.at(-1)?.texto).toMatch(/arco/)
    const baixo = controlador(PROGRAMA_INICIAL.replace(/2800/g, '1000'))
    baixo.rodarAteOFim()
    expect(baixo.passes.at(-1)!.folgaInicialMm).toBeLessThan(-3)
  }, 30000)

  it('velocidade alta para a alimentação parte o cordão (humping)', () => {
    const c = controlador(corrigido.replace(/V=8.0/g, 'V=16.0').replace(/2200/g, '1300'))
    c.rodarAteOFim()
    const a = avaliarParede(c)
    expect(a.achados.map((x) => x.nome)).toContain('Cordão partido (humping)')
    expect(a.itens.find((i) => i.nome === 'Continuidade')!.pontos).toBeLessThan(100)
  }, 30000)

  it('sem espera entre camadas a parede superaquece e escorre', () => {
    const c = controlador(PROGRAMA_INICIAL.replace(/TIMER T=20.00\n/g, '').replace(/2800/g, '2000'))
    c.rodarAteOFim()
    const a = avaliarParede(c)
    expect(a.interpasseMaxC).toBeGreaterThan(500)
    expect(a.achados.map((x) => x.nome)).toContain('Escorrimento lateral')
  }, 30000)

  it('camadas sempre no mesmo sentido inclinam o topo mais que alternadas', () => {
    const ida = job('SET B000 0', 'SET D000 0', 'SETE P000 (3) 0', '*L', 'SFTON P000', 'MOVL C00001 V=50.0', 'MOVL C00002 V=20.0', 'ARCON ASF#(1)', 'MOVL C00003 V=8.0', 'ARCOF AEF#(1)', 'MOVL C00004 V=50.0', 'SFTOF', 'ADD D000 2300', 'SETE P000 (3) D000', 'TIMER T=60.00', 'INC B000', 'JUMP *L IF B000<8')
    const mesmo = controlador(ida); mesmo.rodarAteOFim()
    const alternado = controlador(corrigido); alternado.rodarAteOFim()
    const im = Math.abs(avaliarParede(mesmo).medidas.inclinacaoMm100), ia = Math.abs(avaliarParede(alternado).medidas.inclinacaoMm100)
    expect(im).toBeGreaterThan(ia + 1)
  }, 60000)
})

describe('persistência', () => {
  it('ida e volta do projeto salvo', () => {
    const d = dadosManufaturaIniciais()
    d.projeto.programa = 'NOP\nEND'
    d.melhor = { nota: 812, aprovada: false, data: '2026-10-30T12:00:00.000Z' }
    expect(validarDadosManufatura(JSON.parse(JSON.stringify(d)))).toEqual(d)
  })

  it('campo estragado volta ao padrão sem perder o resto', () => {
    const d = JSON.parse(JSON.stringify(dadosManufaturaIniciais()))
    d.projeto.pontos = [{ nome: 'x', pose: { x: 'a' } }]
    d.projeto.condicoes = { inicio: [{ alimentacaoMMin: 99 }], fim: [{}] }
    d.projeto.programa = 'NOP\nTIMER T=1.00\nEND'
    const v = validarDadosManufatura(d)!
    expect(v.projeto.programa).toBe('NOP\nTIMER T=1.00\nEND')
    expect(v.projeto.pontos).toEqual(pontosIniciais())
    expect(v.projeto.condicoes.inicio[0].alimentacaoMMin).toBe(12)
    expect(validarDadosManufatura({ versao: 2 })).toBeNull()
  })

  it('dados antigos (sem a coleção nova) continuam lidos; lixo vira aviso e padrão', () => {
    const mem = new MemoriaChaveValor()
    const repo = new Repositorio(mem)
    repo.gravar('preferencias', { som: false })
    expect(repo.ler('manufatura', dadosManufaturaIniciais(), validarDadosManufatura)).toEqual({ dados: dadosManufaturaIniciais() })
    expect(repo.ler('preferencias', null).dados).toEqual({ som: false })
    mem.setItem('soldagem-mig/manufatura', '{quebrado')
    const r = repo.ler('manufatura', dadosManufaturaIniciais(), validarDadosManufatura)
    expect(r.aviso).toMatch(/manufatura/)
    expect(r.dados).toEqual(dadosManufaturaIniciais())
  })
})

describe('modo livre (sem missão)', () => {
  it('o programa inicial do modo livre é válido e faz um cordão só', () => {
    expect(ler(PROGRAMA_LIVRE).diagnosticos).toEqual([])
    const c = controlador(PROGRAMA_LIVRE)
    expect(c.rodarAteOFim()).toBe('concluido')
    const i = inspecionarLivre(c)
    expect(i.passes).toBe(1)
    expect(i.extensao).not.toBeNull()
    expect(i.extensao!.xMin).toBeGreaterThan(690)
    expect(i.extensao!.xMax).toBeLessThan(810)
    expect(i.alturaMaxMm).toBeGreaterThan(1.5)
    expect(i.arameG).toBeGreaterThan(0)
    // Sem nota e sem aprovação: só medidas e avisos de processo.
    expect('nota' in i).toBe(false)
    expect(i.achados.some((a) => /missão/i.test(a.causa))).toBe(false)
  })

  it('peça fora do lugar da missão é medida sem reclamar', () => {
    const pontos = pontosIniciais().map((p) => ({ ...p, pose: { ...p.pose, y: p.pose.y + 25 } }))
    pontos[0] = pontosIniciais()[0]
    const c = controlador(PROGRAMA_LIVRE, 'fabricar', pontos)
    expect(c.rodarAteOFim()).toBe('concluido')
    const i = inspecionarLivre(c)
    expect(i.extensao!.yMin).toBeGreaterThan(18)
    expect(i.achados).toEqual([])
  })

  it('nada depositado vira aviso; alarme aparece como no modo missão', () => {
    const vazio = controlador(job('MOVJ C00001 VJ=15.00'))
    vazio.rodarAteOFim()
    expect(inspecionarLivre(vazio).achados.map((a) => a.nome)).toContain('Nada foi depositado')
    const alarme = controlador(job('MOVL C00001 V=50.0', 'ARCON ASF#(1)'))
    alarme.rodarAteOFim()
    expect(inspecionarLivre(alarme).achados[0].nome).toBe('Programa interrompido por alarme')
  })

  it('o projeto do modo livre é salvo à parte; dado antigo sem ele recebe o padrão', () => {
    const d = dadosManufaturaIniciais()
    d.livre.programa = 'NOP\nTIMER T=2.00\nEND'
    const v = validarDadosManufatura(JSON.parse(JSON.stringify(d)))!
    expect(v.livre.programa).toBe('NOP\nTIMER T=2.00\nEND')
    expect(v.projeto.programa).toBe(PROGRAMA_INICIAL)
    const antigo = JSON.parse(JSON.stringify(d)) as Record<string, unknown>
    delete antigo.livre
    expect(validarDadosManufatura(antigo)!.livre).toEqual(projetoLivre())
  })
})

