export interface Option {
  label: string;
  value: string;
  icon?: React.ComponentType<{ className?: string }>;
  withCount?: boolean;
}

// 章节类型
export interface Collection {
  id: string;
  name: string;
  description?: string;
  word_count: number;
  created_at: string;
  updated_at: string;
}

// 章节类型
export interface Chapter {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
  word_count?: number; // 可选的单词数量（用于UI显示）
}

// 单词类型
export interface Word {
  id: string;
  word: string;
  phonetic: string | null;
  translation: string;
  part_of_speech: string | null;
  collection_id: string | null;
  chapter_id: string | null; // 新增章节ID
  import_order: number; // 导入顺序
  needs_review?: boolean; // 需要用户审查
  review_reason?: string | null; // 审查原因
  created_at: string;
  updated_at: string;
  collection?: Collection;
  chapter?: Chapter; // 新增章节关联
}

// 易错词类型
export interface WrongWord {
  id: string;
  word_id: string;
  error_count: number;
  weight: number; // 权重值
  created_at: string;
  updated_at: string;
  word?: Word; // 关联的单词信息
}

// 易错词历史类型
export interface WrongWordHistory {
  id: string;
  word_id: string;
  total_errors: number;
  removed_at: string;
  created_at: string;
  word?: Word; // 关联的单词信息
}

// 学习记录类型
export interface StudyRecord {
  id: string;
  study_date: string;
  study_duration: number;
  words_studied: number;
  correct_count: number;
  total_count: number;
  accuracy: number | null;
  mode: 'english_chinese' | 'chinese_english' | 'mixed' | 'wrong_words' | 'wrong_words_practice' | null;
  created_at: string;
}

// 设置类型
export interface Setting {
  id: string;
  key: string;
  value: string;
  created_at: string;
  updated_at: string;
}

// 学习模式类型
export type StudyMode = 'sequential' | 'random';

// 答题结果类型
export interface QuizResult {
  word: Word;
  userAnswer: string;
  isCorrect: boolean;
}

// 单词查询API响应
export interface WordLookupResponse {
  word: string;
  phonetic?: string;
  translation?: string;
}

// 统计数据类型
export interface StatisticsData {
  date: string;
  duration: number;
  wordsCount: number;
  accuracy: number;
}
