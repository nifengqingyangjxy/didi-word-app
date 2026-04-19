-- 添加导入顺序字段
ALTER TABLE words ADD COLUMN IF NOT EXISTS import_order INTEGER DEFAULT 0;

-- 为现有数据设置默认顺序（按创建时间）
UPDATE words SET import_order = (
  SELECT ROW_NUMBER() OVER (PARTITION BY collection_id ORDER BY created_at)
  FROM words w2
  WHERE w2.id = words.id
)
WHERE import_order = 0;

-- 添加索引以提高排序性能
CREATE INDEX IF NOT EXISTS idx_words_import_order ON words(collection_id, import_order);

-- 添加注释
COMMENT ON COLUMN words.import_order IS '导入顺序，用于保持文件中的原始顺序';
