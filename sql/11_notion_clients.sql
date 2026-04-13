-- Kopia rekordów z bazy Notion (Klienci) — uruchom w Supabase SQL Editor po wcześniejszych migracjach
CREATE TABLE IF NOT EXISTS notion_clients (
    notion_page_id TEXT PRIMARY KEY,
    user_id UUID NOT NULL,
    title TEXT NOT NULL DEFAULT '',
    notion_properties JSONB NOT NULL DEFAULT '{}'::jsonb,
    last_edited_time TIMESTAMPTZ,
    synced_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notion_clients_user_id ON notion_clients (user_id);
CREATE INDEX IF NOT EXISTS idx_notion_clients_synced_at ON notion_clients (synced_at DESC);

ALTER TABLE notion_clients ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all operations for notion_clients" ON notion_clients;
CREATE POLICY "Allow all operations for notion_clients" ON notion_clients FOR ALL USING (true) WITH CHECK (true);
