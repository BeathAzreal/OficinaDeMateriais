// Desenho técnico didático da encomenda (SVG). Os requisitos vêm dos dados da missão.

import type { Encomenda, Material } from '../../modelo/tipos';
import { num } from '../formato';

export function DesenhoTecnico({ enc, material }: { enc: Encomenda; material: Material }) {
  const { tarugo, requisitos: req } = enc;
  const balanco = tarugo.comprimentoTotal - tarugo.comprimentoFixado;
  const W = 700;
  const H = 370;
  const s = 4.4; // px/mm
  const xFace = 570;
  const eixo = 165;
  const X = (z: number) => xFace - z * s;
  const rB = (tarugo.diametro / 2) * s;
  const rF = (req.diametro.nominal / 2) * s;
  const L = req.comprimento.nominal;
  const d = req.diametro;
  const tolTxt = `${d.tolSup === 0 ? '0' : num(d.tolSup)}/${d.tolInf === 0 ? '0' : '−' + num(Math.abs(d.tolInf))}`;
  const xFix = X(balanco);
  const xFimTarugo = X(balanco + Math.min(tarugo.comprimentoFixado, 22));

  return (
    <svg
      className="desenho"
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={`Desenho técnico: tarugo Ø ${tarugo.diametro} mm. Usinar Ø ${req.diametro.nominal} (${tolTxt}) mm em ${L} ± ${req.comprimento.tol} mm a partir da face livre, Ra máxima ${req.ra.max} µm.`}
    >
      <defs>
        <pattern id="hachura" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="6" stroke="#ff8a1f" strokeWidth="1.2" />
        </pattern>
        <marker id="seta" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" fill="#cfd8e3" />
        </marker>
      </defs>
      <rect x="0" y="0" width={W} height={H} fill="#f4f6f8" opacity="0.03" />
      {/* parte bruta + dentro da placa (tracejada) */}
      <rect x={xFimTarugo} y={eixo - rB} width={xFix - xFimTarugo} height={2 * rB} fill="none" stroke="#7f8fa3" strokeDasharray="5 4" />
      <text x={(xFimTarugo + xFix) / 2} y={eixo + rB + 14} className="desenho-nota" textAnchor="middle">
        fixado na placa ({tarugo.comprimentoFixado} mm)
      </text>
      {/* sobremetal a remover */}
      <rect x={X(L)} y={eixo - rB} width={L * s} height={rB - rF} fill="url(#hachura)" opacity="0.55" />
      <rect x={X(L)} y={eixo + rF} width={L * s} height={rB - rF} fill="url(#hachura)" opacity="0.55" />
      {/* contorno final */}
      <path
        d={`M${xFix},${eixo - rB} L${X(L)},${eixo - rB} L${X(L)},${eixo - rF} L${xFace},${eixo - rF} L${xFace},${eixo + rF} L${X(L)},${eixo + rF} L${X(L)},${eixo + rB} L${xFix},${eixo + rB}`}
        fill="none"
        stroke="#e6ebf1"
        strokeWidth="2"
      />
      {/* contorno bruto na região usinada */}
      <path d={`M${X(L)},${eixo - rB} L${xFace},${eixo - rB} L${xFace},${eixo + rB} L${X(L)},${eixo + rB}`} fill="none" stroke="#7f8fa3" strokeDasharray="2 3" />
      <line x1={xFix} y1={eixo - rB - 10} x2={xFix} y2={eixo + rB + 10} stroke="#7f8fa3" strokeWidth="3" />
      {/* eixo */}
      <line x1={xFimTarugo - 6} y1={eixo} x2={xFace + 16} y2={eixo} stroke="#9fb0c4" strokeDasharray="14 4 2 4" />

      {/* cota de diâmetro final */}
      <line x1={xFace + 26} y1={eixo - rF} x2={xFace + 26} y2={eixo + rF} stroke="#cfd8e3" markerStart="url(#seta)" markerEnd="url(#seta)" />
      <line x1={xFace + 2} y1={eixo - rF} x2={xFace + 32} y2={eixo - rF} stroke="#7f8fa3" />
      <line x1={xFace + 2} y1={eixo + rF} x2={xFace + 32} y2={eixo + rF} stroke="#7f8fa3" />
      <text x={xFace + 36} y={eixo - 8} className="desenho-cota">Ø {num(d.nominal)}</text>
      <text x={xFace + 36} y={eixo + 8} className="desenho-cota-tol">{tolTxt}</text>
      <text x={xFace + 36} y={eixo + 22} className="desenho-nota">
        {num(d.nominal + d.tolInf)} a {num(d.nominal + d.tolSup)}
      </text>
      {/* cota de diâmetro bruto */}
      <line x1={X(62)} y1={eixo - rB} x2={X(62)} y2={eixo + rB} stroke="#cfd8e3" markerStart="url(#seta)" markerEnd="url(#seta)" />
      <text x={X(62) + 6} y={eixo - rB + 30} className="desenho-cota">Ø {tarugo.diametro} (bruto)</text>
      {/* cota de comprimento */}
      <line x1={X(L)} y1={eixo - rB - 30} x2={xFace} y2={eixo - rB - 30} stroke="#cfd8e3" markerStart="url(#seta)" markerEnd="url(#seta)" />
      <line x1={X(L)} y1={eixo - rB - 36} x2={X(L)} y2={eixo - rB - 2} stroke="#7f8fa3" />
      <line x1={xFace} y1={eixo - rB - 36} x2={xFace} y2={eixo - rF - 2} stroke="#7f8fa3" />
      <text x={(X(L) + xFace) / 2} y={eixo - rB - 36} className="desenho-cota" textAnchor="middle">
        {L} ± {num(req.comprimento.tol, 1)}
      </text>
      {/* balanço */}
      <line x1={xFix} y1={eixo + rB + 34} x2={xFace} y2={eixo + rB + 34} stroke="#9fb0c4" markerStart="url(#seta)" markerEnd="url(#seta)" />
      <text x={(xFix + xFace) / 2} y={eixo + rB + 30} className="desenho-nota" textAnchor="middle">
        balanço {balanco} (referência)
      </text>
      {/* rugosidade */}
      <g transform={`translate(${X(L * 0.42)}, ${eixo - rF - 4})`}>
        <path d="M-6,-8 L-2,0 L6,-16 L26,-16" fill="none" stroke="#ff8a1f" strokeWidth="1.6" />
        <text x="30" y="-12" className="desenho-cota laranja">Ra ≤ {num(req.ra.max, 1)} µm</text>
      </g>
      {/* seções de medição */}
      {enc.pontosMedicao.map((p) => (
        <g key={p.id}>
          <line x1={X(p.z)} y1={eixo + rB + 4} x2={X(p.z)} y2={eixo + rB + 14} stroke="#cfd8e3" />
          <text x={X(p.z)} y={eixo + rB + 50} textAnchor="middle" className="desenho-cota">
            {p.id}
          </text>
          <text x={X(p.z)} y={eixo + rB + 62} textAnchor="middle" className="desenho-nota">
            z={p.z}
          </text>
        </g>
      ))}
      {/* legenda */}
      <g transform={`translate(12, ${H - 46})`}>
        <rect width="14" height="10" fill="url(#hachura)" stroke="#ff8a1f" strokeWidth="0.6" />
        <text x="20" y="9" className="desenho-nota">sobremetal a remover ({num((tarugo.diametro - d.nominal) / 2)} mm no raio)</text>
        <line x1="0" y1="24" x2="14" y2="24" stroke="#7f8fa3" strokeDasharray="5 4" />
        <text x="20" y="28" className="desenho-nota">parte fixada / contorno bruto</text>
      </g>
      {/* legenda do material */}
      <g transform="translate(12, 8)">
        <rect width="244" height="52" fill="none" stroke="#7f8fa3" />
        <text x="8" y="16" className="desenho-nota">{enc.codigo} · {enc.titulo}</text>
        <text x="8" y="31" className="desenho-nota">{material.nome} · {material.condicaoFornecimento.toLowerCase()}</text>
        <text x="8" y="45" className="desenho-nota laranja">Requisitos fictícios · sem escala · mm</text>
      </g>
    </svg>
  );
}
