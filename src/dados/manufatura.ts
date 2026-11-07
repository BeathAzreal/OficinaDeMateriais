import { LIMITES, type Pose, type PontoEnsinado } from '../modelo/manufatura/celula'
import { validarCondicoes } from '../modelo/manufatura/condicoes'
import { CELULA_PADRAO } from '../modelo/manufatura/executor'
import { projetoInicial, projetoLivre, type ProjetoManufatura } from '../modelo/manufatura/missao'

/*
 * Projeto da Manufatura Aditiva salvo no navegador (coleção "manufatura",
 * v2.1): programa, pontos ensinados, condições e célula, mais a melhor nota.
 * O modo livre guarda o projeto dele à parte (`livre`), para não mexer no da
 * missão; dado salvo antes do modo livre não tem o campo e recebe o padrão.
 * Coleção nova: nenhuma coleção antiga muda de formato. Dado estranho ou
 * corrompido volta ao projeto inicial, campo a campo, sem perder o resto.
 */

export interface MelhorParede { nota: number; aprovada: boolean; data: string }

export interface DadosManufatura {
  versao: 1
  projeto: ProjetoManufatura
  /** Projeto do modo livre (sem missão). */
  livre: ProjetoManufatura
  melhor: MelhorParede | null
}

export const MAX_CARACTERES_PROGRAMA = 24000

export function dadosManufaturaIniciais(): DadosManufatura {
  return { versao: 1, projeto: projetoInicial(), livre: projetoLivre(), melhor: null }
}

const numero = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

function validarPose(d: unknown): Pose | null {
  if (!d || typeof d !== 'object') return null
  const p = d as Record<string, unknown>
  const campos = ['x', 'y', 'z', 'rx', 'ry', 'rz'] as const
  if (!campos.every((c) => numero(p[c]) && Math.abs(p[c] as number) < 1e5)) return null
  return { x: p.x as number, y: p.y as number, z: p.z as number, rx: p.rx as number, ry: p.ry as number, rz: p.rz as number }
}

export function validarPontos(d: unknown): PontoEnsinado[] | null {
  if (!Array.isArray(d) || !d.length) return null
  const pontos: PontoEnsinado[] = []
  for (const item of d.slice(0, LIMITES.pontos)) {
    const o = (item ?? {}) as { nome?: unknown; pose?: unknown }
    const pose = validarPose(o.pose)
    if (!pose) return null
    pontos.push({ nome: typeof o.nome === 'string' ? o.nome.slice(0, 40) : '', pose })
  }
  return pontos
}

/** Projeto salvo, campo a campo: o que estiver estragado volta ao de `inicial`. */
function validarProjeto(d: unknown, inicial: ProjetoManufatura): ProjetoManufatura {
  const p = (d ?? {}) as Partial<Record<keyof ProjetoManufatura, unknown>>
  const programa = typeof p.programa === 'string' && p.programa.length <= MAX_CARACTERES_PROGRAMA ? p.programa : inicial.programa
  const pontos = validarPontos(p.pontos) ?? inicial.pontos
  const condicoes = validarCondicoes(p.condicoes) ?? inicial.condicoes
  const c = (p.celula ?? {}) as { ctwdMm?: unknown }
  const celula = { ctwdMm: numero(c.ctwdMm) ? Math.max(8, Math.min(25, c.ctwdMm)) : CELULA_PADRAO.ctwdMm }
  return { programa, pontos, condicoes, celula }
}

export function validarDadosManufatura(d: unknown): DadosManufatura | null {
  if (!d || typeof d !== 'object') return null
  const o = d as { versao?: unknown; projeto?: unknown; livre?: unknown; melhor?: unknown }
  if (o.versao !== 1) return null
  const m = (o.melhor ?? null) as { nota?: unknown; aprovada?: unknown; data?: unknown } | null
  const melhor = m && numero(m.nota) && typeof m.aprovada === 'boolean' && typeof m.data === 'string'
    ? { nota: Math.max(0, Math.min(1000, Math.round(m.nota))), aprovada: m.aprovada, data: m.data }
    : null
  return { versao: 1, projeto: validarProjeto(o.projeto, projetoInicial()), livre: validarProjeto(o.livre, projetoLivre()), melhor }
}
