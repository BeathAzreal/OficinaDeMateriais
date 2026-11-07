import { useState } from 'react';
import type { Iluminacao } from '../../casos/tipos';
import { CUSTOS } from '../../motor/recursos';
import { JANELA_DETALHE, janelaVisual, regioesRemovidas } from '../../motor/inspecao';
import { limparSuperficie, registrarVisual } from '../../motor/estado';
import { useJogo } from '../contexto';
import { BotaoConfirmar, CartaoEstacao, Dicas, Preco } from '../componentes/comuns';
import { Miniatura, VisorAquisicao } from '../componentes/VisorAquisicao';

const NOME_LIMPEZA = { 'como-recebida': 'como recebida', suave: 'limpeza suave', agressiva: 'escovada (escova de aço)' } as const;

export function EstacaoVisual({ superficieInicial }: { superficieInicial?: string }) {
  const { caso, estado, executar, selecionarResultado, resultadoSelecionado } = useJogo();
  const [supId, setSupId] = useState(superficieInicial ?? 'fratura-A');
  const [luz, setLuz] = useState<Iluminacao>('rasante');
  const [centro, setCentro] = useState<{ u: number; v: number } | null>(null);
  const sup = caso.publico.superficies.find((s) => s.id === supId)!;
  const limpeza = estado.limpezas[supId] ?? 'como-recebida';
  const visuais = estado.aquisicoes.filter((a) => a.tipo === 'visual');
  const atual = visuais.find((a) => a.id === resultadoSelecionado) ?? visuais[visuais.length - 1];
  const fratura = sup.tipo === 'fratura';

  const registrar = (vista: 'geral' | 'detalhe') => {
    const id = executar((e) => registrarVisual(caso, e, { superficie: supId, vista, centro: centro ?? undefined, iluminacao: luz }));
    if (id) selecionarResultado(id);
  };

  return (
    <div className="estacao">
      <CartaoEstacao
        titulo="Inspeção visual e da superfície de fratura"
        finalidade="Documentar a peça como recebida, localizar a origem e reconhecer marcas macroscópicas da fratura e da geometria do cordão."
        informacao="Morfológica e macroscópica (superfície). Não mostra o interior nem a microestrutura."
        custos={[
          { item: 'Limpeza suave', custo: CUSTOS.limpeza.suave },
          { item: 'Limpeza agressiva', custo: CUSTOS.limpeza.agressiva },
          { item: 'Registro — visão geral', custo: CUSTOS.visual.geral },
          { item: 'Registro — detalhe ~10×', custo: CUSTOS.visual.detalhe },
        ]}
      />
      <Dicas estacao="visual" />
      <div className="grade-estacao">
        <section className="painel">
          <h3>1. Superfície</h3>
          <div className="lista-opcoes">
            {caso.publico.superficies.map((s) => (
              <button
                key={s.id}
                className={`opcao ${s.id === supId ? 'ativa' : ''}`}
                onClick={() => {
                  setSupId(s.id);
                  setCentro(null);
                }}
              >
                <strong>{s.nome}</strong>
                <small>{NOME_LIMPEZA[estado.limpezas[s.id] ?? 'como-recebida']}</small>
              </button>
            ))}
          </div>
          <p className="ajuda">{sup.descricao}</p>

          <h3>2. Limpeza (irreversível)</h3>
          <p>
            Estado atual: <strong>{NOME_LIMPEZA[limpeza]}</strong>
          </p>
          <div className="linha-botoes">
            <button className="botao" disabled={limpeza !== 'como-recebida' || estado.concluido} onClick={() => executar((e) => limparSuperficie(caso, e, supId, 'suave'))}>
              {fratura ? 'Solvente + escova de nylon' : 'Removedor de tinta + escova macia'} <Preco custo={CUSTOS.limpeza.suave} />
            </button>
            <BotaoConfirmar
              aviso="A escova de aço altera a superfície de forma permanente. Continuar?"
              desativado={limpeza === 'agressiva' || estado.concluido}
              onConfirmar={() => executar((e) => limparSuperficie(caso, e, supId, 'agressiva'))}
            >
              Escova de aço rotativa <Preco custo={CUSTOS.limpeza.agressiva} />
            </BotaoConfirmar>
          </div>

          <h3>3. Iluminação</h3>
          <div className="radio-linha" role="radiogroup">
            {(['rasante', 'difusa'] as Iluminacao[]).map((l) => (
              <label key={l}>
                <input type="radio" checked={luz === l} onChange={() => setLuz(l)} /> {l === 'rasante' ? 'Rasante (oblíqua): realça relevo' : 'Difusa: realça tonalidades'}
              </label>
            ))}
          </div>

          <h3>4. Registro</h3>
          <button className="botao primario" onClick={() => registrar('geral')} disabled={estado.concluido}>
            Registrar visão geral <Preco custo={CUSTOS.visual.geral} />
          </button>
          <p className="ajuda">
            Para o detalhe, clique no mapa abaixo para posicionar a janela do estereoscópio ({JANELA_DETALHE.u} × {JANELA_DETALHE.v} mm).
          </p>
          <MapaSuperficie supId={supId} centro={centro} onCentro={setCentro} />
          <button className="botao primario" onClick={() => registrar('detalhe')} disabled={!centro || estado.concluido}>
            Registrar detalhe ~10× <Preco custo={CUSTOS.visual.detalhe} />
          </button>
        </section>

        <section className="painel resultado">
          <h3>Resultados desta estação</h3>
          <div className="faixa-miniaturas">
            {visuais.map((a) => (
              <button key={a.id} className={`mini ${atual?.id === a.id ? 'ativa' : ''}`} onClick={() => selecionarResultado(a.id)} title={a.rotulo}>
                <Miniatura aq={a} />
                <span>{a.id}</span>
              </button>
            ))}
          </div>
          {atual ? <VisorAquisicao aq={atual} /> : <p className="vazio">Nenhum registro visual ainda.</p>}
        </section>
      </div>
    </div>
  );
}

/** Mapa esquemático (SVG) da superfície para posicionar a janela do detalhe. */
function MapaSuperficie({ supId, centro, onCentro }: { supId: string; centro: { u: number; v: number } | null; onCentro: (c: { u: number; v: number }) => void }) {
  const { caso, estado } = useJogo();
  const sup = caso.publico.superficies.find((s) => s.id === supId)!;
  const [u0, u1] = sup.eixoU.faixa;
  const [v0, v1] = sup.eixoV.faixa;
  const larg = u1 - u0;
  const alt = v1 - v0;
  const removidos = regioesRemovidas(caso, estado, sup);
  const janelas = estado.aquisicoes.filter((a) => a.tipo === 'visual' && a.superficie === supId && a.vista === 'detalhe');
  const jan = centro ? janelaVisual(sup, 'detalhe', centro) : null;
  const fs = Math.max(larg, alt) / 40;
  const d = caso.publico.desenho;
  const fratura = sup.tipo === 'fratura';
  return (
    <>
      <svg
        className="mapa-superficie"
        viewBox={`${u0} ${v0} ${larg} ${alt}`}
        preserveAspectRatio={fratura ? 'none' : 'xMidYMid meet'}
        style={{ height: fratura ? 130 : 260 }}
        onClick={(e) => {
          const svg = e.currentTarget;
          const pt = svg.createSVGPoint();
          pt.x = e.clientX;
          pt.y = e.clientY;
          const p = pt.matrixTransform(svg.getScreenCTM()!.inverse());
          if (p.x >= u0 && p.x <= u1 && p.y >= v0 && p.y <= v1) onCentro({ u: p.x, v: p.y });
        }}
        role="img"
        aria-label={`Mapa de ${sup.nome}`}
      >
        {fratura ? (
          <rect x={0} y={0} width={d.largura} height={d.espessura} className="contorno-superficie" />
        ) : (
          <>
            <rect x={u0} y={0} width={larg} height={d.largura} className="contorno-superficie" />
            {supId !== 'metal-base' && (
              <rect
                x={-(supId === 'raiz-cordao' ? 2.5 : d.meiaLarguraCordao)}
                y={0}
                width={2 * (supId === 'raiz-cordao' ? 2.5 : d.meiaLarguraCordao)}
                height={d.largura}
                className="cordao-mapa"
              />
            )}
            {supId !== 'metal-base' && <line x1={d.xFraturaFace} x2={d.xFraturaFace} y1={0} y2={d.largura} className="fratura" strokeWidth={fs * 0.15} />}
          </>
        )}
        {removidos.map((r) => (
          <rect key={r.amostraId} x={r.u[0]} y={Math.max(r.v[0], v0)} width={r.u[1] - r.u[0]} height={Math.min(r.v[1], v1) - Math.max(r.v[0], v0)} className="removida" />
        ))}
        {janelas.map(
          (a) => a.tipo === 'visual' && <rect key={a.id} x={a.janela.u[0]} y={a.janela.v[0]} width={a.janela.u[1] - a.janela.u[0]} height={a.janela.v[1] - a.janela.v[0]} className="janela-feita" />,
        )}
        {jan && <rect x={jan.u[0]} y={jan.v[0]} width={jan.u[1] - jan.u[0]} height={jan.v[1] - jan.v[0]} className="janela-prevista" />}
      </svg>
      <p className="legenda-imagem">
        <span>
          Horizontal: {sup.eixoU.rotulo}, de {Math.round(u0)} a {Math.round(u1)} · vertical (de cima para baixo): {sup.eixoV.rotulo}, de {Math.round(v0)} a{' '}
          {Math.round(v1)}
          {fratura ? ' · escala vertical ampliada' : ''}
        </span>
      </p>
    </>
  );
}
