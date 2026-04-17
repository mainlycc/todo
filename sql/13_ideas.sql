-- Pomysły zapisane lokalnie + powiązanie ze stroną w Notion (uruchom w Supabase SQL Editor)
CREATE TABLE IF NOT EXISTS ideas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    content TEXT NOT NULL,
    notion_page_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE ideas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all operations for ideas" ON ideas;
CREATE POLICY "Allow all operations for ideas" ON ideas FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_ideas_user_created ON ideas (user_id, created_at DESC);
