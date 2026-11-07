import { useEffect, useRef, useState, type MouseEvent } from 'react';
import type { AchadoVisivel, Aquisicao, AquisicaoMicrografia, AquisicaoVisual, Vinculo } from '../../motor/tipos';
import { achadosDisponiveis, marcarEncontrado, registrarEvidencia } from '../../motor/estado';
import { grupoPorId } from '../../motor/interpretacoes';
import { desenharMicrografia } from '../render/micrografia';
import { desenharSuperficie } from '../render/superficie';
import { paraMm, paraPx, type Mapa } from '../render/comum';
import { useJogo } from '../contexto';
import { ListaLimitacoes, Modal, SeloQualidade } from './comuns';
import { VisorPerfil } from './Microdureza';

export const LARGURA_IMG = 640;
export const ALTURA_IMG = 400;

/** Dimensões do canvas: a visão geral de uma fratura (faixa 84 × 16 mm) usa um canvas baixo. */
export function dimensoesImagem(aq: AquisicaoVisual | AquisicaoMicrografia): { w: number; h: number } {
  if (aq.tipo === 'visual' && aq.vista === 'geral' && aq.superficie.startsWith('fratura')) return { w: LARGURA_IMG, h: 150 };
  return { w: LARGURA_IMG, h: ALTURA_IMG };
}

/** Canvas com a imagem esquemática de uma aquisição visual ou micrográfica. */
export function ImagemAquisicao({
  aq,
  largura = dimensoesImagem(aq).w,
  altura = dimensoesImagem(aq).h,
  semRotulo,
  onMapa,
}: {
  aq: AquisicaoVisual | AquisicaoMicrografia;
  largura?: number;
  altura?: number;
  semRotulo?: boolean;
  onMapa?: (m: Mapa) => void;
}) {
  const { caso, estado } = useJogo();
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    let mapa: Mapa;
    if (aq.tipo === 'visual') mapa = desenharSuperficie(c, caso, aq, semRotulo);
    else {
      const am = estado.amostras.find((a) => a.id === aq.amostraId);
      const pr = estado.preparos.find((p) => p.id === aq.preparoId);
      if (!am || !pr) return;
      mapa = desenharMicrografia(c, caso, am, pr, aq, { semRotulo });
    }
    onMapa?.(mapa);
    // a imagem depende só da aquisição (determinística)
  }, [aq.id, largura, altura]);
  return <canvas ref={ref} width={largura} height={altura} className="imagem-aquisicao" />;
}

export function Miniatura({ aq }: { aq: Aquisicao }) {
  if (aq.tipo === 'visual' || aq.tipo === 'micrografia') return <ImagemAquisicao aq={aq} largura={160} altura={100} semRotulo />;
  if (aq.tipo === 'microdureza') {
    const max = Math.max(...aq.pontos.map((p) => p.hv));
    const min = Math.min(...aq.pontos.map((p) => p.hv));
    const us = aq.pontos.map((p) => p.u);
    const u0 = Math.min(...us);
    const u1 = Math.max(...us);
    const pts = aq.pontos.map((p) => `${((p.u - u0) / Math.max(1e-6, u1 - u0)) * 150 + 5},${95 - ((p.hv - min) / Math.max(1, max - min)) * 85}`);
    return (
      <svg width={160} height={100} className="miniatura-grafico" aria-label="Miniatura do perfil de dureza">
        <rect width={160} height={100} />
        <polyline points={pts.join(' ')} />
      </svg>
    );
  }
  return (
    <div className="miniatura-doc" aria-hidden>
      <span>📄</span>
    </div>
  );
}

/** Visualizador completo de uma aquisição, com busca de feições e registro de observações. */
export function VisorAquisicao({ aq, interativo = true }: { aq: Aquisicao; interativo?: boolean }) {
  return (
    <div className="visor">
      <header className="visor-cabecalho">
        <strong>{aq.id}</strong> <span>{aq.rotulo}</span>
        {aq.tipo !== 'documento' && <span className="etiqueta">{aq.tipo === 'microdureza' ? 'dados sintéticos' : 'imagem esquemática'}</span>}
      </header>
      {(aq.tipo === 'visual' || aq.tipo === 'micrografia') && <VisorImagem aq={aq} interativo={interativo} />}
      {aq.tipo === 'microdureza' && <VisorPerfil aq={aq} />}
      <ListaObservacoes aq={aq} />
      <ListaLimitacoes limitacoes={aq.limitacoes} />
    </div>
  );
}

function VisorImagem({ aq, interativo }: { aq: AquisicaoVisual | AquisicaoMicrografia; interativo: boolean }) {
  const { estado, alterar, avisar } = useJogo();
  const [mapa, setMapa] = useState<Mapa | null>(null);
  const [dicas, setDicas] = useState(false);
  const locais = aq.achados.filter((a) => a.modo === 'local');
  const { w: LW, h: LH } = dimensoesImagem(aq);

  const clicar = (e: MouseEvent<SVGSVGElement>) => {
    if (!mapa || !interativo) return;
    const r = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * LW;
    const y = ((e.clientY - r.top) / r.height) * LH;
    const [u, v] = paraMm(mapa, x, y);
    const tol = 16 / mapa.escala;
    const achado = locais.find(
      (a) => !aq.encontrados.includes(a.chave) && a.marcadores.some((m) => Math.hypot(m.u - u, m.v - v) < m.raio + tol),
    );
    if (achado) {
      alterar((s) => marcarEncontrado(s, aq.id, achado.chave));
      avisar('Feição localizada: a observação foi adicionada à lista abaixo.', 'ok');
    } else {
      avisar('Nada de distinto identificado neste ponto. Examine outra região.');
    }
  };

  return (
    <div className="imagem-com-camada">
      <ImagemAquisicao aq={aq} onMapa={setMapa} />
      {mapa && (
        <svg
          className={`camada ${interativo ? 'clicavel' : ''}`}
          viewBox={`0 0 ${LW} ${LH}`}
          onClick={clicar}
          role="button"
          aria-label="Clique para examinar um ponto da imagem"
        >
          {aq.tipo === 'visual' &&
            aq.removidos.map((r) => {
              const [x0, y0] = paraPx(mapa, Math.max(r.u[0], aq.janela.u[0]), Math.max(r.v[0], aq.janela.v[0]));
              const [x1] = paraPx(mapa, Math.min(r.u[1], aq.janela.u[1]), 0);
              if (x1 <= x0) return null;
              return (
                <text key={r.amostraId} x={(x0 + x1) / 2} y={Math.max(y0 + 14, 14)} className="rotulo-removido" textAnchor="middle">
                  removido ({r.amostraId})
                </text>
              );
            })}
          {locais.map((a) => {
            const achado = aq.encontrados.includes(a.chave);
            if (!achado && !(dicas && estado.modo === 'aprender')) return null;
            return a.marcadores.slice(0, 12).map((m, k) => {
              const [x, y] = paraPx(mapa, m.u, m.v);
              const rr = Math.min(70, Math.max(10, m.raio * mapa.escala + 6));
              return <circle key={`${a.chave}-${k}`} cx={x} cy={y} r={rr} className={achado ? 'marcador' : 'marcador-dica'} />;
            });
          })}
        </svg>
      )}
      {interativo && (
        <div className="legenda-imagem">
          <span>Clique na imagem para examinar um ponto (sem custo). Feições localizadas ficam circuladas em laranja.</span>
          {estado.modo === 'aprender' && locais.length > 0 && (
            <label>
              <input type="checkbox" checked={dicas} onChange={(e) => setDicas(e.target.checked)} /> mostrar onde procurar
            </label>
          )}
        </div>
      )}
    </div>
  );
}

export function ListaObservacoes({ aq }: { aq: Aquisicao }) {
  const { estado } = useJogo();
  const [formulario, setFormulario] = useState<AchadoVisivel | null>(null);
  const disp = achadosDisponiveis(aq);
  return (
    <div className="observacoes">
      <h4>{aq.tipo === 'documento' ? 'Informações do documento' : aq.tipo === 'microdureza' ? 'Leituras registráveis' : 'Observações disponíveis'}</h4>
      {disp.length === 0 && <p className="vazio">Nenhuma observação distinta neste resultado.</p>}
      <ul>
        {disp.map((a) => {
          const ev = estado.evidencias.find((e) => e.aquisicaoId === aq.id && e.chave === a.chave);
          return (
            <li key={a.chave}>
              {aq.tipo !== 'documento' && <SeloQualidade q={a.qualidade} />}
              <span className="texto-obs">{a.observacao}</span>
              {ev ? (
                <span className="ja-registrado">✓ {ev.id}</span>
              ) : (
                <button className="botao pequeno" onClick={() => setFormulario(a)} disabled={estado.concluido}>
                  Registrar no caderno
                </button>
              )}
            </li>
          );
        })}
      </ul>
      {formulario && <FormEvidencia aq={aq} achado={formulario} onFechar={() => setFormulario(null)} />}
    </div>
  );
}

export const ROTULO_VINCULO: Record<Vinculo, string> = { apoia: 'apoia', enfraquece: 'enfraquece', inconclusiva: 'inconclusiva' };
export const ICONE_VINCULO: Record<Vinculo, string> = { apoia: '＋', enfraquece: '－', inconclusiva: '？' };

export function SeletorVinculo({ valor, onMudar }: { valor: Vinculo | undefined; onMudar: (v: Vinculo | null) => void }) {
  return (
    <span className="seletor-vinculo" role="radiogroup">
      {(['apoia', 'enfraquece', 'inconclusiva'] as Vinculo[]).map((v) => (
        <button
          key={v}
          role="radio"
          aria-checked={valor === v}
          className={`vinc vinc-${v} ${valor === v ? 'ativo' : ''}`}
          onClick={() => onMudar(valor === v ? null : v)}
          title={ROTULO_VINCULO[v]}
        >
          {ICONE_VINCULO[v]} {ROTULO_VINCULO[v]}
        </button>
      ))}
    </span>
  );
}

function FormEvidencia({ aq, achado, onFechar }: { aq: Aquisicao; achado: AchadoVisivel; onFechar: () => void }) {
  const { caso, estado, executar, avisar } = useJogo();
  const grupo = grupoPorId(caso, achado.grupo);
  const [interp, setInterp] = useState<string>('');
  const [nota, setNota] = useState('');
  const [vinculos, setVinculos] = useState<Record<string, Vinculo>>({});
  const hips = [...caso.publico.hipoteses].sort(
    (a, b) => Number(!!estado.hipoteses[b.id]?.selecionada) - Number(!!estado.hipoteses[a.id]?.selecionada),
  );
  const salvar = () => {
    const id = executar((e) =>
      registrarEvidencia(e, { aquisicaoId: aq.id, chave: achado.chave, interpretacaoId: interp || undefined, nota, vinculos }),
    );
    if (id) {
      avisar(`Evidência ${id} registrada no caderno.`, 'ok');
      onFechar();
    }
  };
  return (
    <Modal titulo="Registrar evidência no caderno" onFechar={onFechar} largo>
      <div className="form-evidencia">
        <section>
          <h4>Observação — o que se vê</h4>
          <p className="observacao-fixa">{achado.observacao}</p>
          <p className="origem">
            Origem: {aq.id} · {aq.rotulo} {aq.tipo !== 'documento' && <SeloQualidade q={achado.qualidade} />}
          </p>
        </section>
        {grupo && (
          <section>
            <h4>Interpretação — o que você conclui</h4>
            <label className="rotulo">{grupo.pergunta}</label>
            <select value={interp} onChange={(e) => setInterp(e.target.value)}>
              <option value="">(sem interpretação por enquanto)</option>
              {grupo.opcoes.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.texto}
                </option>
              ))}
            </select>
          </section>
        )}
        <section>
          <label className="rotulo" htmlFor="nota-ev">
            Nota (opcional)
          </label>
          <textarea id="nota-ev" rows={2} value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Ex.: comparar com o corte do outro lado" />
        </section>
        <section>
          <h4>Relação com as hipóteses</h4>
          <p className="ajuda">Marque só o que esta evidência permite dizer. Deixe em branco se não tiver relação.</p>
          <table className="tabela-vinculos">
            <tbody>
              {hips.map((h) => (
                <tr key={h.id} className={estado.hipoteses[h.id]?.selecionada ? 'hip-selecionada' : ''}>
                  <td>
                    <span className={`cat cat-${h.categoria}`}>{h.categoria === 'fator' ? 'fator' : h.categoria}</span> {h.titulo}
                  </td>
                  <td>
                    <SeletorVinculo
                      valor={vinculos[h.id]}
                      onMudar={(v) =>
                        setVinculos((old) => {
                          const n = { ...old };
                          if (v) n[h.id] = v;
                          else delete n[h.id];
                          return n;
                        })
                      }
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <footer className="acoes">
          <button className="botao" onClick={onFechar}>
            Cancelar
          </button>
          <button className="botao primario" onClick={salvar}>
            Registrar evidência
          </button>
        </footer>
      </div>
    </Modal>
  );
}
