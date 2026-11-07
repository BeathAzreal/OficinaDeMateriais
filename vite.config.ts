import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// v2.2: os setores de Usinagem e Laboratório são telas em React (src/setores).
export default defineConfig({
  plugins: [react()],
})
