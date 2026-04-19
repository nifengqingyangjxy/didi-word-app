-- 添加词集表
CREATE TABLE IF NOT EXISTS collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  word_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 为words表添加新字段
ALTER TABLE words ADD COLUMN IF NOT EXISTS part_of_speech TEXT;
ALTER TABLE words ADD COLUMN IF NOT EXISTS collection_id UUID REFERENCES collections(id) ON DELETE SET NULL;

-- 创建默认词集
INSERT INTO collections (name, word_count) VALUES ('默认词集', 0)
ON CONFLICT (name) DO NOTHING;

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_words_collection_id ON words(collection_id);

-- RLS策略
ALTER TABLE collections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "允许所有操作collections" ON collections FOR ALL USING (true) WITH CHECK (true);