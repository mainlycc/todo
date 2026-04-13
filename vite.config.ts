import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import { syncNotionClientsToSupabase } from './scripts/notionClients/syncNotionClients';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'notion-clients-sync-api',
        configureServer(server) {
          server.middlewares.use(async (req, res, next) => {
            const pathname = req.url?.split('?')[0] ?? '';
            if (pathname !== '/api/notion-clients/sync' || (req.method !== 'GET' && req.method !== 'POST')) {
              return next();
            }
            const notionToken = env.NOTION_TOKEN?.trim();
            const databaseId = env.NOTION_CLIENTS_DATABASE_ID?.trim();
            const supabaseUrl = env.VITE_SUPABASE_URL?.trim();
            const supabaseKey =
              env.SUPABASE_SERVICE_ROLE_KEY?.trim() || env.VITE_SUPABASE_ANON_KEY?.trim();
            if (!notionToken || !databaseId || !supabaseUrl || !supabaseKey) {
              res.statusCode = 503;
              res.setHeader('Content-Type', 'application/json; charset=utf-8');
              res.end(
                JSON.stringify({
                  ok: false,
                  error:
                    'Brak NOTION_TOKEN, NOTION_CLIENTS_DATABASE_ID lub danych Supabase w pliku .env (wymagane przy npm run dev).',
                })
              );
              return;
            }
            try {
              const result = await syncNotionClientsToSupabase({
                notionToken,
                databaseId,
                supabaseUrl,
                supabaseKey,
              });
              res.setHeader('Content-Type', 'application/json; charset=utf-8');
              res.end(JSON.stringify({ ok: true, ...result }));
            } catch (e) {
              const msg = e instanceof Error ? e.message : String(e);
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json; charset=utf-8');
              res.end(JSON.stringify({ ok: false, error: msg }));
            }
          });
        },
      },
    ],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
