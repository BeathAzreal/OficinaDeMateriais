import { describe, expect, it } from 'vitest';
import * as E from '../../src/setores/laboratorio/motor/estado';
import { avaliar, INSUFICIENTE } from '../../src/setores/laboratorio/avaliacao/avaliar';
import { caso, investigacaoCompleta, ok, passo, registrar } from './auxiliar';

const nota = (r: ReturnType<typeof avaliar>, id: string) => r.dimensoes.find((d) => d.id === id)!.nota;

describe('avaliação das evidências', () => {
  it('uma investigação completa e cuidadosa recebe nota alta', () => {
    const e = investigacaoCompleta();
    const r = avaliar(caso, e);
    expect(r.total).toBeGreaterThanOrEqual(75);
    expect(nota(r, 'coerencia')).toBeGreaterThanOrEqual(80);
  });

  it('acertar por palpite, sem dados, vale pouco em coerência', () => {
    let e = E.novoJogo(caso, 'desafio');
    e = E.atualizarRelatorio(e, { mecanismo: 'mec-fadiga', causa: 'causa-trinca-fabricacao', fatores: ['fator-material'] });
    e = ok(E.concluir(e));
    const r = avaliar(caso, e);
    expect(nota(r, 'coerencia')).toBeLessThan(40);
    expect(r.total).toBeLessThan(30);
  });

  it('"dados insuficientes" sem dados vale mais que um palpite certo', () => {
    let palpite = E.novoJogo(caso, 'desafio');
    palpite = ok(E.concluir(E.atualizarRelatorio(palpite, { mecanismo: 'mec-fadiga', causa: 'causa-trinca-fabricacao' })));
    let honesto = E.novoJogo(caso, 'desafio');
    honesto = ok(E.concluir(E.atualizarRelatorio(honesto, { mecanismo: INSUFICIENTE, causa: INSUFICIENTE })));
    expect(nota(avaliar(caso, honesto), 'coerencia')).toBeGreaterThan(nota(avaliar(caso, palpite), 'coerencia'));
  });

  it('"dados insuficientes" com os dados em mãos é penalizado', () => {
    const completa = investigacaoCompleta();
    const e = { ...completa, relatorio: { ...completa.relatorio, mecanismo: INSUFICIENTE } };
    expect(nota(avaliar(caso, e), 'coerencia')).toBeLessThan(nota(avaliar(caso, completa), 'coerencia'));
  });

  it('interpretar um artefato como defeito real penaliza o reconhecimento de limitações', () => {
    let e = E.novoJogo(caso, 'desafio');
    let am: string, p: string, m: string;
    [e, am] = passo(E.cortarAmostra(caso, e, { orientacao: 'transversal', x: 0, y: 45 }));
    [e, p] = passo(E.prepararAmostra(caso, e, { amostraId: am, lixamento: 'lixa-220', polimento: 'diamante-6', ataque: 'nital-5s' }));
    [e, m] = passo(E.registrarMicrografia(caso, e, { preparoId: p, ampliacao: 100, centro: { u: -18, v: 6 } }));
    const base = E.atualizarRelatorio(e, { mecanismo: INSUFICIENTE, causa: INSUFICIENTE });
    const [errado] = registrar(base, m, 'art-arrancamento', 'porosidade', { 'causa-descontinuidade-interna': 'apoia' });
    const [certo] = registrar(base, m, 'art-arrancamento', 'arrancamento', {});
    const rErrado = avaliar(caso, ok(E.concluir(errado)));
    const rCerto = avaliar(caso, ok(E.concluir(certo)));
    expect(rErrado.porEvidencia[errado.evidencias[0].id].artefatoMalInterpretado).toBe(true);
    expect(nota(rErrado, 'limitacoes')).toBeLessThan(nota(rCerto, 'limitacoes'));
    expect(nota(rErrado, 'coerencia')).toBeLessThan(nota(rCerto, 'coerencia'));
  });

  it('afirmar que a dureza prova fragilidade é tratado como exagero', () => {
    const completa = investigacaoCompleta();
    const ev = completa.evidencias.find((x) => x.achadoId === 'hv-pico-acabamento')!;
    const exagerada = E.atualizarEvidencia({ ...completa, concluido: false }, ev.id, { interpretacaoId: 'prova-fragil' });
    expect(nota(avaliar(caso, exagerada), 'limitacoes')).toBeLessThan(nota(avaliar(caso, completa), 'limitacoes'));
  });

  it('gastar pouco sem obter as evidências-chave não é premiado', () => {
    let e = E.novoJogo(caso, 'desafio');
    let v: string;
    [e, v] = passo(E.registrarVisual(caso, e, { superficie: 'fratura-A', vista: 'geral', iluminacao: 'rasante' }));
    void v;
    e = ok(E.concluir(E.atualizarRelatorio(e, { mecanismo: 'mec-fadiga', causa: INSUFICIENTE })));
    const r = avaliar(caso, e);
    expect(nota(r, 'recursos')).toBeLessThan(nota(avaliar(caso, investigacaoCompleta()), 'recursos'));
  });

  it('vincular evidência comprometida como apoio é penalizado', () => {
    let e = E.novoJogo(caso, 'desafio');
    let am: string, p: string, m: string;
    [e, am] = passo(E.cortarAmostra(caso, e, { orientacao: 'transversal', x: 0, y: 45 }));
    [e, p] = passo(E.prepararAmostra(caso, e, { amostraId: am, lixamento: 'lixa-1200', polimento: 'diamante-6-1', ataque: 'nital-30s' }));
    [e, m] = passo(E.registrarMicrografia(caso, e, { preparoId: p, ampliacao: 500, centro: { u: -18, v: 6 } }));
    const base = E.atualizarRelatorio(e, { mecanismo: INSUFICIENTE, causa: INSUFICIENTE });
    const [forte] = registrar(base, m, 'mg-mb-perlita', 'medio-c', { 'fator-material': 'apoia' });
    const [cauteloso] = registrar(base, m, 'mg-mb-perlita', 'nao-estimar', { 'fator-material': 'inconclusiva' });
    expect(nota(avaliar(caso, forte), 'limitacoes')).toBeLessThan(nota(avaliar(caso, cauteloso), 'limitacoes'));
  });
});
