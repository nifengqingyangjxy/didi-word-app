import Dexie, { Table } from 'dexie';
import type { Word, WrongWord, WrongWordHistory, StudyRecord, Setting, Collection } from '@/types';

// 定义数据库类
export class DidiWordDB extends Dexie {
  words!: Table<Word>;
  wrong_words!: Table<WrongWord>;
  wrong_words_history!: Table<WrongWordHistory>;
  study_records!: Table<StudyRecord>;
  settings!: Table<Setting>;
  collections!: Table<Collection>;

  constructor() {
    super('DidiWordDB');
    
    // 版本1：初始schema
    this.version(1).stores({
      words: 'id, word, phonetic, translation, part_of_speech, collection_id, created_at, updated_at',
      wrong_words: 'id, word_id, weight, error_count, created_at, updated_at',
      wrong_words_history: 'id, word_id, total_errors, removed_at',
      study_records: 'id, study_date, study_duration, words_studied, correct_count, total_count, accuracy, mode, created_at',
      settings: 'id, key, value, created_at, updated_at',
      collections: 'id, name, description, word_count, created_at, updated_at'
    });
    
    // 版本2：添加import_order字段
    this.version(2).stores({
      words: 'id, word, phonetic, translation, part_of_speech, collection_id, import_order, created_at, updated_at',
      wrong_words: 'id, word_id, weight, error_count, created_at, updated_at',
      wrong_words_history: 'id, word_id, total_errors, removed_at',
      study_records: 'id, study_date, study_duration, words_studied, correct_count, total_count, accuracy, mode, created_at',
      settings: 'id, key, value, created_at, updated_at',
      collections: 'id, name, description, word_count, created_at, updated_at'
    }).upgrade(async (tx) => {
      // 为现有数据添加默认的import_order
      const words = await tx.table('words').toArray();
      for (let i = 0; i < words.length; i++) {
        await tx.table('words').update(words[i].id, { import_order: i + 1 });
      }
    });
    
    // 版本3：添加needs_review和review_reason字段
    this.version(3).stores({
      words: 'id, word, phonetic, translation, part_of_speech, collection_id, import_order, needs_review, created_at, updated_at',
      wrong_words: 'id, word_id, weight, error_count, created_at, updated_at',
      wrong_words_history: 'id, word_id, total_errors, removed_at',
      study_records: 'id, study_date, study_duration, words_studied, correct_count, total_count, accuracy, mode, created_at',
      settings: 'id, key, value, created_at, updated_at',
      collections: 'id, name, description, word_count, created_at, updated_at'
    }).upgrade(async (tx) => {
      // 为现有数据添加默认的needs_review和review_reason
      const words = await tx.table('words').toArray();
      for (const word of words) {
        await tx.table('words').update(word.id, { 
          needs_review: false,
          review_reason: null
        });
      }
    });
  }
}

// 创建数据库实例
export const db = new DidiWordDB();

// 生成UUID
export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}
