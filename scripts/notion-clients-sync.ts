/**
 * Synchronizacja bazy Notion → Supabase (tabela notion_clients).
 * Uruchom: npx tsx scripts/notion-clients-sync.ts
 * Wymaga w .env: NOTION_TOKEN, NOTION_CLIENTS_DATABASE_ID, VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
 */
import { config } from 'dotenv';
import { syncNotionClientsToSupabase } from './notionClients/syncNotionClients';

config({ path: '.env' });

async function main() {
  const notionToken = process.env.NOTION_TOKEN?.trim();
  const databaseId = process.env.NOTION_CLIENTS_DATABASE_ID?.trim();
  const supabaseUrl = process.env.VITE_SUPABASE_URL?.trim();
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || process.env.VITE_SUPABASE_ANON_KEY?.trim();

  if (!notionToken || !databaseId || !supabaseUrl || !supabaseKey) {
    console.error(
      'Brakuje zmiennych: NOTION_TOKEN, NOTION_CLIENTS_DATABASE_ID, VITE_SUPABASE_URL oraz VITE_SUPABASE_ANON_KEY (lub SUPABASE_SERVICE_ROLE_KEY).'
    );
    process.exit(1);
  }

  const result = await syncNotionClientsToSupabase({
    notionToken,
    databaseId,
    supabaseUrl,
    supabaseKey,
  });
  console.log(`Zsynchronizowano: ${result.synced} wierszy, usunięto przestarzałe: ${result.removedStale}`);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
