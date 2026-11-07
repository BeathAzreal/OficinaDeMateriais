import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Amostra, AquisicaoMicrodureza, Indentacao, Preparo } from '../../motor/tipos';
import { desenharSecao } from '../render/micrografia';
import { paraMm, paraPx, type Mapa } from '../render/comum';
import { DISTANCIA_MIN_DIAGONAIS } from '../../motor/microdureza';
import { useJogo } from '../contexto';

export const LARG_MAPA = 640;
export const ALT_MAPA = 260;

/** Mapa da seção (canvas) com camada SVG para sobreposições e cliques em mm. */
export function MapaSecao({
  amostra,
  preparo,
  onClique,
  camada,
  rotulo,
}: {
  amostra: Amostra;
  preparo: Preparo | null;
  onClique?: (u: number, v: number) => void;
  camada?: (m: Mapa) => ReactNode;
  rotulo?: string;
}) {
  const { caso } = useJogo();
  const ref = useRef<HTMLCanvasElement>(null);
  const [mapa, setMapa] = useState<Mapa | null>(null);
  const [cursor, setCursor] = useState<[number, number] | null>(null);
  useEffect(() => {
    if (ref.current) setMapa(desenharSecao(ref.current, caso, amostra, preparo));
  }, [caso, amostra, preparo]);
  const mm = (e: React.MouseEvent<SVGSVGElement>): [number, number] | null => {
    if (!mapa) return null;
    const r = e.currentTarget.getBoundingClientRect();
    return paraMm(mapa, ((e.clientX - r.left) / r.width) * LARG_MAPA, ((e.clientY - r.top) / r.height) * ALT_MAPA);
  };
  return (
    <div className="mapa-secao">
      <div className="imagem-com-camada">
        <canvas ref={ref} width={LARG_MAPA} height={ALT_MAPA} />
        {mapa && (
          <svg
            className={`camada ${onClique ? 'clicavel' : ''}`}
            viewBox={`0 0 ${LARG_MAPA} ${ALT_MAPA}`}
            onMouseMove={(e) => setCursor(mm(e))}
            onMouseLeave={() => setCursor(null)}
            onClick={(e) => {
              const p = mm(e);
              if (p && onClique) onClique(p[0], p[1]);
            }}
          >
            <EixosSecao mapa={mapa} amostra={amostra} />
            {camada?.(mapa)}
          </svg>
        )}
      </div>
      <div className="legenda-imagem">
        <span>
          {rotulo ?? 'Seção da amostra (vista a olho nu)'} · {amostra.orientacao === 'transversal' ? 'x' : 'y'} na horizontal, z na vertical (mm)
        </span>
        {cursor && (
          <span className="coordenadas">
            {amostra.orientacao === 'transversal' ? 'x' : 'y'} = {cursor[0].toFixed(2).replace('.', ',')} · z = {cursor[1].toFixed(2).replace('.', ',')} mm
          </span>
        )}
      </div>
    </div>
  );
}

function EixosSecao({ mapa, amostra }: { mapa: Mapa; amostra: Amostra }) {
  const ticks: number[] = [];
  const passo = 5;
  for (let t = Math.ceil(amostra.extensao[0] / passo) * passo; t <= amostra.extensao[1]; t += passo) ticks.push(t);
  return (
    <g className="eixos-secao">
      {ticks.map((t) => {
        const [x, y] = paraPx(mapa, t, 14);
        return (
          <g key={t}>
            <line x1={x} x2={x} y1={y - 4} y2={y} />
            <text x={x} y={y + 11} textAnchor="middle">
              {t}
            </text>
          </g>
        );
      })}
      {[0, 6, 12].map((z) => {
        const [x, y] = paraPx(mapa, amostra.extensao[0] - 0.6, z);
        return (
          <text key={z} x={x} y={y + 3} textAnchor="end">
            z={z}
          </text>
        );
      })}
    </g>
  );
}

/** Marcadores das indentações sobre o mapa. */
export function MarcasNoMapa({ mapa, pontos, selecionado, pendentes }: { mapa: Mapa; pontos: Indentacao[]; selecionado?: number | null; pendentes?: { u: number; v: number }[] }) {
  return (
    <g>
      {pendentes?.map((p, i) => {
        const [x, y] = paraPx(mapa, p.u, p.v);
        return <circle key={`p${i}`} cx={x} cy={y} r={2.2} className="ponto-pendente" />;
      })}
      {pontos.map((p, i) => {
        const [x, y] = paraPx(mapa, p.u, p.v);
        const alerta = p.alertas.length > 0;
        return alerta ? (
          <polygon key={i} points={`${x},${y - 4} ${x + 4},${y + 3} ${x - 4},${y + 3}`} className={`marca alerta ${selecionado === i ? 'sel' : ''}`} />
        ) : (
          <rect key={i} x={x - 2.5} y={y - 2.5} width={5} height={5} transform={`rotate(45 ${x} ${y})`} className={`marca ${selecionado === i ? 'sel' : ''}`} />
        );
      })}
    </g>
  );
}

export interface Serie {
  rotulo: string;
  carga: string;
  pontos: Indentacao[];
  eixo: 'x' | 'y';
}

/** Gráfico de dureza × distância (SVG). */
export function GraficoDureza({ series, selecionado, onSelecionar }: { series: Serie[]; selecionado?: number | null; onSelecionar?: (i: number) => void }) {
  const W = 640;
  const H = 280;
  const m = { e: 56, d: 16, t: 16, b: 46 };
  const todos = series.flatMap((s) => s.pontos);
  if (todos.length === 0) return null;
  const us = todos.map((p) => p.u);
  const hs = todos.map((p) => p.hv);
  let u0 = Math.min(...us);
  let u1 = Math.max(...us);
  if (u1 - u0 < 1) {
    u0 -= 0.5;
    u1 += 0.5;
  }
  const h0 = Math.floor((Math.min(...hs) - 10) / 50) * 50;
  const h1 = Math.ceil((Math.max(...hs) + 10) / 50) * 50;
  const X = (u: number) => m.e + ((u - u0) / (u1 - u0)) * (W - m.e - m.d);
  const Y = (h: number) => H - m.b - ((h - h0) / (h1 - h0)) * (H - m.t - m.b);
  const passoU = niceStep((u1 - u0) / 8);
  const ticksU: number[] = [];
  for (let t = Math.ceil(u0 / passoU) * passoU; t <= u1 + 1e-9; t += passoU) ticksU.push(+t.toFixed(4));
  const ticksH: number[] = [];
  for (let t = h0; t <= h1; t += 50) ticksH.push(t);
  const cargas = [...new Set(series.map((s) => s.carga.replace('.', ',')))].join(' / ');
  const formas = ['losango', 'circulo', 'quadrado'];
  return (
    <svg className="grafico-dureza" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Gráfico de dureza Vickers em função da distância">
      {ticksH.map((t) => (
        <g key={`h${t}`}>
          <line x1={m.e} x2={W - m.d} y1={Y(t)} y2={Y(t)} className="grade" />
          <text x={m.e - 6} y={Y(t) + 4} textAnchor="end">
            {t}
          </text>
        </g>
      ))}
      {ticksU.map((t) => (
        <g key={`u${t}`}>
          <line x1={X(t)} x2={X(t)} y1={H - m.b} y2={H - m.b + 4} className="eixo-linha" />
          <text x={X(t)} y={H - m.b + 16} textAnchor="middle">
            {t.toLocaleString('pt-BR')}
          </text>
        </g>
      ))}
      {u0 < 0 && u1 > 0 && series[0]?.eixo === 'x' && (
        <g>
          <line x1={X(0)} x2={X(0)} y1={m.t} y2={H - m.b} className="linha-eixo-solda" />
          <text x={X(0) + 4} y={H - m.b - 6}>
            eixo da solda
          </text>
        </g>
      )}
      <line x1={m.e} x2={W - m.d} y1={H - m.b} y2={H - m.b} className="eixo-linha" />
      <line x1={m.e} x2={m.e} y1={m.t} y2={H - m.b} className="eixo-linha" />
      <text x={(m.e + W - m.d) / 2} y={H - 8} textAnchor="middle" className="rotulo-eixo">
        {series[0]?.eixo === 'x' ? 'x — distância ao eixo da solda (mm)' : 'y — posição ao longo do cordão (mm)'}
      </text>
      <text x={14} y={(m.t + H - m.b) / 2} textAnchor="middle" transform={`rotate(-90 14 ${(m.t + H - m.b) / 2})`} className="rotulo-eixo">
        Dureza ({cargas})
      </text>
      {series.map((s, k) => (
        <g key={s.rotulo} className={`serie serie-${k}`}>
          <polyline points={s.pontos.map((p) => `${X(p.u)},${Y(p.hv)}`).join(' ')} />
          {s.pontos.map((p, i) => {
            const x = X(p.u);
            const y = Y(p.hv);
            const alerta = p.alertas.length > 0;
            const sel = k === 0 && selecionado === i;
            const comum = { className: `ponto ${alerta ? 'alerta' : ''} ${sel ? 'sel' : ''}`, onClick: () => k === 0 && onSelecionar?.(i) };
            const titulo = <title>{`${p.hv} HV em ${p.u.toFixed(2)} mm${alerta ? ' — com alerta' : ''}`}</title>;
            if (alerta) return <polygon key={i} points={`${x},${y - 5} ${x + 5},${y + 4} ${x - 5},${y + 4}`} {...comum}>{titulo}</polygon>;
            if (formas[k % 3] === 'circulo') return <circle key={i} cx={x} cy={y} r={3.5} {...comum}>{titulo}</circle>;
            if (formas[k % 3] === 'quadrado') return <rect key={i} x={x - 3} y={y - 3} width={6} height={6} {...comum}>{titulo}</rect>;
            return <rect key={i} x={x - 3} y={y - 3} width={6} height={6} transform={`rotate(45 ${x} ${y})`} {...comum}>{titulo}</rect>;
          })}
        </g>
      ))}
      <g className="legenda-grafico" transform={`translate(${W - m.d - 230}, ${m.t + 4})`}>
        {series.map((s, k) => (
          <text key={s.rotulo} x={0} y={k * 14}>
            {['◆', '●', '■'][k % 3]} {s.rotulo}
          </text>
        ))}
        <text x={0} y={series.length * 14}>
          ▲ ponto com alerta de configuração
        </text>
      </g>
    </svg>
  );
}

function niceStep(x: number): number {
  const p = Math.pow(10, Math.floor(Math.log10(x)));
  const n = x / p;
  return (n < 1.5 ? 1 : n < 3.5 ? 2 : n < 7.5 ? 5 : 10) * p;
}

/** Marcas em escala real em torno de um ponto, com o círculo de distância mínima. */
export function MarcasEscalaReal({ pontos, indice }: { pontos: Indentacao[]; indice: number }) {
  const c = pontos[indice];
  if (!c) return null;
  const W = 420;
  const H = 150;
  const janela = 0.7; // mm de largura
  const esc = W / janela;
  const X = (u: number) => W / 2 + (u - c.u) * esc;
  const Y = (v: number) => H / 2 + (v - c.v) * esc;
  const vis = pontos.filter((p) => Math.abs(p.u - c.u) < janela && Math.abs(p.v - c.v) < janela);
  return (
    <figure className="escala-real">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Indentações em escala real">
        <rect width={W} height={H} className="fundo" />
        {vis.map((p, i) => {
          const r = (p.diagonal / 2) * esc;
          const x = X(p.u);
          const y = Y(p.v);
          return (
            <g key={i}>
              <circle cx={x} cy={y} r={DISTANCIA_MIN_DIAGONAIS * p.diagonal * esc} className="raio-minimo" />
              <polygon points={`${x},${y - r} ${x + r},${y} ${x},${y + r} ${x - r},${y}`} className={p.alertas.length ? 'diamante alerta' : 'diamante'} />
              <text x={x} y={y + r + 12} textAnchor="middle">
                {p.hv}
              </text>
            </g>
          );
        })}
        <line x1={10} x2={10 + 0.1 * esc} y1={H - 10} y2={H - 10} className="barra" />
        <text x={10} y={H - 14}>
          100 µm
        </text>
      </svg>
      <figcaption>
        Marcas em escala real (diagonal de {(c.diagonal * 1000).toFixed(0)} µm). Círculo tracejado: {DISTANCIA_MIN_DIAGONAIS} diagonais (regra prática do jogo).
      </figcaption>
    </figure>
  );
}

export function VisorPerfil({ aq }: { aq: AquisicaoMicrodureza }) {
  const { estado } = useJogo();
  const [sel, setSel] = useState<number | null>(null);
  const amostra = estado.amostras.find((a) => a.id === aq.amostraId);
  const preparo = estado.preparos.find((p) => p.id === aq.preparoId) ?? null;
  if (!amostra) return null;
  return (
    <div className="visor-perfil">
      <MapaSecao
        amostra={amostra}
        preparo={preparo}
        rotulo={`Posição das indentações em ${amostra.id}`}
        camada={(m) => <MarcasNoMapa mapa={m} pontos={aq.pontos} selecionado={sel} />}
      />
      <GraficoDureza
        series={[{ rotulo: `${aq.id} (${aq.carga.replace('.', ',')})`, carga: aq.carga, pontos: aq.pontos, eixo: amostra.orientacao === 'transversal' ? 'x' : 'y' }]}
        selecionado={sel}
        onSelecionar={setSel}
      />
      {sel !== null ? <MarcasEscalaReal pontos={aq.pontos} indice={sel} /> : <p className="ajuda">Clique num ponto do gráfico para ver as marcas em escala real.</p>}
    </div>
  );
}
