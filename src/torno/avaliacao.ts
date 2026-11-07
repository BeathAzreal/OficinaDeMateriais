import type { Dificuldade } from '../missoes/catalogo'
import type { DefeitoTig } from '../pontuacao/tig'
import { CAUSA, type ModeloTorno } from './modelo'
import type { PecaTorno } from './pecas'

/*
 * Nota do torno (v2.2, H108), de 0 a 1000, nos moldes da solda: itens
 * medidos na peça e na execução, e defeitos com onde, por quê e como
 * corrigir. Fácil só nota; Difícil aprova com 20 % em cada item e na nota.
 * Medidas com a resolução dos instrumentos: micrômetro 0,01 mm,
 * paquímetro 0,02 mm, rugosímetro 0,1 µm.
 */

export const RESOLUCAO = { micrometro: 0.01, paquimetro: 0.02, rugosimetro: 0.1 } as const
const arred = (v: number, r: number) => Math.round(v / r) * r

/** Leitura do micrômetro (diâmetro) num ponto, a partir da face livre. */
export function micrometro(m: ModeloTorno, distanciaFaceMm: number): number {
  return arred(m.diametroEm(m.zFace - distanciaFaceMm), RESOLUCAO.micrometro)
}

/** Comprimento usinado: da face livre até o ressalto (onde o diâmetro sobe para o bruto). */
export function comprimentoUsinado(m: ModeloTorno): number | null {
  const face = m.zFace
  const meio = (m.raioBruto + m.raioEm(face - 2)) / 2
  if (m.raioBruto - m.raioEm(face - 2) < 0.1) return null
  for (let z = face - 2; z >= 0; z -= 0.05) if (m.raioEm(z) >= meio) return arred(face - z, RESOLUCAO.paquimetro)
  return arred(face, RESOLUCAO.paquimetro)
}

const limitar = (v: number) => Math.max(0, Math.min(1, v))

export interface ResultadoTorno {
  nota: number
  itens: { nome: string; maximo: number; pontos: number; explicacao: string }[]
  descricao: string
  inspecaoPendente: false
  medidas: { faceRemovidaMm: number; comprimentoMm: number | null; diametroMin: number; diametroMax: number; raMax: number | null }
}

/** Trecho funcional: da face livre até 1 mm antes do ressalto pedido. */
function trechoFuncional(m: ModeloTorno, p: PecaTorno): [number, number] {
  const face = m.zFace
  const L = p.alvo ? p.alvo.comprimento.nominal : Math.max(0, (comprimentoUsinado(m) ?? 0))
  return [face - L + 1, face - 0.5]
}

export function medidasTorno(m: ModeloTorno, p: PecaTorno): ResultadoTorno['medidas'] {
  const [a, b] = trechoFuncional(m, p)
  let dmin = Infinity, dmax = 0, raMax: number | null = null
  for (let z = a; z <= b; z += 0.5) {
    const d = m.diametroEm(z)
    dmin = Math.min(dmin, d); dmax = Math.max(dmax, d)
    const ra = m.raEm(z)
    if (ra !== null) raMax = Math.max(raMax ?? 0, ra)
  }
  return {
    faceRemovidaMm: arred(m.balanco - m.zFace, RESOLUCAO.paquimetro),
    comprimentoMm: comprimentoUsinado(m),
    diametroMin: arred(dmin === Infinity ? 0 : dmin, RESOLUCAO.micrometro),
    diametroMax: arred(dmax, RESOLUCAO.micrometro),
    raMax: raMax === null ? null : arred(raMax, RESOLUCAO.rugosimetro),
  }
}

export function avaliarTorno(p: PecaTorno, m: ModeloTorno, _modo: Dificuldade): ResultadoTorno {
  const medidas = medidasTorno(m, p)
  const executado = m.volumeRemovidoMm3 > 0
  if (!p.alvo) {
    return { nota: 0, itens: [], descricao: 'Treino livre: só as medidas da peça.', inspecaoPendente: false, medidas }
  }
  const alvo = p.alvo
  const [a, b] = trechoFuncional(m, p)
  const dMin = alvo.diametro.nominal + alvo.diametro.inf, dMax = alvo.diametro.nominal + alvo.diametro.sup
  let total = 0, naMedida = 0, lisas = 0
  for (let z = a; z <= b; z += 0.5) {
    total++
    const d = arred(m.diametroEm(z), RESOLUCAO.micrometro)
    if (d >= dMin - 1e-9 && d <= dMax + 1e-9) naMedida++
    const ra = m.raEm(z)
    if (ra !== null && ra <= alvo.raMax) lisas++
  }
  const L = medidas.comprimentoMm
  const erroL = L === null ? Infinity : Math.abs(L - alvo.comprimento.nominal)
  const fracComprimento = erroL <= alvo.comprimento.tol ? 1 : limitar(1 - (erroL - alvo.comprimento.tol) / (3 * alvo.comprimento.tol))
  const faceada = medidas.faceRemovidaMm >= alvo.facearMinMm
  const brutaIntacta = regiaoBrutaIntacta(m, p)
  const seguranca = limitar(1 - 0.5 * m.quebras - 0.5 * m.colisoes - 0.25 * m.lascas - 0.25 * m.medicoesInseguras - 0.15 * m.sobrecargas)
  const fracVc = m.tempoCorteS > 0 ? m.tempoVcBoaS / m.tempoCorteS : 0
  const fracTempo = limitar(1 - Math.max(0, m.tempoS - p.tempoRefS) / (2 * p.tempoRefS))
  const pct = (v: number) => `${Math.round(v * 100)}%`
  const itens = [
    { nome: 'Diâmetro na tolerância', maximo: 300, fracao: total ? naMedida / total : 0, explicacao: `${pct(total ? naMedida / total : 0)} do trecho funcional entre Ø ${dMin.toFixed(2)} e ${dMax.toFixed(2)} mm (micrômetro). Medido: Ø ${medidas.diametroMin.toFixed(2)}–${medidas.diametroMax.toFixed(2)}.` },
    { nome: 'Comprimento até o ressalto', maximo: 150, fracao: fracComprimento, explicacao: L === null ? 'Não há ressalto: o trecho não foi torneado.' : `Medido ${L.toFixed(2)} mm (paquímetro) para ${alvo.comprimento.nominal} ± ${alvo.comprimento.tol} mm.` },
    { nome: 'Acabamento', maximo: 200, fracao: total ? lisas / total : 0, explicacao: `${pct(total ? lisas / total : 0)} do trecho com Ra ≤ ${alvo.raMax} µm (rugosímetro). Maior Ra: ${medidas.raMax === null ? '—' : medidas.raMax.toFixed(1) + ' µm'}.` },
    { nome: 'Face e região bruta', maximo: 100, fracao: (faceada ? 0.5 : 0) + (brutaIntacta ? 0.5 : 0), explicacao: `Face ${faceada ? `faceada (${medidas.faceRemovidaMm.toFixed(2)} mm removidos)` : `não faceada (mínimo ${alvo.facearMinMm} mm)`}. Região além do ressalto ${brutaIntacta ? 'intacta' : 'tocada pela ferramenta'}.` },
    { nome: 'Ferramenta e segurança', maximo: 150, fracao: seguranca, explicacao: `Quebras ${m.quebras}, batidas na placa ${m.colisoes}, aresta lascada ${m.lascas}, motor parado por sobrecarga ${m.sobrecargas}, medições com o eixo girando ${m.medicoesInseguras}.` },
    { nome: 'Parâmetros e tempo', maximo: 100, fracao: 0.5 * fracVc + 0.5 * fracTempo, explicacao: `${pct(fracVc)} do tempo de corte com vc na faixa do material (${m.material.vcFaixa.min}–${m.material.vcFaixa.max} m/min). Tempo total ${Math.round(m.tempoS)} s (referência ${p.tempoRefS} s).` },
  ].map((i) => ({ nome: i.nome, maximo: i.maximo, explicacao: i.explicacao, pontos: executado ? Math.round(i.fracao * i.maximo) : 0 }))
  const nota = executado ? Math.min(1000, itens.reduce((s, i) => s + i.pontos, 0)) : 0
  return { nota, itens, descricao: `Ø ${alvo.diametro.nominal} (${fmtTol(alvo.diametro)}) em ${alvo.comprimento.nominal} ± ${alvo.comprimento.tol} mm, Ra ≤ ${alvo.raMax} µm`, inspecaoPendente: false, medidas }
}

function fmtTol(t: { sup: number; inf: number }): string {
  const s = (v: number) => (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(2).replace(/\.?0+$/, '')
  return t.sup === -t.inf ? `± ${t.sup.toFixed(2)}` : `${s(t.sup) || '0'}/${s(t.inf) || '0'}`
}

/** Nada foi cortado além do ressalto pedido (2 mm de folga). */
function regiaoBrutaIntacta(m: ModeloTorno, p: PecaTorno): boolean {
  if (!p.alvo) return true
  const limite = m.zFace - p.alvo.comprimento.nominal - 2
  for (let z = 0; z < limite; z += 0.05) if (m.raioEm(z) < m.raioBruto - 1e-3) return false
  return true
}

const mm = (v: number) => v.toFixed(2)

/** Defeitos: o que se vê, onde, por que e como corrigir (do mais grave ao mais leve). */
export function inspecionarTorno(p: PecaTorno, m: ModeloTorno): DefeitoTig[] {
  const d: DefeitoTig[] = []
  const med = medidasTorno(m, p)
  if (m.quebras || m.colisoes) d.push({ nome: `Ferramenta quebrada (${m.quebras + m.colisoes}×)`, onde: 'na pastilha', grave: true,
    causa: [m.colisoes ? 'a ferramenta bateu na placa' : '', m.quebras ? 'encostou na peça com o eixo parado, ligou o eixo com a ferramenta encostada ou cortou fundo demais' : ''].filter(Boolean).join('; ') + '.',
    corrigir: 'Afaste a ferramenta antes de ligar ou desligar o eixo, respeite a profundidade da pastilha (até 4 mm) e pare o avanço antes do ressalto e da placa.' })
  if (p.alvo) {
    const a = p.alvo
    const dMin = a.diametro.nominal + a.diametro.inf, dMax = a.diametro.nominal + a.diametro.sup
    if (med.diametroMin < dMin - 1e-9) d.push({ nome: 'Diâmetro abaixo da tolerância (refugo)', onde: `Ø ${mm(med.diametroMin)} mm`, grave: true,
      causa: 'Material removido demais: no torno não dá para pôr de volta.', corrigir: 'Deixe sobremetal no desbaste (0,3–0,5 mm no diâmetro), meça com o micrômetro e só então dê o passe final.' })
    if (med.diametroMax > dMax + 1e-9) d.push({ nome: 'Diâmetro acima da tolerância', onde: `Ø ${mm(med.diametroMax)} mm`, grave: true,
      causa: m.vb > 0.15 ? 'Ainda há sobremetal. A aresta gasta recua e a força empurra a ferramenta: a peça sai maior que o mostrador.' : 'Ainda há sobremetal, ou a força do corte afastou a ferramenta (a peça sai maior que o mostrador).',
      corrigir: 'Meça, desconte a diferença e dê mais um passe leve (passe de "mola").' })
    if (med.comprimentoMm === null) d.push({ nome: 'Trecho não torneado', onde: 'na ponta', grave: true, causa: 'A ferramenta não chegou ao diâmetro pedido.', corrigir: 'Desbaste em passes de até 2 mm de profundidade, do lado da face para a placa.' })
    else if (Math.abs(med.comprimentoMm - a.comprimento.nominal) > a.comprimento.tol) d.push({
      nome: med.comprimentoMm > a.comprimento.nominal ? 'Ressalto longe demais' : 'Ressalto perto demais', onde: `${mm(med.comprimentoMm)} mm da face`, grave: false,
      causa: 'O avanço passou (ou parou antes) da marca do ressalto.', corrigir: 'Zere o carro na face e desligue o avanço automático um pouco antes; termine na manivela.' })
    if (med.faceRemovidaMm < a.facearMinMm) d.push({ nome: 'Face não faceada', onde: 'na face livre', grave: false,
      causa: 'A ponta do tarugo ficou com a face bruta de corte de serra.', corrigir: `Faceie primeiro: ferramenta na face, avanço transversal até o centro, tirando pelo menos ${a.facearMinMm} mm.` })
    if (!regiaoBrutaIntacta(m, p)) d.push({ nome: 'Região bruta usinada', onde: 'além do ressalto', grave: false,
      causa: 'A ferramenta passou do ressalto e cortou onde o desenho pede a barra bruta.', corrigir: 'Pare o avanço antes do ressalto.' })
    // Acabamento: a causa que mais aparece no trecho funcional.
    const [i0, i1] = [m.celula(m.zFace - a.comprimento.nominal + 1), m.celula(m.zFace - 0.5)]
    let ruins = 0
    const contagem = { avanco: 0, apc: 0, desgaste: 0, vibracao: 0, lascada: 0 }
    for (let i = Math.max(0, i0); i <= Math.min(m.n - 1, i1); i++) {
      if (!(m.ra[i] > a.raMax)) continue
      ruins++
      for (const k of Object.keys(contagem) as (keyof typeof contagem)[]) if (m.causa[i] & CAUSA[k]) contagem[k]++
    }
    if (ruins > 0) {
      const textos: Record<keyof typeof contagem, [string, string]> = {
        avanco: ['Avanço alto para o raio de ponta (Ra ≈ f²/8rε).', 'Acabamento com avanço menor (0,05–0,1 mm/volta) ou pastilha de raio maior.'],
        apc: ['Velocidade de corte baixa: aresta postiça (material grudando na aresta).', 'Suba a rotação para a vc ficar na faixa do material.'],
        desgaste: ['Aresta gasta: risca e esquenta a superfície.', 'Troque a aresta antes do acabamento.'],
        vibracao: ['A peça vibrou (balanço longo e corte pesado): marcas de trepidação.', 'Passes mais leves perto da ponta, ou deixe menos peça para fora da placa.'],
        lascada: ['Aresta lascada.', 'Troque a aresta.'],
      }
      const principais = (Object.keys(contagem) as (keyof typeof contagem)[]).filter((k) => contagem[k] > 0).sort((x, y) => contagem[y] - contagem[x])
      d.push({ nome: `Acabamento acima de Ra ${a.raMax} µm`, onde: `Ra até ${med.raMax?.toFixed(1)} µm no trecho funcional`, grave: false,
        causa: principais.length ? principais.map((k) => textos[k][0]).join(' ') : 'A superfície não foi acabada.', corrigir: principais.length ? principais.map((k) => textos[k][1]).join(' ') : 'Dê um passe de acabamento.' })
    }
  }
  if (m.sobrecargas) d.push({ nome: `Motor parou por sobrecarga (${m.sobrecargas}×)`, onde: 'no cabeçote', grave: false,
    causa: 'Profundidade e avanço altos demais para a rotação (pouco torque em rotação baixa).', corrigir: 'Diminua a profundidade ou o avanço.' })
  if (m.lascas && !m.quebras) d.push({ nome: 'Aresta lascada', onde: 'na pastilha', grave: false,
    causa: 'A aresta passou muito do desgaste-limite (VB > 0,6 mm): vc alta demais para o material ou carepa abrasiva.', corrigir: 'Troque a aresta quando o desgaste passar de 0,3 mm e use a vc da faixa.' })
  if (m.medicoesInseguras) d.push({ nome: `Medição com o eixo girando (${m.medicoesInseguras}×)`, onde: 'segurança', grave: false,
    causa: 'O instrumento pode ser puxado pela peça girando: na oficina isso machuca.', corrigir: 'Desligue o eixo e espere parar antes de medir.' })
  if (m.episodiosVibracao && !d.some((x) => x.nome.startsWith('Acabamento'))) d.push({ nome: `Vibração (${m.episodiosVibracao}×)`, onde: 'perto da ponta', grave: false,
    causa: 'Peça comprida e fina em balanço com corte pesado.', corrigir: 'Passes leves na ponta da peça.' })
  return d.sort((x, y) => Number(y.grave) - Number(x.grave))
}
