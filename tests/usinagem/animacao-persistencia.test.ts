import { describe, expect, it } from 'vitest';
import { quadroDoPasse, reproduzirAnimacao, VELOCIDADES } from '../../src/setores/usinagem/jogo/animacao';
import { carregar, CHAVE, reiniciarModo, salvar, salvoPadrao } from '../../src/setores/usinagem/jogo/persistencia';
import { reproduzir, pecaAtual, type RegistroPasse } from '../../src/setores/usinagem/jogo/partida';
import { calcularCustos } from '../../src/setores/usinagem/jogo/recursos';
import { ENC, PLANO_BOM, ctx, jogar, memoria, passe } from './auxiliar';

describe('animação não altera a física', () => {
  it('todas as velocidades terminam no mesmo quadro e no mesmo tempo calculado', () => {
    const e = jogar([passe({ n: 1300, f: 0.25 })]);
    const reg = e.passes[0];
    const finais = VELOCIDADES.map((v) => reproduzirAnimacao(reg, v, ctx.maquina.aproximacao));
    for (const f of finais) {
      expect(f.final).toEqual(finais[0].final);
      expect(f.final.concluido).toBe(true);
      expect(f.final.tSim).toBe(reg.previsao.tc);
    }
    // mais rápido = menos quadros, mesmo resultado
    expect(finais[VELOCIDADES.length - 1].quadros).toBeLessThan(finais[0].quadros);
  });

  it('o estado do jogo é calculado antes da animação e não depende dela', () => {
    const e1 = jogar([passe({})]);
    reproduzirAnimacao(e1.passes[0], 8, ctx.maquina.aproximacao);
    const e2 = jogar([passe({})]);
    expect(pecaAtual(e1).peca.diametros).toEqual(pecaAtual(e2).peca.diametros);
    expect(e1.tempos).toEqual(e2.tempos);
  });

  it('o quadro é função só do tempo simulado', () => {
    const r = jogar([passe({})]).passes[0] as RegistroPasse;
    const t = r.previsao.tc / 2;
    expect(quadroDoPasse(r, t, 2)).toEqual(quadroDoPasse(r, t, 2));
    expect(quadroDoPasse(r, 0, 2).celulasCortadas).toBe(0);
    expect(quadroDoPasse(r, r.previsao.tc, 2).celulasCortadas).toBe(r.celulas.length);
  });
});

describe('reinício e persistência', () => {
  it('salvar e carregar reconstrói a mesma partida', () => {
    const arm = memoria();
    const s = salvoPadrao();
    s.partidas.encomenda.acoes = PLANO_BOM;
    s.configuracoes.velocidade = 4;
    s.configuracoes.tutorialVisto = true;
    expect(salvar(arm, s)).toBe(true);
    const lido = carregar(arm);
    expect(lido.configuracoes).toEqual(s.configuracoes);
    const a = reproduzir('encomenda', ENC, s.partidas.encomenda.acoes).estado;
    const b = reproduzir('encomenda', ENC, lido.partidas.encomenda.acoes).estado;
    expect(pecaAtual(b).peca.diametros).toEqual(pecaAtual(a).peca.diametros);
    expect(calcularCustos(b)).toEqual(calcularCustos(a));
    expect(b.medicoes).toEqual(a.medicoes);
  });

  it('reiniciar limpa só o modo escolhido', () => {
    const s = salvoPadrao();
    s.partidas.encomenda.acoes = PLANO_BOM;
    s.partidas.laboratorio.acoes = [passe({})];
    s.configuracoes.tutorialVisto = true;
    const r = reiniciarModo(s, 'encomenda');
    expect(r.partidas.encomenda.acoes).toHaveLength(0);
    expect(r.partidas.laboratorio.acoes).toHaveLength(1);
    expect(r.configuracoes.tutorialVisto).toBe(true);
    const e = reproduzir('encomenda', ENC, r.partidas.encomenda.acoes).estado;
    expect(e.passes).toHaveLength(0);
    expect(pecaAtual(e).peca.diametros.every((d) => d === 40)).toBe(true);
  });

  it('dados corrompidos ou ausentes voltam ao padrão sem erro', () => {
    const arm = memoria();
    expect(carregar(arm)).toEqual(salvoPadrao());
    arm.setItem(CHAVE, '{não é json');
    expect(carregar(arm)).toEqual(salvoPadrao());
    arm.setItem(CHAVE, JSON.stringify({ versao: 1, partidas: { encomenda: { encomendaId: ENC, acoes: [{ tipo: 'hack' }, ...PLANO_BOM] } } }));
    expect(carregar(arm).partidas.encomenda.acoes).toHaveLength(PLANO_BOM.length);
    expect(carregar(null)).toEqual(salvoPadrao());
  });

  it('armazenamento que falha ao gravar não derruba o jogo', () => {
    const arm = { getItem: () => null, setItem: () => { throw new Error('cheio'); }, removeItem: () => {} };
    expect(salvar(arm, salvoPadrao())).toBe(false);
  });
});
