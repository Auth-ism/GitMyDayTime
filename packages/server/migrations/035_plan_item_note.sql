-- Plan öğesine serbest metin not alanı (GMD-21)
--
-- description başlık olarak kalıyor; uzun açıklama ayrı sütuna gidiyor.
-- Şablon ve tekrarlayan görevler de notu taşısın diye aynı sütun oralara da eklendi.
-- trgm index, arama sorgusunun notların içinde de eşleşebilmesi için —
-- pg_trgm uzantısı 013_fuzzy_search.sql'de kuruluyor.

ALTER TABLE plan_items      ADD COLUMN IF NOT EXISTS note TEXT;
ALTER TABLE template_items  ADD COLUMN IF NOT EXISTS note TEXT;
ALTER TABLE recurring_tasks ADD COLUMN IF NOT EXISTS note TEXT;

CREATE INDEX IF NOT EXISTS idx_plan_items_note_trgm
  ON plan_items USING GIN (note gin_trgm_ops);
