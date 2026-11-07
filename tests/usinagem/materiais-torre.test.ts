import { describe, expect, it } from 'vitest';
import { listaMateriais, material, ferramenta } from '../../src/setores/usinagem/dados/catalogo';
import { criarPeca } from '../../src/setores/usinagem/modelo/peca';
import { arestaNova, simularPasse } from '../../src/setores/usinagem/modelo/passe';
import { aplicarAcao, iniciarPartida, instanciaNaEstacao, pecaAtual } from '../../src/setores/usinagem/jogo/partida';
import { estoqueRestante } from '../../src/setores/usinagem/jogo/recursos';
import { blocoParaAcao, listagemIso, referenciasDosBlocos, type Programa } from '../../src/setores/usinagem/jogo/programa';
import { carregar, CHAVE_ANTIGA, salvar, salvoPadrao } from '../../src/setores/usinagem/jogo/persistencia';
import type { FerramentaTornear, ParametrosPasse } from '../../src/setores/usinagem/modelo/tipos';
import { ENC, ctx, jogar, memoria, passe } from './auxiliar';

const p: ParametrosPasse = { n: 1200, f: 0.2, ap: 1, L: 40, operacao: 'desbaste' };
const tornear = (matId: string, ferrId = 'md80-r08', params = p) =>
  simularPasse(criarPeca(40, 75, matId), arestaNova(), params, {
    material: material(matId),
    ferramenta: ferramenta(ferrId) as FerramentaTornear,
    maquina: ctx.maquina,
  }, 1);

describe('materiais com comportamentos distintos', () => {
  it('cada material tem ficha, microestrutura e dados identificados', () => {
    expect(listaMateriais.length).toBeGreaterThanOrEqual(6);
    for (const m of listaMateriais) {
      expect(m.condicaoFornecimento.length).toBeGreaterThan(0);
      expect(m.propriedades.some((v) => v.origem === 'sintetico')).toBe(true);
    }
  });

  it('ferro fundido e latão fragmentam o cavaco; o aço forma fita sem quebra-cavaco', () => {
    expect(tornear('ff25-fundido').resultado.cavaco.tipo).toBe('fragmentado');
    expect(tornear('lt360-corte-livre', 'hss-bit-r04').resultado.cavaco.tipo).toBe('fragmentado');
    expect(tornear('ac45-laminado', 'hss-bit-r04', { ...p, n: 2000 }).resultado.cavaco.tipo).toBe('fita');
  });

  it('não é um multiplicador único: AC-10 tem força menor, mas Ra pior que o AC-45 em vc média', () => {
    const params = { ...p, n: 800, f: 0.15, ap: 0.5 }; // vc ≈ 98 m/min
    const a10 = tornear('ac10-trefilado', 'md80-r08', params);
    const a45 = tornear('ac45-laminado', 'md80-r08', params);
    expect(a10.resultado.cargaMax).toBeLessThan(a45.resultado.cargaMax);
    expect(a10.resultado.celulas[100].ra!.total).toBeGreaterThan(a45.resultado.celulas[100].ra!.total);
  });

  it('o alumínio flete mais que o aço com a mesma força relativa (E menor)', () => {
    const al = tornear('al61-t6');
    const ac = tornear('ac45-laminado');
    // compare deflexão por unidade de carga na mesma posição perto da face (viga mais longa)
    const i = 5;
    const porCargaAl = al.resultado.celulas[i].deflexao / al.resultado.celulas[i].carga;
    const porCargaAc = ac.resultado.celulas[i].deflexao / ac.resultado.celulas[i].carga;
    expect(porCargaAl).toBeGreaterThan(porCargaAc);
  });

  it('o inox exige mais da aresta que o aço carbono, com dureza parecida', () => {
    expect(tornear('ix304-solubilizado').resultado.cargaMax).toBeGreaterThan(tornear('ac45-laminado').resultado.cargaMax);
  });

  it('aço rápido tem vida muito mais sensível à vc que o metal duro', () => {
    const m = material('ac45-laminado').comportamento;
    const hss = m.vidaAresta(30, 0.25, 'aco-rapido') / m.vidaAresta(60, 0.25, 'aco-rapido');
    const md = m.vidaAresta(150, 0.25, 'metal-duro') / m.vidaAresta(300, 0.25, 'metal-duro');
    expect(hss).toBeCloseTo(2 ** 8, 6);
    expect(md).toBeCloseTo(2 ** 4, 6);
  });

  it('raio de ponta menor piora a Ra geométrica com o mesmo avanço', () => {
    const r08 = tornear('ac45-laminado', 'md80-r08', { ...p, n: 1500 });
    const r04 = tornear('ac45-laminado', 'md80-r04', { ...p, n: 1500 });
    expect(r04.resultado.celulas[50].ra!.geometrica).toBeCloseTo(2 * r08.resultado.celulas[50].ra!.geometrica, 9);
  });
});

describe('torre de ferramentas', () => {
  it('o modo livre começa com insertos e brocas montados', () => {
    const e = iniciarPartida('laboratorio', ENC);
    expect(ferramenta(instanciaNaEstacao(e, 1)!.ferramentaId).tipo).toBe('tornear');
    expect(ferramenta(instanciaNaEstacao(e, 4)!.ferramentaId).tipo).toBe('broca');
  });

  it('torneamento exige ferramenta de tornear, e furação exige broca', () => {
    const e = iniciarPartida('laboratorio', ENC);
    expect(aplicarAcao(e, { ...passe({}), estacao: 4 } as never).ok).toBe(false);
    expect(aplicarAcao(e, { tipo: 'furar', estacao: 1, params: { n: 800, f: 0.1, P: 10, q: 0 } }).ok).toBe(false);
  });

  it('cada estação tem seu próprio desgaste e a troca só afeta a estação escolhida', () => {
    let e = jogar([passe({ n: 3000 }), { ...passe({ n: 3000, ap: 0.5 }), estacao: 2 } as never], 'laboratorio');
    const d1 = instanciaNaEstacao(e, 1)!.estado.dano;
    const d2 = instanciaNaEstacao(e, 2)!.estado.dano;
    expect(d1).toBeGreaterThan(0);
    expect(d2).toBeGreaterThan(0);
    const r = aplicarAcao(e, { tipo: 'trocarAresta', estacao: 2 });
    if (!r.ok) throw new Error(r.erro);
    e = r.estado;
    expect(instanciaNaEstacao(e, 1)!.estado.dano).toBe(d1);
    expect(instanciaNaEstacao(e, 2)!.estado.dano).toBe(0);
  });

  it('na encomenda, só ferramentas permitidas podem ser montadas, e montar consome estoque', () => {
    const e = iniciarPartida('encomenda', ENC);
    expect(aplicarAcao(e, { tipo: 'montarFerramenta', estacao: 2, ferramentaId: 'hss-d10' }).ok).toBe(false);
    const r = aplicarAcao(e, { tipo: 'montarFerramenta', estacao: 2, ferramentaId: 'md80-r04' });
    if (!r.ok) throw new Error(r.erro);
    expect(estoqueRestante(r.estado)!.arestas).toBe(estoqueRestante(e)!.arestas - 1);
  });

  it('no modo livre dá para escolher material, diâmetro e balanço do tarugo', () => {
    const e = jogar([{ tipo: 'novoTarugo', materialId: 'al61-t6', diametro: 25, balanco: 100 }], 'laboratorio');
    const pj = pecaAtual(e);
    expect(pj.peca.materialId).toBe('al61-t6');
    expect(pj.peca.diametroBruto).toBe(25);
    expect(pj.peca.balanco).toBe(100);
    expect(aplicarAcao(e, { tipo: 'novoTarugo', diametro: 33 }).ok).toBe(false);
  });

  it('na encomenda, o tarugo é sempre o da encomenda', () => {
    const e = jogar([passe({ ap: 3, f: 0.2 }), { tipo: 'novoTarugo', materialId: 'al61-t6', diametro: 25 }]);
    expect(pecaAtual(e).peca.materialId).toBe(ctx.encomenda.materialId);
    expect(pecaAtual(e).peca.diametroBruto).toBe(ctx.encomenda.tarugo.diametro);
  });
});

describe('programa CNC', () => {
  const prog: Programa = {
    nome: 'O0001',
    cursor: 0,
    blocos: [
      { id: 'a', tipo: 'tornear', estacao: 1, params: { n: 1300, f: 0.25, ap: 1.5, L: 50, operacao: 'desbaste' } },
      { id: 'b', tipo: 'parada', comentario: 'medir' },
      { id: 'c', tipo: 'tornear', estacao: 2, params: { n: 1700, f: 0.15, ap: 0.5, L: 50, operacao: 'acabamento' } },
      { id: 'd', tipo: 'furar', estacao: 4, params: { n: 800, f: 0.15, P: 20, q: 5 } },
    ],
  };

  it('as referências X seguem a cadeia Dref − 2·ap', () => {
    const e = iniciarPartida('laboratorio', ENC);
    expect(referenciasDosBlocos(prog, e)).toEqual([40, 37, 37, 36]);
  });

  it('a listagem ISO mostra X em diâmetro e Z negativo', () => {
    const e = iniciarPartida('laboratorio', ENC);
    const texto = listagemIso(prog, e).map((l) => l.texto).join('\n');
    expect(texto).toContain('X37.000');
    expect(texto).toContain('X36.000');
    expect(texto).toContain('Z-50.000');
    expect(texto).toContain('G83');
    expect(texto).toContain('M00');
  });

  it('a parada M00 não gera ação; os demais blocos viram ações na estação certa', () => {
    const e = iniciarPartida('laboratorio', ENC);
    expect(blocoParaAcao(prog.blocos[1], e)).toBeNull();
    expect(blocoParaAcao(prog.blocos[2], e)).toMatchObject({ tipo: 'passe', estacao: 2 });
    expect(blocoParaAcao(prog.blocos[3], e)).toMatchObject({ tipo: 'furar', estacao: 4 });
  });

  it('no experimento controlado, só o parâmetro escolhido difere da base', () => {
    const e = jogar([passe({ n: 1300, f: 0.25, ap: 1.5 })], 'laboratorio');
    const a = blocoParaAcao(
      { id: 'x', tipo: 'tornear', estacao: 1, params: { n: 2000, f: 0.4, ap: 0.1, L: 10, operacao: 'acabamento' }, base: { numero: 1, variar: 'n' } },
      e,
    );
    expect(a).toMatchObject({ tipo: 'passe', params: { n: 2000, f: 0.25, ap: 1.5, L: 50, operacao: 'desbaste' } });
    if (a && a.tipo === 'passe') expect(a.controle?.mantidos).toEqual(['f', 'ap', 'L', 'operacao']);
  });

  it('o programa é salvo junto com as ações, e a chave antiga ainda é lida', () => {
    const arm = memoria();
    const s = salvoPadrao();
    s.partidas.laboratorio.programa = { ...prog, cursor: 2 };
    arm.setItem(CHAVE_ANTIGA, JSON.stringify(s));
    const lido = carregar(arm);
    expect(lido.partidas.laboratorio.programa.blocos).toHaveLength(4);
    expect(lido.partidas.laboratorio.programa.cursor).toBe(2);
    expect(salvar(arm, lido)).toBe(true);
  });
});
