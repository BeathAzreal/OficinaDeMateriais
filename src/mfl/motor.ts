/*
 * Motor MFL do jogo: carrega o interpretador da MFL (WebAssembly, pacote
 * mfl-wasm em vendor/) uma vez, registra os modelos de modelos/*.mfl e
 * compila cada modelo uma vez só. As contas físicas ficam nos .mfl, com
 * unidades verificadas; aqui só entram e saem números.
 */
import { create, type Mfl, type MflScript, type MflState } from 'mfl-wasm'
// O .wasm vai embutido (data URL) para o HTML portátil funcionar sem servidor.
import wasmEmbutido from 'mfl-wasm/mfl.wasm?inline'

/** Texto de cada modelo, pelo caminho a partir da raiz ('modelos/soldagem/aporte.mfl'). */
export const MODELOS: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(import.meta.glob<string>('../../modelos/**/*.mfl', { query: '?raw', import: 'default', eager: true }))
    .map(([caminho, texto]) => [caminho.replace(/^(\.\.\/)+/, ''), texto]),
)

function bytesDoDataUrl(url: string): Uint8Array {
  const base64 = url.slice(url.indexOf(',') + 1)
  const binario = atob(base64)
  const bytes = new Uint8Array(binario.length)
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i)
  return bytes
}

let carregando: Promise<Mfl> | null = null

/** O interpretador, carregado na primeira vez que alguém precisa dele. */
export function mfl(): Promise<Mfl> {
  carregando ??= create(bytesDoDataUrl(wasmEmbutido))
  return carregando
}

/** Um estado com todos os modelos registrados e os scripts já compilados. */
export class Modelos {
  private readonly scripts = new Map<string, MflScript>()

  private constructor(readonly estado: MflState) {
    for (const [caminho, texto] of Object.entries(MODELOS)) estado.addSource(caminho, texto)
  }

  static async criar(): Promise<Modelos> {
    return new Modelos((await mfl()).createState())
  }

  /**
   * Roda um modelo com as entradas dadas ({nome: [valor, unidade]}) e
   * devolve o estado para ler os resultados com getNumber. A primeira
   * execução de cada modelo compila (as entradas já precisam existir: a
   * verificação de dimensões usa as unidades delas).
   */
  rodar(caminho: string, entradas: Readonly<Record<string, readonly [number, string?]>>): MflState {
    for (const [nome, [valor, unidade]] of Object.entries(entradas)) this.estado.setNumber(nome, valor, unidade)
    let script = this.scripts.get(caminho)
    if (!script) {
      script = this.estado.compile(caminho)
      this.scripts.set(caminho, script)
    }
    // Limite de instruções: um modelo com laço infinito não trava o jogo.
    script.run({ maxSteps: 1_000_000 })
    return this.estado
  }
}

let modelos: Promise<Modelos> | null = null

/** Estado compartilhado do jogo (um só; os modelos são pequenos). */
export function modelosDoJogo(): Promise<Modelos> {
  modelos ??= Modelos.criar()
  return modelos
}
