import { describe, expect, it } from 'vitest';
import {
  diametroProgramado,
  profundidadeRadial,
  raGeometrico,
  reducaoDiametral,
  rotacaoPara,
  taxaRemocao,
  tempoCorte,
  velocidadeAvanco,
  velocidadeCorte,
  volumeAnel,
} from '../../src/setores/usinagem/modelo/cinematica';

describe('conversões e unidades', () => {
  it('vc = π·D·n/1000 em m/min com D em mm e n em rpm', () => {
    expect(velocidadeCorte(40, 1000)).toBeCloseTo(125.664, 3);
    expect(velocidadeCorte(1000 / Math.PI, 1)).toBeCloseTo(1, 12);
  });

  it('rotação e velocidade de corte são inversas para o mesmo diâmetro', () => {
    const n = rotacaoPara(200, 36);
    expect(velocidadeCorte(36, n)).toBeCloseTo(200, 10);
  });

  it('com rotação fixa, reduzir o diâmetro reduz vc proporcionalmente', () => {
    expect(velocidadeCorte(36, 1500) / velocidadeCorte(40, 1500)).toBeCloseTo(0.9, 12);
  });

  it('vf = f·n em mm/min', () => {
    expect(velocidadeAvanco(0.25, 1200)).toBeCloseTo(300, 12);
  });

  it('Q [cm³/min] = vc·ap·f e coincide com a conversão explícita de unidades', () => {
    const vc = 200; // m/min
    const ap = 1.5; // mm
    const f = 0.25; // mm
    const mm3PorMin = vc * 1000 * ap * f;
    expect(taxaRemocao(vc, ap, f)).toBeCloseTo(mm3PorMin / 1000, 12);
  });

  it('volume de anel em mm³', () => {
    expect(volumeAnel(40, 37, 50)).toBeCloseTo((Math.PI / 4) * (1600 - 1369) * 50, 9);
  });

  it('Ra geométrica f²/(32 rε) em µm', () => {
    expect(raGeometrico(0.2, 0.8)).toBeCloseTo(1.5625, 10);
    // dobrar o avanço quadruplica a parcela geométrica
    expect(raGeometrico(0.4, 0.8) / raGeometrico(0.2, 0.8)).toBeCloseTo(4, 12);
  });
});

describe('profundidade radial × redução diametral', () => {
  it('ΔD = 2·ap e ap = (D0 − D1)/2', () => {
    expect(reducaoDiametral(1.5)).toBe(3);
    expect(profundidadeRadial(40, 37)).toBe(1.5);
    expect(diametroProgramado(40, 1.5)).toBe(37);
  });
});

describe('tempo de corte', () => {
  it('tc = percurso / vf', () => {
    expect(tempoCorte(52, velocidadeAvanco(0.2, 1000))).toBeCloseTo(0.26, 12);
  });
  it('vf nula não gera tempo finito', () => {
    expect(tempoCorte(10, 0)).toBe(Infinity);
  });
});
