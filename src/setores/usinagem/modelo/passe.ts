// Simulação de um passe de torneamento cilíndrico externo longitudinal.
// Função pura: mesmo estado + mesmos parâmetros → mesmo resultado (sem aleatoriedade).

import {
  diametroProgramado,
  reducaoDiametral,
  taxaRemocao,
  tempoCorte,
  velocidadeAvanco,
  velocidadeCorte,
  volumeAnel,
} from './cinematica';
import {
  componentesRa,
  deflexaoRadial,
  desgasteRadial,
  forcaCorte,
  indiceCarga,
  nivelCarga,
  razaoPassiva,
  vbDeDano,
} from './fenomenos';
import { DZ, celulasAte, centroCelula, copiarPeca, extremosEntre, furoMaximoEntre, type Peca } from './peca';
import type {
  ComponentesRa,
  FerramentaTornear,
  Maquina,
  Material,
  NivelCarga,
  ParametrosPasse,
  ResultadoCavaco,
} from './tipos';

/** Recuo radial adicional da ponta depois de um lascamento [mm] (sintético). */
export const RECUO_LASCAMENTO = 0.03;

export interface EstadoAresta {
  dano: number; // fração de vida consumida (soma de Δt/T)
  lascada: boolean;
  tempoCorte: number; // min em contato
  /** Recuo radial da ponta no último tangenciamento (zeragem do corretor) [mm]. */
  recuoReferencia: number;
}

export const arestaNova = (): EstadoAresta => ({ dano: 0, lascada: false, tempoCorte: 0, recuoReferencia: 0 });

/** Recuo radial da ponta por desgaste e lascamento, desde que a aresta era nova [mm]. */
export function recuoDaPonta(aresta: Pick<EstadoAresta, 'dano' | 'lascada'>, ferramenta: FerramentaTornear): number {
  return (
    desgasteRadial(vbDeDano(aresta.dano, ferramenta), ferramenta) +
    (aresta.lascada ? RECUO_LASCAMENTO : 0)
  );
}

export interface AmbienteCorte {
  material: Material;
  ferramenta: FerramentaTornear;
  maquina: Maquina;
}

export interface ProblemaParametro {
  campo: keyof ParametrosPasse | 'geral';
  mensagem: string;
}

export function comprimentoMaximo(peca: Peca, maquina: Maquina): number {
  return peca.balanco - maquina.folgaCastanhas;
}

export function limiteAp(amb: AmbienteCorte): number {
  return Math.min(amb.maquina.profundidade.max, amb.ferramenta.apMax);
}

/** Limites físicos e geométricos. Não julga a qualidade do resultado. */
export function verificarParametros(
  peca: Peca,
  p: ParametrosPasse,
  amb: AmbienteCorte,
): ProblemaParametro[] {
  const { maquina } = amb;
  const erros: ProblemaParametro[] = [];
  const finito = [p.n, p.f, p.ap, p.L].every(Number.isFinite);
  if (!finito) return [{ campo: 'geral', mensagem: 'Preencha todos os campos com números.' }];
  if (p.n < maquina.rotacao.min || p.n > maquina.rotacao.max) {
    erros.push({
      campo: 'n',
      mensagem: `A rotação deve ficar entre ${maquina.rotacao.min} e ${maquina.rotacao.max} rpm (limite do torno).`,
    });
  }
  if (p.f < maquina.avanco.min || p.f > maquina.avanco.max) {
    erros.push({
      campo: 'f',
      mensagem: `O avanço deve ficar entre ${String(maquina.avanco.min).replace(".", ",")} e ${String(maquina.avanco.max).replace(".", ",")} mm/volta (caixa de avanços).`,
    });
  }
  const apMax = limiteAp(amb);
  if (p.ap < 0 || p.ap > apMax) {
    erros.push({
      campo: 'ap',
      mensagem: `A profundidade radial deve ficar entre 0 e ${apMax.toFixed(2).replace(".", ",")} mm (limite do inserto).`,
    });
  }
  const lMax = comprimentoMaximo(peca, maquina);
  if (p.L <= 0 || p.L > lMax) {
    erros.push({
      campo: 'L',
      mensagem: `O comprimento deve ficar entre 0 e ${lMax.toFixed(1).replace(".", ",")} mm. Acima disso, a ferramenta colide com as castanhas.`,
    });
  }
  const dprog = diametroProgramado(peca.dref, p.ap);
  if (dprog < maquina.diametroMinimo) {
    erros.push({
      campo: 'ap',
      mensagem: `O diâmetro programado (${dprog.toFixed(2).replace(".", ",")} mm) fica abaixo do mínimo de ${maquina.diametroMinimo} mm.`,
    });
  }
  const furo = p.L > 0 ? furoMaximoEntre(peca, 0, Math.min(p.L, peca.balanco)) : 0;
  if (furo > 0 && dprog < furo + 2 * maquina.paredeMinima) {
    erros.push({
      campo: 'ap',
      mensagem: `Com Ø ${dprog.toFixed(2).replace(".", ",")} mm, a parede até o furo de Ø ${furo.toFixed(2).replace(".", ",")} mm ficaria abaixo de ${String(maquina.paredeMinima).replace(".", ",")} mm: a ferramenta romperia a parede.`,
    });
  }
  return erros;
}

/** Previsão puramente geométrica do passe (sem rugosidade, deflexão ou desgaste). */
export interface PrevisaoGeometrica {
  dref: number;
  dprog: number;
  reducaoDiametral: number;
  vcExterna: number; // m/min no maior diâmetro atual da região
  vcUsinada: number; // m/min no diâmetro programado
  vf: number;
  percurso: number;
  tc: number;
  volumeNominal: number; // mm³, supondo corte exatamente no diâmetro programado
  diametroAtualMax: number;
  passeEmVazio: boolean;
}

export function preverPasse(peca: Peca, p: ParametrosPasse, amb: AmbienteCorte): PrevisaoGeometrica {
  const dprog = diametroProgramado(peca.dref, p.ap);
  const n = celulasAte(peca, p.L);
  const dMax = n > 0 ? extremosEntre(peca, 0, p.L).max : peca.dref;
  const vf = velocidadeAvanco(p.f, p.n);
  const percurso = p.L + amb.maquina.aproximacao;
  let volume = 0;
  for (let i = 0; i < n; i++) {
    const d0 = peca.diametros[i];
    if (d0 > dprog) volume += volumeAnel(d0, dprog, DZ);
  }
  return {
    dref: peca.dref,
    dprog,
    reducaoDiametral: reducaoDiametral(p.ap),
    vcExterna: velocidadeCorte(dMax, p.n),
    vcUsinada: velocidadeCorte(dprog, p.n),
    vf,
    percurso,
    tc: tempoCorte(percurso, vf),
    volumeNominal: volume,
    diametroAtualMax: dMax,
    passeEmVazio: dMax <= dprog,
  };
}

/** Dados de cada célula percorrida pelo passe (usados na animação, inspeção e análise). */
export interface CelulaPasse {
  dAntes: number;
  dDepois: number;
  contato: boolean;
  apEfetiva: number; // mm
  deflexao: number; // mm (radial)
  recuo: number; // mm (radial, desgaste/lascamento relativo ao tangenciamento)
  vb: number; // mm
  carga: number; // índice adimensional
  cortouCasca: boolean;
  ra: ComponentesRa | null;
}

export interface ResultadoPasse {
  params: ParametrosPasse;
  previsao: PrevisaoGeometrica;
  vcModelo: number; // vc no diâmetro usinado, usada pelos fenômenos
  vidaReferencia: number; // min, T(vc, f) sintético
  celulas: CelulaPasse[];
  tempoContato: number; // min
  volume: number; // mm³ removidos de fato
  taxaRemocaoTeorica: number; // cm³/min
  danoInicial: number;
  danoFinal: number;
  vbInicial: number;
  vbFinal: number;
  lascadaInicial: boolean;
  lascouEm: number | null; // z [mm]
  cargaMax: number;
  nivelCargaMax: NivelCarga;
  cavaco: ResultadoCavaco;
  apEfetivaMax: number;
  cortouCasca: boolean;
}

export interface SaidaPasse {
  resultado: ResultadoPasse;
  peca: Peca;
  aresta: EstadoAresta;
}

export function simularPasse(
  pecaEntrada: Peca,
  arestaEntrada: EstadoAresta,
  p: ParametrosPasse,
  amb: AmbienteCorte,
  numeroPasse: number,
): SaidaPasse {
  const { material, ferramenta, maquina } = amb;
  const peca = copiarPeca(pecaEntrada);
  const previsao = preverPasse(pecaEntrada, p, amb);
  const { dprog, vf } = previsao;
  const vc = previsao.vcUsinada;
  const T = material.comportamento.vidaAresta(vc, p.f, ferramenta.classe);
  const n = celulasAte(peca, p.L);
  const dt = DZ / vf; // min por célula

  let dano = arestaEntrada.dano;
  let lascada = arestaEntrada.lascada;
  let lascouEm: number | null = null;
  let tempoContato = 0;
  let volume = 0;
  let cargaMax = 0;
  let apEfetivaMax = 0;
  let cortouCasca = false;
  const celulas: CelulaPasse[] = [];

  for (let i = 0; i < n; i++) {
    const z = centroCelula(i);
    const dAntes = peca.diametros[i];
    const vb = vbDeDano(dano, ferramenta);
    const recuo = recuoDaPonta({ dano, lascada }, ferramenta) - arestaEntrada.recuoReferencia;
    // Profundidade que a ponta encontraria sem deflexão.
    const apNominal = (dAntes - dprog) / 2 - recuo;
    if (apNominal <= 0) {
      celulas.push({
        dAntes,
        dDepois: dAntes,
        contato: false,
        apEfetiva: 0,
        deflexao: 0,
        recuo,
        vb,
        carga: 0,
        cortouCasca: false,
        ra: null,
      });
      continue;
    }
    const fc = forcaCorte(apNominal, p.f, material, ferramenta);
    const carga = indiceCarga(fc, ferramenta, vb);
    if (carga >= 1 && !lascada) {
      lascada = true;
      lascouEm = z;
      dano = Math.max(dano, 1);
    }
    const fp = fc * razaoPassiva(apNominal, ferramenta);
    const deflexao = deflexaoRadial(
      fp,
      peca.balanco - z,
      dAntes,
      maquina.rigidezSistema,
      material.comportamento.moduloElasticidade,
      peca.furo[i],
    );
    const recuoAtual = recuoDaPonta({ dano, lascada }, ferramenta) - arestaEntrada.recuoReferencia;
    const dCorte = dprog + 2 * (recuoAtual + deflexao);
    const dDepois = Math.min(dAntes, dCorte);
    const apEfetiva = (dAntes - dDepois) / 2;
    if (apEfetiva <= 0) {
      celulas.push({
        dAntes,
        dDepois: dAntes,
        contato: false,
        apEfetiva: 0,
        deflexao: 0,
        recuo: recuoAtual,
        vb: vbDeDano(dano, ferramenta),
        carga: 0,
        cortouCasca: false,
        ra: null,
      });
      continue;
    }
    const naCasca = peca.origem[i] === -1 && material.casca !== undefined;
    const fator = naCasca ? material.comportamento.fatorCasca(apEfetiva) : 1;
    dano += (dt / T) * fator;
    tempoContato += dt;
    const vbDepois = vbDeDano(dano, ferramenta);
    const ra = componentesRa(p.f, vc, vbDepois, apEfetiva, lascada, material, ferramenta);

    peca.diametros[i] = dDepois;
    peca.origem[i] = numeroPasse;
    peca.ra[i] = ra.total;
    volume += volumeAnel(dAntes, dDepois, DZ);
    cargaMax = Math.max(cargaMax, carga);
    apEfetivaMax = Math.max(apEfetivaMax, apEfetiva);
    cortouCasca ||= naCasca;
    celulas.push({
      dAntes,
      dDepois,
      contato: true,
      apEfetiva,
      deflexao,
      recuo: recuoAtual,
      vb: vbDepois,
      carga,
      cortouCasca: naCasca,
      ra,
    });
  }

  peca.dref = dprog;
  const aresta: EstadoAresta = {
    ...arestaEntrada,
    dano,
    lascada,
    tempoCorte: arestaEntrada.tempoCorte + tempoContato,
  };
  const cavaco = material.comportamento.classificarCavaco({
    vc,
    f: p.f,
    ap: apEfetivaMax,
    janelaQuebra: ferramenta.quebraCavaco,
    furacao: false,
  });

  return {
    peca,
    aresta,
    resultado: {
      params: { ...p },
      previsao,
      vcModelo: vc,
      vidaReferencia: T,
      celulas,
      tempoContato,
      volume,
      taxaRemocaoTeorica: taxaRemocao(vc, apEfetivaMax, p.f),
      danoInicial: arestaEntrada.dano,
      danoFinal: dano,
      vbInicial: vbDeDano(arestaEntrada.dano, ferramenta),
      vbFinal: vbDeDano(dano, ferramenta),
      lascadaInicial: arestaEntrada.lascada,
      lascouEm,
      cargaMax,
      nivelCargaMax: nivelCarga(cargaMax),
      cavaco,
      apEfetivaMax,
      cortouCasca,
    },
  };
}
