# Usinagem

Simulador didático de torno CNC, em português, para estudantes de Engenharia de Materiais.
Tem **torneamento cilíndrico externo** e **furação axial com brocas**, 6 materiais com comportamentos
distintos, uma torre com 6 estações, programa em blocos com listagem ISO ilustrativa e dois modos:

- **Encomenda** — OM-01 “O eixo sob medida”: tarugo Ø 40 de aço AC-45 laminado → Ø 36 (0/−0,05) × 50 ± 0,5 mm, Ra estimada ≤ 1,6 µm,
  com orçamento, estoque limitado e devolutiva completa.
- **Modo livre** — escolha o material (AC-45, AC-10, AL-61, FF-25, IX-304, LT-360), o diâmetro do tarugo e o balanço; monte ferramentas
  e brocas na torre; repita operações mudando um parâmetro por vez, prepare condições equivalentes e compare resultados.

O modelo é **didático e simplificado**: geometria e cinemática exatas; força, deflexão, desgaste, cavaco, rugosidade e quebra de broca
com dados sintéticos identificados. Veja [docs/MODELO.md](docs/MODELO.md).

## Instalação e execução

Requer Node.js 20 ou mais recente.

```bash
npm install
npm run dev
```

Abra o endereço mostrado pelo Vite. Não há backend, conta nem chamadas de IA. No Windows, o arquivo
`Abrir Usinagem.bat`, nesta pasta, faz o mesmo.

```bash
npm test          # testes (Vitest)
npm run build     # verificação de tipos + build de produção em dist/
```

## Como jogar

A tela imita um painel de comando: à esquerda o torno (metade superior em vista, inferior em corte), o mostrador
X/Z/S/F/T/vc e os botões **CICLO INÍCIO**, **PARADA DE AVANÇO**, **Fim do bloco**, **RESET** e **Bloco a bloco**. À direita, as teclas de painel
(F1–F6 na tela, Alt+1…6 no teclado):

1. **PEÇA** — encomenda, desenho e ficha do material (microestrutura esquemática, propriedades e origem dos dados), ou escolha do tarugo no modo livre.
2. **FERRAMENTAS** — torre T01–T06, desgaste de cada estação, troca de aresta/broca, montagem a partir da biblioteca.
3. **PROGRAMA** — blocos de torneamento (S, F, ap, L), furação (S, F, P, pica-pau Q) e paradas M00; previsão geométrica e cinemática; listagem ISO.
4. **MEDIÇÃO** — Ø externo e do furo em qualquer posição, comprimento e profundidade, perfis, superfície ampliada e Ra estimada.
5. **HISTÓRICO** — todas as operações, comparação que indica quando o resultado não é atribuível a um único fator, “repetir no programa” e condições equivalentes.
6. **ENTREGA** (só na encomenda) — avaliação técnica e econômica com pergunta estruturada.

O progresso (ações e programa de cada modo) e as configurações ficam no `localStorage`. “Reiniciar” apaga só as operações do modo atual.

## Estrutura

```
src/
  modelo/      cinemática, fenômenos, torneamento (passe.ts), furação (furacao.ts), medição
  dados/       materiais, ferramentas e brocas, máquina, encomendas, glossário, catálogo
  jogo/        partida (registro de ações → estado), programa CNC, avaliação, comparação, animação, persistência
  ui/          React: App, torno em Canvas 2D, painéis e esquemas SVG
tests/         Vitest
docs/          MODELO.md e NOVAS-ENCOMENDAS.md
```

Para cadastrar encomendas, materiais e ferramentas, veja [docs/NOVAS-ENCOMENDAS.md](docs/NOVAS-ENCOMENDAS.md).
