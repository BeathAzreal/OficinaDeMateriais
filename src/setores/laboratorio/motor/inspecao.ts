/**
 * Estação de inspeção visual e da superfície de fratura: modelo de aquisição.
 * Decide quais achados ficam visíveis conforme superfície, janela, luz e limpeza.
 */
import type { CasoDefinicao, Faixa, Iluminacao, Qualidade, SuperficieDef, VistaVisual } from '../casos/tipos';
import type { AchadoVisivel, AquisicaoVisual, EstadoJogo, Limitacao } from './tipos';
import { hashValores } from './rng';
import { faixasSobrepoem, retanguloFatia, xFraturaFace } from './geometria';
import { ARTEFATOS } from './interpretacoes';

/** Tamanho da janela do detalhe com estereoscópio (~10×), em mm. */
export const JANELA_DETALHE = { u: 16, v: 10 };

export interface PedidoVisual {
  superficie: string;
  vista: VistaVisual;
  centro?: { u: number; v: number };
  iluminacao: Iluminacao;
}

export function superficiePorId(caso: CasoDefinicao, id: string): SuperficieDef {
  const s = caso.publico.superficies.find((x) => x.id === id);
  if (!s) throw new Error(`Superfície desconhecida: ${id}`);
  return s;
}

export function janelaVisual(sup: SuperficieDef, vista: VistaVisual, centro?: { u: number; v: number }): { u: Faixa; v: Faixa } {
  if (vista === 'geral' || !centro) return { u: sup.eixoU.faixa, v: sup.eixoV.faixa };
  const hu = JANELA_DETALHE.u / 2;
  const hv = JANELA_DETALHE.v / 2;
  const [u0, u1] = sup.eixoU.faixa;
  const [v0, v1] = sup.eixoV.faixa;
  const cu = Math.min(Math.max(centro.u, u0 + hu), u1 - hu);
  const cv = v1 - v0 <= JANELA_DETALHE.v ? (v0 + v1) / 2 : Math.min(Math.max(centro.v, v0 + hv), v1 - hv);
  return { u: [cu - hu, cu + hu], v: [cv - hv, cv + hv] };
}

/** Regiões da superfície removidas pelos cortes já feitos. */
export function regioesRemovidas(caso: CasoDefinicao, estado: EstadoJogo, sup: SuperficieDef): AquisicaoVisual['removidos'] {
  const g = caso.verdade.geometria;
  const out: AquisicaoVisual['removidos'] = [];
  for (const a of estado.amostras) {
    const r = retanguloFatia(a);
    if (sup.tipo === 'fratura') {
      if (a.parte !== sup.parte || a.orientacao !== 'transversal') continue;
      const alcanca = a.parte === 'A' ? a.extensao[1] >= g.fratura.xPlano : a.extensao[0] <= xFraturaFace(g);
      if (alcanca) out.push({ u: r.y, v: [-50, 50], amostraId: a.id });
    } else {
      out.push({ u: r.x, v: r.y, amostraId: a.id });
    }
  }
  return out;
}

function pontoRemovido(removidos: AquisicaoVisual['removidos'], u: number, v: number): boolean {
  return removidos.some((r) => u >= r.u[0] && u <= r.u[1] && v >= r.v[0] && v <= r.v[1]);
}

/** A região tem alguma parte dentro da janela e fora das áreas removidas? */
function regiaoDisponivel(regiao: { u: Faixa; v: Faixa }, janela: { u: Faixa; v: Faixa }, removidos: AquisicaoVisual['removidos']): boolean {
  if (!faixasSobrepoem(regiao.u, janela.u) || !faixasSobrepoem(regiao.v, janela.v)) return false;
  const u0 = Math.max(regiao.u[0], janela.u[0]);
  const u1 = Math.min(regiao.u[1], janela.u[1]);
  const v0 = Math.max(regiao.v[0], janela.v[0]);
  const v1 = Math.min(regiao.v[1], janela.v[1]);
  for (let i = 0; i <= 8; i++) {
    for (let j = 0; j <= 4; j++) {
      const u = u0 + ((u1 - u0) * i) / 8;
      const v = v0 + ((v1 - v0) * j) / 4;
      if (!pontoRemovido(removidos, u, v)) return true;
    }
  }
  return false;
}

export function rotuloVisual(sup: SuperficieDef, vista: VistaVisual, janela: { u: Faixa; v: Faixa }, iluminacao: Iluminacao, limpeza: string): string {
  const luz = iluminacao === 'rasante' ? 'luz rasante' : 'luz difusa';
  const limp = limpeza === 'como-recebida' ? 'como recebida' : limpeza === 'suave' ? 'limpeza suave' : 'limpeza agressiva';
  const onde =
    vista === 'geral'
      ? 'visão geral (~1×)'
      : `detalhe ~10× centrado em ${sup.eixoU.rotulo.split(' ')[0]} = ${fmt((janela.u[0] + janela.u[1]) / 2)} mm, ${sup.eixoV.rotulo.split(' ')[0]} = ${fmt((janela.v[0] + janela.v[1]) / 2)} mm`;
  return `${sup.nome} · ${onde} · ${luz} · ${limp}`;
}

function fmt(n: number): string {
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

/** Gera a aquisição visual (sem cobrar; o estado cobra). */
export function adquirirVisual(caso: CasoDefinicao, estado: EstadoJogo, pedido: PedidoVisual, id: string): AquisicaoVisual {
  const sup = superficiePorId(caso, pedido.superficie);
  const limpeza = estado.limpezas[sup.id] ?? 'como-recebida';
  const janela = janelaVisual(sup, pedido.vista, pedido.centro);
  const removidos = regioesRemovidas(caso, estado, sup);
  const achados: AchadoVisivel[] = [];

  for (const a of caso.verdade.achadosVisuais) {
    if (!a.superficies.includes(sup.id)) continue;
    const regra = a.regras.find(
      (r) => r.vistas.includes(pedido.vista) && r.iluminacoes.includes(pedido.iluminacao) && r.limpezas.includes(limpeza),
    );
    if (!regra) continue;
    if (a.modo === 'local') {
      const m = a.marcador;
      if (!m) continue;
      if (m.u < janela.u[0] || m.u > janela.u[1] || m.v < janela.v[0] || m.v > janela.v[1]) continue;
      if (pontoRemovido(removidos, m.u, m.v)) continue;
    } else if (!regiaoDisponivel(a.regiao, janela, removidos)) {
      continue;
    }
    achados.push({
      chave: a.id,
      achadoId: a.id,
      modo: a.modo,
      qualidade: regra.qualidade,
      observacao: regra.qualidade === 'tenue' && a.observacaoTenue ? a.observacaoTenue : a.observacao,
      grupo: a.grupo,
      marcadores: a.marcador ? [a.marcador] : [],
    });
  }

  if (sup.tipo === 'fratura' && limpeza === 'agressiva') {
    achados.push({
      chave: ARTEFATOS.riscosEscova.id,
      achadoId: ARTEFATOS.riscosEscova.id,
      modo: 'campo',
      qualidade: 'nitida',
      observacao: ARTEFATOS.riscosEscova.observacao,
      grupo: ARTEFATOS.riscosEscova.grupo,
      marcadores: [],
    });
  }

  return {
    tipo: 'visual',
    id,
    criadaEm: Date.now(),
    rotulo: rotuloVisual(sup, pedido.vista, janela, pedido.iluminacao, limpeza),
    superficie: sup.id,
    vista: pedido.vista,
    janela,
    iluminacao: pedido.iluminacao,
    limpeza,
    removidos,
    achados,
    encontrados: [],
    limitacoes: limitacoesVisuais(sup, pedido.vista, pedido.iluminacao, limpeza, removidos),
    semente: hashValores(sup.id, pedido.vista, janela.u[0], janela.v[0], pedido.iluminacao, limpeza),
  };
}

export function limitacoesVisuais(
  sup: SuperficieDef,
  vista: VistaVisual,
  iluminacao: Iluminacao,
  limpeza: string,
  removidos: AquisicaoVisual['removidos'],
): Limitacao[] {
  const lim: Limitacao[] = [];
  if (limpeza === 'como-recebida') {
    lim.push({
      id: 'vi-sujeira',
      severidade: 'atencao',
      texto: 'Superfície como recebida: óleo, poeira e oxidação podem encobrir detalhes finos.',
      explicacao: 'Uma limpeza suave (solvente e escova macia) remove a sujeira sem alterar o relevo da fratura.',
    });
  }
  if (limpeza === 'agressiva') {
    lim.push({
      id: 'vi-agressiva',
      severidade: 'grave',
      texto: 'Superfície riscada pela escova de aço: detalhes finos foram apagados de forma permanente.',
      explicacao: 'Escovas de aço deformam o relevo e criam riscos que podem ser confundidos com marcas reais. O dano não pode ser desfeito.',
    });
  }
  if (sup.tipo === 'fratura') {
    lim.push(
      iluminacao === 'rasante'
        ? {
            id: 'vi-rasante',
            severidade: 'info',
            texto: 'Luz rasante: realça relevo, mas dificulta comparar tonalidades.',
            explicacao: 'Diferenças de cor (por exemplo, regiões mais oxidadas) ficam mais claras com luz difusa.',
          }
        : {
            id: 'vi-difusa',
            severidade: 'info',
            texto: 'Luz difusa: boa para comparar tonalidades, mas pouco realce do relevo.',
            explicacao: 'Marcas de relevo (degraus, linhas curvas) aparecem melhor com luz rasante.',
          },
    );
  } else {
    lim.push({
      id: 'vi-superficie',
      severidade: 'info',
      texto: 'A inspeção da superfície não mostra o interior da peça.',
      explicacao: 'Descontinuidades internas só aparecem em cortes ou em ensaios volumétricos; aparência externa regular não prova integridade interna.',
    });
  }
  if (vista === 'geral') {
    lim.push({
      id: 'vi-escala',
      severidade: 'info',
      texto: 'Visão geral (~1×): feições menores que cerca de 1 mm não são resolvidas.',
      explicacao: 'Para examinar origens, degraus e linhas finas, registre um detalhe com o estereoscópio.',
    });
  }
  if (removidos.length > 0) {
    lim.push({
      id: 'vi-removido',
      severidade: 'atencao',
      texto: `Parte desta superfície foi removida por corte (${[...new Set(removidos.map((r) => r.amostraId))].join(', ')}).`,
      explicacao: 'Cortes são destrutivos: documente a superfície antes de retirar amostras dela.',
    });
  }
  return lim;
}

/** Qualidade mínima considerada útil. */
export function qualidadeUtil(q: Qualidade): boolean {
  return q !== 'comprometida';
}
