import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';

// The AYYY parent is static: the React app is built to /family/.
export default defineConfig({
  base:'./',
  plugins:[react()],
  build:{target:'es2022',outDir:'../family',emptyOutDir:true}
});
