
import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
// Added import for fileURLToPath to resolve __dirname equivalent in ESM
import { fileURLToPath } from 'url';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [react()],
    base: process.env.VITE_BASE_PATH || '/culture-annotation-tool',
    define: {
      // Use import.meta.env for client-side environment variables in Vite
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY), // Keep for @google/genai guideline adherence
      'import.meta.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(env.VITE_SUPABASE_URL),
      'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(env.VITE_SUPABASE_ANON_KEY)
    },
    resolve: {
      alias: {
        // Replaced __dirname with path.dirname(fileURLToPath(import.meta.url)) for ESM compatibility
        '@': path.resolve(path.dirname(fileURLToPath(import.meta.url)), '.'),
      }
    }
  };
});
