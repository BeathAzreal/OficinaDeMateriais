/**
 * Peça interativa vista de cima (plano x–y), em milímetros.
 * Modo "regioes": clicar seleciona regiões; modo "ponto": clicar escolhe um ponto (ex.: posição de corte).
 */
import { useRef, useState, type MouseEvent } from 'react';
import type { Orientacao } from '../../casos/tipos';
import { retanguloFatia } from '../../motor/geometria';
import { planejarCorte } from '../../motor/metalografia';
import { useJogo } from '../contexto';

export interface RegiaoPeca {
  id: string;
  nome: string;
  descricao: string;
  superficie?: string;
}

export const REGIOES: RegiaoPeca[] = [
  {
    id: 'fratura',
    nome: 'Superfície de fratura',
    descricao: 'Faces da separação, na parte A e no fragmento B. Guardam a história da ruptura.',
    superficie: 'fratura-A',
  },
  {
    id: 'cordao',
    nome: 'Cordão de solda (face) e pés',
    descricao: 'Reforço do passe de acabamento e transições para o metal de base (pés do cordão).',
    superficie: 'face-cordao',
  },
  {
    id: 'raiz',
    nome: 'Lado da raiz',
    descricao: 'Face oposta da barra, onde aparece o cordão de raiz.',
    superficie: 'raiz-cordao',
  },
  {
    id: 'metal-base',
    nome: 'Metal de base (parte A)',
    descricao: 'Barra longe da solda; ali fica a marcação estampada. Boa região de referência.',
    superficie: 'metal-base',
  },
  {
    id: 'fragmento-B',
    nome: 'Fragmento B',
    descricao: 'Restante da barra, do outro lado da fratura. Sua face de fratura corresponde à da parte A.',
    superficie: 'fratura-B',
  },
];

interface Props {
  vista: 'junta' | 'inteira';
  modo: 'regioes' | 'ponto';
  regiao?: string | null;
  onRegiao?: (id: string) => void;
  ponto?: { x: number; y: number } | null;
  onPonto?: (p: { x: number; y: number }) => void;
  orientacao?: Orientacao;
  altura?: number;
}

const GAP = 2.5; // afastamento visual do fragmento B (mm)

export function PecaSVG({ vista, modo, regiao, onRegiao, ponto, onPonto, orientacao, altura = 360 }: Props) {
  const { caso, estado } = useJogo();
  const d = caso.publico.desenho;
  const svgRef = useRef<SVGSVGElement>(null);
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);
  const [hover, setHover] = useState<string | null>(null);

  const xf = d.xFraturaFace;
  const hw = d.meiaLarguraCordao;
  const L = d.largura;
  const vb = vista === 'junta' ? { x0: -42, x1: 42 + GAP } : { x0: -205, x1: 205 + GAP };
  const margem = vista === 'junta' ? 9 : 22;
  const viewBox = `${vb.x0 - margem} ${-margem * 0.9} ${vb.x1 - vb.x0 + margem * 1.6} ${L + margem * 2}`;
  const fonte = vista === 'junta' ? 3 : 9;
  const traco = vista === 'junta' ? 0.35 : 1;

  const paraMm = (e: MouseEvent) => {
    const svg = svgRef.current!;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const m = svg.getScreenCTM();
    if (!m) return null;
    const p = pt.matrixTransform(m.inverse());
    // desfaz o afastamento visual do fragmento B
    const x = p.x > xf + GAP ? p.x - GAP : p.x > xf ? xf : p.x;
    return { x, y: p.y };
  };

  const xVis = (x: number) => (x > xf ? x + GAP : x);

  const ticks: number[] = [];
  const passo = vista === 'junta' ? 10 : 50;
  for (let t = Math.ceil(vb.x0 / passo) * passo; t <= vb.x1 - GAP; t += passo) ticks.push(t);

  const fraturaPath = (() => {
    const pts: string[] = [];
    for (let i = 0; i <= 40; i++) {
      const y = (L * i) / 40;
      const jit = Math.sin(i * 2.7) * 0.35 + Math.sin(i * 1.3) * 0.25;
      pts.push(`${xf + jit * 0.5},${y}`);
    }
    return pts.join(' ');
  })();

  const realce = (id: string) => (regiao === id ? 'var(--laranja)' : hover === id ? 'var(--laranja-suave)' : 'transparent');

  const preview = (() => {
    if (!ponto || !orientacao) return null;
    const plano = planejarCorte(caso, estado, { orientacao, x: ponto.x, y: ponto.y }, 'prévia');
    return typeof plano === 'string' ? null : retanguloFatia(plano);
  })();

  return (
    <svg
      ref={svgRef}
      className={`peca-svg modo-${modo}`}
      viewBox={viewBox}
      style={{ height: altura }}
      role="img"
      aria-label={vista === 'junta' ? 'Vista de cima da região da junta' : 'Vista de cima da barra inteira'}
      onMouseMove={(e) => setCursor(paraMm(e))}
      onMouseLeave={() => {
        setCursor(null);
        setHover(null);
      }}
      onClick={(e) => {
        if (modo !== 'ponto' || !onPonto) return;
        const p = paraMm(e);
        if (p && p.y >= 0 && p.y <= L && Math.abs(p.x) <= 200) onPonto(p);
      }}
    >
      <defs>
        <pattern id={`ondas-${vista}`} width="2.2" height="1.1" patternUnits="userSpaceOnUse">
          <rect width="2.2" height="1.1" fill="#8f8a80" />
          <path d="M0 0.8 Q1.1 0 2.2 0.8" stroke="#6f6a62" strokeWidth="0.25" fill="none" />
        </pattern>
        <pattern id={`hachura-${vista}`} width="2" height="2" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="2" height="2" fill="#1b222c" />
          <line x1="0" y1="0" x2="0" y2="2" stroke="#5b6675" strokeWidth="0.8" />
        </pattern>
      </defs>

      {/* eixos */}
      {ticks.map((t) => (
        <g key={t} className="eixo">
          <line x1={xVis(t)} x2={xVis(t)} y1={L} y2={L + margem * 0.25} strokeWidth={traco} />
          <text x={xVis(t)} y={L + margem * 0.62} fontSize={fonte} textAnchor="middle">
            {t}
          </text>
        </g>
      ))}
      {[0, 20, 40, 60, 80].map((t) => (
        <g key={`y${t}`} className="eixo">
          <line x1={vb.x0 - margem * 0.25} x2={vb.x0} y1={t} y2={t} strokeWidth={traco} />
          <text x={vb.x0 - margem * 0.35} y={t + fonte * 0.35} fontSize={fonte} textAnchor="end">
            {t}
          </text>
        </g>
      ))}
      <text className="eixo-rotulo" x={(vb.x0 + vb.x1) / 2} y={L + margem * 0.98} fontSize={fonte} textAnchor="middle">
        x — distância ao eixo da solda (mm)
      </text>
      <text className="eixo-rotulo" x={vb.x0 - margem * 0.8} y={-margem * 0.35} fontSize={fonte}>
        y (mm)
      </text>

      {/* parte A */}
      <rect x={Math.max(vb.x0, -200)} y={0} width={xf - Math.max(vb.x0, -200)} height={L} className="chapa" />
      {/* fragmento B */}
      <rect x={xf + GAP} y={0} width={Math.min(vb.x1, 200 + GAP) - xf - GAP} height={L} className="chapa" />
      {/* cordão */}
      <rect x={-hw} y={0} width={2 * hw} height={L} fill={`url(#ondas-${vista})`} />
      <rect x={-hw} y={18} width={2 * hw} height={9} className="reinicio" />
      {/* fratura */}
      <polyline points={fraturaPath} className="fratura" strokeWidth={traco * 1.4} />
      <polyline points={fraturaPath.split(' ').map((p) => { const [x, y] = p.split(','); return `${+x + GAP},${y}`; }).join(' ')} className="fratura" strokeWidth={traco * 1.4} />
      <text x={vb.x0 + 2} y={-margem * 0.35} fontSize={fonte} className="rotulo-parte">
        Parte A
      </text>
      <text x={vb.x1 - 2} y={-margem * 0.35} fontSize={fonte} className="rotulo-parte" textAnchor="end">
        Fragmento B
      </text>
      {vista === 'inteira' && (
        <text x={-120} y={44} fontSize={fonte * 0.9} className="marca-estampa" textAnchor="middle">
          ▭ marcação
        </text>
      )}

      {/* amostras já retiradas */}
      {estado.amostras.map((a) => {
        const r = retanguloFatia(a);
        const x0 = xVis(r.x[0]);
        const x1 = xVis(r.x[1]);
        return (
          <g key={a.id}>
            <rect x={x0} y={r.y[0]} width={x1 - x0} height={r.y[1] - r.y[0]} fill={`url(#hachura-${vista})`} className="removida" strokeWidth={traco} />
            <text x={(x0 + x1) / 2} y={r.y[0] - fonte * 0.3} fontSize={fonte * 0.85} textAnchor="middle" className="rotulo-amostra">
              {a.id}
            </text>
          </g>
        );
      })}

      {/* regiões clicáveis */}
      {modo === 'regioes' && (
        <g className="regioes">
          <rect
            x={Math.max(vb.x0, -200)}
            y={0}
            width={-hw - 1 - Math.max(vb.x0, -200)}
            height={L}
            fill="transparent"
            stroke={realce('metal-base')}
            strokeWidth={traco * 2}
            onMouseEnter={() => setHover('metal-base')}
            onClick={() => onRegiao?.('metal-base')}
          />
          <rect x={-hw} y={0} width={2 * hw - 0.3} height={L} fill="transparent" stroke={realce('cordao')} strokeWidth={traco * 2} onMouseEnter={() => setHover('cordao')} onClick={() => onRegiao?.('cordao')} />
          <rect x={xf - 1.2} y={0} width={GAP + 2.4} height={L} fill="transparent" stroke={realce('fratura')} strokeWidth={traco * 2} onMouseEnter={() => setHover('fratura')} onClick={() => onRegiao?.('fratura')} />
          <rect x={xf + GAP + 1.3} y={0} width={Math.min(vb.x1, 200 + GAP) - xf - GAP - 1.3} height={L} fill="transparent" stroke={realce('fragmento-B')} strokeWidth={traco * 2} onMouseEnter={() => setHover('fragmento-B')} onClick={() => onRegiao?.('fragmento-B')} />
        </g>
      )}

      {/* pré-visualização do corte */}
      {modo === 'ponto' && preview && (
        <rect
          x={xVis(preview.x[0])}
          y={preview.y[0]}
          width={xVis(preview.x[1]) - xVis(preview.x[0])}
          height={preview.y[1] - preview.y[0]}
          className="previa-corte"
          strokeWidth={traco * 1.5}
        />
      )}
      {ponto && (
        <g className="mira">
          <line x1={xVis(ponto.x) - fonte} x2={xVis(ponto.x) + fonte} y1={ponto.y} y2={ponto.y} strokeWidth={traco * 1.5} />
          <line x1={xVis(ponto.x)} x2={xVis(ponto.x)} y1={ponto.y - fonte} y2={ponto.y + fonte} strokeWidth={traco * 1.5} />
        </g>
      )}
      {cursor && cursor.y >= 0 && cursor.y <= L && (
        <text x={vb.x1} y={L + margem * 0.98} fontSize={fonte} textAnchor="end" className="coordenadas">
          x = {cursor.x.toFixed(1).replace('.', ',')} · y = {cursor.y.toFixed(1).replace('.', ',')} mm
        </text>
      )}
    </svg>
  );
}

/** Vista lateral esquemática (plano x–z) da junta, só com o perfil externo. */
export function VistaLateral() {
  const { caso } = useJogo();
  const d = caso.publico.desenho;
  const T = d.espessura;
  const hw = d.meiaLarguraCordao;
  const cap: string[] = [];
  for (let i = 0; i <= 20; i++) {
    const x = -hw + (2 * hw * i) / 20;
    const t = x / hw;
    cap.push(`${x},${-2.5 * (1 - t * t)}`);
  }
  return (
    <svg className="vista-lateral" viewBox="-42 -7 90 24" role="img" aria-label="Vista lateral esquemática da junta">
      <rect x={-40} y={0} width={40 + d.xFraturaFace} height={T} className="chapa" />
      <rect x={d.xFraturaFace + 2.5} y={0} width={40 - d.xFraturaFace} height={T} className="chapa" />
      <polygon points={`${-hw},0 ${cap.join(' ')} ${hw},0`} className="cordao-lateral" />
      <polygon points={`-2.5,${T} 0,${T + 1} 2.5,${T}`} className="cordao-lateral" />
      <line x1={d.xFraturaFace} x2={d.xFraturaFace - 1.5} y1={0} y2={T} className="fratura" strokeWidth={0.35} />
      <text x={-40} y={-3.5} fontSize={2.4} className="eixo">
        z = 0 (face do cordão)
      </text>
      <text x={-40} y={T + 3.6} fontSize={2.4} className="eixo">
        z = {T} mm (raiz)
      </text>
      <text x={d.xFraturaFace + 3} y={-3.5} fontSize={2.4} className="eixo">
        fratura
      </text>
    </svg>
  );
}
