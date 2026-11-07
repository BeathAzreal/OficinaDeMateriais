import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// v2.2: os setores de Usinagem e Laboratório são telas em React (src/setores).
// v2.3: o interpretador da MFL (.wasm) entra como asset embutido (?inline, src/mfl/motor.ts).
export default defineConfig({
  plugins: [react()],
  assetsInclude: ['**/*.wasm'],
})
