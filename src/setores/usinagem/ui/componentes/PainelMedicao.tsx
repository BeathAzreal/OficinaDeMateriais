import { useState } from 'react';
import type { Contexto } from '../../dados/catalogo';
import { ferramentas } from '../../dados/catalogo';
import { pecaAtual, type Acao, type EstadoPartida, type RegistroOperacao } from '../../jogo/partida';
import { faixaRa } from '../../modelo/fenomenos';
import { avaliarDiametro, leitura, limitesDiametro } from '../../modelo/medicao';
import { celulaEm, type Peca } from '../../modelo/peca';
import type { ComponentesRa } from '../../modelo/tipos';
import { comSinal, num } from '../formato';
import { SuperficieAmpliada } from './Esquemas';

const STATUS: Record<string, string> = { conforme: '✓ dentro', acima: '▲ acima do limite', abaixo: '▼ abaixo do limite' };

export const LIMITACOES_RA = [
  'Só a parcela geométrica (f²/32rε) vem de uma relação conhecida. As outras parcelas são sintéticas e servem para mostrar tendências.',
  'Vibração (chatter), deflexão dinâmica, temperatura, fluido de corte e revestimento não são modelados, e na prática alteram a Ra.',
  'As parcelas são somadas. Essa é uma hipótese do jogo, não uma lei física.',
  'Uma Ra medida depende do rugosímetro, do comprimento de amostragem e do filtro. Nada disso é simulado aqui.',
  'A faixa de ±30 % só lembra que o valor é indicativo. Ela não foi calculada como incerteza.',
  'Na furação, a Ra da parede é ainda mais simplificada: referência da broca + aresta postiça + desgaste.',
];

interface Serie {
  rotulo: string;
  peca: Peca;
  campo: 'diametros' | 'furo';
  estilo: 'principal' | 'anterior';
}

/** Gráfico de perfil ao longo de z, lido com a resolução do micrômetro. Faixa de tolerância opcional. */
function GraficoPerfil({
  titulo,
  series,
  zMax,
  resolucao,
  faixa,
}: {
  titulo: string;
  series: Serie[];
  zMax: number;
  resolucao: number;
  faixa?: { min: number; max: number; nominal: number; L: number };
}) {
  const W = 420;
  const H = 200;
  const m = { l: 52, r: 12, t: 14, b: 34 };
  const principal = series.find((s) => s.estilo === 'principal')!;
  let dMin = Infinity;
  let dMax = -Infinity;
  const zLim = faixa ? faixa.L : zMax;
  for (let z = 0.25; z < zLim; z += 0.5) {
    const d = principal.peca[principal.campo][celulaEm(principal.peca, z)];
    if (principal.campo === 'furo' && d <= 0) continue;
    dMin = Math.min(dMin, d);
    dMax = Math.max(dMax, d);
  }
  if (!Number.isFinite(dMin)) {
    dMin = 0;
    dMax = 1;
  }
  let yMin = dMin - 0.05;
  let yMax = dMax + 0.05;
  if (faixa) {
    yMin = Math.min(faixa.nominal - 0.15, yMin);
    yMax = Math.max(faixa.nominal + 0.15, Math.min(yMax, principal.peca.diametroBruto + 0.05));
  }
  if (yMax - yMin < 0.2) {
    const c = (yMax + yMin) / 2;
    yMin = c - 0.1;
    yMax = c + 0.1;
  }
  const faixaY = yMax - yMin;
  const passoY = faixaY <= 0.4 ? 0.05 : faixaY <= 1 ? 0.1 : faixaY <= 2.5 ? 0.25 : faixaY <= 6 ? 1 : 5;
  const marcasY: number[] = [];
  for (let v = Math.ceil(yMin / passoY) * passoY; v <= yMax + 1e-9; v += passoY) marcasY.push(v);
  const X = (z: number) => m.l + (z / zMax) * (W - m.l - m.r);
  const Y = (d: number) => m.t + ((yMax - Math.min(yMax, Math.max(yMin, d))) / (yMax - yMin)) * (H - m.t - m.b);
  const caminho = (s: Serie) => {
    const pts: string[] = [];
    for (let z = 0.25; z <= zMax; z += 0.5) {
      const bruto = s.peca[s.campo][celulaEm(s.peca, z)];
      if (s.campo === 'furo' && bruto <= 0) break;
      pts.push(`${X(z).toFixed(1)},${Y(leitura(bruto, resolucao)).toFixed(1)}`);
    }
    return pts.join(' ');
  };
  const marcasZ: number[] = [];
  const passoZ = zMax > 60 ? 20 : 10;
  for (let z = 0; z <= zMax; z += passoZ) marcasZ.push(z);
  return (
    <figure className="figura">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${titulo}: perfil lido com resolução de ${resolucao} milímetro ao longo de z.`}>
        <defs>
          <pattern id="hachTol" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="6" stroke="#3fb68b" strokeWidth="1" />
          </pattern>
        </defs>
        {faixa && (
          <>
            <rect x={X(0)} y={Y(faixa.max)} width={X(faixa.L) - X(0)} height={Math.max(1, Y(faixa.min) - Y(faixa.max))} fill="url(#hachTol)" opacity="0.5" stroke="#3fb68b" />
            <text x={X(faixa.L) - 2} y={Y(faixa.max) - 4} textAnchor="end" className="desenho-nota">limite sup. {num(faixa.max)}</text>
            <text x={X(faixa.L) - 2} y={Y(faixa.min) + 12} textAnchor="end" className="desenho-nota">limite inf. {num(faixa.min)}</text>
            <line x1={X(faixa.L)} x2={X(faixa.L)} y1={m.t} y2={H - m.b} stroke="#7f8fa3" strokeDasharray="3 3" />
          </>
        )}
        {marcasY.map((v) => (
          <g key={v}>
            <line x1={m.l - 4} x2={m.l} y1={Y(v)} y2={Y(v)} stroke="#7f8fa3" />
            <text x={m.l - 6} y={Y(v) + 4} textAnchor="end" className="desenho-nota">
              {num(v, passoY < 0.1 ? 2 : passoY < 1 ? 2 : 0)}
            </text>
          </g>
        ))}
        {marcasZ.map((z) => (
          <g key={z}>
            <line x1={X(z)} x2={X(z)} y1={H - m.b} y2={H - m.b + 4} stroke="#7f8fa3" />
            <text x={X(z)} y={H - m.b + 16} textAnchor="middle" className="desenho-nota">
              {z}
            </text>
          </g>
        ))}
        <text x={(W + m.l) / 2} y={H - 4} textAnchor="middle" className="desenho-nota">z [mm] a partir da face livre</text>
        <text x={m.l + 4} y={m.t + 10} className="desenho-nota">{titulo} [mm]</text>
        {series
          .filter((s) => s.estilo === 'anterior')
          .map((s, i) => (
            <polyline key={s.rotulo} points={caminho(s)} fill="none" stroke="#7f8fa3" strokeDasharray={i ? '2 3' : '6 3'} strokeWidth="1.2" />
          ))}
        <polyline points={caminho(principal)} fill="none" stroke="#ff8a1f" strokeWidth="2" />
      </svg>
      <figcaption>
        Linha laranja contínua: perfil atual lido com resolução de {num(resolucao)} mm (projetor de perfil didático).
        {faixa ? ' Faixa hachurada: tolerância do desenho.' : ''}
        {series.some((s) => s.estilo === 'anterior') && ` Cinza tracejado: ${series.filter((s) => s.estilo === 'anterior').map((s) => s.rotulo).join(' e ')}.`} Escala
        vertical ampliada (de {num(yMin, 2)} a {num(yMax, 2)} mm); valores fora dela ficam na borda.
      </figcaption>
    </figure>
  );
}

function BarrasRa({ c }: { c: ComponentesRa }) {
  const itens: [string, number][] = [
    ['Marcas do avanço (geométrica + piso)', c.geometrica + c.piso],
    ['Aresta postiça', c.apc],
    ['Desgaste de flanco', c.desgaste],
    ['Atrito (ap pequena)', c.atrito],
    ['Lascamento', c.lascamento],
  ];
  const max = Math.max(c.total, 0.01);
  return (
    <table className="tabela barras">
      <caption>Parcelas da Ra estimada [µm]</caption>
      <tbody>
        {itens.map(([r, v]) => (
          <tr key={r}>
            <th scope="row">{r}</th>
            <td>
              <span className="barra-h" style={{ width: `${(v / max) * 100}%` }} aria-hidden />
            </td>
            <td className="num">{num(v, 2)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ResumoOperacao({ r }: { r: RegistroOperacao }) {
  const f = ferramentas[r.ferramentaId];
  return (
    <dl className="grade-dados">
      <dt>Ferramenta</dt>
      <dd>
        T{String(r.estacao).padStart(2, '0')} · {f.codigo}
      </dd>
      <dt>Parâmetros</dt>
      <dd>
        S {num(r.params.n, 0)} rpm · F {num(r.params.f)} mm/volta ·{' '}
        {r.tipo === 'tornear'
          ? `ap ${num(r.params.ap)} mm · L ${num(r.params.L, 1)} mm (${r.params.operacao})`
          : `P ${num(r.params.P, 1)} mm · pica-pau ${r.params.q > 0 ? `${num(r.params.q, 1)} mm (${r.previsao.descargas} descargas)` : 'não'}`}
      </dd>
      <dt>Cinemática</dt>
      <dd>
        vc {num(r.vcModelo, 0)} m/min {r.tipo === 'tornear' ? '(no Ø usinado)' : '(periferia da broca)'} · vf {num(r.previsao.vf, 0)} mm/min · tempo{' '}
        {num(r.tipo === 'furar' ? r.tcEfetivo : r.previsao.tc, 3)} min
      </dd>
      <dt>Material removido</dt>
      <dd>{num(r.volume / 1000, 2)} cm³</dd>
      <dt>Cavaco</dt>
      <dd>
        {r.cavaco.rotulo}. {r.cavaco.descricao}
        {r.tempoLimpeza > 0 ? ` (+${num(r.tempoLimpeza, 1)} min para retirar)` : ''}
      </dd>
      <dt>Carga máxima</dt>
      <dd>
        {r.nivelCargaMax} (qualitativo)
        {r.tipo === 'tornear' && r.lascouEm !== null ? ` · ✕ a aresta lascou em z ≈ ${num(r.lascouEm, 1)} mm` : ''}
        {r.tipo === 'furar' && r.entupimentoMax > 1.05 ? ` · cavaco entupindo o canal (até ×${num(r.entupimentoMax, 1)})` : ''}
        {r.tipo === 'furar' && r.gumeTransversalCortou ? ' · gume transversal cortando (furo maciço)' : r.tipo === 'furar' ? ' · sem gume transversal (havia pré-furo)' : ''}
        {r.tipo === 'furar' && r.quebrouEm !== null ? ` · ✕ broca quebrou a ${num(r.quebrouEm, 1)} mm` : ''}
      </dd>
      {r.tipo === 'furar' && (
        <>
          <dt>Furo (modelo)</dt>
          <dd>
            sobremedida da broca + desgaste: Ø maior que o nominal da broca. Ra estimada da parede ≈ {num(r.raFuro, 1)} µm (faixa didática {num(faixaRa(r.raFuro)[0], 1)}–
            {num(faixaRa(r.raFuro)[1], 1)} µm).
          </dd>
        </>
      )}
    </dl>
  );
}

interface Props {
  ctx: Contexto;
  estado: EstadoPartida;
  despachar(a: Acao): string | null;
  ocupado: boolean;
}

export function PainelMedicao({ ctx, estado, despachar, ocupado }: Props) {
  const { encomenda: enc } = ctx;
  const enc_ = estado.modo === 'encomenda';
  const [z, setZ] = useState(enc_ ? 25 : 10);
  const pj = pecaAtual(estado);
  const passesPeca = pj.passes.map((n) => estado.passes[n - 1]);
  const ultimo = passesPeca[passesPeca.length - 1];
  const medicoes = estado.medicoes.filter((m) => m.pecaNumero === pj.numero).slice().reverse();
  const req = enc.requisitos;
  const lim = limitesDiametro(enc);
  const res = enc.instrumentos.micrometro.resolucao;
  const temFuro = pj.peca.furo.some((d) => d > 0);
  const zMaxPeca = pj.peca.balanco - 0.5;

  if (ocupado) {
    return (
      <div className="painel-conteudo">
        <h2>Medição</h2>
        <p>A máquina está trabalhando. Termine o bloco (ou use “Fim do bloco”) para medir.</p>
      </div>
    );
  }

  const i = celulaEm(pj.peca, z);
  const origem = pj.peca.origem[i];
  const regOrigem = origem > 0 ? estado.passes[origem - 1] : undefined;
  const comp = regOrigem?.tipo === 'tornear' ? regOrigem.celulas[i]?.ra ?? null : null;
  const raTotal = comp?.total ?? null;
  const faixa = raTotal !== null ? faixaRa(raTotal) : null;
  const anterior = passesPeca.length >= 2 ? passesPeca[passesPeca.length - 2] : null;
  const seriesExt: Serie[] = [{ rotulo: 'atual', peca: pj.peca, campo: 'diametros', estilo: 'principal' }];
  if (anterior) seriesExt.push({ rotulo: `depois da operação ${anterior.numero}`, peca: anterior.pecaDepois, campo: 'diametros', estilo: 'anterior' });
  else if (ultimo) seriesExt.push({ rotulo: 'tarugo bruto', peca: ultimo.pecaAntes, campo: 'diametros', estilo: 'anterior' });

  return (
    <div className="painel-conteudo">
      <h2>Medição da peça {pj.numero}</h2>
      {pj.estado === 'refugo' && (
        <div className="alerta" role="alert">
          <strong>✕ {pj.bloqueio ? 'Peça inutilizada.' : 'Peça refugada.'}</strong> {pj.bloqueio ?? pj.motivosRefugo.map((m) => m.texto).join(' ')}{' '}
          {enc_ ? 'Carregue um tarugo novo em PEÇA. O histórico continua disponível.' : ''}
        </div>
      )}

      <h3>Instrumentos</h3>
      {enc_ && (
        <div className="acoes" role="group" aria-label="Seções do desenho">
          {enc.pontosMedicao.map((p) => (
            <button key={p.id} type="button" className="botao" onClick={() => despachar({ tipo: 'medir', alvo: p.id })} title={p.descricao}>
              ⌀ Seção {p.id} (Z −{p.z})
            </button>
          ))}
        </div>
      )}
      <div className="campo">
        <label htmlFor="pos-z">
          Posição de medição livre: <strong>Z −{num(z, 1)} mm</strong>
        </label>
        <input id="pos-z" type="range" min={0.5} max={zMaxPeca} step={0.5} value={z} onChange={(e) => setZ(Number(e.target.value))} />
      </div>
      <div className="acoes">
        <button type="button" className="botao" onClick={() => despachar({ tipo: 'medir', alvo: 'externo', z })}>
          ⌀ Ø externo em Z −{num(z, 1)}
        </button>
        <button type="button" className="botao" disabled={!temFuro} onClick={() => despachar({ tipo: 'medir', alvo: 'interno', z })}>
          ◎ Ø do furo em Z −{num(z, 1)}
        </button>
        <button type="button" className="botao" onClick={() => despachar({ tipo: 'medir', alvo: 'comprimento' })}>
          ↔ Comprimento usinado
        </button>
        <button type="button" className="botao" disabled={!temFuro} onClick={() => despachar({ tipo: 'medir', alvo: 'profundidade' })}>
          ↧ Profundidade do furo
        </button>
      </div>
      <p className="nota">
        Micrômetros externo e interno: resolução {num(res)} mm, incerteza didática ±{num(enc.instrumentos.micrometro.incerteza)} mm. Paquímetro: resolução{' '}
        {num(enc.instrumentos.paquimetro.resolucao)} mm. A leitura arredonda o valor do modelo, sem ruído sorteado.
      </p>
      {medicoes.length > 0 ? (
        <table className="tabela">
          <thead>
            <tr>
              <th scope="col">Medição</th>
              {enc_ && <th scope="col">Nominal</th>}
              {enc_ && <th scope="col">Tolerância</th>}
              <th scope="col">Leitura</th>
              {enc_ && <th scope="col">Situação</th>}
            </tr>
          </thead>
          <tbody>
            {medicoes.map((m) => {
              const ponto = enc_ && enc.pontosMedicao.find((p) => p.id === m.alvo && p.id !== 'R');
              const av = ponto ? avaliarDiametro(m.valor, enc) : null;
              const ehComp = m.alvo === 'comprimento';
              return (
                <tr key={m.numero}>
                  <th scope="row">
                    {m.rotulo}
                    <div className="nota">após operação {m.aposPasse || '— (bruta)'}</div>
                  </th>
                  {enc_ && <td>{av ? num(req.diametro.nominal) : ehComp ? num(req.comprimento.nominal, 1) : m.alvo === 'R' ? `${num(enc.tarugo.diametro)} (bruto)` : '—'}</td>}
                  {enc_ && (
                    <td>
                      {av
                        ? `${num(lim.min)} a ${num(lim.max)}`
                        : ehComp
                          ? `${num(req.comprimento.nominal - req.comprimento.tol, 1)} a ${num(req.comprimento.nominal + req.comprimento.tol, 1)}`
                          : m.alvo === 'R'
                            ? 'manter bruto'
                            : '—'}
                    </td>
                  )}
                  <td className="num">{m.valor > 0 ? `${num(m.valor, 2)} mm` : m.alvo === 'interno' ? 'maciço' : `${num(m.valor, 2)} mm`}</td>
                  {enc_ && (
                    <td>
                      {av ? (
                        <>
                          {STATUS[av.status]}
                          {av.pertoDoLimite && <div className="nota">perto do limite (dentro da incerteza)</div>}
                          <div className="nota">desvio do nominal {comSinal(av.desvio, 2)}</div>
                        </>
                      ) : ehComp ? (
                        Math.abs(m.valor - req.comprimento.nominal) <= req.comprimento.tol + 1e-9 ? '✓ dentro' : '✕ fora'
                      ) : m.alvo === 'R' ? (
                        m.valor >= enc.tarugo.diametro - 1e-9 ? '✓ bruto' : '✕ usinado'
                      ) : (
                        '—'
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : (
        <p className="nota">Nenhuma medição nesta peça ainda.</p>
      )}

      <h3>Perfil externo</h3>
      <GraficoPerfil
        titulo="Ø externo"
        series={seriesExt}
        zMax={enc_ ? 60 : pj.peca.balanco}
        resolucao={res}
        faixa={enc_ ? { min: lim.min, max: lim.max, nominal: req.diametro.nominal, L: req.comprimento.nominal } : undefined}
      />
      {temFuro && (
        <>
          <h3>Perfil do furo</h3>
          <GraficoPerfil titulo="Ø do furo" series={[{ rotulo: 'furo', peca: pj.peca, campo: 'furo', estilo: 'principal' }]} zMax={pj.peca.balanco} resolucao={res} />
        </>
      )}

      <h3>Superfície externa em Z −{num(z, 1)}</h3>
      {comp && regOrigem?.tipo === 'tornear' && faixa ? (
        <>
          <p>
            Superfície gerada na operação {regOrigem.numero} ({ferramentas[regOrigem.ferramentaId].codigo}, f = {num(regOrigem.params.f)} mm/volta, vc ≈{' '}
            {num(regOrigem.vcModelo, 0)} m/min). <strong>Ra estimada ≈ {num(raTotal!, 1)} µm</strong> (faixa didática {num(faixa[0], 1)}–{num(faixa[1], 1)} µm)
            {enc_ ? `; objetivo ≤ ${num(req.ra.max, 1)} µm → ${raTotal! <= req.ra.max ? '✓ atende pela estimativa' : '✕ não atende pela estimativa'}` : ''}.
          </p>
          <SuperficieAmpliada f={regOrigem.params.f} raioPonta={(ferramentas[regOrigem.ferramentaId] as { raioPonta: number }).raioPonta} comp={comp} />
          <BarrasRa c={comp} />
        </>
      ) : (
        <p className="nota">Nesta posição a superfície continua a original de fornecimento. A Ra não é estimada para superfície bruta.</p>
      )}
      <details className="termo">
        <summary>Limitações da rugosidade estimada</summary>
        <ul>
          {LIMITACOES_RA.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      </details>

      {ultimo && (
        <>
          <h3>
            Última operação (#{ultimo.numero}, {ultimo.tipo === 'tornear' ? 'torneamento' : 'furação'})
          </h3>
          <ResumoOperacao r={ultimo} />
        </>
      )}
    </div>
  );
}
