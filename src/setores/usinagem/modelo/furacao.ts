// Furação axial no torno: broca parada na torre, peça girando.
// Função pura e determinística, como o passe de torneamento.

import { tempoCorte, velocidadeAvanco, velocidadeCorte, volumeAnel } from './cinematica';
import { energiaEspecifica, enfraquecimento, nivelCarga, vbDeDano } from './fenomenos';
import { DZ, celulaEm, celulasAte, centroCelula, copiarPeca, extremosEntre, type Peca } from './peca';
import type { EstadoAresta } from './passe';
import type { Broca, Maquina, Material, NivelCarga, ParametrosFuracao, ResultadoCavaco } from './tipos';

export interface AmbienteFuracao {
  material: Material;
  broca: Broca;
  maquina: Maquina;
}

/** Fração do diâmetro ocupada pelo gume transversal (centro da broca), sintética. */
export const FRACAO_GUME_TRANSVERSAL = 0.18;
/** Relação profundidade/diâmetro a partir da qual o cavaco começa a entupir o canal (sintética). */
export const LD_ENTUPIMENTO = 3;

const rad = (g: number) => (g * Math.PI) / 180;
const br = (v: number, c = 2) => v.toFixed(c).replace('.', ',');

/** Comprimento da ponta cônica: lp = (d/2)/tan(σ/2) — relação geométrica exata. */
export function comprimentoPonta(broca: Broca): number {
  return broca.diametro / 2 / Math.tan(rad(broca.anguloPonta / 2));
}

export interface ProblemaFuracao {
  campo: keyof ParametrosFuracao | 'geral';
  mensagem: string;
}

export function verificarFuracao(peca: Peca, p: ParametrosFuracao, amb: AmbienteFuracao): ProblemaFuracao[] {
  const { maquina, broca } = amb;
  if (![p.n, p.f, p.P, p.q].every(Number.isFinite)) return [{ campo: 'geral', mensagem: 'Preencha todos os campos com números.' }];
  const erros: ProblemaFuracao[] = [];
  if (p.n < maquina.rotacao.min || p.n > maquina.rotacao.max)
    erros.push({ campo: 'n', mensagem: `A rotação deve ficar entre ${maquina.rotacao.min} e ${maquina.rotacao.max} rpm.` });
  if (p.f < maquina.avanco.min || p.f > maquina.avanco.max)
    erros.push({ campo: 'f', mensagem: `O avanço deve ficar entre ${br(maquina.avanco.min)} e ${br(maquina.avanco.max)} mm/volta.` });
  const lp = comprimentoPonta(broca);
  const fundo = p.P + lp;
  if (p.P <= 0) erros.push({ campo: 'P', mensagem: 'A profundidade precisa ser maior que zero.' });
  else if (fundo > broca.comprimentoUtil)
    erros.push({ campo: 'P', mensagem: `Com a ponta (${br(lp, 1)} mm), o furo passaria do canal útil da broca (${broca.comprimentoUtil} mm).` });
  else if (fundo > peca.balanco - maquina.folgaCastanhas)
    erros.push({ campo: 'P', mensagem: `O furo entraria na região presa pela placa (máximo ${br(peca.balanco - maquina.folgaCastanhas - lp, 1)} mm de diâmetro pleno).` });
  if (p.q < 0 || (p.q > 0 && p.q < 0.5)) erros.push({ campo: 'q', mensagem: 'O pica-pau deve ser 0 (contínuo) ou pelo menos 0,5 mm.' });
  if (p.P > 0 && fundo <= peca.balanco) {
    const dExt = extremosEntre(peca, 0, Math.min(fundo, peca.balanco)).min;
    if (broca.diametro + 2 * maquina.paredeMinima > dExt)
      erros.push({ campo: 'geral', mensagem: `A broca Ø ${br(broca.diametro, 1)} deixaria parede menor que ${br(maquina.paredeMinima, 1)} mm no Ø externo de ${br(dExt)} mm.` });
  }
  return erros;
}

export interface SegmentoMovimento {
  t0: number; // min
  t1: number;
  z0: number; // posição da ponta (mm; negativo fora da peça)
  z1: number;
  corte: boolean;
}

export interface PrevisaoFuracao {
  vc: number; // m/min na periferia da broca
  vf: number; // mm/min
  lp: number; // mm
  fundo: number; // mm, profundidade da ponta
  descargas: number;
  percurso: number; // mm em avanço
  tc: number; // min, avanço + descargas
  segmentos: SegmentoMovimento[];
  volumeNominal: number; // mm³
}

export function preverFuracao(peca: Peca, p: ParametrosFuracao, amb: AmbienteFuracao): PrevisaoFuracao {
  const { broca, maquina } = amb;
  const lp = comprimentoPonta(broca);
  const fundo = p.P + lp;
  const vf = velocidadeAvanco(p.f, p.n);
  const ap = maquina.aproximacao;
  const segmentos: SegmentoMovimento[] = [];
  let t = 0;
  let z = -ap;
  const avancar = (alvo: number) => {
    const dt = tempoCorte(alvo - z, vf);
    segmentos.push({ t0: t, t1: t + dt, z0: z, z1: alvo, corte: true });
    t += dt;
    z = alvo;
  };
  const paradas: number[] = [];
  if (p.q > 0) for (let k = p.q; k < fundo - 1e-9; k += p.q) paradas.push(k);
  let percurso = 0;
  for (const parada of paradas) {
    percurso += parada - z;
    avancar(parada);
    const meia = maquina.tempoDescarga / 2;
    segmentos.push({ t0: t, t1: t + meia, z0: z, z1: -ap, corte: false });
    t += meia;
    const volta = Math.max(-ap, parada - 0.5);
    segmentos.push({ t0: t, t1: t + meia, z0: -ap, z1: volta, corte: false });
    t += meia;
    z = volta;
  }
  percurso += fundo - z;
  avancar(fundo);
  let volume = 0;
  const n = celulasAte(peca, fundo);
  for (let i = 0; i < n; i++) {
    const zc = centroCelula(i);
    const dLocal = zc < p.P ? broca.diametro : broca.diametro * (1 - (zc - p.P) / lp);
    if (dLocal > peca.furo[i]) volume += volumeAnel(dLocal, peca.furo[i], DZ);
  }
  return {
    vc: velocidadeCorte(broca.diametro, p.n),
    vf,
    lp,
    fundo,
    descargas: paradas.length,
    percurso,
    tc: t,
    segmentos,
    volumeNominal: volume,
  };
}

export interface PassoFuracao {
  z: number; // posição da ponta
  contato: boolean;
  torque: number; // N·m (interno; exibido só como índice)
  avanco: number; // N (interno)
  entupimento: number; // fator ≥ 1
  carga: number; // índice adimensional
  vb: number;
}

/** Instante em que a ponta, avançando, chega à profundidade z pela primeira vez [min]. */
export function tempoAte(previsao: PrevisaoFuracao, z: number): number {
  for (const s of previsao.segmentos) {
    if (s.corte && s.z1 >= z - 1e-9 && s.z0 <= z + 1e-9) {
      return s.t0 + ((z - s.z0) / Math.max(s.z1 - s.z0, 1e-9)) * (s.t1 - s.t0);
    }
  }
  return previsao.tc;
}

export interface ResultadoFuracao {
  params: ParametrosFuracao;
  /** Duração real da operação [min]: menor que a prevista se a broca quebrou. */
  tcEfetivo: number;
  previsao: PrevisaoFuracao;
  vcModelo: number;
  vidaReferencia: number;
  passos: PassoFuracao[];
  tempoContato: number;
  volume: number;
  danoInicial: number;
  danoFinal: number;
  vbInicial: number;
  vbFinal: number;
  quebrouEm: number | null; // z da ponta
  cargaMax: number;
  nivelCargaMax: NivelCarga;
  entupimentoMax: number;
  gumeTransversalCortou: boolean;
  cavaco: ResultadoCavaco;
  diametroFuro: number; // mm, na entrada (modelo)
  raFuro: number; // µm (estimativa sintética)
  profundidadeAlcancada: number; // mm de diâmetro pleno
}

export interface SaidaFuracao {
  resultado: ResultadoFuracao;
  peca: Peca;
  aresta: EstadoAresta;
}

export function simularFuracao(
  pecaEntrada: Peca,
  arestaEntrada: EstadoAresta,
  p: ParametrosFuracao,
  amb: AmbienteFuracao,
): SaidaFuracao {
  const { material, broca } = amb;
  const peca = copiarPeca(pecaEntrada);
  const previsao = preverFuracao(pecaEntrada, p, amb);
  const { lp, fundo, vf } = previsao;
  const d = broca.diametro;
  const vc = previsao.vc;
  const T = material.comportamento.vidaAresta(vc, p.f, broca.classe);
  const h = (p.f / 2) * Math.sin(rad(broca.anguloPonta / 2));
  const kc = energiaEspecifica(h, material);
  const dt = DZ / vf;
  const tanMeio = Math.tan(rad(broca.anguloPonta / 2));
  const paradas: number[] = [];
  if (p.q > 0) for (let k = p.q; k < fundo - 1e-9; k += p.q) paradas.push(k);

  let dano = arestaEntrada.dano;
  let quebrada = arestaEntrada.lascada;
  let quebrouEm: number | null = null;
  let tempoContato = 0;
  let cargaMax = 0;
  let entupimentoMax = 1;
  let gumeTransversalCortou = false;
  let wMax = 0;
  const passos: PassoFuracao[] = [];
  const vbEm: number[] = []; // VB quando a margem passou por cada célula
  let alcance = fundo;

  const nPassos = Math.max(1, Math.round(fundo / DZ));
  for (let k = 1; k <= nPassos; k++) {
    const zt = k * DZ;
    const d0 = pecaEntrada.furo[celulaEm(pecaEntrada, Math.max(0, zt - DZ / 2))];
    const dEng = Math.min(d, 2 * zt * tanMeio);
    const w = Math.max(0, (dEng - d0) / 2);
    const vb = vbDeDano(dano, broca);
    if (w <= 0) {
      passos.push({ z: zt, contato: false, torque: 0, avanco: 0, entupimento: 1, carga: 0, vb });
      vbEm.push(vb);
      continue;
    }
    const fcAresta = kc * w * (p.f / 2);
    const torque = (2 * fcAresta * ((dEng + d0) / 4)) / 1000;
    const transversal = d0 < FRACAO_GUME_TRANSVERSAL * d;
    gumeTransversalCortou ||= transversal;
    const avanco = fcAresta + (transversal ? 0.6 * kc * p.f * FRACAO_GUME_TRANSVERSAL * d : 0);
    const ultimaDescarga = paradas.filter((q) => q <= zt + 1e-9).pop() ?? 0;
    const entupimento = 1 + 0.5 * Math.max(0, (zt - ultimaDescarga) / d - LD_ENTUPIMENTO);
    const enf = enfraquecimento(vb, broca);
    const carga = Math.max(
      (torque * entupimento) / (broca.torqueLimite * enf),
      (avanco * entupimento) / (broca.forcaAvancoLimite * enf),
    );
    cargaMax = Math.max(cargaMax, carga);
    entupimentoMax = Math.max(entupimentoMax, entupimento);
    wMax = Math.max(wMax, w);
    dano += dt / T;
    tempoContato += dt;
    passos.push({ z: zt, contato: true, torque, avanco, entupimento, carga, vb: vbDeDano(dano, broca) });
    vbEm.push(vbDeDano(dano, broca));
    if (carga >= 1 && !quebrada) {
      quebrada = true;
      quebrouEm = zt;
      alcance = zt;
      break;
    }
  }

  // Geometria final do furo: cilindro (com sobremedida) até alcance − lp, cone depois.
  const pleno = Math.max(0, alcance - lp);
  let volume = 0;
  const n = celulasAte(peca, alcance);
  for (let i = 0; i < n; i++) {
    const zc = centroCelula(i);
    const passo = Math.min(vbEm.length - 1, Math.max(0, Math.round((zc + lp) / DZ) - 1));
    const vbLocal = vbEm[passo] ?? 0;
    const dNovo = zc < pleno ? d + broca.sobremedida + 0.2 * vbLocal : d * Math.max(0, 1 - (zc - pleno) / lp);
    if (dNovo > peca.furo[i]) {
      volume += volumeAnel(dNovo, peca.furo[i], DZ);
      peca.furo[i] = dNovo;
    }
  }

  const vbFinal = vbDeDano(dano, broca);
  const razaoVb = vbFinal / broca.vbLimite;
  // Ra da parede (sintética): referência da broca + parte da aresta postiça + desgaste.
  const raFuro = broca.raBase + 0.4 * material.comportamento.rugosidadeApc(vc) + razaoVb * razaoVb;
  const cavaco = material.comportamento.classificarCavaco({
    vc,
    f: p.f,
    ap: wMax,
    janelaQuebra: { fMin: broca.janelaCavaco.fMin, fMax: broca.janelaCavaco.fMax, apMin: 0, apMax: 999 },
    furacao: true,
  });

  return {
    peca,
    aresta: { ...arestaEntrada, dano, lascada: quebrada, tempoCorte: arestaEntrada.tempoCorte + tempoContato },
    resultado: {
      params: { ...p },
      tcEfetivo: quebrouEm !== null ? tempoAte(previsao, quebrouEm) : previsao.tc,
      previsao,
      vcModelo: vc,
      vidaReferencia: T,
      passos,
      tempoContato,
      volume,
      danoInicial: arestaEntrada.dano,
      danoFinal: dano,
      vbInicial: vbDeDano(arestaEntrada.dano, broca),
      vbFinal,
      quebrouEm,
      cargaMax,
      nivelCargaMax: nivelCarga(cargaMax),
      entupimentoMax,
      gumeTransversalCortou,
      cavaco,
      diametroFuro: peca.furo[0],
      raFuro,
      profundidadeAlcancada: pleno,
    },
  };
}
