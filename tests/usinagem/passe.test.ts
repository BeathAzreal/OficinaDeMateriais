import { describe, expect, it } from 'vitest';
import { criarPeca, celulaEm } from '../../src/setores/usinagem/modelo/peca';
import { arestaNova, simularPasse, verificarParametros, preverPasse } from '../../src/setores/usinagem/modelo/passe';
import { velocidadeAvanco } from '../../src/setores/usinagem/modelo/cinematica';
import { amb, ctx } from './auxiliar';
import type { ParametrosPasse } from '../../src/setores/usinagem/modelo/tipos';

const base: ParametrosPasse = { n: 1300, f: 0.25, ap: 1.5, L: 50, operacao: 'desbaste' };
const tarugo = () => criarPeca(40, 75, 'ac45-laminado');

describe('redução de diâmetro por passe', () => {
  it('diâmetro programado = Dref − 2·ap e o obtido fica entre o programado e um desvio pequeno acima', () => {
    const s = simularPasse(tarugo(), arestaNova(), base, amb, 1);
    expect(s.resultado.previsao.dprog).toBeCloseTo(37, 12);
    for (const c of s.resultado.celulas) {
      expect(c.dDepois).toBeGreaterThanOrEqual(37);
      expect(c.dDepois).toBeLessThan(37.2);
      // decomposição fecha: D = Dprog + 2·(recuo + deflexão)
      expect(c.dDepois).toBeCloseTo(37 + 2 * (c.recuo + c.deflexao), 10);
    }
    expect(s.peca.dref).toBeCloseTo(37, 12);
  });

  it('só as células dentro de L são alteradas', () => {
    const s = simularPasse(tarugo(), arestaNova(), { ...base, L: 30 }, amb, 1);
    expect(s.peca.diametros[celulaEm(s.peca, 29.95)]).toBeLessThan(40);
    expect(s.peca.diametros[celulaEm(s.peca, 30.05)]).toBe(40);
    expect(s.peca.origem[celulaEm(s.peca, 30.05)]).toBe(-1);
  });

  it('volume removido coincide com o anel entre o bruto e o obtido', () => {
    const s = simularPasse(tarugo(), arestaNova(), base, amb, 1);
    const esperado = s.resultado.celulas.reduce((v, c) => v + (Math.PI / 4) * (c.dAntes ** 2 - c.dDepois ** 2) * 0.1, 0);
    expect(s.resultado.volume).toBeCloseTo(esperado, 6);
    // ordem de grandeza: anel 40→37 em 50 mm ≈ 9,07 cm³
    expect(s.resultado.volume / 1000).toBeGreaterThan(8.5);
    expect(s.resultado.volume / 1000).toBeLessThan(9.2);
  });
});

describe('tempo de corte do passe', () => {
  it('tc = (L + aproximação)/(f·n), independente do material', () => {
    const p = preverPasse(tarugo(), base, amb);
    expect(p.tc).toBeCloseTo((50 + ctx.maquina.aproximacao) / velocidadeAvanco(0.25, 1300), 12);
  });
  it('dobrar o avanço por volta corta o tempo pela metade', () => {
    const a = preverPasse(tarugo(), base, amb).tc;
    const b = preverPasse(tarugo(), { ...base, f: 0.5 }, amb).tc;
    expect(a / b).toBeCloseTo(2, 12);
  });
});

describe('limites geométricos', () => {
  it('rejeita comprimento que colidiria com as castanhas', () => {
    const lMax = 75 - ctx.maquina.folgaCastanhas;
    expect(verificarParametros(tarugo(), { ...base, L: lMax }, amb)).toHaveLength(0);
    const erros = verificarParametros(tarugo(), { ...base, L: lMax + 0.5 }, amb);
    expect(erros.map((e) => e.campo)).toContain('L');
  });
  it('rejeita ap acima do limite do inserto e ap negativa', () => {
    expect(verificarParametros(tarugo(), { ...base, ap: 3.01 }, amb).map((e) => e.campo)).toContain('ap'); // MD-80 R0,8: 3 mm
    expect(verificarParametros(tarugo(), { ...base, ap: -0.1 }, amb).map((e) => e.campo)).toContain('ap');
  });
  it('rejeita diâmetro programado abaixo do mínimo do balanço', () => {
    const p = { ...tarugo(), dref: 11 };
    expect(verificarParametros(p, { ...base, ap: 1 }, amb).map((e) => e.campo)).toContain('ap');
  });
  it('rejeita rotação e avanço fora da máquina', () => {
    const campos = verificarParametros(tarugo(), { ...base, n: 5000, f: 0.9 }, amb).map((e) => e.campo);
    expect(campos).toEqual(expect.arrayContaining(['n', 'f']));
  });
  it('rejeita campos não numéricos', () => {
    expect(verificarParametros(tarugo(), { ...base, n: Number.NaN }, amb)).toHaveLength(1);
  });
});

describe('material removido não volta', () => {
  it('um passe com diâmetro programado maior que o atual não aumenta o diâmetro', () => {
    const p1 = simularPasse(tarugo(), arestaNova(), { ...base, ap: 2 }, amb, 1);
    // Referência artificialmente maior (ex.: erro de zeragem): o passe não pode "repor" material.
    const pecaMaior = { ...p1.peca, dref: 39 };
    const p2 = simularPasse(pecaMaior, p1.aresta, { ...base, ap: 0.5 }, amb, 2);
    p2.peca.diametros.forEach((d, i) => expect(d).toBeLessThanOrEqual(p1.peca.diametros[i]));
    expect(p2.resultado.volume).toBe(0);
    expect(p2.resultado.celulas.every((c) => !c.contato)).toBe(true);
  });
});

describe('comportamentos que não são monotônicos', () => {
  it('vc baixa não melhora o acabamento: a aresta postiça piora a Ra', () => {
    const lento = simularPasse(tarugo(), arestaNova(), { ...base, n: 300, f: 0.15, ap: 0.5 }, amb, 1);
    const medio = simularPasse(tarugo(), arestaNova(), { ...base, n: 1500, f: 0.15, ap: 0.5 }, amb, 1);
    const raL = lento.resultado.celulas[100].ra!.total;
    const raM = medio.resultado.celulas[100].ra!.total;
    expect(raL).toBeGreaterThan(raM);
  });
  it('vc alta acelera o desgaste', () => {
    const medio = simularPasse(tarugo(), arestaNova(), { ...base, n: 1500 }, amb, 1);
    const rapido = simularPasse(tarugo(), arestaNova(), { ...base, n: 3000 }, amb, 1);
    // mesmo percurso, menos tempo, mas desgaste maior
    expect(rapido.resultado.tempoContato).toBeLessThan(medio.resultado.tempoContato);
    expect(rapido.aresta.dano).toBeGreaterThan(medio.aresta.dano);
  });
  it('avanço muito pequeno não reduz a Ra abaixo do piso, só aumenta o tempo', () => {
    const p = (f: number) => simularPasse(tarugo(), arestaNova(), { ...base, n: 1500, f, ap: 0.5 }, amb, 1);
    const a = p(0.1);
    const b = p(0.05);
    expect(a.resultado.celulas[100].ra!.total - b.resultado.celulas[100].ra!.total).toBeLessThan(0.15);
    expect(b.resultado.previsao.tc).toBeCloseTo(2 * a.resultado.previsao.tc, 10);
  });
  it('carga excessiva lasca a aresta de forma determinística', () => {
    const s = simularPasse(tarugo(), arestaNova(), { ...base, ap: 3, f: 0.5 }, amb, 1);
    expect(s.resultado.lascouEm).not.toBeNull();
    expect(s.aresta.lascada).toBe(true);
    const s2 = simularPasse(tarugo(), arestaNova(), { ...base, ap: 3, f: 0.5 }, amb, 1);
    expect(s2.resultado.lascouEm).toBe(s.resultado.lascouEm);
  });
});
