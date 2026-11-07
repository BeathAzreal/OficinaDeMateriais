// Esquemas SVG: microestrutura, geometria do inserto, relação ap × ΔD, superfície e aresta.
// Todos são ilustrativos e indicam isso na própria figura.

import { useId } from 'react';
import type { Broca, ComponentesRa, FerramentaTornear, Material } from '../../modelo/tipos';
import { num } from '../formato';

function lcg(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** Microestrutura esquemática: grãos quadriláteros com jitter, conforme o tipo de esquema do material. */
export function Microestrutura({ material }: { material: Material }) {
  const id = useId().replace(/:/g, '');
  const esquema = material.microestrutura.esquema;
  const rnd = lcg(material.id.length * 7 + 3);
  const nx = 8;
  const ny = 5;
  const W = 320;
  const H = 200;
  const pts: { x: number; y: number }[][] = [];
  for (let j = 0; j <= ny; j++) {
    const linha = [];
    for (let i = 0; i <= nx; i++) {
      const borda = i === 0 || j === 0 || i === nx || j === ny;
      linha.push({
        x: (i / nx) * W + (borda ? 0 : (rnd() - 0.5) * 26),
        y: (j / ny) * H + (borda ? 0 : (rnd() - 0.5) * 26),
      });
    }
    pts.push(linha);
  }
  const total = nx * ny;
  const fracLamelar = esquema.tipo === 'ferrita-perlita' ? esquema.fracaoPerlita : esquema.tipo === 'grafita-lamelar' ? 1 : 0;
  const ordem = Array.from({ length: total }, (_, k) => ({ k, r: rnd() })).sort((a, b) => a.r - b.r);
  const lamelares = new Set(ordem.slice(0, Math.round(fracLamelar * total)).map((o) => o.k));
  const graos = [];
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const k = j * nx + i;
      const c = [pts[j][i], pts[j][i + 1], pts[j + 1][i + 1], pts[j + 1][i]];
      const d = c.map((p, n) => `${n ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ') + ' Z';
      graos.push({ k, d, lamelar: lamelares.has(k), ang: rnd() * 180, cx: (c[0].x + c[2].x) / 2, cy: (c[0].y + c[2].y) / 2 });
    }
  }
  const corClara = esquema.tipo === 'monofasico' ? esquema.corGrao : '#d9dee4';
  const pontos: { x: number; y: number; r: number }[] = [];
  if (esquema.tipo === 'monofasico' && esquema.particulas) {
    const n = Math.round(esquema.particulas.densidade * 90);
    for (let i = 0; i < n; i++) pontos.push({ x: rnd() * W, y: rnd() * H, r: 1.2 + rnd() * 1.8 });
  }
  const veios: string[] = [];
  if (esquema.tipo === 'grafita-lamelar') {
    for (let i = 0; i < 26; i++) {
      const x0 = rnd() * W;
      const y0 = rnd() * H;
      const a = rnd() * Math.PI;
      const L = 18 + rnd() * 40;
      const cx = x0 + Math.cos(a) * L * 0.5 + (rnd() - 0.5) * 14;
      const cy = y0 + Math.sin(a) * L * 0.5 + (rnd() - 0.5) * 14;
      veios.push(`M${x0.toFixed(1)},${y0.toFixed(1)} Q${cx.toFixed(1)},${cy.toFixed(1)} ${(x0 + Math.cos(a) * L).toFixed(1)},${(y0 + Math.sin(a) * L).toFixed(1)}`);
    }
  }
  const corParticula = esquema.tipo === 'monofasico' && esquema.particulas ? esquema.particulas.cor : '#000';
  return (
    <figure className="figura">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Microestrutura esquemática de ${material.nome}: ${material.microestrutura.legenda}.`}>
        <defs>
          {graos
            .filter((g) => g.lamelar)
            .map((g) => (
              <clipPath id={`${id}-c${g.k}`} key={g.k}>
                <path d={g.d} />
              </clipPath>
            ))}
        </defs>
        {graos.map((g) => (
          <g key={g.k}>
            <path d={g.d} fill={g.lamelar ? '#59626e' : corClara} stroke="#20262e" strokeWidth="1.6" />
            {g.lamelar && (
              <g clipPath={`url(#${id}-c${g.k})`} transform={`rotate(${g.ang.toFixed(0)} ${g.cx.toFixed(0)} ${g.cy.toFixed(0)})`}>
                {Array.from({ length: 30 }, (_, n) => (
                  <line key={n} x1={g.cx - 60} x2={g.cx + 60} y1={g.cy - 60 + n * 4} y2={g.cy - 60 + n * 4} stroke="#2a3038" strokeWidth="1.6" />
                ))}
              </g>
            )}
            {esquema.tipo === 'monofasico' && esquema.maclas && g.k % 3 === 0 && (
              <line x1={g.cx - 12} y1={g.cy - 6} x2={g.cx + 12} y2={g.cy + 6} stroke="#8a95a3" strokeWidth="5" opacity="0.55" />
            )}
          </g>
        ))}
        {pontos.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={p.r} fill={corParticula} />
        ))}
        {veios.map((d, i) => (
          <path key={i} d={d} stroke="#111418" strokeWidth="3.2" fill="none" strokeLinecap="round" />
        ))}
      </svg>
      <figcaption>{material.microestrutura.legenda}. Esquema sem escala, não é micrografia.</figcaption>
    </figure>
  );
}

/** Inserto (vista de cima) com rε, κr e direção de avanço, desenhado a partir da geometria declarada. */
export function GeometriaInserto({ ferramenta }: { ferramenta: FerramentaTornear }) {
  const ang = (g: number) => (g * Math.PI) / 180;
  const tx = 70;
  const ty = 150;
  const a = 90;
  const kr = ferramenta.anguloPosicao;
  const p1 = { x: tx + a * Math.cos(ang(180 - kr)), y: ty - a * Math.sin(ang(180 - kr)) };
  const dirSec = 180 - kr - ferramenta.anguloPonta;
  const p3 = { x: tx + a * Math.cos(ang(dirSec)), y: ty - a * Math.sin(ang(dirSec)) };
  const p2 = { x: p1.x + p3.x - tx, y: p1.y + p3.y - ty };
  const r = Math.max(3, ferramenta.raioPonta * 12);
  return (
    <figure className="figura">
      <svg viewBox="0 0 300 190" role="img" aria-label={`${ferramenta.codigo}: ponta de ${ferramenta.anguloPonta} graus, raio ${ferramenta.raioPonta} milímetro, ângulo de posição ${kr} graus.`}>
        <defs>
          <marker id="setaIns" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">
            <path d="M0,0 L10,5 L0,10 z" fill="#cfd8e3" />
          </marker>
        </defs>
        <line x1="10" y1="170" x2="290" y2="170" stroke="#9fb0c4" strokeDasharray="12 4 2 4" />
        <text x="290" y="184" textAnchor="end" className="desenho-nota">eixo da peça</text>
        <path d={`M${tx},${ty} L${p1.x},${p1.y} L${p2.x},${p2.y} L${p3.x},${p3.y} Z`} fill="#2b2f36" stroke="#d8dee6" strokeWidth="1.5" />
        <circle cx={tx + r * 0.7} cy={ty - r * 0.7} r={r} fill="none" stroke="#ff8a1f" />
        <text x={tx + 22} y={ty + 14} className="desenho-nota laranja">rε {String(ferramenta.raioPonta).replace('.', ',')} (ampliado)</text>
        <line x1={tx} y1={ty} x2={tx - 60} y2={ty} stroke="#cfd8e3" markerEnd="url(#setaIns)" />
        <text x={tx - 62} y={ty - 6} className="desenho-nota">avanço</text>
        <text x={tx + 4} y={ty - 60} className="desenho-nota">aresta principal κr = {kr}°</text>
        <text x={p2.x - 20} y={p2.y + 26} className="desenho-nota">{ferramenta.anguloPonta}°</text>
      </svg>
      <figcaption>Vista de cima, esquemática. {ferramenta.quebraCavaco ? 'Com quebra-cavaco.' : 'Sem quebra-cavaco.'}</figcaption>
    </figure>
  );
}

/** Broca helicoidal vista de lado, com ângulo de ponta e comprimento útil. */
export function BrocaVista({ broca }: { broca: Broca }) {
  const escala = Math.min(4, 220 / broca.comprimentoUtil);
  const d = Math.min(56, broca.diametro * 4);
  const L = broca.comprimentoUtil * escala;
  const lp = d / 2 / Math.tan(((broca.anguloPonta / 2) * Math.PI) / 180);
  const y = 62;
  const x0 = 12;
  const helices: number[] = [];
  for (let x = x0 + 40; x < x0 + 40 + L - lp - 8; x += 14) helices.push(x);
  return (
    <figure className="figura">
      <svg viewBox="0 0 300 130" role="img" aria-label={`${broca.codigo}: diâmetro ${broca.diametro} milímetros, ponta de ${broca.anguloPonta} graus.`}>
        <rect x={x0} y={y - d * 0.42} width="40" height={d * 0.84} fill="#5d6a7b" />
        <path
          d={`M${x0 + 40},${y - d / 2} L${x0 + 40 + L - lp},${y - d / 2} L${x0 + 40 + L},${y} L${x0 + 40 + L - lp},${y + d / 2} L${x0 + 40},${y + d / 2} Z`}
          fill={broca.classe === 'metal-duro' ? '#7d8794' : '#b7c0ca'}
          stroke="#e6ebf1"
        />
        {helices.map((x) => (
          <line key={x} x1={x} y1={y - d / 2} x2={x + 9} y2={y + d / 2} stroke="#2a3038" strokeWidth="2" />
        ))}
        <text x={x0 + 40 + L} y={y - d / 2 - 6} textAnchor="end" className="desenho-nota laranja">σ = {broca.anguloPonta}°</text>
        <text x={x0} y="122" className="desenho-nota">Ø {String(broca.diametro).replace('.', ',')} mm · canal útil {broca.comprimentoUtil} mm · diâmetro ampliado</text>
      </svg>
    </figure>
  );
}

/** Seção transversal: ap no raio e ΔD = 2·ap no diâmetro. */
export function DiagramaAp({ dref, dprog, ap }: { dref: number; dprog: number; ap: number }) {
  const R = 70;
  const r = Math.max(8, R * (dprog / Math.max(dref, 0.001)));
  const c = 90;
  return (
    <figure className="figura figura-ap">
      <svg viewBox="0 0 320 180" role="img" aria-label={`Seção transversal: diâmetro de referência ${num(dref)} milímetros, profundidade radial ${num(ap)} milímetros nos dois lados, diâmetro programado ${num(dprog)} milímetros.`}>
        <circle cx={c} cy={c} r={R} fill="#3b4048" stroke="#9fb0c4" />
        <circle cx={c} cy={c} r={r} fill="#b9c3cf" stroke="#ff8a1f" strokeDasharray="5 3" />
        <line x1={c - R - 6} y1={c} x2={c + R + 6} y2={c} stroke="#9fb0c4" strokeDasharray="10 3 2 3" />
        <line x1={c + r} y1={c - 8} x2={c + R} y2={c - 8} stroke="#ff8a1f" strokeWidth="2" />
        <line x1={c - R} y1={c - 8} x2={c - r} y2={c - 8} stroke="#ff8a1f" strokeWidth="2" />
        <text x={c + (r + R) / 2} y={c - 14} textAnchor="middle" className="desenho-nota laranja">ap</text>
        <text x={c - (r + R) / 2} y={c - 14} textAnchor="middle" className="desenho-nota laranja">ap</text>
        <text x="180" y="40" className="desenho-cota">Ø ref. {num(dref)} mm</text>
        <text x="180" y="62" className="desenho-cota laranja">− 2 × ap = − {num(2 * ap)} mm</text>
        <text x="180" y="84" className="desenho-cota">Ø prog. {num(dprog)} mm</text>
        <text x="180" y="118" className="desenho-nota">A peça gira: a ponta corta</text>
        <text x="180" y="132" className="desenho-nota">ap em todo o contorno, e o</text>
        <text x="180" y="146" className="desenho-nota">diâmetro cai 2·ap.</text>
      </svg>
    </figure>
  );
}

/** Ampliação esquemática da superfície: marcas do avanço + parcelas sintéticas. */
export function SuperficieAmpliada({ f, raioPonta, comp }: { f: number; raioPonta: number; comp: ComponentesRa }) {
  const W = 340;
  const H = 130;
  const marcas = 6;
  const passo = W / marcas;
  const rnd = lcg(Math.round(f * 1000) + 3);
  // Escala vertical exagerada: Rt geométrico em proporção ao passo.
  const rtGeo = (f * f) / (8 * raioPonta); // mm
  const exag = 0.55 * passo / Math.max(f, 0.01); // px por mm na horizontal
  const ampGeo = Math.min(40, rtGeo * exag * 6);
  const extra = (comp.apc + comp.desgaste + comp.atrito + comp.lascamento) / Math.max(comp.total, 0.01);
  const pontos: string[] = [];
  for (let x = 0; x <= W; x += 2) {
    const u = (x % passo) / passo - 0.5; // −0,5..0,5
    let y = -ampGeo * 4 * u * u; // arco côncavo da ponta; picos (cúspides) entre marcas
    y += extra * 18 * (rnd() - 0.5) * (comp.apc > 0.3 ? 1.6 : 0.6);
    if (comp.lascamento > 0 && Math.abs(u) < 0.08) y += 16;
    if (comp.atrito > 0) y = y * 0.7 + 4 * Math.sin(x / 3);
    pontos.push(`${x},${(H / 2 + 5 + y).toFixed(1)}`);
  }
  return (
    <figure className="figura">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Perfil esquemático da superfície ampliada com marcas periódicas do avanço e irregularidades das parcelas não geométricas.">
        <rect width={W} height={H} fill="#121a25" />
        <polyline points={`0,${H} ${pontos.join(' ')} ${W},${H}`} fill="#8d97a3" stroke="#e6ebf1" strokeWidth="1.4" />
        {Array.from({ length: marcas + 1 }, (_, i) => (
          <line key={i} x1={i * passo} y1="8" x2={i * passo} y2="16" stroke="#ff8a1f" />
        ))}
        <text x={passo / 2} y="12" textAnchor="middle" className="desenho-nota laranja">f</text>
        <text x={W - 6} y={H - 8} textAnchor="end" className="desenho-nota">esquemático · escala vertical muito exagerada</text>
      </svg>
      <figcaption>Os arcos repetidos a cada f vêm da ponta de raio rε. O serrilhado irregular representa as parcelas sintéticas (aresta postiça, desgaste, atrito, lascamento).</figcaption>
    </figure>
  );
}

/** Ponta da ferramenta vista de frente com marca de desgaste VB (escala exagerada). */
export function ArestaVista({ vb, vbLimite, lascada, apc }: { vb: number; vbLimite: number; lascada: boolean; apc: boolean }) {
  const escala = 400; // px por mm (exagerado)
  const largura = Math.min(110, vb * escala);
  const limite = vbLimite * escala;
  return (
    <figure className="figura">
      <svg viewBox="0 0 300 170" role="img" aria-label={`Face de folga da aresta com marca de desgaste de ${num(vb, 2)} milímetros${lascada ? ', aresta lascada' : ''}${apc ? ', com material aderido' : ''}.`}>
        <path d="M30,20 L270,20 L240,160 L60,160 Z" fill="#2b2f36" stroke="#d8dee6" />
        <rect x="40" y="20" width="220" height={largura} fill="#a7b1bd" opacity="0.85" />
        <line x1="34" y1={20 + limite} x2="266" y2={20 + limite} stroke="#ff8a1f" strokeDasharray="5 4" />
        <text x="266" y={16 + limite} textAnchor="end" className="desenho-nota laranja">limite didático VB {num(vbLimite, 2)} mm</text>
        {lascada && <path d="M150,20 L162,48 L174,30 L186,52 L196,20 Z" fill="#0e1621" stroke="#ff6b6b" strokeWidth="1.5" />}
        {apc && <ellipse cx="90" cy="18" rx="18" ry="7" fill="#c6ced8" stroke="#6b7684" />}
        <text x="150" y="14" textAnchor="middle" className="desenho-nota">aresta de corte</text>
        <text x="40" y={Math.max(34, 20 + largura + 14)} className="desenho-nota">marca de flanco VB ≈ {num(vb, 3)} mm</text>
      </svg>
      <figcaption>
        Face de folga vista de frente, com escala muito exagerada.{lascada ? ' ✕ Lascamento indicado em vermelho.' : ''}{' '}
        {apc ? 'O material aderido na aresta é a aresta postiça.' : ''}
      </figcaption>
    </figure>
  );
}
