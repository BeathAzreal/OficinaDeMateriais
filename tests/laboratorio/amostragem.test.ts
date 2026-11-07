import { describe, expect, it } from 'vitest';
import * as E from '../../src/setores/laboratorio/motor/estado';
import { gerarTrajeto } from '../../src/setores/laboratorio/motor/microdureza';
import type { AquisicaoMicrodureza, EstadoJogo } from '../../src/setores/laboratorio/motor/tipos';
import { caso, ok, passo } from './auxiliar';

function ids(e: EstadoJogo, aqId: string): string[] {
  return e.aquisicoes.find((a) => a.id === aqId)!.achados.map((x) => x.achadoId);
}

function qualidade(e: EstadoJogo, aqId: string, achadoId: string) {
  return e.aquisicoes.find((a) => a.id === aqId)!.achados.find((x) => x.achadoId === achadoId)?.qualidade;
}

function amostraPreparada(y: number, prep: Partial<{ lixamento: 'lixa-220' | 'lixa-600' | 'lixa-1200'; polimento: 'nenhum' | 'diamante-6' | 'diamante-6-1'; ataque: 'nenhum' | 'nital-5s' | 'nital-30s' }> = {}) {
  let e = E.novoJogo(caso, 'desafio');
  let am: string, p: string;
  [e, am] = passo(E.cortarAmostra(caso, e, { orientacao: 'transversal', x: 0, y }));
  [e, p] = passo(
    E.prepararAmostra(caso, e, {
      amostraId: am,
      lixamento: prep.lixamento ?? 'lixa-1200',
      polimento: prep.polimento ?? 'diamante-6-1',
      ataque: prep.ataque ?? 'nital-5s',
    }),
  );
  return { e, p };
}

describe('influência da amostragem e da preparação', () => {
  it('a trinca secundária do lado A só aparece em cortes que passam por ela', () => {
    const naOrigem = amostraPreparada(22);
    const [e1, m1] = passo(E.registrarMicrografia(caso, naOrigem.e, { preparoId: naOrigem.p, ampliacao: 500, centro: { u: -9.36, v: 0.2 } }));
    expect(ids(e1, m1)).toContain('mg-trinca-sec-A');

    const longe = amostraPreparada(45);
    const [e2, m2] = passo(E.registrarMicrografia(caso, longe.e, { preparoId: longe.p, ampliacao: 500, centro: { u: -9.36, v: 0.2 } }));
    expect(ids(e2, m2)).not.toContain('mg-trinca-sec-A');
    // mas a microestrutura da ZTA é a mesma nos dois cortes
    expect(ids(e2, m2)).toContain('mg-zta-martensita');
  });

  it('sem polimento a microestrutura fica comprometida e surgem riscos que imitam linhas', () => {
    const { e, p } = amostraPreparada(45, { lixamento: 'lixa-600', polimento: 'nenhum' });
    const [e2, m] = passo(E.registrarMicrografia(caso, e, { preparoId: p, ampliacao: 500, centro: { u: -18, v: 6 } }));
    expect(qualidade(e2, m, 'mg-mb-perlita')).toBe('comprometida');
    expect(ids(e2, m)).toContain('art-riscos-lixamento');
    expect(e2.aquisicoes.find((a) => a.id === m)!.limitacoes.some((l) => l.id === 'mg-riscos')).toBe(true);
  });

  it('ataque prolongado compromete a estimativa da fração de perlita', () => {
    const { e, p } = amostraPreparada(45, { ataque: 'nital-30s' });
    const [e2, m] = passo(E.registrarMicrografia(caso, e, { preparoId: p, ampliacao: 500, centro: { u: -18, v: 6 } }));
    expect(qualidade(e2, m, 'mg-mb-perlita')).toBe('comprometida');
    expect(ids(e2, m)).toContain('art-sobreataque');
  });

  it('sem ataque a microestrutura não aparece, mas a trinca aparece', () => {
    const { e, p } = amostraPreparada(22, { ataque: 'nenhum' });
    const [e2, m] = passo(E.registrarMicrografia(caso, e, { preparoId: p, ampliacao: 500, centro: { u: -9.36, v: 0.2 } }));
    expect(ids(e2, m)).toContain('mg-trinca-sec-A');
    expect(ids(e2, m)).not.toContain('mg-zta-martensita');
  });

  it('um perfil profundo e espaçado perde o pico de dureza junto à face', () => {
    const { e, p } = amostraPreparada(45);
    const profundo = gerarTrajeto(-14, 2, 1.0, 6);
    const [e2, h1] = passo(E.registrarPerfil(caso, e, { preparoId: p, carga: 'HV0.5', pontos: profundo }));
    const raso = gerarTrajeto(-14, 2, 0.2, 0.5).slice(0, 80);
    const [e3, h2] = passo(E.registrarPerfil(caso, e2, { preparoId: p, carga: 'HV0.5', pontos: raso.map((q) => ({ ...q, v: 0.5 })) }));
    const max = (id: string) => Math.max(...(e3.aquisicoes.find((a) => a.id === id) as AquisicaoMicrodureza).pontos.map((q) => q.hv));
    expect(max(h1)).toBeLessThan(380);
    expect(max(h2)).toBeGreaterThan(420);
    expect(ids(e3, h1)).not.toContain('hv-pico-acabamento');
    expect(ids(e3, h2)).toContain('hv-pico-acabamento');
  });

  it('espaçamento menor que 3 diagonais gera limitação específica e eleva os valores', () => {
    const { e, p } = amostraPreparada(45);
    const pontos = gerarTrajeto(-19, -14, 0.1, 6); // metal de base, HV1: diagonal ~0,1 mm
    const [e2, h] = passo(E.registrarPerfil(caso, e, { preparoId: p, carga: 'HV1', pontos }));
    const aq = e2.aquisicoes.find((a) => a.id === h) as AquisicaoMicrodureza;
    expect(aq.limitacoes.some((l) => l.id === 'hv-espacamento' || l.id === 'hv-sobreposicao')).toBe(true);
    const media = aq.pontos.reduce((s, q) => s + q.hv, 0) / aq.pontos.length;
    expect(media).toBeGreaterThan(caso.verdade.zonas.mb.dureza * 1.04);
  });

  it('limpeza agressiva apaga a região escura da origem; a limpeza suave a revela', () => {
    let e = E.novoJogo(caso, 'desafio');
    e = ok(E.limparSuperficie(caso, e, 'fratura-A', 'agressiva'));
    e = ok(E.limparSuperficie(caso, e, 'fratura-B', 'suave'));
    const pedido = (s: string) => ({ superficie: s, vista: 'detalhe' as const, centro: { u: 22, v: 3 }, iluminacao: 'difusa' as const });
    let a: string, b: string;
    [e, a] = passo(E.registrarVisual(caso, e, pedido('fratura-A')));
    [e, b] = passo(E.registrarVisual(caso, e, pedido('fratura-B')));
    expect(ids(e, a)).not.toContain('vf-origem-escura');
    expect(ids(e, a)).toContain('art-riscos-escova');
    expect(ids(e, b)).toContain('vf-origem-escura');
  });

  it('cortar pela origem remove a região da face A, mas a face B ainda a mostra', () => {
    let e = E.novoJogo(caso, 'desafio');
    e = ok(E.cortarAmostra(caso, e, { orientacao: 'transversal', x: 0, y: 22 }));
    e = ok(E.limparSuperficie(caso, e, 'fratura-A', 'suave'));
    e = ok(E.limparSuperficie(caso, e, 'fratura-B', 'suave'));
    const pedido = (s: string) => ({ superficie: s, vista: 'detalhe' as const, centro: { u: 22, v: 3 }, iluminacao: 'difusa' as const });
    let a: string, b: string;
    [e, a] = passo(E.registrarVisual(caso, e, pedido('fratura-A')));
    [e, b] = passo(E.registrarVisual(caso, e, pedido('fratura-B')));
    expect(ids(e, a)).not.toContain('vf-origem-escura');
    expect(e.aquisicoes.find((x) => x.id === a)!.limitacoes.some((l) => l.id === 'vi-removido')).toBe(true);
    expect(ids(e, b)).toContain('vf-origem-escura');
  });

  it('a inspeção visual da raiz nunca produz achado de integridade interna', () => {
    let e = E.novoJogo(caso, 'desafio');
    let a: string;
    [e, a] = passo(E.registrarVisual(caso, e, { superficie: 'raiz-cordao', vista: 'geral', iluminacao: 'difusa' }));
    const aq = e.aquisicoes.find((x) => x.id === a)!;
    expect(aq.limitacoes.some((l) => l.id === 'vi-superficie')).toBe(true);
    expect(aq.achados.map((x) => x.achadoId)).not.toContain('mg-macro-junta');
  });
});
