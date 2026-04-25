import type { IncomingMessage } from 'node:http';
import type { Connect } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import { IDEA_NOTE_TYPE_OPTIONS } from './src/constants';
import { syncNotionClientsToSupabase } from './scripts/notionClients/syncNotionClients';
import { createNotionIdeaPage } from './scripts/notionIdeas/createNotionIdeaPage';

/** Domyślna baza Notion dla pomysłów (ID z URL przed `?v=`). */
const DEFAULT_NOTION_POMYSLY_PARENT_ID = '8c93b9a454f946978cc1cdfa3de6046c';

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  if (chunks.length === 0) return null;
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
}

/** Ten sam middleware musi być na dev i preview — inaczej `/api/notion-*` zwraca 404 po `vite build`. */
function attachNotionApiMiddleware(server: { middlewares: Connect.Server }, env: Record<string, string>) {
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
            'Brak NOTION_TOKEN, NOTION_CLIENTS_DATABASE_ID lub danych Supabase w pliku .env (wymagane przy npm run dev / vite preview).',
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

  server.middlewares.use(async (req, res, next) => {
    const pathname = req.url?.split('?')[0] ?? '';
    if (pathname !== '/api/notion-ideas/create' || req.method !== 'POST') {
      return next();
    }
    const notionToken = env.NOTION_TOKEN?.trim();
    const parentId =
      env.NOTION_POMYSLY_PARENT_ID?.trim() || DEFAULT_NOTION_POMYSLY_PARENT_ID;
    if (!notionToken) {
      res.statusCode = 503;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(
        JSON.stringify({
          ok: false,
          error:
            'Brak NOTION_TOKEN w .env — dodaj token integracji Notion (jak przy sync klientów).',
        })
      );
      return;
    }
    let body: unknown;
    try {
      body = await readJsonBody(req);
    } catch {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ ok: false, error: 'Niepoprawny JSON' }));
      return;
    }
    const text =
      typeof body === 'object' &&
      body !== null &&
      'text' in body &&
      typeof (body as { text?: unknown }).text === 'string'
        ? (body as { text: string }).text
        : '';
    if (!text.trim()) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ ok: false, error: 'Pole "text" jest wymagane.' }));
      return;
    }

    const rawNoteType =
      typeof body === 'object' &&
      body !== null &&
      'noteType' in body &&
      typeof (body as { noteType?: unknown }).noteType === 'string'
        ? (body as { noteType: string }).noteType.trim()
        : '';
    const allowedTypes = IDEA_NOTE_TYPE_OPTIONS as readonly string[];
    if (rawNoteType && !allowedTypes.includes(rawNoteType)) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(
        JSON.stringify({
          ok: false,
          error: `Nieznany typ notatki: "${rawNoteType}". Dozwolone: ${allowedTypes.join(', ')}.`,
        })
      );
      return;
    }
    const noteType = rawNoteType || IDEA_NOTE_TYPE_OPTIONS[0];
    const noteTypePropertyHint = env.NOTION_POMYSLY_NOTE_TYPE_PROPERTY?.trim();

    try {
      const { notionPageId } = await createNotionIdeaPage({
        notionToken,
        parentTargetId: parentId,
        content: text,
        noteType,
        noteTypePropertyHint: noteTypePropertyHint || undefined,
      });
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ ok: true, notionPageId }));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      res.statusCode = 502;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ ok: false, error: msg }));
    }
  });
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'notion-apis',
        configureServer(server) {
          attachNotionApiMiddleware(server, env);
        },
        configurePreviewServer(server) {
          attachNotionApiMiddleware(server, env);
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
