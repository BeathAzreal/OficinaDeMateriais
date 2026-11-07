# Fábrica — prática industrial (v2.2, experimental)

A v2.2 junta num jogo só a **Oficina de Soldagem**, a **Usinagem** (torno CNC) e o
**Laboratório de Falhas**. Eles viram setores de uma mesma fábrica, ligados por
**ordens de serviço (OS)**. A ideia é estender as aulas: o aluno pratica a cadeia
processamento → estrutura → propriedades → desempenho como ela acontece na
indústria, com uma peça que passa de setor em setor.

## Como se joga

Menu → **FÁBRICA** (ou o ícone da fábrica na barra lateral).

- **Galpão 3D**: quatro setores (Usinagem, Laboratório, Soldagem, Manufatura
  Aditiva) e o quadro de OS. Arraste para girar, role para aproximar e clique
  num setor para entrar. O losango amarelo marca o setor da próxima etapa. Sem
  3D, os mesmos setores ficam nos botões do painel.
- **Painel da OS**: situação, etapas, setor de cada etapa e resultado gravado.
- **Acesso livre**: os botões "Setores" abrem cada setor sem contar na OS.

## OS-01 — Braço tensor da peneira vibratória

| Etapa | Setor | O que o aluno faz | Conforme quando |
|---|---|---|---|
| 1. Análise da falha | Laboratório | Caso "A junta que falhou": ensaios feitos à mão na bancada 3D (inspeção, corte, lixa, polimento, ataque, microscópio, microdureza), hipóteses e relatório no escritório | Nota do relatório ≥ 60/100 |
| 2. Usinar o pino | Usinagem | OM-01 no torno convencional 3D: Ø 36 (0/−0,05) × 50 ± 0,5 mm, Ra ≤ 1,6 µm (no Difícil) | O cliente aceita a peça (dimensões e Ra) |
| 3. Soldar a emenda | Soldagem | Emenda em V em aço SAE 1045, 6 mm, MIG/MAG, no Difícil | Aprovada com 40 % em cada categoria (como na História) |
| Liberação | Qualidade | Responde a três perguntas e libera a OS | Todas as etapas conformes |

A ordem conta uma história só. O laboratório descobre que o braço trincou no pé da
solda, numa ZTA endurecida (aço com mais carbono que o declarado, sem
pré-aquecimento) e a partir de uma mordedura no reinício do cordão. A peça nova
é feita com essa correção: o material é conferido, o pino precisa de tolerância e
acabamento porque trabalha em fadiga, e a emenda pede pé suave, sem mordedura,
com a peça aquecida.

**Notas** (0 a 100 em todas as etapas):

- Laboratório: a nota do próprio relatório.
- Usinagem: dimensões 50, rugosidade 30 e custo dentro do orçamento 20.
- Soldagem: pontuação do jogo ÷ 10.
- OS: média das etapas.

Refazer uma etapa guarda o **melhor** resultado (conforme vale mais que nota
alta). Depois de liberada, a OS fica fechada; "Reabrir a OS" apaga os resultados
dela, mas não o progresso dentro de cada setor.

## Uso em aula (sugestão)

1. **Antes**: apresente a situação da OS e peça hipóteses rápidas (sem jogo).
2. **Laboratório** em dupla, no modo Aprender. Discuta a devolutiva com a turma.
3. **Usinagem** e **Soldagem** individuais. Peça para o aluno anotar o que mudou
   por causa do laudo.
4. **Liberação**: as três respostas e a tabela da OS saem no relatório. Use
   "Imprimir / salvar em PDF" para recolher.

O jogo é um modelo didático: os dados do laboratório são sintéticos, o torno é
ilustrativo e a solda é um modelo qualitativo. Nada aqui certifica competência
prática nem qualifica procedimento.

## Como criar uma OS

1. Acrescente um item em `ORDENS` (`src/fabrica/ordens.ts`): código, cliente,
   situação, etapas (cada uma com `setor`, `titulo`, `instrucao` e `porque`) e as
   perguntas da liberação. Não mude ids que já existem: entram no progresso salvo.
2. Se a etapa de soldagem pedir outra peça, crie a missão como em
   `src/fabrica/missaoOs.ts` (fica fora do catálogo da História).
3. Os critérios de "conforme" de cada setor estão em `src/fabrica/registros.ts`.
4. Hoje a fábrica mostra a primeira OS. Com mais de uma, falta a escolha no
   quadro de OS (`ordemAtiva` em `src/ui/telas/fabrica.ts`).
5. Teste em `tests/fabrica.test.ts`.

Para novos casos do laboratório, veja [setores/NOVOS-CASOS.md](setores/NOVOS-CASOS.md).
Para novas encomendas da usinagem, veja [setores/NOVAS-ENCOMENDAS.md](setores/NOVAS-ENCOMENDAS.md).

## Onde está cada parte

| Parte | Arquivo |
|---|---|
| OS, etapas, progresso e liberação (sem tela) | `src/fabrica/ordens.ts` |
| Resultado de cada setor → registro da OS | `src/fabrica/registros.ts` |
| Peça de soldagem da OS-01 | `src/fabrica/missaoOs.ts` |
| Galpão 3D | `src/render/fabrica3d.ts` |
| Telas da fábrica, setores e liberação | `src/ui/telas/fabrica.ts`, `src/fabrica.css` |
| Usinagem (torno CNC, React) | `src/setores/usinagem/` · [README](setores/USINAGEM-README.md) · [modelo](setores/MODELO.md) |
| Laboratório de Falhas (React) | `src/setores/laboratorio/` · [README](setores/LABORATORIO-README.md) · [modelo didático](setores/MODELO-DIDATICO.md) |
| Como os setores em React entram no jogo | `src/setores/montar.tsx` |

**Usinagem e Laboratório em React.** Os dois setores continuam em TypeScript com
React, como foram feitos. Cada um é montado numa "sombra" (Shadow DOM) para que o
estilo do setor e o da oficina não se misturem. O React soma cerca de 0,65 MB ao
HTML portátil (6,3 MB → 6,9 MB, com os dois setores). Cada setor avisa a fábrica
quando termina: a Usinagem com `aoEntregar` (a cada peça entregue na encomenda) e
o Laboratório com `aoConcluir` (quando o relatório é enviado). Fora da fábrica,
os dois funcionam como antes. O progresso de cada setor continua na chave dele no
navegador (`usinagem:v1` e `laboratorio-de-falhas:v1`). O da fábrica fica em
`soldagem-mig/fabrica`.

## Limites desta versão

- Uma OS só. As etapas não trocam dados entre si além da nota: a solda da OS não
  gera o caso do laboratório.
- O 3D do galpão é ilustrativo, com máquinas simplificadas.
- A Manufatura Aditiva aparece no galpão, mas ainda não tem etapa em OS.
- O escritório do laboratório (React) e a Manufatura Aditiva foram pensados para telas de computador (≥ 1280 px). As bancadas 3D funcionam no celular com a barra de toque (`src/ui/toque.ts`).

## Próximos passos possíveis

- OS-02 com a Manufatura Aditiva (recuperar um eixo por deposição e usinar).
- A solda da OS virar um caso do laboratório (falha que nasce dos próprios erros).
- Escolha de OS no quadro, turma e painel do professor com as OS de cada aluno.
- Materiais em comum entre os setores (hoje cada setor tem o próprio catálogo).
