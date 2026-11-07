import type { StatusAlternativa } from '../motor/tipos';
import { atualizarRelatorio, concluir, validarRelatorio } from '../motor/estado';
import { INSUFICIENTE } from '../avaliacao/avaliar';
import { useJogo } from './contexto';
import { BotaoConfirmar, Dicas, SeloQualidade } from './componentes/comuns';
import { ICONE_VINCULO } from './componentes/VisorAquisicao';

const STATUS: { id: StatusAlternativa; rotulo: string }[] = [
  { id: 'nao-avaliada', rotulo: 'não avaliada / inconclusiva' },
  { id: 'enfraquecida', rotulo: 'enfraquecida' },
  { id: 'descartada', rotulo: 'descartada' },
  { id: 'apoiada', rotulo: 'apoiada' },
];

export function Relatorio() {
  const { caso, estado, alterar, executar } = useJogo();
  const r = estado.relatorio;
  const travado = estado.concluido;
  const set = (m: Partial<typeof r>) => alterar((s) => atualizarRelatorio(s, m));
  const toggle = (lista: string[], id: string) => (lista.includes(id) ? lista.filter((x) => x !== id) : [...lista, id]);
  const hips = caso.publico.hipoteses;
  const escolhidas = new Set([r.mecanismo, r.causa, ...r.fatores].filter(Boolean));
  const faltas = validarRelatorio(r);

  const Escolha = ({ cat, campo }: { cat: 'mecanismo' | 'causa'; campo: 'mecanismo' | 'causa' }) => (
    <div className="lista-radio">
      {hips
        .filter((h) => h.categoria === cat)
        .map((h) => (
          <label key={h.id}>
            <input type="radio" name={campo} disabled={travado} checked={r[campo] === h.id} onChange={() => set({ [campo]: h.id })} /> {h.titulo}
          </label>
        ))}
      <label>
        <input type="radio" name={campo} disabled={travado} checked={r[campo] === INSUFICIENTE} onChange={() => set({ [campo]: INSUFICIENTE })} /> Dados insuficientes
        para concluir
      </label>
    </div>
  );

  return (
    <div className="relatorio">
      <header className="cabecalho-pagina">
        <h2>Relatório da investigação</h2>
        <p>Campos estruturados; as justificativas são opcionais e não são corrigidas automaticamente.</p>
      </header>
      <Dicas estacao="relatorio" />

      <section className="painel">
        <h3>1. Mecanismo de falha proposto</h3>
        <Escolha cat="mecanismo" campo="mecanismo" />
        <textarea disabled={travado} rows={2} placeholder="Justificativa (opcional)" value={r.justificativaMecanismo} onChange={(e) => set({ justificativaMecanismo: e.target.value })} />
      </section>

      <section className="painel">
        <h3>2. Causa provável</h3>
        <Escolha cat="causa" campo="causa" />
        <textarea disabled={travado} rows={2} placeholder="Justificativa (opcional)" value={r.justificativaCausa} onChange={(e) => set({ justificativaCausa: e.target.value })} />
        <h4>Fatores contribuintes</h4>
        <div className="lista-check">
          {hips
            .filter((h) => h.categoria === 'fator')
            .map((h) => (
              <label key={h.id}>
                <input type="checkbox" disabled={travado} checked={r.fatores.includes(h.id)} onChange={() => set({ fatores: toggle(r.fatores, h.id) })} /> {h.titulo}
              </label>
            ))}
        </div>
      </section>

      <section className="painel">
        <h3>3. Evidências utilizadas</h3>
        {estado.evidencias.length === 0 && <p className="vazio">O caderno ainda não tem evidências registradas.</p>}
        <div className="lista-check evidencias">
          {estado.evidencias.map((e) => (
            <label key={e.id}>
              <input type="checkbox" disabled={travado} checked={r.evidencias.includes(e.id)} onChange={() => set({ evidencias: toggle(r.evidencias, e.id) })} />
              <span>
                <strong>{e.id}</strong> {e.qualidade !== 'nitida' && <SeloQualidade q={e.qualidade} />} {e.observacao}
                <small>
                  {e.origem}
                  {Object.entries(e.vinculos).map(([h, v]) => (
                    <span key={h} className={`vinc vinc-${v}`}>
                      {' '}
                      {ICONE_VINCULO[v]} {hips.find((x) => x.id === h)?.titulo}
                    </span>
                  ))}
                </small>
              </span>
            </label>
          ))}
        </div>
      </section>

      <section className="painel">
        <h3>4. Hipóteses alternativas</h3>
        <p className="ajuda">Situação final das hipóteses que você não escolheu acima.</p>
        <table className="tabela-alternativas">
          <tbody>
            {hips
              .filter((h) => !escolhidas.has(h.id))
              .map((h) => (
                <tr key={h.id}>
                  <td>
                    <span className={`cat cat-${h.categoria}`}>{h.categoria}</span> {h.titulo}
                  </td>
                  <td>
                    <select
                      disabled={travado}
                      value={r.alternativas[h.id] ?? 'nao-avaliada'}
                      onChange={(e) => set({ alternativas: { ...r.alternativas, [h.id]: e.target.value as StatusAlternativa } })}
                    >
                      {STATUS.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.rotulo}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </section>

      <section className="painel">
        <h3>5. Limitações</h3>
        <p className="ajuda">Marque as afirmações que descrevem limitações verdadeiras da sua investigação. Algumas afirmações são indevidas.</p>
        <div className="lista-check">
          {caso.publico.relatorio.limitacoes.map((o) => (
            <label key={o.id}>
              <input type="checkbox" disabled={travado} checked={r.limitacoes.includes(o.id)} onChange={() => set({ limitacoes: toggle(r.limitacoes, o.id) })} /> {o.texto}
            </label>
          ))}
        </div>
        <textarea disabled={travado} rows={2} placeholder="Outras limitações (opcional)" value={r.limitacaoLivre} onChange={(e) => set({ limitacaoLivre: e.target.value })} />
        <h4>Próximos ensaios recomendados</h4>
        <div className="lista-check">
          {caso.publico.relatorio.proximosEnsaios.map((o) => (
            <label key={o.id}>
              <input type="checkbox" disabled={travado} checked={r.proximosEnsaios.includes(o.id)} onChange={() => set({ proximosEnsaios: toggle(r.proximosEnsaios, o.id) })} /> {o.texto}
            </label>
          ))}
        </div>
      </section>

      {!travado && (
        <section className="painel concluir">
          {faltas.length > 0 && (
            <ul className="avisos-previos">
              {faltas.map((f) => (
                <li key={f}>▲ {f}</li>
              ))}
            </ul>
          )}
          <BotaoConfirmar
            classe="botao primario grande"
            desativado={faltas.length > 0}
            aviso="Depois de concluir não será possível fazer novos ensaios. A devolutiva mostrará a solução do caso."
            onConfirmar={() => executar((e) => concluir(e))}
          >
            Concluir investigação e ver devolutiva
          </BotaoConfirmar>
        </section>
      )}
    </div>
  );
}
