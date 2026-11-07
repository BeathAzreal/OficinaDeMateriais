# Etapa didática: hipóteses e limites

Roteiros das seis missões ensinam uma habilidade por capítulo sem alterar requisitos físicos. O feedback é determinístico, usa evidência registrada e recomenda uma mudança por tentativa; não diagnostica qualidade interna pela imagem. A progressão reaproveita aprovações salvas, sem migração destrutiva. Arcade v2 introduz missões e condições gradualmente, mantendo vidas, combo e nota; recordes v1 ficam separados. Torneio mostra pendências sem revelar notas antes da publicação, e aplica os mesmos critérios para ordenar e reconhecer empates. Nenhuma mudança em render, entrada, modelo ou pontuação. Conferência visual completa pendente.


## Implementação

- Seis roteiros de habilidades e ciclo preparar → executar → inspecionar, com experimentos de uma variável no treino.
- Plano de próxima tentativa em todos os painéis de pontuação. Prioriza condição essencial descumprida; depois a categoria de menor fração dos pontos disponíveis, sem favorecer categorias de menor peso.
- Progressão derivada, recomendação de continuidade e compatibilidade com perfis existentes.
- Arcade `arcade-v2`: duas primeiras missões introdutórias em Aprendiz; condições de controle a partir da terceira; técnica a partir da quinta; tempo a partir da sétima. Chance de Profissional cresce após a quarta. Evita repetir material e condição extra consecutivos. Três vidas e combo preservados. Ranking separado de `arcade-v1`.
- Pendências de torneio e aviso sobre comparações de versões distintas; comparador único para ordem e empate.

## Validação e limites

Testes cobrem roteiros, desbloqueios, dados antigos, feedback determinístico, prioridades, etapas do Arcade, separação dos rankings, anonimato e desempate. A suíte existente verifica a viabilidade das condições de Arcade e missões. Não houve edição em `src/render`, `src/entrada`, `src/modelo` ou `src/pontuacao`. Falta conferência visual completa de todas as telas e dispositivos.
