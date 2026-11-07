import { useEffect, useState } from 'react';
import { num } from '../formato';

interface Props {
  id: string;
  rotulo: string;
  unidade: string;
  valor: number;
  onValor(v: number): void;
  min: number;
  max: number;
  passo: number;
  ajuda?: string;
  erro?: string;
  travado?: boolean;
  casas?: number;
}

/** Campo numérico com controle deslizante; aceita vírgula e só propaga valores válidos. */
export function CampoNumero({ id, rotulo, unidade, valor, onValor, min, max, passo, ajuda, erro, travado, casas = 2 }: Props) {
  const [texto, setTexto] = useState(String(valor));
  useEffect(() => {
    const atual = Number(texto.replace(',', '.'));
    if (atual !== valor) setTexto(String(valor));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valor]);
  const mudar = (t: string) => {
    setTexto(t);
    const v = Number(t.replace(',', '.'));
    if (t.trim() !== '' && Number.isFinite(v)) onValor(v);
  };
  return (
    <div className={`campo ${erro ? 'com-erro' : ''}`}>
      <label htmlFor={id}>
        {rotulo} <span className="unidade">[{unidade}]</span>
        {travado && <span className="selo">mantido</span>}
      </label>
      <div className="campo-linha">
        <input
          id={id}
          type="text"
          inputMode="decimal"
          value={texto}
          disabled={travado}
          aria-describedby={ajuda ? `${id}-ajuda` : undefined}
          onChange={(e) => mudar(e.target.value)}
        />
        <input
          type="range"
          aria-label={`${rotulo} (controle deslizante)`}
          min={min}
          max={max}
          step={passo}
          value={Number.isFinite(valor) ? valor : min}
          disabled={travado}
          onChange={(e) => mudar(e.target.value)}
        />
      </div>
      {ajuda && (
        <span id={`${id}-ajuda`} className="nota">
          {ajuda} Limite: {num(min, casas)}–{num(max, casas)} {unidade}.
        </span>
      )}
      {erro && (
        <span className="erro" role="alert">
          ✕ {erro}
        </span>
      )}
    </div>
  );
}
