import { supabase } from './supabase';
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
  const { data, error } = await supabase
    .from('collections')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

// 根据ID获取章节
export async function getCollectionById(id: string): Promise<Collection> {
  const { data, error } = await supabase
    .from('collections')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data;
}

// 创建章节
export async function createCollection(name: string): Promise<Collection> {
  const { data, error } = await supabase
    .from('collections')
    .insert({ name, word_count: 0 })
    .select()
    .single();

  if (error) throw error;
  return data;
}

// 更新章节名称
export async function updateCollectionName(id: string, name: string): Promise<void> {
  const { error } = await supabase
    .from('collections')
    .update({ name })
    .eq('id', id);

  if (error) throw error;
}

// 删除章节
export async function deleteCollection(id: string): Promise<void> {
  const { error } = await supabase
    .from('collections')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// 更新章节单词数量
export async function updateCollectionWordCount(collectionId: string): Promise<void> {
  const { count } = await supabase
    .from('words')
    .select('*', { count: 'exact', head: true })
    .eq('collection_id', collectionId);

  await supabase
    .from('collections')
    .update({ word_count: count || 0 })
    .eq('id', collectionId);
}

// ==================== 单词管理 ====================

// 获取所有单词
export async function getAllWords(): Promise<Word[]> {
  const { data, error } = await supabase
    .from('words')
    .select(`
      *,
      collection:collections(*)
    `)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

// 根据章节ID获取单词
export async function getWordsByCollection(collectionId: string): Promise<Word[]> {
  const { data, error } = await supabase
    .from('words')
    .select('*')
    .eq('collection_id', collectionId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

// 根据多个章节ID获取单词
export async function getWordsByCollections(collectionIds: string[]): Promise<Word[]> {
  const { data, error } = await supabase
    .from('words')
    .select('*')
    .in('collection_id', collectionIds)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

// 搜索单词
export async function searchWords(keyword: string): Promise<Word[]> {
  const { data, error } = await supabase
    .from('words')
    .select(`
      *,
      collection:collections(*)
    `)
    .or(`word.ilike.%${keyword}%,translation.ilike.%${keyword}%`)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

// 检查单词是否存在
export async function checkWordExists(word: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('words')
    .select('id')
    .ilike('word', word)
    .maybeSingle();

  if (error) throw error;
  return !!data;
}

// 添加单词
export async function addWord(
  word: string, 
  phonetic: string | null, 
  translation: string,
  partOfSpeech: string | null = null,
  collectionId: string | null = null
): Promise<Word> {
  // 清理单词，移除序号和非字母字符
  const cleanedWord = cleanWord(word);
  
  const { data, error } = await supabase
    .from('words')
    .insert({ 
      word: cleanedWord, 
      phonetic, 
      translation,
      part_of_speech: partOfSpeech,
      collection_id: collectionId
    })
    .select()
    .single();

  if (error) throw error;

  // 更新章节单词数量
  if (collectionId) {
    await updateCollectionWordCount(collectionId);
  }

  return data;
}

// 批量添加单词（支持去重）
/**
 * 批量添加单词
 * @param words 要添加的单词数组
 * @param enableDedupe 是否启用去重（章节内去重，不同章节可以有相同单词）
 * @returns 添加的单词列表和重复单词数量
 * 
 * 去重规则：
 * - 启用去重时，只在同一章节内检查重复
 * - 不同章节可以有相同的单词
 * - 例如：章节1有单词"cat"，章节2也可以有单词"cat"
 */
export async function addWordsBatch(
  words: Array<{ 
    word: string; 
    phonetic: string | null; 
    translation: string;
    part_of_speech?: string | null;
    collection_id?: string | null;
    chapter_id?: string | null; // 添加章节ID
  }>,
  enableDedupe: boolean = false
): Promise<{ added: Word[]; duplicates: number }> {
  // 清理所有单词
  const cleanedWords = words.map(w => ({
    ...w,
    word: cleanWord(w.word)
  }));

  let wordsToAdd = cleanedWords;
  let duplicateCount = 0;

  // 如果启用去重，检查同一章节内是否已存在相同单词
  if (enableDedupe) {
    // 按 (collection_id, chapter_id) 组合分组
    const wordsByGroup = new Map<string, typeof cleanedWords>();
    for (const word of cleanedWords) {
      const collectionId = word.collection_id || 'null';
      const chapterId = word.chapter_id || 'null';
      const groupKey = `${collectionId}:${chapterId}`;
      
      if (!wordsByGroup.has(groupKey)) {
        wordsByGroup.set(groupKey, []);
      }
      wordsByGroup.get(groupKey)!.push(word);
    }

    // 对每个组分别检查重复
    const filteredWords: typeof cleanedWords = [];
    for (const [groupKey, groupWords] of wordsByGroup) {
      const [collectionId, chapterId] = groupKey.split(':');
      
      // 构建查询条件
      let query = supabase
        .from('words')
        .select('word')
        .in('word', groupWords.map(w => w.word));
      
      // 添加collection_id条件
      if (collectionId !== 'null') {
        query = query.eq('collection_id', collectionId);
      } else {
        query = query.is('collection_id', null);
      }
      
      // 添加chapter_id条件
      if (chapterId !== 'null') {
        query = query.eq('chapter_id', chapterId);
      } else {
        query = query.is('chapter_id', null);
      }
      
      const existingWords = await query;

      if (existingWords.data) {
        const existingSet = new Set(existingWords.data.map(w => w.word));
        const nonDuplicates = groupWords.filter(w => !existingSet.has(w.word));
        filteredWords.push(...nonDuplicates);
        duplicateCount += groupWords.length - nonDuplicates.length;
      } else {
        filteredWords.push(...groupWords);
      }
    }

    wordsToAdd = filteredWords;
  }

  if (wordsToAdd.length === 0) {
    return { added: [], duplicates: duplicateCount };
  }

  const { data, error } = await supabase
    .from('words')
    .insert(wordsToAdd)
    .select();

  if (error) throw error;

  // 更新章节单词数量
  const collectionIds = new Set(wordsToAdd.map(w => w.collection_id).filter(Boolean));
  for (const collectionId of collectionIds) {
    await updateCollectionWordCount(collectionId as string);
  }

  return { 
    added: Array.isArray(data) ? data : [], 
    duplicates: duplicateCount 
  };
}

// 删除单词
export async function deleteWord(id: string): Promise<void> {
  // 先获取单词的章节ID
  const { data: word } = await supabase
    .from('words')
    .select('collection_id')
    .eq('id', id)
    .single();

  const { error } = await supabase
    .from('words')
    .delete()
    .eq('id', id);

  if (error) throw error;

  // 更新章节单词数量
  if (word?.collection_id) {
    await updateCollectionWordCount(word.collection_id);
  }
}

// 更新单词
export async function updateWord(
  id: string,
  updates: {
    word?: string;
    phonetic?: string | null;
    translation?: string;
    part_of_speech?: string | null;
  }
): Promise<void> {
  const { error } = await supabase
    .from('words')
    .update(updates)
    .eq('id', id);

  if (error) throw error;
}

// 获取单词总数
export async function getWordsCount(): Promise<number> {
  const { count, error } = await supabase
    .from('words')
    .select('*', { count: 'exact', head: true });

  if (error) throw error;
  return count || 0;
}

// ==================== 易错词管理 ====================

// 获取所有易错词
// 获取所有易错词（支持排序）
export async function getAllWrongWords(sortBy: 'weight' | 'error_count' = 'weight', order: 'asc' | 'desc' = 'desc'): Promise<WrongWord[]> {
  const { data, error } = await supabase
    .from('wrong_words')
    .select(`
      *,
      word:words(*)
    `)
    .order(sortBy, { ascending: order === 'asc' });

  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

// 搜索易错词（支持排序）
export async function searchWrongWords(keyword: string, sortBy: 'weight' | 'error_count' = 'weight', order: 'asc' | 'desc' = 'desc'): Promise<WrongWord[]> {
  const { data, error } = await supabase
    .from('wrong_words')
    .select(`
      *,
      word:words!inner(*)
    `)
    .ilike('word.word', `%${keyword}%`)
    .order(sortBy, { ascending: order === 'asc' });

  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

// 添加或更新易错词（答错时调用，权重+3）
export async function addOrUpdateWrongWord(wordId: string): Promise<void> {
  // 先查询是否存在
  const { data: existing } = await supabase
    .from('wrong_words')
    .select('*')
    .eq('word_id', wordId)
    .maybeSingle();

  if (existing) {
    // 更新错误次数和权重
    const { error } = await supabase
      .from('wrong_words')
      .update({
        error_count: existing.error_count + 1,
        weight: existing.weight + 3,
        last_error_at: new Date().toISOString(),
      })
      .eq('word_id', wordId);

    if (error) throw error;
  } else {
    // 新增易错词，初始权重为3
    const { error } = await supabase
      .from('wrong_words')
      .insert({ 
        word_id: wordId, 
        error_count: 1,
        weight: 3,
      });

    if (error) throw error;
  }
}

// 减少易错词权重（答对时调用，权重-1）
export async function decreaseWrongWordWeight(wordId: string): Promise<void> {
  const { data: existing } = await supabase
    .from('wrong_words')
    .select('*')
    .eq('word_id', wordId)
    .maybeSingle();

  if (!existing) return;

  const newWeight = existing.weight - 1;

  if (newWeight <= 0) {
    // 权重为0，移入历史表并删除
    await supabase
      .from('wrong_words_history')
      .insert({
        word_id: wordId,
        total_errors: existing.error_count,
      });

    await supabase
      .from('wrong_words')
      .delete()
      .eq('word_id', wordId);
  } else {
    // 减少权重
    const { error } = await supabase
      .from('wrong_words')
      .update({ weight: newWeight })
      .eq('word_id', wordId);

    if (error) throw error;
  }
}

// 删除易错词
export async function deleteWrongWord(id: string): Promise<void> {
  const { error } = await supabase
    .from('wrong_words')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// 获取易错词库中的最高权重值
export async function getMaxWrongWordWeight(): Promise<number> {
  const { data, error } = await supabase
    .from('wrong_words')
    .select('weight')
    .order('weight', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data?.weight || 1;
}

// 按权重筛选易错词
export async function getWrongWordsByMaxWeight(maxWeight: number, limit: number): Promise<Word[]> {
  const { data, error } = await supabase
    .from('wrong_words')
    .select(`
      word:words(*)
    `)
    .lte('weight', maxWeight)
    .order('weight', { ascending: false });

  if (error) throw error;
  
  // 提取单词并随机打乱
  const words = (data || [])
    .map((ww: any) => ww.word)
    .filter(Boolean) as Word[];
  
  // 随机打乱并限制数量
  return words.sort(() => Math.random() - 0.5).slice(0, limit);
}

// 获取易错词历史
export async function getWrongWordsHistory(): Promise<WrongWordHistory[]> {
  const { data, error } = await supabase
    .from('wrong_words_history')
    .select(`
      *,
      word:words(*)
    `)
    .order('removed_at', { ascending: false });

  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

// 获取设置值
export async function getSetting(key: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('settings')
    .select('value')
    .eq('key', key)
    .maybeSingle();

  if (error) throw error;
  return data?.value || null;
}

// 更新设置值
export async function updateSetting(key: string, value: string): Promise<void> {
  // 先查询是否存在
  const { data: existing } = await supabase
    .from('settings')
    .select('id')
    .eq('key', key)
    .maybeSingle();

  if (existing) {
    // 存在则更新
    const { error } = await supabase
      .from('settings')
      .update({ value, updated_at: new Date().toISOString() })
      .eq('key', key);
    
    if (error) throw error;
  } else {
    // 不存在则插入
    const { error } = await supabase
      .from('settings')
      .insert({ key, value, updated_at: new Date().toISOString() });
    
    if (error) throw error;
  }
}

// 根据权重获取易错词（用于插入学习模式）
export async function getWrongWordsByWeight(limit: number): Promise<Word[]> {
  const { data, error } = await supabase
    .from('wrong_words')
    .select(`
      word:words(*)
    `)
    .order('weight', { ascending: false })
    .limit(limit);

  if (error) throw error;
  
  if (!Array.isArray(data)) return [];
  
  return data
    .map((item: any) => item.word as Word)
    .filter((word: Word | null | undefined): word is Word => word !== null && word !== undefined);
}

// ==================== 学习记录管理 ====================

// 添加学习记录
export async function addStudyRecord(record: {
  study_duration: number;
  words_studied: number;
  correct_count: number;
  total_count: number;
  mode: 'english_chinese' | 'chinese_english' | 'mixed' | 'wrong_words';
}): Promise<StudyRecord> {
  const accuracy = record.total_count > 0 
    ? Number(((record.correct_count / record.total_count) * 100).toFixed(2))
    : 0;

  const { data, error } = await supabase
    .from('study_records')
    .insert({
      ...record,
      accuracy,
      study_date: new Date().toISOString().split('T')[0],
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

// 获取按日统计数据
export async function getDailyStatistics(days: number = 30): Promise<StudyRecord[]> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const { data, error } = await supabase
    .from('study_records')
    .select('*')
    .gte('study_date', startDate.toISOString().split('T')[0])
    .order('study_date', { ascending: true });

  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

// 获取按月统计数据
export async function getMonthlyStatistics(months: number = 12): Promise<StudyRecord[]> {
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - months);

  const { data, error } = await supabase
    .from('study_records')
    .select('*')
    .gte('study_date', startDate.toISOString().split('T')[0])
    .order('study_date', { ascending: true });

  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

// 获取所有设置
export async function getAllSettings(): Promise<Setting[]> {
  const { data, error } = await supabase
    .from('settings')
    .select('*');

  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

// ==================== 数据库清理 ====================

// 清空易错词库
export async function clearWrongWords(): Promise<void> {
  const { error } = await supabase
    .from('wrong_words')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000'); // 删除所有记录

  if (error) throw error;
}

// 清空单词库
export async function clearWords(): Promise<void> {
  const { error } = await supabase
    .from('words')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000'); // 删除所有记录

  if (error) throw error;
}

// 清空章节
export async function clearCollections(): Promise<void> {
  const { error } = await supabase
    .from('collections')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000'); // 删除所有记录

  if (error) throw error;
}

// 批量删除易错词
export async function deleteWrongWordsBatch(wordIds: string[]): Promise<void> {
  const { error } = await supabase
    .from('wrong_words')
    .delete()
    .in('word_id', wordIds);

  if (error) throw error;
}
