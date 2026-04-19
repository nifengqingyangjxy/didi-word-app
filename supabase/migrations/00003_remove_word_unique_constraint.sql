-- 移除单词的唯一约束，因为同一个单词可能在不同章节中出现
ALTER TABLE words DROP CONSTRAINT IF EXISTS words_word_key;