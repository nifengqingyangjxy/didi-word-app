-- 为易错词表添加权重字段
ALTER TABLE wrong_words ADD COLUMN IF NOT EXISTS weight INTEGER DEFAULT 3;

-- 创建易错词历史表（记录移出易错词库的单词）
CREATE TABLE IF NOT EXISTS wrong_words_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  word_id UUID NOT NULL REFERENCES words(id) ON DELETE CASCADE,
  total_errors INTEGER DEFAULT 0, -- 历史总错误次数
  removed_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 添加设置项
INSERT INTO settings (key, value) 
VALUES 
  ('wrong_word_insertion_enabled', 'true'),
  ('wrong_word_insertion_count', '10')
ON CONFLICT (key) DO NOTHING;

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_wrong_words_weight ON wrong_words(weight DESC);
CREATE INDEX IF NOT EXISTS idx_wrong_words_history_word_id ON wrong_words_history(word_id);

-- RLS策略
ALTER TABLE wrong_words_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "允许所有操作wrong_words_history" ON wrong_words_history FOR ALL USING (true) WITH CHECK (true);