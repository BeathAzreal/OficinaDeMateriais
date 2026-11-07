import { describe, expect, it } from 'vitest';
import { aplicarAcao, iniciarPartida, reproduzir, pecaAtual, type RegistroPasse } from '../../src/setores/usinagem/jogo/partida';
import { avaliarDiametro, leitura, lerComprimentoUsinado } from '../../src/setores/usinagem/modelo/medicao';
import { calcularCustos } from '../../src/setores/usinagem/jogo/recursos';
import { compararPasses } from '../../src/setores/usinagem/jogo/comparacao';
import { ENC, PLANO_BOM, ctx, jogar, passe } from './auxiliar';

const enc = ctx.encomenda;

describe('avaliação das tolerâncias', () => {
  it('limites são inclusivos e o desvio é relativo ao nominal', () => {
    // Ø 36 (0/−0,05): o nominal é o limite superior
    expect(avaliarDiametro(36.0, enc).status).toBe('conforme');
    expect(avaliarDiametro(35.95, enc).status).toBe('conforme');
    expect(avaliarDiametro(36.01, enc).status).toBe('acima');
    expect(avaliarDiametro(35.94, enc).status).toBe('abaixo');
    expect(avaliarDiametro(35.98, enc).desvio).toBeCloseTo(-0.02, 9);
  });
  it('leitura no limite ou a uma resolução dele é marcada como perto do limite', () => {
    expect(avaliarDiametro(36.0, enc).pertoDoLimite).toBe(true);
    expect(avaliarDiametro(35.98, enc).pertoDoLimite).toBe(false);
  });
  it('a leitura arredonda à resolução sem ruído', () => {
    expect(leitura(36.0149, 0.01)).toBe(36.01);
    expect(leitura(36.0151, 0.01)).toBe(36.02);
    expect(leitura(36.0151, 0.01)).toBe(leitura(36.0151, 0.01));
  });
});

describe('missão completa', () => {
  it('o plano de referência entrega dentro das especificações', () => {
    let e = jogar(PLANO_BOM);
    const r = aplicarAcao(e, { tipo: 'entregar' });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    e = r.estado;
    const rel = e.entregas[0];
    expect(rel.conformeDimensoes).toBe(true);
    expect(rel.superficie.conforme).toBe(true);
    expect(rel.comprimento.leitura).toBeCloseTo(50, 1);
    expect(e.encerrada).toBe(true);
    // a pergunta tem uma resposta correta entre as opções e recebe feedback
    const correta = rel.pergunta.correta;
    expect(rel.pergunta.opcoes.map((o) => o.id)).toContain(correta);
    const resp = aplicarAcao(e, { tipo: 'responder', opcao: correta });
    expect(resp.ok).toBe(true);
    // depois de entregue, nada mais pode ser usinado
    if (resp.ok) expect(aplicarAcao(resp.estado, passe({})).ok).toBe(false);
  });

  it('passar a redução diametral como ap leva a refugo irreversível', () => {
    // O jogador quer ir de Ø 40 a Ø 37 (ΔD = 3) e digita ap = 3: 40 − 2·3 = 34.
    const e = jogar([passe({ ap: 3, f: 0.2 })]);
    const pj = pecaAtual(e);
    expect(pj.estado).toBe('refugo');
    expect(pj.motivosRefugo[0].tipo).toBe('abaixo-do-limite');
    expect(aplicarAcao(e, passe({ ap: 0.1 })).ok).toBe(false);
    const ent = aplicarAcao(e, { tipo: 'entregar' });
    if (!ent.ok) throw new Error(ent.erro);
    expect(ent.estado.entregas[0].pergunta.id).toBe('causa-refugo');
    expect(ent.estado.entregas[0].pergunta.correta).toBe('ap-diametral');
  });

  it('refugo exige um tarugo novo e preserva o histórico', () => {
    let e = jogar([passe({ ap: 2.1 })]);
    expect(pecaAtual(e).estado).toBe('refugo');
    const r = aplicarAcao(e, { tipo: 'novoTarugo' });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    e = r.estado;
    expect(e.pecas).toHaveLength(2);
    expect(e.pecas[0].estado).toBe('refugo');
    expect(e.passes).toHaveLength(1);
    expect(pecaAtual(e).peca.diametros.every((d) => d === 40)).toBe(true);
    // estoque da encomenda: 2 tarugos no total
    expect(aplicarAcao(e, { tipo: 'novoTarugo' }).ok).toBe(false);
  });

  it('usinar além do comprimento tolerado também é irreversível', () => {
    const e = jogar([passe({ ap: 1, L: 55 })]);
    expect(pecaAtual(e).motivosRefugo.map((m) => m.tipo)).toContain('regiao-bruta-usinada');
  });

  it('comprimento usinado lido no ressalto', () => {
    const e = jogar(PLANO_BOM);
    expect(lerComprimentoUsinado(pecaAtual(e).peca, enc)).toBe(50);
  });

  it('a decomposição do diâmetro na entrega soma o valor do modelo', () => {
    const r = aplicarAcao(jogar(PLANO_BOM), { tipo: 'entregar' });
    if (!r.ok) throw new Error(r.erro);
    const d = r.estado.entregas[0].decomposicao!;
    expect(d.nominal + d.programacao + d.deflexao + d.desgaste).toBeCloseTo(d.verdadeiro, 9);
  });

  it('custos somam tarugos, tempo de máquina e consumo de arestas', () => {
    const e = jogar(PLANO_BOM);
    const c = calcularCustos(e);
    expect(c.total).toBeCloseTo(c.tarugos + c.maquina + c.arestas, 9);
    expect(c.tarugos).toBe(enc.custos.tarugo);
    expect(c.total).toBeLessThan(enc.modoEncomenda.orcamento);
  });
});

describe('laboratório', () => {
  it('condições equivalentes reproduzem o estado de entrada do passe-base', () => {
    const e0 = jogar([passe({ n: 1300 }), { tipo: 'prepararEquivalente', passeBase: 1 }, passe({ n: 1300 })], 'laboratorio');
    const [a, b] = e0.passes as RegistroPasse[];
    expect(b.pecaAntes.diametros).toEqual(a.pecaAntes.diametros);
    expect(b.celulas.map((c) => c.dDepois)).toEqual(a.celulas.map((c) => c.dDepois));
    expect(compararPasses(a, b).parametrosDiferentes).toHaveLength(0);
  });

  it('mudar um parâmetro em condições equivalentes é atribuível; com diâmetro diferente não é', () => {
    const e = jogar(
      [passe({ n: 1300 }), { tipo: 'prepararEquivalente', passeBase: 1 }, passe({ n: 1800 }), passe({ n: 1800, ap: 0.5 })],
      'laboratorio',
    );
    const [p1, p2, p3] = e.passes;
    expect(compararPasses(p1, p2).atribuivel).toBe(true);
    const c = compararPasses(p2, p3);
    expect(c.atribuivel).toBe(false);
    expect(c.confusores.length).toBeGreaterThan(0);
  });

  it('o laboratório não limita o estoque', () => {
    let e = iniciarPartida('laboratorio', ENC);
    for (let i = 0; i < 5; i++) {
      const r = aplicarAcao(e, { tipo: 'novoTarugo' });
      expect(r.ok).toBe(true);
      if (r.ok) e = r.estado;
    }
  });
});

describe('reprodução', () => {
  it('reproduzir as mesmas ações dá o mesmo estado', () => {
    const a = reproduzir('encomenda', ENC, PLANO_BOM).estado;
    const b = reproduzir('encomenda', ENC, PLANO_BOM).estado;
    expect(pecaAtual(a).peca.diametros).toEqual(pecaAtual(b).peca.diametros);
    expect(a.tempos).toEqual(b.tempos);
  });
  it('ações inválidas são descartadas na reprodução', () => {
    const { aceitas } = reproduzir('encomenda', ENC, [passe({ L: 500 }), ...PLANO_BOM]);
    expect(aceitas).toHaveLength(PLANO_BOM.length);
  });
});
