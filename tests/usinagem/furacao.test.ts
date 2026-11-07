import { describe, expect, it } from 'vitest';
import { criarPeca, celulaEm } from '../../src/setores/usinagem/modelo/peca';
import { arestaNova } from '../../src/setores/usinagem/modelo/passe';
import { comprimentoPonta, preverFuracao, simularFuracao, verificarFuracao } from '../../src/setores/usinagem/modelo/furacao';
import { velocidadeAvanco, velocidadeCorte } from '../../src/setores/usinagem/modelo/cinematica';
import { reproduzirAnimacao, VELOCIDADES } from '../../src/setores/usinagem/jogo/animacao';
import { aplicarAcao, pecaAtual } from '../../src/setores/usinagem/jogo/partida';
import { ambFuro, ctx, jogar, passe } from './auxiliar';
import type { Broca, ParametrosFuracao } from '../../src/setores/usinagem/modelo/tipos';

const tarugo = (d = 40, mat = 'ac45-laminado') => criarPeca(d, 75, mat);
const base: ParametrosFuracao = { n: 800, f: 0.15, P: 20, q: 0 };

describe('geometria e cinemática da furação', () => {
  it('ponta cônica lp = (d/2)/tan(σ/2)', () => {
    const b = ambFuro().broca;
    expect(comprimentoPonta(b)).toBeCloseTo(5 / Math.tan((59 * Math.PI) / 180), 10);
    const md = ambFuro('md-d10').broca;
    expect(comprimentoPonta(md)).toBeLessThan(comprimentoPonta(b)); // 140° é mais "rombuda"
  });

  it('vc na periferia, vf = f·n e tempo = (aproximação + P + lp)/vf sem pica-pau', () => {
    const amb = ambFuro();
    const p = preverFuracao(tarugo(), base, amb);
    expect(p.vc).toBeCloseTo(velocidadeCorte(10, 800), 10);
    expect(p.vf).toBeCloseTo(velocidadeAvanco(0.15, 800), 10);
    expect(p.tc).toBeCloseTo((2 + 20 + comprimentoPonta(amb.broca)) / p.vf, 10);
    expect(p.descargas).toBe(0);
  });

  it('pica-pau soma descargas e o recuo de 0,5 mm em cada retorno', () => {
    const amb = ambFuro();
    const p = preverFuracao(tarugo(), { ...base, q: 5 }, amb);
    const fundo = 20 + comprimentoPonta(amb.broca);
    expect(p.descargas).toBe(Math.ceil(fundo / 5) - 1);
    const percurso = 2 + fundo + 0.5 * p.descargas;
    expect(p.percurso).toBeCloseTo(percurso, 9);
    expect(p.tc).toBeCloseTo(percurso / p.vf + p.descargas * ctx.maquina.tempoDescarga, 9);
  });

  it('o furo tem o diâmetro da broca mais a sobremedida e termina em cone', () => {
    const amb = ambFuro();
    const s = simularFuracao(tarugo(), arestaNova(), base, amb);
    const d = s.peca.furo[celulaEm(s.peca, 10)];
    expect(d).toBeGreaterThanOrEqual(10 + amb.broca.sobremedida);
    expect(d).toBeLessThan(10 + amb.broca.sobremedida + 0.01);
    const lp = comprimentoPonta(amb.broca);
    expect(s.peca.furo[celulaEm(s.peca, 20 + lp / 2)]).toBeLessThan(10);
    expect(s.peca.furo[celulaEm(s.peca, 20 + lp + 0.2)]).toBe(0);
    // volume ≈ cilindro + cone
    const esperado = (Math.PI / 4) * 100 * 20 + (Math.PI / 12) * 100 * lp;
    expect(s.resultado.volume).toBeGreaterThan(esperado * 0.98);
    expect(s.resultado.volume).toBeLessThan(esperado * 1.03);
    // o externo não muda
    expect(s.peca.diametros.every((v) => v === 40)).toBe(true);
  });
});

describe('limites geométricos da furação', () => {
  it('rejeita furo além do canal útil da broca', () => {
    const erros = verificarFuracao(tarugo(), { ...base, P: 56 }, ambFuro('hss-d6'));
    expect(erros.map((e) => e.campo)).toContain('P');
  });
  it('rejeita broca que deixaria parede menor que a mínima', () => {
    const erros = verificarFuracao(tarugo(17), base, ambFuro('hss-d16'));
    expect(erros.length).toBeGreaterThan(0);
  });
  it('depois do furo, o torneamento não pode romper a parede', () => {
    const e = jogar([{ tipo: 'furar', estacao: 4, params: { ...base, P: 30 } }, passe({ ap: 3, L: 20, f: 0.2 })], 'laboratorio');
    // 40 → 34 com furo Ø10 está ok; agora tentar ir a Ø11
    const r = aplicarAcao(e, passe({ ap: 3, L: 20 }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const r2 = aplicarAcao(r.estado, passe({ ap: 3, L: 20 }));
    expect(r2.ok).toBe(true);
    if (!r2.ok) return;
    const r3 = aplicarAcao(r2.estado, passe({ ap: 3, L: 20 })); // 22 → 16? passa; 16 → 10 rompe
    if (r3.ok) {
      const r4 = aplicarAcao(r3.estado, passe({ ap: 3, L: 20 }));
      expect(r4.ok).toBe(false);
      if (!r4.ok) expect(r4.erro).toMatch(/parede/);
    } else expect(r3.erro).toMatch(/parede|mínimo/);
  });
});

describe('efeitos físicos da furação', () => {
  it('pré-furo elimina o gume transversal e reduz a carga', () => {
    const amb16 = ambFuro('hss-d16');
    const macico = simularFuracao(tarugo(), arestaNova(), { ...base, f: 0.25, n: 400 }, amb16);
    const pre = simularFuracao(tarugo(), arestaNova(), { ...base, P: 30 }, ambFuro('hss-d6'));
    const comPre = simularFuracao(pre.peca, arestaNova(), { ...base, f: 0.25, n: 400 }, amb16);
    expect(macico.resultado.gumeTransversalCortou).toBe(true);
    expect(comPre.resultado.gumeTransversalCortou).toBe(false);
    expect(comPre.resultado.cargaMax).toBeLessThan(macico.resultado.cargaMax);
  });

  it('furo fundo sem pica-pau entope o canal; com pica-pau não', () => {
    const amb = ambFuro('hss-d6');
    const sem = simularFuracao(tarugo(), arestaNova(), { n: 1000, f: 0.08, P: 40, q: 0 }, amb);
    const com = simularFuracao(tarugo(), arestaNova(), { n: 1000, f: 0.08, P: 40, q: 10 }, amb);
    expect(sem.resultado.entupimentoMax).toBeGreaterThan(1.5);
    expect(com.resultado.entupimentoMax).toBe(1);
    expect(com.resultado.previsao.tc).toBeGreaterThan(sem.resultado.previsao.tc); // descargas custam tempo
  });

  it('avanço alto quebra a broca pequena de forma determinística e trava a peça', () => {
    const e = jogar([{ tipo: 'furar', estacao: 6, params: { n: 800, f: 0.4, P: 40, q: 0 } }], 'laboratorio');
    const r = e.passes[0];
    expect(r.tipo).toBe('furar');
    if (r.tipo !== 'furar') return;
    expect(r.quebrouEm).not.toBeNull();
    expect(r.tcEfetivo).toBeLessThan(r.previsao.tc);
    expect(pecaAtual(e).bloqueio).toMatch(/quebrou/);
    expect(aplicarAcao(e, passe({ ap: 0.5 })).ok).toBe(false);
    // a broca quebrada precisa ser trocada; com tarugo novo e broca nova volta a funcionar
    const r2 = aplicarAcao(e, { tipo: 'novoTarugo' });
    if (!r2.ok) throw new Error(r2.erro);
    expect(aplicarAcao(r2.estado, { tipo: 'furar', estacao: 6, params: base }).ok).toBe(false);
    const r3 = aplicarAcao(r2.estado, { tipo: 'trocarAresta', estacao: 6 });
    if (!r3.ok) throw new Error(r3.erro);
    expect(aplicarAcao(r3.estado, { tipo: 'furar', estacao: 6, params: { ...base, f: 0.1, n: 1200 } }).ok).toBe(true);
  });

  it('broca de aço rápido em vc alta desgasta muito mais que a de metal duro', () => {
    const p = { n: 2000, f: 0.15, P: 20, q: 0 };
    const hss = simularFuracao(tarugo(), arestaNova(), p, ambFuro('hss-d10'));
    const md = simularFuracao(tarugo(), arestaNova(), p, ambFuro('md-d10'));
    expect(hss.aresta.dano).toBeGreaterThan(10 * md.aresta.dano);
  });

  it('broca menor num furo maior não corta nada', () => {
    const grande = simularFuracao(tarugo(), arestaNova(), base, ambFuro('hss-d10'));
    const pequena = simularFuracao(grande.peca, arestaNova(), { ...base, P: 15 }, ambFuro('hss-d6'));
    expect(pequena.resultado.volume).toBe(0);
    expect(pequena.aresta.dano).toBe(0);
    expect(pequena.peca.furo).toEqual(grande.peca.furo);
  });

  it('a animação da furação termina igual em qualquer velocidade', () => {
    const e = jogar([{ tipo: 'furar', estacao: 4, params: { ...base, q: 6 } }], 'laboratorio');
    const r = e.passes[0];
    const finais = VELOCIDADES.map((v) => reproduzirAnimacao(r, v, 2).final);
    for (const f of finais) expect(f).toEqual(finais[0]);
    expect(finais[0].concluido).toBe(true);
  });

  it('as brocas da biblioteca têm resistência crescente com o diâmetro', () => {
    const t = ['hss-d6', 'hss-d10', 'hss-d16'].map((id) => (ambFuro(id).broca as Broca).torqueLimite);
    expect(t[0]).toBeLessThan(t[1]);
    expect(t[1]).toBeLessThan(t[2]);
  });
});
