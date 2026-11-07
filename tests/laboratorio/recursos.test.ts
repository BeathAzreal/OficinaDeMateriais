import { describe, expect, it } from 'vitest';
import * as E from '../../src/setores/laboratorio/motor/estado';
import { CUSTOS, gastoTotal, saldo, custoPerfil } from '../../src/setores/laboratorio/motor/recursos';
import { caso, ok, passo } from './auxiliar';

describe('consumo de recursos', () => {
  it('cobra cada etapa uma única vez e acumula orçamento e tempo', () => {
    let e = E.novoJogo(caso, 'desafio');
    e = ok(E.solicitarDocumento(caso, e, 'certificado'));
    expect(gastoTotal(e)).toEqual({ reais: 0, horas: CUSTOS.documento.horas });
    e = ok(E.limparSuperficie(caso, e, 'fratura-A', 'suave'));
    e = ok(E.registrarVisual(caso, e, { superficie: 'fratura-A', vista: 'geral', iluminacao: 'rasante' }));
    const esperado = CUSTOS.documento.reais + CUSTOS.limpeza.suave.reais + CUSTOS.visual.geral.reais;
    expect(gastoTotal(e).reais).toBe(esperado);
    expect(gastoTotal(e).horas).toBeCloseTo(CUSTOS.documento.horas + CUSTOS.limpeza.suave.horas + CUSTOS.visual.geral.horas);
  });

  it('não cobra o mesmo documento duas vezes', () => {
    let e = E.novoJogo(caso, 'desafio');
    e = ok(E.solicitarDocumento(caso, e, 'certificado'));
    const r = E.solicitarDocumento(caso, e, 'certificado');
    expect(r.ok).toBe(false);
    expect(gastoTotal(e).horas).toBe(CUSTOS.documento.horas);
  });

  it('bloqueia ações quando o orçamento acaba, sem alterar o estado', () => {
    let e = E.novoJogo(caso, 'desafio');
    // cortes até esgotar o orçamento
    const ys = [6, 16, 26, 36, 46, 56, 66, 76];
    const xs = [-150, -100, -50, 0, 50, 100, 150];
    let bloqueou = false;
    outer: for (const x of xs) {
      for (const y of ys) {
        const r = E.cortarAmostra(caso, e, { orientacao: 'transversal', x, y });
        if (!r.ok) {
          if (/insuficiente/.test(r.erro)) {
            bloqueou = true;
            break outer;
          }
          continue;
        }
        e = r.estado;
      }
    }
    expect(bloqueou).toBe(true);
    const s = saldo(e, caso.publico.recursos);
    expect(s.reais).toBeGreaterThanOrEqual(0);
    expect(s.horas).toBeGreaterThanOrEqual(0);
  });

  it('cobra o perfil pelo número de pontos efetivamente medidos (pontos fora da amostra não custam)', () => {
    let e = E.novoJogo(caso, 'desafio');
    let am: string;
    [e, am] = passo(E.cortarAmostra(caso, e, { orientacao: 'transversal', x: 0, y: 45 }));
    let prep: string;
    [e, prep] = passo(E.prepararAmostra(caso, e, { amostraId: am, lixamento: 'lixa-1200', polimento: 'diamante-6-1', ataque: 'nital-5s' }));
    const antes = gastoTotal(e).reais;
    const pontos = [
      { u: -15, v: 6 },
      { u: -10, v: 6 },
      { u: -5, v: 6 },
      { u: -15, v: 30 }, // fora da amostra
    ];
    e = ok(E.registrarPerfil(caso, e, { preparoId: prep, carga: 'HV0.5', pontos }));
    expect(gastoTotal(e).reais - antes).toBe(custoPerfil(3).reais);
  });

  it('limpeza agressiva é irreversível', () => {
    let e = E.novoJogo(caso, 'desafio');
    e = ok(E.limparSuperficie(caso, e, 'fratura-B', 'agressiva'));
    expect(E.limparSuperficie(caso, e, 'fratura-B', 'suave').ok).toBe(false);
  });

  it('não permite cortar onde o material já foi removido', () => {
    let e = E.novoJogo(caso, 'desafio');
    e = ok(E.cortarAmostra(caso, e, { orientacao: 'transversal', x: 0, y: 22 }));
    const r = E.cortarAmostra(caso, e, { orientacao: 'transversal', x: 0, y: 25 });
    expect(r.ok).toBe(false);
  });

  it('após concluir, nenhuma ação de ensaio é aceita', () => {
    let e = E.novoJogo(caso, 'desafio');
    e = E.atualizarRelatorio(e, { mecanismo: 'dados-insuficientes', causa: 'dados-insuficientes' });
    e = ok(E.concluir(e));
    expect(E.registrarVisual(caso, e, { superficie: 'fratura-A', vista: 'geral', iluminacao: 'difusa' }).ok).toBe(false);
  });
});
