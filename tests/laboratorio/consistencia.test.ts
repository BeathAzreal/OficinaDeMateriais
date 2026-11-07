import { describe, expect, it } from 'vitest';
import * as E from '../../src/setores/laboratorio/motor/estado';
import { executarPerfil } from '../../src/setores/laboratorio/motor/microdureza';
import { zonaEm, meiaLarguraFusao, xBordaFratura } from '../../src/setores/laboratorio/motor/geometria';
import type { AquisicaoMicrodureza, AquisicaoMicrografia, AquisicaoVisual } from '../../src/setores/laboratorio/motor/tipos';
import { caso, ok, passo } from './auxiliar';

const g = caso.verdade.geometria;

describe('consistência dos resultados', () => {
  it('a mesma aquisição visual repetida dá o mesmo resultado', () => {
    let e = E.novoJogo(caso, 'desafio');
    e = ok(E.limparSuperficie(caso, e, 'fratura-A', 'suave'));
    const pedido = { superficie: 'fratura-A', vista: 'detalhe' as const, centro: { u: 22, v: 3 }, iluminacao: 'difusa' as const };
    let a: string, b: string;
    [e, a] = passo(E.registrarVisual(caso, e, pedido));
    [e, b] = passo(E.registrarVisual(caso, e, pedido));
    const A = e.aquisicoes.find((x) => x.id === a) as AquisicaoVisual;
    const B = e.aquisicoes.find((x) => x.id === b) as AquisicaoVisual;
    expect(B.achados).toEqual(A.achados);
    expect(B.semente).toBe(A.semente);
  });

  it('as duas faces da fratura mostram os mesmos achados nas mesmas condições', () => {
    let e = E.novoJogo(caso, 'desafio');
    e = ok(E.limparSuperficie(caso, e, 'fratura-A', 'suave'));
    e = ok(E.limparSuperficie(caso, e, 'fratura-B', 'suave'));
    let a: string, b: string;
    [e, a] = passo(E.registrarVisual(caso, e, { superficie: 'fratura-A', vista: 'geral', iluminacao: 'rasante' }));
    [e, b] = passo(E.registrarVisual(caso, e, { superficie: 'fratura-B', vista: 'geral', iluminacao: 'rasante' }));
    const ids = (id: string) => e.aquisicoes.find((x) => x.id === id)!.achados.map((x) => x.achadoId).sort();
    expect(ids(a)).toEqual(ids(b));
  });

  it('a mesma micrografia repetida é idêntica; outra preparação muda só os artefatos', () => {
    let e = E.novoJogo(caso, 'desafio');
    let am: string, p1: string, p2: string, m1: string, m2: string, m3: string;
    [e, am] = passo(E.cortarAmostra(caso, e, { orientacao: 'transversal', x: 0, y: 45 }));
    [e, p1] = passo(E.prepararAmostra(caso, e, { amostraId: am, lixamento: 'lixa-1200', polimento: 'diamante-6-1', ataque: 'nital-5s' }));
    [e, m1] = passo(E.registrarMicrografia(caso, e, { preparoId: p1, ampliacao: 500, centro: { u: -18, v: 6 } }));
    [e, m2] = passo(E.registrarMicrografia(caso, e, { preparoId: p1, ampliacao: 500, centro: { u: -18, v: 6 } }));
    [e, p2] = passo(E.prepararAmostra(caso, e, { amostraId: am, lixamento: 'lixa-220', polimento: 'diamante-6', ataque: 'nital-5s' }));
    [e, m3] = passo(E.registrarMicrografia(caso, e, { preparoId: p2, ampliacao: 500, centro: { u: -18, v: 6 } }));
    const get = (id: string) => e.aquisicoes.find((x) => x.id === id) as AquisicaoMicrografia;
    expect(get(m2).achados).toEqual(get(m1).achados);
    const reais = (id: string) => get(id).achados.filter((x) => !x.achadoId.startsWith('art-')).map((x) => x.achadoId);
    expect(reais(m3)).toEqual(reais(m1));
    expect(get(m3).achados.some((x) => x.achadoId === 'art-arrancamento')).toBe(true);
    expect(get(m1).achados.some((x) => x.achadoId.startsWith('art-'))).toBe(false);
  });

  it('o perfil de dureza é determinístico para as mesmas condições', () => {
    let e = E.novoJogo(caso, 'desafio');
    let am: string, p: string;
    [e, am] = passo(E.cortarAmostra(caso, e, { orientacao: 'transversal', x: 0, y: 45 }));
    [e, p] = passo(E.prepararAmostra(caso, e, { amostraId: am, lixamento: 'lixa-1200', polimento: 'diamante-6-1', ataque: 'nital-5s' }));
    const amostra = e.amostras[0];
    const preparo = e.preparos[0];
    const pontos = Array.from({ length: 30 }, (_, i) => ({ u: -14 + i * 0.5, v: 1 }));
    const r1 = executarPerfil(caso, amostra, preparo, { preparoId: p, carga: 'HV0.5', pontos }, [], 'X') as AquisicaoMicrodureza;
    const r2 = executarPerfil(caso, amostra, preparo, { preparoId: p, carga: 'HV0.5', pontos }, [], 'Y') as AquisicaoMicrodureza;
    expect(r2.pontos).toEqual(r1.pontos);
  });

  it('dureza, microestrutura e fratura descrevem a mesma peça', () => {
    // a ZTA grosseira do último passe é a zona mais dura
    const zonas = caso.verdade.zonas;
    const maisDura = Object.entries(zonas).sort((a, b) => b[1].dureza - a[1].dureza)[0][0];
    expect(maisDura).toBe('zta-gg-acab');
    // a fratura, junto à face, passa pela ZTA de grãos grosseiros
    const x = xBordaFratura(g, 22, 0.5) - 0.05;
    expect(zonaEm(g, x, 22, 0.5)).toBe('zta-gg-acab');
    // o pé do cordão na face coincide com a meia-largura de fusão
    expect(meiaLarguraFusao(g, 0)).toBeCloseTo(caso.publico.desenho.meiaLarguraCordao, 0);
    // a trinca secundária desenhada está dentro da ZTA grosseira
    const trinca = caso.verdade.formas['trinca-pe-A'];
    if (trinca.tipo !== 'trinca' || !trinca.transversal) throw new Error('forma inesperada');
    for (const [u, v] of trinca.transversal.pontos.slice(1)) {
      expect(['zta-gg-acab']).toContain(zonaEm(g, u, 22, v));
    }
    // os poros estão dentro da zona fundida
    const poros = caso.verdade.formas.poros;
    if (poros.tipo !== 'esferas') throw new Error('forma inesperada');
    for (const p of poros.esferas) expect(zonaEm(g, p.x, p.y, p.z)?.startsWith('zf')).toBe(true);
  });
});
