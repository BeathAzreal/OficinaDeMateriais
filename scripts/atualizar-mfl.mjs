// Copia o pacote mfl-wasm gerado na MFL (wasm/dist/npm) para vendor/mfl-wasm.
//   node scripts/atualizar-mfl.mjs ../MFLanguage/wasm/dist/npm 240f017
import { cpSync, existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const [origem, commit] = process.argv.slice(2)
if (!origem || !commit || !existsSync(join(origem, 'mfl.wasm'))) {
  console.error('uso: node scripts/atualizar-mfl.mjs <pasta wasm/dist/npm da MFL> <commit da MFL>')
  process.exit(1)
}
const destino = join('vendor', 'mfl-wasm')
const origemDoc = readFileSync(join(destino, 'ORIGEM.md'), 'utf8')
rmSync(destino, { recursive: true, force: true })
cpSync(origem, destino, { recursive: true })
const versao = JSON.parse(readFileSync(join(destino, 'package.json'), 'utf8')).version
writeFileSync(join(destino, 'ORIGEM.md'), origemDoc
  .replace(/\| Versão \| [^|]+\|/, `| Versão | ${versao} |`)
  .replace(/\| Commit da MFL \| [^\n]+/, `| Commit da MFL | \`${commit}\` |`))
console.log(`mfl-wasm ${versao} (MFL ${commit}) copiado para ${destino}. Rode npm install.`)
