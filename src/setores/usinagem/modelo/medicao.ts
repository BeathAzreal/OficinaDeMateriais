// Medição e verificação de tolerâncias. O diâmetro "verdadeiro" do modelo nunca é mostrado
// diretamente: o jogador vê a leitura do instrumento (arredondada à resolução).

import { DZ, celulaEm, extremosEntre, profundidadeFuro, type Peca } from './peca';
import type { Encomenda } from './tipos';

/** Leitura determinística: arredonda à resolução do instrumento (sem ruído sorteado). */
export function leitura(valor: number, resolucao: number): number {
  const passos = Math.round(valor / resolucao + 1e-9);
  return Number((passos * resolucao).toFixed(6));
}

export function lerDiametro(peca: Peca, z: number, enc: Encomenda): number {
  return leitura(peca.diametros[celulaEm(peca, z)], enc.instrumentos.micrometro.resolucao);
}

/** Diâmetro do furo (micrômetro interno), 0 se a seção é maciça. */
export function lerFuro(peca: Peca, z: number, enc: Encomenda): number {
  return leitura(peca.furo[celulaEm(peca, z)], enc.instrumentos.micrometro.resolucao);
}

/** Profundidade do diâmetro pleno do furo (paquímetro de profundidade). */
export function lerProfundidadeFuro(peca: Peca, enc: Encomenda): number {
  return leitura(profundidadeFuro(peca), enc.instrumentos.paquimetro.resolucao);
}

export function limitesDiametro(enc: Encomenda): { min: number; max: number } {
  const d = enc.requisitos.diametro;
  return { min: d.nominal + d.tolInf, max: d.nominal + d.tolSup };
}

export type StatusTolerancia = 'conforme' | 'acima' | 'abaixo';

export interface AvaliacaoDiametro {
  leitura: number;
  status: StatusTolerancia;
  desvio: number; // leitura − nominal
  /** Leitura a menos de uma incerteza do limite: a decisão é sensível à medição. */
  pertoDoLimite: boolean;
}

/** Regra de decisão: aceitação simples pela leitura, com aviso de proximidade do limite. */
export function avaliarDiametro(leituraMm: number, enc: Encomenda): AvaliacaoDiametro {
  const { min, max } = limitesDiametro(enc);
  const u = enc.instrumentos.micrometro.incerteza;
  const eps = 1e-9;
  const status: StatusTolerancia =
    leituraMm > max + eps ? 'acima' : leituraMm < min - eps ? 'abaixo' : 'conforme';
  const pertoDoLimite = Math.abs(leituraMm - max) < u - eps || Math.abs(leituraMm - min) < u - eps;
  return {
    leitura: leituraMm,
    status,
    desvio: Number((leituraMm - enc.requisitos.diametro.nominal).toFixed(6)),
    pertoDoLimite: pertoDoLimite || Math.abs(leituraMm - max) <= eps || Math.abs(leituraMm - min) <= eps,
  };
}

/** Degrau mínimo [mm, no diâmetro] que o paquímetro reconhece como ressalto. */
export const DEGRAU_RESSALTO = 0.1;

/**
 * Comprimento usinado medido com paquímetro: distância da face livre ao primeiro ressalto,
 * isto é, ao primeiro ponto onde o diâmetro sobe mais que DEGRAU_RESSALTO em relação à ponta.
 */
export function lerComprimentoUsinado(peca: Peca, enc: Encomenda): number {
  const base = peca.diametros[0];
  let i = 0;
  while (i < peca.diametros.length && peca.diametros[i] <= base + DEGRAU_RESSALTO) i++;
  if (i >= peca.diametros.length && base >= peca.diametroBruto) i = 0; // nada usinado
  return leitura(i * DZ, enc.instrumentos.paquimetro.resolucao);
}

/** Região funcional: onde o diâmetro final é exigido (exclui a faixa de tolerância do comprimento). */
export function regiaoFuncional(enc: Encomenda): [number, number] {
  const c = enc.requisitos.comprimento;
  return [0, c.nominal - c.tol];
}

/** Região que deve continuar bruta: além do limite superior do comprimento. */
export function inicioRegiaoBruta(enc: Encomenda): number {
  const c = enc.requisitos.comprimento;
  return c.nominal + c.tol;
}

const mmBr = (v: number, casas: number) => v.toFixed(casas).replace('.', ',');

export interface MotivoRefugo {
  tipo: 'abaixo-do-limite' | 'regiao-bruta-usinada';
  texto: string;
}

/** Defeitos irreversíveis: material removido não volta. */
export function verificarRefugo(peca: Peca, enc: Encomenda): MotivoRefugo[] {
  const motivos: MotivoRefugo[] = [];
  const [z0, z1] = regiaoFuncional(enc);
  const { min } = extremosEntre(peca, z0, z1);
  const leituraMin = leitura(min, enc.instrumentos.micrometro.resolucao);
  const lim = limitesDiametro(enc);
  if (leituraMin < lim.min - 1e-9) {
    motivos.push({
      tipo: 'abaixo-do-limite',
      texto: `Diâmetro de ${mmBr(leituraMin, 2)} mm na região funcional, abaixo do limite inferior de ${mmBr(lim.min, 2)} mm. O material removido não pode ser recuperado.`,
    });
  }
  const iBruta = Math.ceil(inicioRegiaoBruta(enc) / DZ);
  for (let i = iBruta; i < peca.origem.length; i++) {
    if (peca.origem[i] !== -1) {
      motivos.push({
        tipo: 'regiao-bruta-usinada',
        texto: `A ferramenta usinou além de ${mmBr(inicioRegiaoBruta(enc), 1)} mm, numa região que o desenho manda manter bruta.`,
      });
      break;
    }
  }
  return motivos;
}
