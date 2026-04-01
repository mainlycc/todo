-- Override sum wpłat per miesiąc (YYYY-MM)
-- Uruchom w Supabase SQL Editor po schema.sql

CREATE TABLE IF NOT EXISTS payment_month_overrides (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  month TEXT NOT NULL, -- format: YYYY-MM
  net_total_override NUMERIC NOT NULL,
  gross_total_override NUMERIC NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, month)
);

ALTER TABLE payment_month_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations for payment_month_overrides"
  ON payment_month_overrides
  FOR ALL
  USING (true)
  WITH CHECK (true);

