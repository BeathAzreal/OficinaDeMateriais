/** Roteiros de investigação: orientações, sem alterar física ou nota. */
export interface ExercicioTecnico {
  id: string
  titulo: string
  objetivo: string
  manter: string
  variar: string
  observar: string
  pergunta: string
}
export const EXERCICIOS_TECNICOS: readonly ExercicioTecnico[] = [
  {
    id: 'avanco', titulo: '1. Controle do avanço',
    objetivo: 'Investigar a relação entre tempo de permanência e tamanho do cordão.',
    manter: 'Use a mesma tensão, alimentação, arame, gás, técnica e posição da peça nas duas tentativas.',
    variar: 'Faça um passe de referência. Depois repita com avanço mais lento, seguindo o mesmo trecho e evitando oscilar.',
    observar: 'Compare largura, reforço, regularidade e o gráfico de velocidade. Observe onde você parou ou voltou.',
    pergunta: 'O aumento de largura coincidiu com os trechos de maior permanência?',
  },
  {
    id: 'alimentacao', titulo: '2. Alimentação e deposição',
    objetivo: 'Investigar o efeito da alimentação do arame sem mudar seu diâmetro.',
    manter: 'Mantenha tensão, arame, gás, técnica, posição e um avanço tão semelhante quanto conseguir.',
    variar: 'Faça o passe de referência. Na repetição, aumente somente a alimentação da máquina.',
    observar: 'Compare largura, reforço e velocidade efetivamente executada. A alimentação também afeta corrente e aquecimento previstos no modelo.',
    pergunta: 'A diferença veio acompanhada de mudança no avanço? Que fatores impedem atribuir tudo à alimentação?',
  },
  {
    id: 'tensao', titulo: '3. Tensão e forma',
    objetivo: 'Investigar a mudança de forma da seção do cordão.',
    manter: 'Mantenha alimentação, arame, gás, técnica, posição e avanço tão semelhantes quanto conseguir.',
    variar: 'Faça o passe de referência. Na repetição, aumente somente a tensão.',
    observar: 'Compare largura e reforço no corte. Confira também os indicadores térmicos: mudar tensão não é mudar apenas aparência.',
    pergunta: 'A relação entre largura e reforço mudou? O movimento foi suficientemente parecido para sustentar a comparação?',
  },
  {
    id: 'transferencia', titulo: '4. Curto-circuito, globular e spray',
    objetivo: 'Ver o modo de transferência mudar com a tensão e a alimentação (H93).',
    manter: 'Mantenha arame de 1,0 mm, mistura com argônio, técnica e posição plana em chapa de 6 mm.',
    variar: 'Faça um passe em 6 m/min e 20 V (curto-circuito), outro em 7 m/min e 24 V (globular) e outro em 11 m/min e 27 V (spray), andando mais rápido quanto mais arame.',
    observar: 'Compare respingos, regularidade e o calor de fusão no corte. Troque o gás para CO₂ puro e veja que o spray não aparece.',
    pergunta: 'Por que o globular respinga mais? Em que peças o spray seria um problema?',
  },
]
