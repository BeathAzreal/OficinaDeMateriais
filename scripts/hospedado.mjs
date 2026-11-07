// Empacota o HTML e o servidor em um Worker ESM, sem dependências no runtime.
import {build} from 'vite'
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs'
import {resolve} from 'node:path'
const pagina=readFileSync('portatil/Oficina de Materiais v2.3/Oficina de Materiais.html','utf8')
mkdirSync('.hospedagem',{recursive:true})
writeFileSync('.hospedagem/entrada.ts',`import {criarWorker} from '../servidor/worker';export default criarWorker(${JSON.stringify(pagina)});\n`)
await build({build:{ssr:resolve('.hospedagem/entrada.ts'),outDir:'dist-hospedado',rollupOptions:{output:{entryFileNames:'index.js'}}}})
