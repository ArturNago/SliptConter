import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// URL da API injetada em build-time via VITE_API_URL (docker-compose / .env).
// Fallback para o túnel de produção documentado no projeto.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  // Prioriza env var de sistema (docker-compose) e cai para o .env / fallback.
  const API_URL = process.env.VITE_API_URL || env.VITE_API_URL || 'https://bemviverdecor.com.br';

  return {
    plugins: [react()],
    server: {
      port: 3000,
      host: true,
    },
    preview: {
      port: 3000,
      host: true,
    },
    define: {
      // Disponibiliza a URL base da API em tempo de build para o cliente.
      __API_URL__: JSON.stringify(API_URL),
    },
    build: {
      outDir: 'dist',
      sourcemap: false,
    },
  };
});

