import { useState } from 'react';
import type { Carga } from '../../casos/tipos';
import { CUSTOS, custoPerfil } from '../../motor/recursos';
import { descreverPreparo } from '../../motor/metalografia';
import { DISTANCIA_BORDA_DIAGONAIS, DISTANCIA_MIN_DIAGONAIS, MAX_PONTOS, diagonaisReferencia, gerarTrajeto } from '../../motor/microdureza';
import { registrarPerfil } from '../../motor/estado';
import { useJogo } from '../contexto';
import { CartaoEstacao, Dicas, Preco } from '../componentes/comuns';
import { MapaSecao, MarcasNoMapa } from '../componentes/Microdureza';
import { Miniatura, VisorAquisicao } from '../componentes/VisorAquisicao';
import { paraPx } from '../render/comum';

const CARGAS: Carga[] = ['HV0.1', 'HV0.5', 'HV1'];
const NOME_CARGA: Record<Carga, string> = { 'HV0.1': 'HV0,1 (0,98 N)', 'HV0.5': 'HV0,5 (4,9 N)', HV1: 'HV1 (9,8 N)' };

export function EstacaoMicrodureza() {
  const { caso, estado, executar, selecionarResultado, resultadoSelecionado } = useJogo();
  const [preparoId, setPreparoId] = useState<string | null>(estado.preparos[estado.preparos.length - 1]?.id ?? null);
  const [carga, setCarga] = useState<Carga>('HV0.5');
  const [z, setZ] = useState(1.0);
  const [inicio, setInicio] = useState(-16);
  const [fim, setFim] = useState(4);
  const [esp, setEsp] = useState(0.5);
  const [pontos, setPontos] = useState<{ u: number; v: number }[]>([]);

  const preparo = estado.preparos.find((p) => p.id === preparoId) ?? null;
  const amostra = preparo ? estado.amostras.find((a) => a.id === preparo.amostraId) ?? null : null;
  const perfis = estado.aquisicoes.filter((a) => a.tipo === 'microdureza');
  const atual = perfis.find((a) => a.id === resultadoSelecionado) ?? perfis[perfis.length - 1];
  const anteriores = perfis.filter((a) => a.tipo === 'microdureza' && a.preparoId === preparoId).flatMap((a) => (a.tipo === 'microdureza' ? a.pontos : []));
  const ref = diagonaisReferencia(carga);
  const eixo = amostra?.orientacao === 'longitudinal' ? 'y' : 'x';

  const avisosPrevios: string[] = [];
  if (esp < DISTANCIA_MIN_DIAGONAIS * ref.mole) {
    avisosPrevios.push(
      `Espaçamento de ${fmt(esp)} mm é menor que ${DISTANCIA_MIN_DIAGONAIS} diagonais estimadas em material mole (${DISTANCIA_MIN_DIAGONAIS} × ${Math.round(ref.mole * 1000)} µm).`,
    );
  }
  if (z < DISTANCIA_BORDA_DIAGONAIS * ref.mole) avisosPrevios.push('Profundidade muito próxima da superfície para esta carga.');
  if (pontos.length > MAX_PONTOS) avisosPrevios.push(`Máximo de ${MAX_PONTOS} pontos por perfil.`);

  const gerar = () => {
    const novos = gerarTrajeto(inicio, fim, esp, z);
    setPontos(novos);
  };
  const executarPerfil = () => {
    if (!preparo || pontos.length === 0) return;
    const id = executar((e) => registrarPerfil(caso, e, { preparoId: preparo.id, carga, pontos: pontos.slice(0, MAX_PONTOS) }));
    if (id) {
      selecionarResultado(id);
      setPontos([]);
    }
  };

  return (
    <div className="estacao">
      <CartaoEstacao
        titulo="Perfil de microdureza Vickers"
        finalidade="Medir como a dureza varia ao longo de um trajeto que atravessa a junta, relacionando-a às zonas observadas."
        informacao="Numérica e pontual (uma marca por posição). Indício de mudanças microestruturais; não mede tenacidade nem fragilidade."
        custos={[
          { item: 'Preparação do ensaio (por perfil)', custo: CUSTOS.microdurezaPreparacao },
          { item: 'Cada indentação', custo: CUSTOS.porIndentacao },
        ]}
      />
      <Dicas estacao="microdureza" />
      <div className="grade-metalografia">
        <section className="painel">
          <h3>1. Amostra preparada</h3>
          {estado.preparos.length === 0 ? (
            <p className="vazio">Prepare uma amostra na estação de metalografia (corte transversal, polida).</p>
          ) : (
            <div className="lista-opcoes">
              {estado.preparos.map((p) => (
                <button
                  key={p.id}
                  className={`opcao ${p.id === preparoId ? 'ativa' : ''}`}
                  onClick={() => {
                    setPreparoId(p.id);
                    setPontos([]);
                  }}
                >
                  <small>{descreverPreparo(p)}</small>
                </button>
              ))}
            </div>
          )}
        </section>
        <section className="painel">
          <h3>2. Parâmetros</h3>
          <fieldset>
            <legend>Carga</legend>
            {CARGAS.map((c) => {
              const r = diagonaisReferencia(c);
              return (
                <label key={c} className="opcao-param">
                  <input type="radio" checked={carga === c} onChange={() => setCarga(c)} /> {NOME_CARGA[c]}
                  <small>
                    diagonal esperada ≈ {Math.round(r.mole * 1000)} µm a 200 HV e {Math.round(r.dura * 1000)} µm a 450 HV
                  </small>
                </label>
              );
            })}
          </fieldset>
          <fieldset className="campos-trajeto">
            <legend>Trajeto em linha (z constante)</legend>
            <label>
              Profundidade z (mm)
              <input type="number" step={0.1} min={0.1} max={11.9} value={z} onChange={(e) => setZ(+e.target.value)} />
            </label>
            <label>
              Início {eixo} (mm)
              <input type="number" step={0.5} value={inicio} onChange={(e) => setInicio(+e.target.value)} />
            </label>
            <label>
              Fim {eixo} (mm)
              <input type="number" step={0.5} value={fim} onChange={(e) => setFim(+e.target.value)} />
            </label>
            <label>
              Espaçamento (mm)
              <input type="number" step={0.05} min={0.05} value={esp} onChange={(e) => setEsp(Math.max(0.02, +e.target.value))} />
            </label>
          </fieldset>
          <div className="linha-botoes">
            <button className="botao" onClick={gerar} disabled={!amostra}>
              Gerar pontos do trajeto
            </button>
            <button className="botao" onClick={() => setPontos([])} disabled={pontos.length === 0}>
              Limpar pontos
            </button>
          </div>
          <p className="ajuda">Também é possível clicar na seção para acrescentar ou remover pontos individuais.</p>
          {estado.modo === 'aprender' && avisosPrevios.length > 0 && (
            <ul className="avisos-previos">
              {avisosPrevios.map((a) => (
                <li key={a}>▲ {a}</li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {amostra && preparo && (
        <section className="painel">
          <h3>3. Posicionamento das indentações — {preparo.id}</h3>
          <MapaSecao
            amostra={amostra}
            preparo={preparo}
            rotulo={preparo.ataque === 'nenhum' ? 'Seção sem ataque: zonas não visíveis' : 'Seção atacada: zonas visíveis a olho nu'}
            onClique={(u, v) =>
              setPontos((old) => {
                const perto = old.findIndex((p) => Math.hypot(p.u - u, p.v - v) < 0.25);
                if (perto >= 0) return old.filter((_, i) => i !== perto);
                return [...old, { u: +u.toFixed(3), v: +v.toFixed(3) }];
              })
            }
            camada={(m) => (
              <g>
                <MarcasNoMapa mapa={m} pontos={anteriores} />
                {pontos.length > 1 &&
                  (() => {
                    const [x0, y0] = paraPx(m, pontos[0].u, pontos[0].v);
                    const [x1, y1] = paraPx(m, pontos[pontos.length - 1].u, pontos[pontos.length - 1].v);
                    return <line x1={x0} y1={y0} x2={x1} y2={y1} className="trajeto" />;
                  })()}
                <MarcasNoMapa mapa={m} pontos={[]} pendentes={pontos} />
              </g>
            )}
          />
          <div className="linha-botoes">
            <span className="ajuda">
              {pontos.length} ponto(s) planejado(s){anteriores.length ? ` · ${anteriores.length} marca(s) já feitas nesta superfície` : ''}
            </span>
            <button className="botao primario" onClick={executarPerfil} disabled={pontos.length === 0 || estado.concluido}>
              Executar perfil <Preco custo={custoPerfil(Math.min(pontos.length, MAX_PONTOS))} />
            </button>
          </div>
        </section>
      )}

      <section className="painel resultado">
        <h3>Perfis de dureza</h3>
        <div className="faixa-miniaturas">
          {perfis.map((a) => (
            <button key={a.id} className={`mini ${atual?.id === a.id ? 'ativa' : ''}`} onClick={() => selecionarResultado(a.id)} title={a.rotulo}>
              <Miniatura aq={a} />
              <span>{a.id}</span>
            </button>
          ))}
        </div>
        {atual ? <VisorAquisicao aq={atual} /> : <p className="vazio">Nenhum perfil ainda.</p>}
      </section>
    </div>
  );
}

function fmt(n: number): string {
  return n.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
}
