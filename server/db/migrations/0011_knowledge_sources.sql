ALTER TABLE kb.document
  ADD COLUMN source_url text CHECK (source_url IS NULL OR source_url LIKE 'https://%'),
  ADD COLUMN source_type text CHECK (source_type IS NULL OR source_type IN ('book', 'paper', 'patent')),
  ADD COLUMN rights_note text;
