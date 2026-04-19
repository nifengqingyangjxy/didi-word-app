-- 单词表
CREATE TABLE words (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  word TEXT NOT NULL UNIQUE,
  phonetic TEXT,
  translation TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 易错词表
CREATE TABLE wrong_words (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  word_id UUID NOT NULL REFERENCES words(id) ON DELETE CASCADE,
  error_count INTEGER DEFAULT 1,
  last_error_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(word_id)
);

-- 学习记录表
CREATE TABLE study_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  study_date DATE NOT NULL DEFAULT CURRENT_DATE,
  study_duration INTEGER DEFAULT 0, -- 学习时长（秒）
  words_studied INTEGER DEFAULT 0, -- 学习单词数
  correct_count INTEGER DEFAULT 0, -- 正确数
  total_count INTEGER DEFAULT 0, -- 总题数
  accuracy DECIMAL(5,2), -- 正确率
  mode TEXT, -- 学习模式：english_chinese, chinese_english, wrong_words
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 设置表
CREATE TABLE settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 插入默认设置
INSERT INTO settings (key, value) VALUES 
  ('pronunciation_threshold', '60');

-- 创建索引
CREATE INDEX idx_words_word ON words(word);
CREATE INDEX idx_wrong_words_word_id ON wrong_words(word_id);
CREATE INDEX idx_study_records_date ON study_records(study_date);

-- RLS策略（本地应用，允许所有操作）
ALTER TABLE words ENABLE ROW LEVEL SECURITY;
ALTER TABLE wrong_words ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "允许所有操作words" ON words FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "允许所有操作wrong_words" ON wrong_words FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "允许所有操作study_records" ON study_records FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "允许所有操作settings" ON settings FOR ALL USING (true) WITH CHECK (true);