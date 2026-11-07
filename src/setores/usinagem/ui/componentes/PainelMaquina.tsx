// Painel da máquina: vista do torno, mostrador de coordenadas (DRO), botões de ciclo e
// indicadores durante o corte. O relógio de apresentação vive aqui.

import { useEffect, useRef, useState } from 'react';
import { avancarRelogio, quadroDaOperacao, VELOCIDADES } from '../../jogo/animacao';
import { duracaoOperacao, type RegistroOperacao } from '../../jogo/partida';
import type { Peca } from '../../modelo/peca';
import type { Ferramenta, Material, NivelCarga, PontoMedicao } from '../../modelo/tipos';
import { T } from '../../jogo/programa';
import { num } from '../formato';
import { Torno, type PrevisaoDesenho } from './Torno';

export interface EstadoCiclo {
  executando: boolean; // programa em execução automática
  blocoABloco: boolean;
  cursor: number;
  total: number;
  alarme: string | null;
  mensagem: string | null;
}

interface Props {
  peca: Peca;
  material: Material;
  ferramenta: Ferramenta | null;
  estacao: number;
  registro: RegistroOperacao | null;
  /** Identifica cada execução; muda só quando uma operação nova começa a ser mostrada. */
  execucao: number;
  previsao: PrevisaoDesenho | null;
  velocidade: number;
  onVelocidade(v: number): void;
  onFim(): void;
  ciclo: EstadoCiclo;
  onCicloInicio(): void;
  onReset(): void;
  onBlocoABloco(v: boolean): void;
  aproximacao: number;
  pontos: PontoMedicao[];
  ressalto: number | null;
  aviso: string | null;
}

const NIVEIS: NivelCarga[] = ['baixa', 'moderada', 'alta', 'crítica'];

function Dro({ rotulo, valor, unidade }: { rotulo: string; valor: string; unidade: string }) {
  return (
    <div className="dro-eixo">
      <span className="dro-rotulo">{rotulo}</span>
      <span className="dro-valor">{valor}</span>
      <span className="dro-unidade">{unidade}</span>
    </div>
  );
}

export function PainelMaquina(p: Props) {
  // O tempo fica associado à operação: ao trocar de operação, o quadro recomeça em zero.
  const [relogio, setRelogio] = useState<{ id: number; t: number }>({ id: -1, t: 0 });
  const [rodando, setRodando] = useState(false);
  const tRef = useRef(0);
  const velRef = useRef(p.velocidade);
  velRef.current = p.velocidade;
  const fimRef = useRef(p.onFim);
  fimRef.current = p.onFim;
  const avisado = useRef<number>(-1);
  const reg = p.registro;
  const id = p.execucao;
  const tFinal = reg ? duracaoOperacao(reg) : 0;
  const tSim = relogio.id === id ? relogio.t : 0;
  const setTSim = (t: number) => setRelogio({ id, t });

  // Só uma execução nova reinicia o relógio (o estado é reconstruído a cada ação,
  // então o objeto da operação muda mesmo quando a operação é a mesma).
  useEffect(() => {
    tRef.current = 0;
    setRelogio({ id, t: 0 });
    setRodando(id >= 0);
  }, [id]);

  useEffect(() => {
    if (!reg || !rodando) return;
    let raf = 0;
    let ultimo = performance.now();
    const passo = (agora: number) => {
      const dt = Math.min(0.1, (agora - ultimo) / 1000);
      ultimo = agora;
      tRef.current = avancarRelogio(tRef.current, dt, velRef.current, tFinal);
      setTSim(tRef.current);
      if (tRef.current >= tFinal) {
        setRodando(false);
        return;
      }
      raf = requestAnimationFrame(passo);
    };
    raf = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, rodando, tFinal]);

  const quadro = reg ? quadroDaOperacao(reg, tSim, p.aproximacao) : null;
  const concluido = !!quadro?.concluido;

  // Avisa o fim da animação uma única vez por operação.
  useEffect(() => {
    if (reg && concluido && avisado.current !== id) {
      avisado.current = id;
      fimRef.current();
    }
  }, [reg, id, concluido]);

  const irAoFim = () => {
    if (!reg) return;
    tRef.current = tFinal;
    setTSim(tFinal);
    setRodando(false);
  };

  const cicloInicio = () => {
    if (reg && !concluido && !rodando) setRodando(true); // retoma depois da parada de avanço
    else if (!reg || concluido) p.onCicloInicio();
  };

  // DRO: X em diâmetro, Z negativo para dentro da peça.
  let x = p.peca.dref;
  let z = 2;
  let s = 0;
  let f = 0;
  let vc = 0;
  if (reg && quadro) {
    s = reg.params.n;
    f = reg.params.f;
    vc = reg.vcModelo;
    z = -quadro.zFerramenta;
    x = reg.tipo === 'furar' ? 0 : quadro.zFerramenta < 0 ? reg.previsao.dprog : quadro.diametroPonta;
    if (concluido) s = 0;
  }
  const vbLim = p.ferramenta?.vbLimite ?? 0.3;
  const fracaoVb = quadro ? quadro.vb / vbLim : 0;
  const modoCnc = p.ciclo.executando ? 'AUTO' : 'MEM';

  return (
    <section className="area-execucao" aria-label="Máquina">
      <Torno
        peca={p.peca}
        material={p.material}
        ferramenta={p.ferramenta}
        animacao={reg && quadro ? { registro: reg, quadro, rodando } : null}
        previsao={p.previsao}
        aproximacao={p.aproximacao}
        pontos={p.pontos}
        ressalto={p.ressalto}
        aviso={p.aviso}
      />
      <div className="dro" aria-label="Mostrador de posição (DRO)" aria-live="off">
        <Dro rotulo="X" valor={num(x, 3)} unidade="mm Ø" />
        <Dro rotulo="Z" valor={num(z, 3)} unidade="mm" />
        <Dro rotulo="S" valor={num(s, 0)} unidade="rpm" />
        <Dro rotulo="F" valor={num(f, 2)} unidade="mm/v" />
        <Dro rotulo="T" valor={T(p.estacao)} unidade={p.ferramenta?.codigo ?? '—'} />
        <Dro rotulo="vc" valor={num(vc, 0)} unidade="m/min" />
        <Dro rotulo="t" valor={quadro ? num(quadro.tSim, 3) : '0,000'} unidade={`/ ${num(tFinal, 3)} min`} />
      </div>
      <div className="barra-execucao">
        <div className="controles" role="group" aria-label="Botões da máquina">
          <span className={`selo-cnc ${p.ciclo.executando ? 'ativo' : ''}`}>{modoCnc}</span>
          <button type="button" className="botao botao-ciclo" onClick={cicloInicio} disabled={!reg && p.ciclo.cursor >= p.ciclo.total}>
            ▶ CICLO INÍCIO
          </button>
          <button type="button" className="botao botao-parada" onClick={() => setRodando(false)} disabled={!reg || concluido || !rodando}>
            ❚❚ PARADA DE AVANÇO
          </button>
          <button type="button" className="botao" onClick={irAoFim} disabled={!reg || concluido}>
            ⏭ Fim do bloco
          </button>
          <button type="button" className="botao" onClick={() => { irAoFim(); p.onReset(); }}>
            ■ RESET
          </button>
          <label className="interruptor">
            <input type="checkbox" checked={p.ciclo.blocoABloco} onChange={(e) => p.onBlocoABloco(e.target.checked)} /> Bloco a bloco
          </label>
          <span className="rotulo-pequeno" id="rot-vel">
            Simulação
          </span>
          <div className="segmentado" role="radiogroup" aria-labelledby="rot-vel">
            {VELOCIDADES.map((v) => (
              <button key={v} type="button" role="radio" aria-checked={p.velocidade === v} className={p.velocidade === v ? 'ativo' : ''} onClick={() => p.onVelocidade(v)}>
                {num(v, v < 1 ? 1 : 0)}×
              </button>
            ))}
          </div>
        </div>
        <p className="nota">
          Programa: bloco {Math.min(p.ciclo.cursor + 1, p.ciclo.total)} de {p.ciclo.total}. A velocidade de simulação muda só a apresentação; o resultado e o tempo já
          foram calculados pelo modelo.
        </p>
        {p.ciclo.alarme && (
          <p className="alarme" role="alert">
            ALARME: {p.ciclo.alarme}
          </p>
        )}
        {p.ciclo.mensagem && !p.ciclo.alarme && <p className="mensagem-cnc">{p.ciclo.mensagem}</p>}
        {reg && quadro && (
          <div className="indicadores">
            <div className="indicador">
              <span className="rotulo-pequeno">Carga na {reg.tipo === 'furar' ? 'broca (torque/avanço)' : 'aresta'} — indicador qualitativo</span>
              <div className="escala-niveis" aria-label={`Carga ${quadro.emContato ? quadro.nivel : 'sem contato'}`}>
                {NIVEIS.map((n, i) => (
                  <span key={n} className={`nivel nivel-${i} ${quadro.emContato && NIVEIS.indexOf(quadro.nivel) >= i ? 'aceso' : ''}`}>
                    {n}
                  </span>
                ))}
              </div>
              <span className="rotulo-pequeno">{quadro.emContato ? `nível: ${quadro.nivel}` : 'sem contato (em vazio ou recuando)'}</span>
            </div>
            <div className="indicador">
              <span className="rotulo-pequeno">Condição da ferramenta (estimativa sintética)</span>
              <div className="barra" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(fracaoVb * 100)} aria-label="Desgaste relativo ao limite didático">
                <div className="barra-preenchida" style={{ width: `${Math.min(100, fracaoVb * 100)}%` }} />
              </div>
              <span className="rotulo-pequeno">
                VB ≈ {num(quadro.vb, 2)} mm de {num(vbLim, 2)} mm
                {reg.tipo === 'tornear' && reg.lascouEm !== null && quadro.zFerramenta >= reg.lascouEm ? ' · ✕ LASCADA' : ''}
                {reg.tipo === 'furar' && reg.quebrouEm !== null && concluido ? ' · ✕ BROCA QUEBRADA' : ''}
              </span>
            </div>
            <div className="indicador">
              <span className="rotulo-pequeno">Cavaco (classificação qualitativa)</span>
              <strong>{reg.cavaco.rotulo}</strong>
              {reg.tipo === 'furar' && (
                <span className="rotulo-pequeno">
                  canal da broca: {quadro.entupimento > 1.05 ? `⚠ entupindo (×${num(quadro.entupimento, 1)})` : 'livre'}
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
