# Dados salvos

Tudo fica no **armazenamento local do navegador** (`localStorage`), sem conta,
sem servidor e sem internet. Limpar os dados do site no navegador apaga tudo;
os recordes podem ser exportados em JSON antes.

## Coleções separadas

Cada coleção tem a sua chave, sempre com o prefixo `soldagem-mig/`:

| Chave | Conteúdo |
|---|---|
| `participantes` | Perfis: jogadores do Arcade (com missões aprovadas) e participantes de torneios |
| `tentativas` | Tentativas oficiais de torneio: ajustes, preparo, dispositivo, **registro compacto de eventos**, pontuação e situação (`em-andamento`, `concluida`, `interrompida`) |
| `entregas` | Entrega final de cada participante em cada rodada, com a regra aplicada e o código anônimo |
| `torneios` | Configuração (bloqueada após o início), ordem por rodada, ordem de julgamento, publicações e histórico |
| `avaliacoes` | Ficha inicial, nota final, justificativa e histórico de revisões do professor |
| `recordes` | Recordes do Arcade |
| `preferencias` | Dispositivo padrão, calibração do controle e da caneta, último nome usado |
| `manufatura` | v2.1: projeto da Manufatura Aditiva (programa INFORM, pontos ensinados, arquivos ASF/AEF, distância de trabalho), o projeto do modo livre (`livre`, à parte) e a melhor nota da missão. Dado salvo antes do modo livre recebe o projeto livre padrão. Coleção nova; validada campo a campo ([`MANUFATURA-ADITIVA.md`](MANUFATURA-ADITIVA.md)) |

As **missões** não são salvas: ficam no código (`src/missoes/catalogo.ts`), com
número de versão. A versão da missão entra na chave dos rankings.

## Versão e migração

Cada chave guarda um envelope:

```json
{ "esquema": 1, "colecao": "recordes", "salvoEm": "2026-10-20T23:38:11.535Z", "dados": [ ... ] }
```

- Dados **sem envelope** são tratados como esquema 0 e migrados para o 1
  (`MIGRACOES` em `src/dados/armazenamento.ts`); a coleção é regravada.
- **Esquema mais novo** que o do jogo, **JSON inválido** ou **estrutura
  inválida**: o conteúdo original é guardado em
  `soldagem-mig/corrompido/<coleção>/<instante>`, a coleção recomeça vazia e o
  jogo mostra um aviso. Nada é descartado em silêncio.
- Se o navegador bloquear o armazenamento (modo privado restrito), o jogo
  funciona em memória e avisa que nada será salvo.
- Se o espaço acabar, a gravação falha com aviso na tela.

## Recordes

Cada recorde tem: nome ou apelido, nota total, notas por categoria, se foi
aprovado, missão (id, versão e título), dificuldade, processo, material,
dispositivo, data e versão das regras de pontuação.

Rankings separados por **missão + versão da missão + dificuldade +
dispositivo + versão da pontuação**. Ordem: aprovados primeiro, depois nota
total, integridade, desenho e data (quem chegou primeiro).

### Exportar e importar

- **Exportar** gera `{ "formato": "soldagem-mig/recordes", "versao": 1, "exportadoEm": ..., "recordes": [...] }`.
- **Importar** confere o formato e cada registro. Registros inválidos são
  recusados com o motivo; repetidos (mesmo id) são ignorados; os válidos só
  entram depois de confirmação. Um arquivo inválido não altera nada.

## Torneios: salvar e retomar

- O torneio é gravado **depois de cada ação relevante** (início, começo e fim
  de tentativa, entrega, avaliação, revisão, publicação).
- Uma tentativa oficial é gravada como `em-andamento` **assim que começa**. Se a
  página for recarregada no meio dela, ela vira `interrompida`: conta no
  limite e não pode ser entregue. Isso evita recarregar para "apagar" uma
  tentativa ruim e impede duplicação.
- Concluir uma tentativa já concluída, ou entregar duas vezes, é recusado pelo
  motor do torneio.

## Registro compacto da tentativa

Os eventos de entrada (abrir arco, mover, fechar arco, trocar ajustes) são
gravados com tempo relativo (0,01 ms) e posição (0,001 mm). A **pontuação
oficial é calculada a partir do replay deste registro compacto**, então a
nota, a inspeção do professor e o replay usam exatamente os mesmos dados.
