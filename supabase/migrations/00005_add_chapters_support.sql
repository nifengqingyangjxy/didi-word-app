-- 创建章节表
CREATE TABLE IF NOT EXISTS chapters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 为words表添加chapter_id字段
ALTER TABLE words 
ADD COLUMN IF NOT EXISTS chapter_id UUID REFERENCES chapters(id) ON DELETE CASCADE;

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_words_chapter_id ON words(chapter_id);

-- 添加RLS策略
ALTER TABLE chapters ENABLE ROW LEVEL SECURITY;

-- 删除旧策略（如果存在）
DROP POLICY IF EXISTS "Allow public read access to chapters" ON chapters;
DROP POLICY IF EXISTS "Allow public insert access to chapters" ON chapters;
DROP POLICY IF EXISTS "Allow public update access to chapters" ON chapters;
DROP POLICY IF EXISTS "Allow public delete access to chapters" ON chapters;

-- 创建新策略
CREATE POLICY "Allow public read access to chapters"
ON chapters FOR SELECT
TO public
USING (true);

CREATE POLICY "Allow public insert access to chapters"
ON chapters FOR INSERT
TO public
WITH CHECK (true);

CREATE POLICY "Allow public update access to chapters"
ON chapters FOR UPDATE
TO public
USING (true);

CREATE POLICY "Allow public delete access to chapters"
ON chapters FOR DELETE
TO public
USING (true);