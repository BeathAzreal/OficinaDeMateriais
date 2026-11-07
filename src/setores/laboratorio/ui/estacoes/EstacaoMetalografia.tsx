import { useState } from 'react';
import type { Ampliacao, Ataque, Lixamento, Orientacao, Polimento } from '../../casos/tipos';
import { CUSTOS, custoPreparo } from '../../motor/recursos';
import {
  CAMPO_MM,
  NOMES_ATAQUE,
  NOMES_LIXAMENTO,
  NOMES_POLIMENTO,
  descreverAmostra,
  descreverPreparo,
  janelaCampo,
  planejarCorte,
} from '../../motor/metalografia';
import { cortarAmostra, prepararAmostra, registrarMicrografia } from '../../motor/estado';
import { useJogo } from '../contexto';
import { BotaoConfirmar, CartaoEstacao, Dicas, ListaLimitacoes, Preco } from '../componentes/comuns';
import { PecaSVG } from '../componentes/PecaSVG';
import { MapaSecao } from '../componentes/Microdureza';
import { Miniatura, VisorAquisicao } from '../componentes/VisorAquisicao';
import { paraPx } from '../render/comum';

const EXPLICA_LIX: Record<Lixamento, string> = {
  'lixa-220': 'Só a lixa grossa: rápido, mas deixa riscos profundos e camada deformada.',
  'lixa-600': 'Sequência intermediária.',
  'lixa-1200': 'Sequência completa: riscos finos, fáceis de remover no polimento.',
};
const EXPLICA_POL: Record<Polimento, string> = {
  nenhum: 'Superfície apenas lixada: serve para macrografia, não para microscopia.',
  'diamante-6': 'Remove a maior parte dos riscos de lixas finas.',
  'diamante-6-1': 'Acabamento espelhado para microscopia.',
};
const EXPLICA_AT: Record<Ataque, string> = {
  nenhum: 'Sem ataque: bom contraste para trincas, poros e inclusões; microestrutura invisível.',
  'nital-5s': 'Ataque leve: revela contornos, ferrita/perlita e zonas da junta.',
  'nital-30s': 'Ataque prolongado: escurece e alarga contornos.',
};

export function EstacaoMetalografia() {
  const { caso, estado, executar, selecionarResultado, resultadoSelecionado } = useJogo();
  const [orientacao, setOrientacao] = useState<Orientacao>('transversal');
  const [ponto, setPonto] = useState<{ x: number; y: number } | null>(null);
  const [vistaPeca, setVistaPeca] = useState<'junta' | 'inteira'>('junta');
  const [amostraId, setAmostraId] = useState<string | null>(estado.amostras[estado.amostras.length - 1]?.id ?? null);
  const [lix, setLix] = useState<Lixamento>('lixa-1200');
  const [pol, setPol] = useState<Polimento>('diamante-6-1');
  const [at, setAt] = useState<Ataque>('nital-5s');
  const [preparoId, setPreparoId] = useState<string | null>(null);
  const [amp, setAmp] = useState<Ampliacao>(100);
  const [centro, setCentro] = useState<{ u: number; v: number } | null>(null);

  const amostra = estado.amostras.find((a) => a.id === amostraId) ?? null;
  const preparos = estado.preparos.filter((p) => p.amostraId === amostraId);
  const preparo = preparos.find((p) => p.id === preparoId) ?? preparos[preparos.length - 1] ?? null;
  const micros = estado.aquisicoes.filter((a) => a.tipo === 'micrografia');
  const atual = micros.find((a) => a.id === resultadoSelecionado) ?? micros[micros.length - 1];
  const planoErro = ponto ? planejarCorte(caso, estado, { orientacao, ...ponto }, 'x') : null;

  const cortar = () => {
    if (!ponto) return;
    const id = executar((e) => cortarAmostra(caso, e, { orientacao, ...ponto }));
    if (id) {
      setAmostraId(id);
      setPreparoId(null);
      setCentro(null);
      setPonto(null);
    }
  };
  const preparar = () => {
    if (!amostra) return;
    const id = executar((e) => prepararAmostra(caso, e, { amostraId: amostra.id, lixamento: lix, polimento: pol, ataque: at }));
    if (id) setPreparoId(id);
  };
  const capturar = () => {
    if (!preparo || !centro) return;
    const id = executar((e) => registrarMicrografia(caso, e, { preparoId: preparo.id, ampliacao: amp, centro }));
    if (id) selecionarResultado(id);
  };

  return (
    <div className="estacao">
      <CartaoEstacao
        titulo="Metalografia"
        finalidade="Observar a microestrutura num plano de corte: zonas da junta, constituintes, trincas e poros nesse plano e o trajeto da fratura em perfil."
        informacao="Microestrutural e local (um plano por corte). Depende do local do corte, da preparação, do ataque e da ampliação."
        custos={[
          { item: 'Corte + embutimento', custo: CUSTOS.corte },
          { item: 'Preparação completa (#1200, 1 µm, Nital)', custo: custoPreparo('lixa-1200', 'diamante-6-1', 'nital-5s') },
          { item: 'Micrografia 10×', custo: CUSTOS.micrografia[10] },
          { item: 'Micrografia 100×', custo: CUSTOS.micrografia[100] },
          { item: 'Micrografia 500×', custo: CUSTOS.micrografia[500] },
        ]}
      />
      <Dicas estacao="metalografia" />
      <div className="grade-metalografia">
        <section className="painel">
          <h3>1. Corte (destrutivo)</h3>
          <div className="radio-linha" role="radiogroup">
            <label>
              <input type="radio" checked={orientacao === 'transversal'} onChange={() => setOrientacao('transversal')} /> Transversal à junta (atravessa MB–ZTA–ZF)
            </label>
            <label>
              <input type="radio" checked={orientacao === 'longitudinal'} onChange={() => setOrientacao('longitudinal')} /> Longitudinal ao cordão
            </label>
          </div>
          <div className="radio-linha">
            <button className={`botao pequeno ${vistaPeca === 'junta' ? 'ativo' : ''}`} onClick={() => setVistaPeca('junta')}>
              Região da junta
            </button>
            <button className={`botao pequeno ${vistaPeca === 'inteira' ? 'ativo' : ''}`} onClick={() => setVistaPeca('inteira')}>
              Barra inteira
            </button>
          </div>
          <PecaSVG vista={vistaPeca} modo="ponto" ponto={ponto} onPonto={setPonto} orientacao={orientacao} altura={vistaPeca === 'junta' ? 300 : 170} />
          <p className="ajuda">
            Clique na peça para posicionar o corte. A fatia (8 mm de largura, ~40 mm de comprimento) aparece tracejada em laranja.
            {ponto && (
              <>
                {' '}
                Centro: x = {ponto.x.toFixed(1).replace('.', ',')} mm, y = {ponto.y.toFixed(1).replace('.', ',')} mm.
              </>
            )}
          </p>
          {typeof planoErro === 'string' && <p className="erro-inline">{planoErro}</p>}
          <BotaoConfirmar
            classe="botao primario"
            aviso="O corte remove material da peça de forma permanente. Cortar?"
            desativado={!ponto || typeof planoErro === 'string' || estado.concluido}
            onConfirmar={cortar}
          >
            Cortar e embutir <Preco custo={CUSTOS.corte} />
          </BotaoConfirmar>

          <h3>Amostras</h3>
          {estado.amostras.length === 0 && <p className="vazio">Nenhuma amostra retirada.</p>}
          <div className="lista-opcoes">
            {estado.amostras.map((a) => (
              <button
                key={a.id}
                className={`opcao ${a.id === amostraId ? 'ativa' : ''}`}
                onClick={() => {
                  setAmostraId(a.id);
                  setPreparoId(null);
                  setCentro(null);
                }}
              >
                <small>{descreverAmostra(a)}</small>
              </button>
            ))}
          </div>
        </section>

        <section className="painel">
          <h3>2. Preparação {amostra ? `de ${amostra.id}` : ''}</h3>
          {!amostra ? (
            <p className="vazio">Retire e selecione uma amostra.</p>
          ) : (
            <>
              <fieldset>
                <legend>Lixamento</legend>
                {(Object.keys(NOMES_LIXAMENTO) as Lixamento[]).map((k) => (
                  <label key={k} className="opcao-param">
                    <input type="radio" checked={lix === k} onChange={() => setLix(k)} /> {NOMES_LIXAMENTO[k]} <Preco custo={CUSTOS.lixamento[k]} />
                    {estado.modo === 'aprender' && <small>{EXPLICA_LIX[k]}</small>}
                  </label>
                ))}
              </fieldset>
              <fieldset>
                <legend>Polimento</legend>
                {(Object.keys(NOMES_POLIMENTO) as Polimento[]).map((k) => (
                  <label key={k} className="opcao-param">
                    <input type="radio" checked={pol === k} onChange={() => setPol(k)} /> {NOMES_POLIMENTO[k]} <Preco custo={CUSTOS.polimento[k]} />
                    {estado.modo === 'aprender' && <small>{EXPLICA_POL[k]}</small>}
                  </label>
                ))}
              </fieldset>
              <fieldset>
                <legend>Ataque químico</legend>
                {(Object.keys(NOMES_ATAQUE) as Ataque[]).map((k) => (
                  <label key={k} className="opcao-param">
                    <input type="radio" checked={at === k} onChange={() => setAt(k)} /> {NOMES_ATAQUE[k]} <Preco custo={CUSTOS.ataque[k]} />
                    {estado.modo === 'aprender' && <small>{EXPLICA_AT[k]}</small>}
                  </label>
                ))}
              </fieldset>
              <button className="botao primario" onClick={preparar} disabled={estado.concluido}>
                Preparar {amostra.id} <Preco custo={custoPreparo(lix, pol, at)} />
              </button>
              <p className="ajuda">Uma nova preparação regride a superfície e substitui a anterior para novas imagens e indentações.</p>
              {preparos.length > 0 && (
                <div className="lista-opcoes">
                  {preparos.map((p) => (
                    <button key={p.id} className={`opcao ${p.id === preparo?.id ? 'ativa' : ''}`} onClick={() => setPreparoId(p.id)}>
                      <small>{descreverPreparo(p)}</small>
                    </button>
                  ))}
                </div>
              )}
              {preparo && <ListaLimitacoes limitacoes={preparo.limitacoes} titulo={`Limitações da preparação ${preparo.id}`} />}
            </>
          )}
        </section>
      </div>

      {amostra && preparo && (
        <section className="painel">
          <h3>3. Microscópio — {preparo.id}</h3>
          <div className="radio-linha" role="radiogroup">
            {([10, 100, 500] as Ampliacao[]).map((a) => (
              <label key={a}>
                <input type="radio" checked={amp === a} onChange={() => setAmp(a)} /> {a}× (campo {fmtCampo(a)}) <Preco custo={CUSTOS.micrografia[a]} />
              </label>
            ))}
          </div>
          <MapaSecao
            amostra={amostra}
            preparo={preparo}
            onClique={(u, v) => setCentro({ u, v })}
            camada={(m) => (
              <g>
                {micros
                  .filter((x) => x.tipo === 'micrografia' && x.preparoId === preparo.id)
                  .map((x) => {
                    if (x.tipo !== 'micrografia') return null;
                    const [a0, b0] = paraPx(m, x.janela.u[0], x.janela.v[0]);
                    const [a1, b1] = paraPx(m, x.janela.u[1], x.janela.v[1]);
                    return <rect key={x.id} x={a0} y={b0} width={Math.max(2, a1 - a0)} height={Math.max(2, b1 - b0)} className="janela-feita" />;
                  })}
                {centro &&
                  (() => {
                    const j = janelaCampo(centro, amp);
                    const [a0, b0] = paraPx(m, j.u[0], j.v[0]);
                    const [a1, b1] = paraPx(m, j.u[1], j.v[1]);
                    const [cx, cy] = paraPx(m, centro.u, centro.v);
                    return (
                      <g>
                        <rect x={a0} y={b0} width={Math.max(3, a1 - a0)} height={Math.max(3, b1 - b0)} className="janela-prevista" />
                        <circle cx={cx} cy={cy} r={6} className="janela-prevista" />
                      </g>
                    );
                  })()}
              </g>
            )}
          />
          <div className="linha-botoes">
            <span className="ajuda">
              {centro
                ? `Centro do campo: ${amostra.orientacao === 'transversal' ? 'x' : 'y'} = ${centro.u.toFixed(2).replace('.', ',')} mm, z = ${centro.v.toFixed(2).replace('.', ',')} mm`
                : 'Clique na seção para posicionar o campo.'}
            </span>
            <button className="botao primario" onClick={capturar} disabled={!centro || estado.concluido}>
              Capturar micrografia {amp}× <Preco custo={CUSTOS.micrografia[amp]} />
            </button>
          </div>
        </section>
      )}

      <section className="painel resultado">
        <h3>Micrografias</h3>
        <div className="faixa-miniaturas">
          {micros.map((a) => (
            <button key={a.id} className={`mini ${atual?.id === a.id ? 'ativa' : ''}`} onClick={() => selecionarResultado(a.id)} title={a.rotulo}>
              <Miniatura aq={a} />
              <span>{a.id}</span>
            </button>
          ))}
        </div>
        {atual ? <VisorAquisicao aq={atual} /> : <p className="vazio">Nenhuma micrografia ainda.</p>}
      </section>
    </div>
  );
}

function fmtCampo(a: Ampliacao): string {
  const c = CAMPO_MM[a];
  return c.u >= 1 ? `${c.u.toFixed(1).replace('.', ',')} × ${c.v.toFixed(1).replace('.', ',')} mm` : `${Math.round(c.u * 1000)} × ${Math.round(c.v * 1000)} µm`;
}
