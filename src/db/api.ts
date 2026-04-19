import { db, generateUUID } from './indexeddb';
import type { Word, WrongWord, WrongWordHistory, StudyRecord, Setting, Collection } from '@/types';

// ==================== 辅助函数 ====================

/**
 * 清理单词，移除序号和非字母字符
 */
export function cleanWord(word: string): string {
  // 移除行首序号（如 "1. ", "88. ", "1、", "1) "等）
  let cleaned = word.replace(/^\d+[.、)]\s*/, '').trim();
  
  // 只保留字母字符
  cleaned = cleaned.replace(/[^a-zA-Z]/g, '');
  
  return cleaned.toLowerCase();
}

// ==================== 章节管理 ====================

// 获取所有章节
export async function getAllCollections(): Promise<Collection[]> {
  return await db.collections.orderBy('created_at').reverse().toArray();
}

// 根据ID获取章节
export async function getCollectionById(id: string): Promise<Collection | undefined> {
  return await db.collections.get(id);
}

// 创建章节
export async function createCollection(name: string, description?: string): Promise<Collection> {
  const collection: Collection = {
    id: generateUUID(),
    name,
    description: description || '',
    word_count: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  
  await db.collections.add(collection);
  return collection;
}

// 更新章节
export async function updateCollection(id: string, updates: Partial<Collection>): Promise<void> {
  await db.collections.update(id, {
    ...updates,
    updated_at: new Date().toISOString(),
  });
}

// 更新章节名称（兼容旧代码）
export async function updateCollectionName(id: string, name: string): Promise<void> {
  await updateCollection(id, { name });
}

// 删除章节
export async function deleteCollection(id: string): Promise<void> {
  // 删除章节下的所有单词
  const words = await db.words.where('collection_id').equals(id).toArray();
  await db.words.where('collection_id').equals(id).delete();
  
  // 删除章节
  await db.collections.delete(id);
}

// 更新章节的单词数量
export async function updateCollectionWordCount(collectionId: string): Promise<void> {
  const count = await db.words.where('collection_id').equals(collectionId).count();
  await db.collections.update(collectionId, {
    word_count: count,
    updated_at: new Date().toISOString(),
  });
}

// ==================== 单词管理 ====================

// 获取所有单词
export async function getAllWords(): Promise<Word[]> {
  return await db.words.orderBy('created_at').reverse().toArray();
}

// 获取单词总数
export async function getWordsCount(): Promise<number> {
  return await db.words.count();
}

// 根据章节获取单词
export async function getWordsByCollection(collectionId: string): Promise<Word[]> {
  return await db.words.where('collection_id').equals(collectionId).toArray();
}

// 根据多个章节获取单词
export async function getWordsByCollections(collectionIds: string[]): Promise<Word[]> {
  if (collectionIds.length === 0) {
    return await getAllWords();
  }
  
  const words: Word[] = [];
  for (const id of collectionIds) {
    const collectionWords = await db.words.where('collection_id').equals(id).toArray();
    words.push(...collectionWords);
  }
  return words;
}

// 搜索单词
export async function searchWords(keyword: string): Promise<Word[]> {
  const lowerKeyword = keyword.toLowerCase();
  return await db.words
    .filter(word => 
      word.word.toLowerCase().includes(lowerKeyword) ||
      word.translation.toLowerCase().includes(lowerKeyword) ||
      (word.phonetic !== null && word.phonetic.toLowerCase().includes(lowerKeyword))
    )
    .toArray();
}

// 添加单词
export async function addWord(word: Omit<Word, 'id' | 'created_at' | 'updated_at'>): Promise<Word> {
  const newWord: Word = {
    ...word,
    id: generateUUID(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  
  await db.words.add(newWord);
  
  // 更新章节的单词数量
  if (word.collection_id) {
    await updateCollectionWordCount(word.collection_id);
  }
  
  return newWord;
}

// 批量添加单词
export async function addWordsBatch(
  words: Omit<Word, 'id' | 'created_at' | 'updated_at'>[],
  enableDedupe: boolean = false
): Promise<{ added: Word[]; duplicates: number }> {
  const newWords: Word[] = [];
  let duplicates = 0;
  
  for (const word of words) {
    // 如果启用去重，检查同一章节内单词是否已存在
    if (enableDedupe) {
      // 查询条件：单词相同 AND collection_id相同 AND chapter_id相同
      let query = db.words.where('word').equalsIgnoreCase(word.word);
      
      const allMatches = await query.toArray();
      
      // 手动过滤：检查collection_id和chapter_id是否都匹配
      const existing = allMatches.find(w => 
        w.collection_id === (word.collection_id || null) &&
        w.chapter_id === (word.chapter_id || null)
      );
      
      if (existing) {
        duplicates++;
        continue;
      }
    }
    
    const newWord: Word = {
      ...word,
      id: generateUUID(),
      import_order: word.import_order || 0, // 确保import_order字段存在
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    newWords.push(newWord);
  }
  
  if (newWords.length > 0) {
    await db.words.bulkAdd(newWords);
    
    // 更新章节的单词数量
    const collectionIds = [...new Set(newWords.map(w => w.collection_id).filter(Boolean))];
    for (const collectionId of collectionIds) {
      if (collectionId) {
        await updateCollectionWordCount(collectionId);
      }
    }
  }
  
  return { added: newWords, duplicates };
}

// 更新单词
export async function updateWord(id: string, updates: Partial<Word>): Promise<void> {
  await db.words.update(id, {
    ...updates,
    updated_at: new Date().toISOString(),
  });
}

// 删除单词
export async function deleteWord(id: string): Promise<void> {
  const word = await db.words.get(id);
  await db.words.delete(id);
  
  // 更新章节的单词数量
  if (word?.collection_id) {
    await updateCollectionWordCount(word.collection_id);
  }
  
  // 删除相关的易错词记录
  await db.wrong_words.where('word_id').equals(id).delete();
}

// 根据单词文本查找单词
export async function getWordByText(wordText: string): Promise<Word | undefined> {
  return await db.words.where('word').equalsIgnoreCase(wordText).first();
}

// ==================== 易错词管理 ====================

// 获取所有易错词
export async function getAllWrongWords(
  sortBy: 'weight' | 'error_count' | 'created_at' = 'weight',
  order: 'asc' | 'desc' = 'desc'
): Promise<WrongWord[]> {
  let wrongWords = await db.wrong_words.toArray();
  
  // 关联单词信息
  for (const wrongWord of wrongWords) {
    wrongWord.word = await db.words.get(wrongWord.word_id);
  }
  
  // 排序
  wrongWords.sort((a, b) => {
    const aValue = a[sortBy];
    const bValue = b[sortBy];
    if (order === 'asc') {
      return aValue > bValue ? 1 : -1;
    } else {
      return aValue < bValue ? 1 : -1;
    }
  });
  
  return wrongWords;
}

// 搜索易错词
export async function searchWrongWords(
  keyword: string,
  sortBy: 'weight' | 'error_count' | 'created_at' = 'weight',
  order: 'asc' | 'desc' = 'desc'
): Promise<WrongWord[]> {
  const allWrongWords = await getAllWrongWords(sortBy, order);
  const lowerKeyword = keyword.toLowerCase();
  
  return allWrongWords.filter(wrongWord => {
    const word = wrongWord.word;
    if (!word) return false;
    return word.word.toLowerCase().includes(lowerKeyword) ||
           word.translation.toLowerCase().includes(lowerKeyword) ||
           (word.phonetic && word.phonetic.toLowerCase().includes(lowerKeyword));
  });
}

// 添加或更新易错词
export async function addOrUpdateWrongWord(wordId: string): Promise<void> {
  const existing = await db.wrong_words.where('word_id').equals(wordId).first();
  
  if (existing) {
    // 更新：权重+3，错误次数+1
    await db.wrong_words.update(existing.id, {
      weight: existing.weight + 3,
      error_count: existing.error_count + 1,
      updated_at: new Date().toISOString(),
    });
  } else {
    // 新增：初始权重3，错误次数1
    const wrongWord: WrongWord = {
      id: generateUUID(),
      word_id: wordId,
      weight: 3,
      error_count: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    await db.wrong_words.add(wrongWord);
  }
}

// 减少易错词权重
export async function decreaseWrongWordWeight(wordId: string): Promise<void> {
  const existing = await db.wrong_words.where('word_id').equals(wordId).first();
  
  if (existing) {
    const newWeight = existing.weight - 1;
    
    if (newWeight <= 0) {
      // 权重为0，移到历史记录并删除
      const history: WrongWordHistory = {
        id: generateUUID(),
        word_id: wordId,
        total_errors: existing.error_count,
        removed_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      };
      await db.wrong_words_history.add(history);
      await db.wrong_words.delete(existing.id);
    } else {
      // 权重-1
      await db.wrong_words.update(existing.id, {
        weight: newWeight,
        updated_at: new Date().toISOString(),
      });
    }
  }
}

// 删除易错词
export async function deleteWrongWord(wordId: string): Promise<void> {
  await db.wrong_words.where('word_id').equals(wordId).delete();
}

// 批量删除易错词
export async function deleteWrongWordsBatch(wordIds: string[]): Promise<void> {
  for (const wordId of wordIds) {
    await db.wrong_words.where('word_id').equals(wordId).delete();
  }
}

// 获取易错词历史
export async function getWrongWordsHistory(): Promise<WrongWordHistory[]> {
  const history = await db.wrong_words_history.orderBy('removed_at').reverse().toArray();
  
  // 关联单词信息
  for (const item of history) {
    item.word = await db.words.get(item.word_id);
  }
  
  return history;
}

// 根据权重获取易错词
export async function getWrongWordsByWeight(maxWeight: number): Promise<WrongWord[]> {
  const wrongWords = await db.wrong_words.where('weight').belowOrEqual(maxWeight).toArray();
  
  // 关联单词信息
  for (const wrongWord of wrongWords) {
    wrongWord.word = await db.words.get(wrongWord.word_id);
  }
  
  return wrongWords;
}

// 获取最大权重值
export async function getMaxWrongWordWeight(): Promise<number> {
  const wrongWords = await db.wrong_words.toArray();
  if (wrongWords.length === 0) return 0;
  return Math.max(...wrongWords.map(w => w.weight));
}

// 根据最大权重获取易错词
export async function getWrongWordsByMaxWeight(maxWeight: number, limit?: number): Promise<Word[]> {
  const wrongWords = await getWrongWordsByWeight(maxWeight);
  
  // 提取单词信息
  const words: Word[] = wrongWords
    .map(ww => ww.word)
    .filter((word): word is Word => word !== undefined);
  
  // 如果指定了数量限制，随机选择
  if (limit && words.length > limit) {
    const shuffled = words.sort(() => Math.random() - 0.5);
    return shuffled.slice(0, limit);
  }
  
  return words;
}

// ==================== 学习记录管理 ====================

// 添加学习记录
export async function addStudyRecord(record: Omit<StudyRecord, 'id' | 'created_at'>): Promise<StudyRecord> {
  const newRecord: StudyRecord = {
    ...record,
    id: generateUUID(),
    created_at: new Date().toISOString(),
  };
  
  await db.study_records.add(newRecord);
  return newRecord;
}

// 获取指定日期范围的学习记录
export async function getStudyRecordsByDateRange(startDate: string, endDate: string): Promise<StudyRecord[]> {
  return await db.study_records
    .where('study_date')
    .between(startDate, endDate, true, true)
    .toArray();
}

// 获取所有学习记录
export async function getAllStudyRecords(): Promise<StudyRecord[]> {
  return await db.study_records.orderBy('study_date').reverse().toArray();
}

// 获取每日统计
export async function getDailyStatistics(days: number = 30): Promise<StudyRecord[]> {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  return await getStudyRecordsByDateRange(
    startDate.toISOString().split('T')[0],
    endDate.toISOString().split('T')[0]
  );
}

// 获取每月统计
export async function getMonthlyStatistics(months: number = 12): Promise<StudyRecord[]> {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - months);
  
  return await getStudyRecordsByDateRange(
    startDate.toISOString().split('T')[0],
    endDate.toISOString().split('T')[0]
  );
}

// ==================== 设置管理 ====================

// 获取设置
export async function getSetting(key: string): Promise<string | null> {
  const setting = await db.settings.where('key').equals(key).first();
  return setting ? setting.value : null;
}

// 更新设置
export async function updateSetting(key: string, value: string): Promise<void> {
  const existing = await db.settings.where('key').equals(key).first();
  
  if (existing) {
    await db.settings.update(existing.id, {
      value,
      updated_at: new Date().toISOString(),
    });
  } else {
    const setting: Setting = {
      id: generateUUID(),
      key,
      value,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    await db.settings.add(setting);
  }
}

// 获取所有设置
export async function getAllSettings(): Promise<Setting[]> {
  return await db.settings.toArray();
}

// ==================== 数据库清理 ====================

// 清空易错词库
export async function clearWrongWords(): Promise<void> {
  await db.wrong_words.clear();
}

// 清空单词库
export async function clearWords(): Promise<void> {
  await db.words.clear();
  // 同时清空所有章节的单词数量
  const collections = await db.collections.toArray();
  for (const collection of collections) {
    await db.collections.update(collection.id, { word_count: 0 });
  }
}

// 清空章节
export async function clearCollections(): Promise<void> {
  await db.collections.clear();
  // 同时清空所有单词
  await db.words.clear();
}
