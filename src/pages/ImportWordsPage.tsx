import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { addWordsBatch, getAllCollections, createCollection, updateCollectionName, deleteCollection, getWordsByCollection } from '@/db/api';
import { supabase } from '@/db/supabase';
import type { Collection, Word } from '@/types';
import { ArrowLeft, Upload, Loader2, Check, Plus, Pencil, Trash2, Eye } from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';

// 词性缩写列表（需要过滤的）
const POS_ABBREVIATIONS = new Set([
  'n', 'v', 'adj', 'adv', 'prep', 'conj', 'pron', 'interj', 'art', 'num',
  'vt', 'vi', 'aux', 'det', 'abbr', 'pl', 'sing', 'phr', 'int',
  // 带点的版本
  'n.', 'v.', 'adj.', 'adv.', 'prep.', 'conj.', 'pron.', 'interj.', 'art.', 'num.',
  'vt.', 'vi.', 'aux.', 'det.', 'abbr.', 'pl.', 'sing.', 'phr.', 'int.',
  // 中文词性标注
  '词组', '短语', '缩写',
]);

// 检查是否是词性缩写
function isPartOfSpeech(word: string): boolean {
  const lower = word.toLowerCase().trim();
  
  // 检查单个词性缩写
  if (POS_ABBREVIATIONS.has(lower)) return true;
  
  // 检查词性缩写组合（如 "v. aux.", "adv. prep.", "n. adj."）
  // 按空格分割，如果所有部分都是词性缩写，则整体也是词性缩写
  const parts = lower.split(/\s+/);
  if (parts.length > 1 && parts.every(part => POS_ABBREVIATIONS.has(part))) {
    return true;
  }
  
  return false;
}

interface ParsedWord {
  word: string;
  phonetic: string | null;
  translation: string;
  part_of_speech: string | null;
  status: 'pending' | 'processing' | 'ready';
  hasError?: boolean;
  errorMessage?: string;
  chapterName?: string; // 所属章节名
  hasOriginalTranslation?: boolean; // 是否有原始翻译
  hasOriginalPhonetic?: boolean; // 是否有原始音标
  hasOriginalPos?: boolean; // 是否有原始词性
  needsReview?: boolean; // 需要用户审查
  reviewReason?: string; // 需要审查的原因
}

interface ChapterGroup {
  name: string;
  words: ParsedWord[];
}

// 验证单词/词组是否有效
function validateWord(word: string): { valid: boolean; message?: string } {
  if (!word || !word.trim()) {
    return { valid: false, message: '单词不能为空' };
  }
  
  // 支持单词和词组（可以包含空格、连字符、撇号）
  if (!/^[a-zA-Z]+(?:[-'\s][a-zA-Z]+)*$/.test(word)) {
    return { valid: false, message: '单词只能包含英文字母、空格、连字符和撇号' };
  }
  
  if (word.length > 100) {
    return { valid: false, message: '单词/词组过长' };
  }
  
  const repeatedPattern = /(.)\1{4,}/;
  if (repeatedPattern.test(word)) {
    return { valid: false, message: '单词包含过多重复字母' };
  }
  
  return { valid: true };
}

// 检查单词是否需要用户审查
function checkWordNeedsReview(word: string, translation: string, phonetic: string | null): { needsReview: boolean; reason?: string } {
  // 1. 检查是否没有翻译
  if (!translation || translation === '(未找到释义)') {
    return { needsReview: true, reason: '缺少翻译' };
  }
  
  // 2. 检查是否包含特殊符号（排除合法的词组格式）
  // 合法格式：keep sb./sth. away, on one's own, at that time, don't, it's
  // 可疑格式：v./adj., n./v., adj./adv.
  
  // 检查是否是词性组合（如 v./adj., n./v.）
  if (/^[a-z]+\.\/[a-z]+\.?$/i.test(word)) {
    return { needsReview: true, reason: '疑似词性组合' };
  }
  
  // 检查是否包含不常见的特殊符号组合
  // 允许：撇号(')、连字符(-)、点号(.)在单词中间、空格
  // 不允许：问号(?)、反斜杠(\)、顿号(、)、中文符号等
  if (/[?\\、，。；：""''（）【】]/.test(word)) {
    return { needsReview: true, reason: '包含特殊符号' };
  }
  
  // 3. 检查是否是无意义的字符串（连续的辅音或元音过多）
  const consonantPattern = /[bcdfghjklmnpqrstvwxyz]{6,}/i;
  const vowelPattern = /[aeiou]{4,}/i;
  if (consonantPattern.test(word) || vowelPattern.test(word)) {
    return { needsReview: true, reason: '可能是拼写错误' };
  }
  
  // 4. 检查是否包含数字
  if (/\d/.test(word)) {
    return { needsReview: true, reason: '包含数字' };
  }
  
  // 5. 检查是否是词性缩写（不应该被导入）
  if (isPartOfSpeech(word)) {
    return { needsReview: true, reason: '疑似词性缩写' };
  }
  
  // 6. 检查单词长度是否异常（过短或过长）
  const wordWithoutSpaces = word.replace(/\s+/g, '');
  if (wordWithoutSpaces.length < 2) {
    return { needsReview: true, reason: '单词过短' };
  }
  if (wordWithoutSpaces.length > 30) {
    return { needsReview: true, reason: '单词过长' };
  }
  
  return { needsReview: false };
}

// 检查是否是词组（包含空格）
function isPhraseWord(word: string): boolean {
  return word.includes(' ');
}

// 识别是否为标题行
function isTitleLine(line: string): boolean {
  const trimmed = line.trim();
  
  // 空行不是标题
  if (!trimmed) return false;
  
  // ✅ 标题特征1：包含Unit、Lesson、Chapter等关键词（最可靠）
  const titleKeywords = /^(Unit|Lesson|Chapter|Section|Part|Module|第.{1,3}[课单元章节])/i;
  if (titleKeywords.test(trimmed)) {
    console.log('✅ 检测到标题（关键词）:', trimmed);
    return true;
  }
  
  // ✅ 标题特征2：纯数字标题（如 "1", "2", "3"）
  if (/^\d+$/.test(trimmed) && trimmed.length <= 3) {
    console.log('✅ 检测到标题（纯数字）:', trimmed);
    return true;
  }
  
  // ❌ 移除过于宽松的标题识别逻辑，避免误判
  
  return false;
}

// 从文本中提取标题和内容分组
function extractChaptersByTitle(text: string): { name: string; content: string }[] {
  console.log('📚 开始提取章节，文本长度:', text.length);
  console.log('📚 文本前500字符:', text.substring(0, 500));
  
  const lines = text.split('\n');
  const chapters: { name: string; content: string }[] = [];
  let currentChapter: { name: string; content: string } | null = null;
  let contentLines: string[] = [];
  
  console.log('📚 总行数:', lines.length);
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    
    if (isTitleLine(trimmed)) {
      // 遇到标题，保存之前的章节
      if (currentChapter && contentLines.length > 0) {
        currentChapter.content = contentLines.join('\n');
        chapters.push(currentChapter);
        console.log(`📚 保存章节: ${currentChapter.name}, 内容行数: ${contentLines.length}`);
        contentLines = [];
      }
      
      // 创建新章节
      currentChapter = {
        name: trimmed,
        content: ''
      };
      console.log('📚 创建新章节:', trimmed);
    } else {
      // 内容行
      contentLines.push(line);
    }
  }
  
  // 保存最后一个章节
  if (currentChapter && contentLines.length > 0) {
    currentChapter.content = contentLines.join('\n');
    chapters.push(currentChapter);
    console.log(`📚 保存最后章节: ${currentChapter.name}, 内容行数: ${contentLines.length}`);
  }
  
  console.log(`📚 提取完成，共 ${chapters.length} 个章节`);
  
  return chapters;
}

// 按页分章节（用于PDF/图片）
function splitByPages(words: ParsedWord[], fileName: string): ChapterGroup[] {
  // 如果单词已经有chapterName，按chapterName分组
  const chapterMap = new Map<string, ParsedWord[]>();
  
  for (const word of words) {
    const chapterName = word.chapterName || `${fileName}`;
    if (!chapterMap.has(chapterName)) {
      chapterMap.set(chapterName, []);
    }
    chapterMap.get(chapterName)!.push(word);
  }
  
  return Array.from(chapterMap.entries()).map(([name, words]) => ({
    name,
    words
  }));
}

// 智能识别表格列类型
interface ColumnInfo {
  index: number;
  type: 'word' | 'phonetic' | 'translation' | 'pos' | 'unknown';
  confidence: number; // 置信度 0-1
}

function detectTableColumns(rows: any[][]): ColumnInfo[] {
  if (!rows || rows.length === 0) return [];
  
  // 跳过空行和标题行，找到第一行有效数据
  let sampleRows: any[][] = [];
  for (const row of rows) {
    if (!row || row.length === 0) continue;
    const firstCell = row[0] ? String(row[0]).trim() : '';
    // 跳过标题行
    if (/^(单词|音标|翻译|中文|英文|word|phonetic|translation|meaning)/i.test(firstCell)) continue;
    sampleRows.push(row);
    if (sampleRows.length >= 10) break; // 取前10行作为样本
  }
  
  if (sampleRows.length === 0) return [];
  
  const maxCols = Math.max(...sampleRows.map(r => r.length));
  const columnInfos: ColumnInfo[] = [];
  
  // 分析每一列
  for (let colIndex = 0; colIndex < maxCols; colIndex++) {
    const cells = sampleRows
      .map(row => row[colIndex] ? String(row[colIndex]).trim() : '')
      .filter(cell => cell.length > 0);
    
    if (cells.length === 0) {
      columnInfos.push({ index: colIndex, type: 'unknown', confidence: 0 });
      continue;
    }
    
    // 统计特征
    let wordCount = 0;      // 纯英文单词
    let phoneticCount = 0;  // 音标
    let chineseCount = 0;   // 包含中文
    let posCount = 0;       // 词性
    
    for (const cell of cells) {
      // 检查是否是音标
      if (/^[\[\]\/]/.test(cell) || /[əɪʊɛɔæʌɑːˈˌ]/.test(cell)) {
        phoneticCount++;
        continue;
      }
      
      // 检查是否包含中文
      if (/[\u4e00-\u9fa5]/.test(cell)) {
        chineseCount++;
        continue;
      }
      
      // 检查是否是词性
      if (isPartOfSpeech(cell)) {
        posCount++;
        continue;
      }
      
      // 检查是否是纯英文单词
      if (/^[a-zA-Z]+[-'\s.()…/,a-zA-Z]*$/.test(cell) && !isPartOfSpeech(cell)) {
        wordCount++;
      }
    }
    
    // 计算置信度和类型
    const total = cells.length;
    const wordRatio = wordCount / total;
    const phoneticRatio = phoneticCount / total;
    const chineseRatio = chineseCount / total;
    const posRatio = posCount / total;
    
    let type: ColumnInfo['type'] = 'unknown';
    let confidence = 0;
    
    // 判断列类型（按优先级）
    if (phoneticRatio > 0.6) {
      type = 'phonetic';
      confidence = phoneticRatio;
    } else if (chineseRatio > 0.6) {
      type = 'translation';
      confidence = chineseRatio;
    } else if (wordRatio > 0.6) {
      type = 'word';
      confidence = wordRatio;
    } else if (posRatio > 0.5) {
      type = 'pos';
      confidence = posRatio;
    }
    
    columnInfos.push({ index: colIndex, type, confidence });
  }
  
  console.log('📊 列类型识别结果:', columnInfos.map(c => `列${c.index}: ${c.type} (${(c.confidence * 100).toFixed(0)}%)`).join(', '));
  
  return columnInfos;
}

// 根据列信息提取单词数据
function extractWordFromRow(row: any[], columnInfos: ColumnInfo[]): {
  word: string;
  phonetic: string | null;
  translation: string;
  partOfSpeech: string | null;
} | null {
  const wordCol = columnInfos.find(c => c.type === 'word');
  const phoneticCol = columnInfos.find(c => c.type === 'phonetic');
  const translationCol = columnInfos.find(c => c.type === 'translation');
  const posCol = columnInfos.find(c => c.type === 'pos');
  
  if (!wordCol) return null;
  
  const wordCell = row[wordCol.index] ? String(row[wordCol.index]).trim() : '';
  if (!wordCell) return null;
  
  // 验证是否是有效的英文单词
  if (!/^[a-zA-Z]+[-'\s.()…/,a-zA-Z]*$/.test(wordCell)) return null;
  if (isPartOfSpeech(wordCell)) return null;
  
  const word = wordCell.toLowerCase();
  const phonetic = phoneticCol && row[phoneticCol.index] ? String(row[phoneticCol.index]).trim() : null;
  const translation = translationCol && row[translationCol.index] ? String(row[translationCol.index]).trim() : '';
  const partOfSpeech = posCol && row[posCol.index] ? String(row[posCol.index]).trim() : null;
  
  return { word, phonetic, translation, partOfSpeech };
}

// 使用列检测解析Excel
function parseExcelWithColumnDetection(rows: any[][], columnInfos: ColumnInfo[]): { words: ParsedWord[], chapters: ChapterGroup[] } {
  const words: ParsedWord[] = [];
  const chapters: ChapterGroup[] = [];
  let currentChapter: ChapterGroup | null = null;
  
  for (const row of rows) {
    if (!row || row.length === 0) continue;
    
    const firstCell = row[0] ? String(row[0]).trim() : '';
    
    // 跳过标题行
    if (/^(单词|音标|翻译|中文|英文|word|phonetic|translation|meaning)/i.test(firstCell)) {
      console.log('⏭️ 跳过标题行:', firstCell);
      continue;
    }
    
    // 检查是否是章节标题行
    const hasOnlyFirstColumn = firstCell && row.slice(1).every(cell => !cell || String(cell).trim() === '');
    const isTitleKeyword = /^(Unit|Lesson|Chapter|第.*课|第.*单元|Part|九年级)/i.test(firstCell);
    const isShortLine = firstCell.length < 30 && !/^[a-z]/i.test(firstCell);
    
    if (hasOnlyFirstColumn && (isTitleKeyword || isShortLine)) {
      if (currentChapter && currentChapter.words.length > 0) {
        chapters.push(currentChapter);
      }
      currentChapter = {
        name: firstCell,
        words: []
      };
      console.log('📖 检测到章节:', firstCell);
      continue;
    }
    
    // 提取单词数据
    const extracted = extractWordFromRow(row, columnInfos);
    if (!extracted) continue;
    
    const { word, phonetic, translation, partOfSpeech } = extracted;
    
    console.log(`📝 提取单词: ${word}, 音标: ${phonetic || '无'}, 翻译: ${translation || '无'}`);
    
    const parsedWord = createParsedWord(word, translation, phonetic, partOfSpeech);
    
    // 检查是否需要审查
    const reviewCheck = checkWordNeedsReview(word, translation, phonetic);
    if (reviewCheck.needsReview) {
      parsedWord.needsReview = true;
      parsedWord.reviewReason = reviewCheck.reason;
    }
    
    if (currentChapter) {
      parsedWord.chapterName = currentChapter.name;
      currentChapter.words.push(parsedWord);
    } else {
      words.push(parsedWord);
    }
  }
  
  // 保存最后一个章节
  if (currentChapter && currentChapter.words.length > 0) {
    chapters.push(currentChapter);
  }
  
  // 返回单词和章节信息
  const totalWords = chapters.length > 0 
    ? chapters.reduce((sum, ch) => sum + ch.words.length, 0)
    : words.length;
  
  if (chapters.length > 0) {
    console.log(`✅ 智能识别完成: ${chapters.length}个章节, ${totalWords}个单词`);
  } else {
    console.log(`✅ 智能识别完成: ${totalWords}个单词`);
  }
  
  return { words, chapters };
}

// 创建ParsedWord对象的辅助函数
function createParsedWord(
  word: string,
  translation: string = '',
  phonetic: string | null = null,
  partOfSpeech: string | null = null,
  chapterName?: string
): ParsedWord {
  return {
    word: word.toLowerCase(),
    phonetic,
    translation,
    part_of_speech: partOfSpeech,
    status: 'pending',
    chapterName,
    // 标记哪些字段是用户原有的
    hasOriginalTranslation: !!translation,
    hasOriginalPhonetic: !!phonetic,
    hasOriginalPos: !!partOfSpeech,
  };
}

export default function ImportWordsPage() {
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [parsedWords, setParsedWords] = useState<ParsedWord[]>([]);
  const [originalWords, setOriginalWords] = useState<ParsedWord[]>([]); // 保存原始导入顺序
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [selectedCollection, setSelectedCollection] = useState<string>('');
  const [newCollectionName, setNewCollectionName] = useState('');
  const [showNewCollection, setShowNewCollection] = useState(false);
  const [enableDedupe, setEnableDedupe] = useState(true);
  const [enableAutoMatch, setEnableAutoMatch] = useState(true); // 自动匹配音标与翻译
  const [showAutoMatchDialog, setShowAutoMatchDialog] = useState(false); // 显示自动匹配确认对话框
  const [pendingFile, setPendingFile] = useState<File | File[] | null>(null); // 待处理的文件
  
  // 排序相关状态
  const [sortOrder, setSortOrder] = useState<'import' | 'alpha'>('import'); // 排序方式：导入顺序或字母顺序
  
  // 分章节相关状态
  const [chapterMode, setChapterMode] = useState<'none' | 'title' | 'page'>('none'); // 分章节模式
  const [detectedChapters, setDetectedChapters] = useState<ChapterGroup[]>([]); // 检测到的章节
  const [showChapterOptions, setShowChapterOptions] = useState(false); // 是否显示分章节选项
  
  // 进度状态
  const [processingProgress, setProcessingProgress] = useState({ current: 0, total: 0 });
  const [processingMessage, setProcessingMessage] = useState('');
  
  // 章节管理状态
  const [editingCollection, setEditingCollection] = useState<Collection | null>(null);
  const [editCollectionName, setEditCollectionName] = useState('');
  const [previewCollection, setPreviewCollection] = useState<Collection | null>(null);
  const [previewWords, setPreviewWords] = useState<Word[]>([]);
  const [deleteConfirmCollection, setDeleteConfirmCollection] = useState<Collection | null>(null);

  useEffect(() => {
    loadCollections();
  }, []);

  const loadCollections = async () => {
    try {
      const data = await getAllCollections();
      setCollections(data);
      if (data.length > 0) {
        setSelectedCollection(data[0].id);
      }
    } catch (error) {
      console.error('加载章节失败:', error);
    }
  };

  const handleCreateCollection = async () => {
    if (!newCollectionName.trim()) {
      toast.error('请输入章节名称');
      return;
    }

    try {
      const collection = await createCollection(newCollectionName.trim());
      setCollections([collection, ...collections]);
      setSelectedCollection(collection.id);
      setNewCollectionName('');
      setShowNewCollection(false);
      toast.success('创建成功');
    } catch (error: any) {
      console.error('创建章节失败:', error);
      if (error.message?.includes('duplicate')) {
        toast.error('章节名称已存在');
      } else {
        toast.error('创建失败');
      }
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const supportedFormats = ['txt', 'csv', 'xlsx', 'xls', 'doc', 'docx', 'pdf', 'jpg', 'jpeg', 'png', 'bmp'];
    
    // 检查所有文件格式
    for (let i = 0; i < files.length; i++) {
      const ext = files[i].name.split('.').pop()?.toLowerCase();
      if (!supportedFormats.includes(ext || '')) {
        toast.error(`不支持的文件格式: ${files[i].name}`);
        return;
      }
    }

    // 保存待处理的文件，显示确认对话框
    const imageExts = ['jpg', 'jpeg', 'png', 'bmp'];
    const firstExt = files[0].name.split('.').pop()?.toLowerCase();
    
    if (files.length > 1 && imageExts.includes(firstExt || '')) {
      // 多图片上传
      setPendingFile(Array.from(files));
    } else {
      // 单文件上传
      setPendingFile(files[0]);
    }
    
    // 显示确认对话框
    setShowAutoMatchDialog(true);
  };
  
  // 确认自动匹配选择后，开始解析文件
  const handleConfirmAutoMatch = async (autoMatch: boolean) => {
    setShowAutoMatchDialog(false);
    setEnableAutoMatch(autoMatch);
    
    if (!pendingFile) return;
    
    // 根据文件类型处理，直接传递autoMatch参数
    if (Array.isArray(pendingFile)) {
      // 多图片上传
      await parseMultipleImages(pendingFile, autoMatch);
    } else {
      // 单文件上传
      setFile(pendingFile);
      await parseFile(pendingFile, autoMatch);
    }
    
    setPendingFile(null);
  };

  // 处理多图片上传
  const parseMultipleImages = async (files: File[], autoMatch?: boolean) => {
    // 如果没有传入autoMatch参数，使用状态值
    const shouldAutoMatch = autoMatch !== undefined ? autoMatch : enableAutoMatch;
    
    try {
      setParsing(true);
      setProcessingMessage('正在识别多张图片...');
      
      const allChapters: ChapterGroup[] = [];
      
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setProcessingMessage(`正在识别第 ${i + 1}/${files.length} 张图片...`);
        
        // ✅ 获取单词列表和原始文本
        const result = await parseOCRFile(file, 'image');
        const words = result.words;
        const chapterName = file.name.replace(/\.(jpg|jpeg|png|bmp)$/i, '');
        
        // 为每个单词添加章节名
        words.forEach(w => w.chapterName = chapterName);
        
        allChapters.push({
          name: chapterName,
          words
        });
      }
      
      // 合并所有单词
      const allWords = allChapters.flatMap(c => c.words);
      
      if (allWords.length === 0) {
        toast.error('未识别到有效单词内容');
        return;
      }
      
      setParsedWords(allWords);
      setOriginalWords([...allWords]); // 保存原始顺序
      setDetectedChapters(allChapters);
      setChapterMode('page'); // 默认按图片分章节
      
      // 自动补充缺失的音标和翻译，传递autoMatch参数
      await autoCompleteWords(allWords, shouldAutoMatch);
    } catch (error) {
      console.error('解析图片失败:', error);
      toast.error('解析图片失败');
    } finally {
      setParsing(false);
      setProcessingMessage('');
    }
  };

  const parseFile = async (file: File, autoMatch?: boolean) => {
    // 如果没有传入autoMatch参数，使用状态值
    const shouldAutoMatch = autoMatch !== undefined ? autoMatch : enableAutoMatch;
    
    try {
      setParsing(true);
      setProcessingMessage('正在解析文件...');
      
      const ext = file.name.split('.').pop()?.toLowerCase();
      let words: ParsedWord[] = [];
      let fileContent = '';

      // ✅ 标记是否为Excel文件（Excel文件在parseExcelFile内部已经完成章节检测）
      const isExcelFile = ext === 'xlsx' || ext === 'xls';
      
      if (ext === 'txt' || ext === 'csv') {
        fileContent = await file.text();
        words = parseTextContent(fileContent);
      } else if (isExcelFile) {
        words = await parseExcelFile(file);
        // ❌ 不为Excel文件生成fileContent，因为它已经在parseExcelFile内部完成章节检测
        // Excel文件的章节检测在parseExcelFile函数内部完成（第1226行）
      } else if (ext === 'doc' || ext === 'docx' || ext === 'pdf' || ext === 'jpg' || ext === 'jpeg' || ext === 'png' || ext === 'bmp') {
        // DOCX、PDF和图片格式，使用OCR识别
        setProcessingMessage('正在识别文档内容，请耐心等待...');
        // ✅ 获取单词列表和原始文本
        const result = await parseOCRFile(file, ext);
        words = result.words;
        fileContent = result.text; // 保存原始文本用于章节检测
      } else {
        toast.error('不支持的文件格式');
        return;
      }

      if (words.length === 0) {
        toast.error('未识别到有效单词内容');
        return;
      }

      // 如果关闭了自动匹配，将缺失翻译的单词排在前面
      if (!shouldAutoMatch) {
        const wordsWithIssues = words.filter(w => !w.translation || w.translation === '');
        const wordsWithoutIssues = words.filter(w => w.translation && w.translation !== '');
        words = [...wordsWithIssues, ...wordsWithoutIssues];
      }

      setParsedWords(words);
      setOriginalWords([...words]); // 保存原始顺序
      
      // ✅ 检测是否需要分章节（Excel文件已经在parseExcelFile内部完成章节检测，这里只处理TXT/CSV/OCR文件）
      if (!isExcelFile) {
        console.log('🔍🔍🔍 ===== 开始章节检测 =====');
        console.log('🔍 文件类型:', ext);
        console.log('🔍 单词数量:', words.length);
        console.log('🔍 fileContent是否存在:', !!fileContent);
        console.log('🔍 fileContent长度:', fileContent?.length || 0);
        
        if (fileContent) {
          console.log('🔍 文本内容前1000字符:', fileContent.substring(0, 1000));
          
          // 尝试按标题分章节
          const chapterTexts = extractChaptersByTitle(fileContent);
          console.log('🔍 extractChaptersByTitle返回章节数量:', chapterTexts.length);
          console.log('🔍 章节列表:', chapterTexts.map(ch => ch.name));
          
          if (chapterTexts.length > 1) {
            console.log('🔍 ✅ 检测到多个章节，开始转换为ChapterGroup');
            
            // 将文本章节转换为ChapterGroup
            const chapters: ChapterGroup[] = chapterTexts.map(ch => ({
              name: ch.name,
              words: parseTextContent(ch.content)
            }));
            
            console.log('🔍 章节详情:', chapters.map(ch => `${ch.name}: ${ch.words.length}个单词`));
            console.log('🔍 调用setDetectedChapters，章节数量:', chapters.length);
            console.log('🔍 调用setShowChapterOptions(true)');
            
            setDetectedChapters(chapters);
            setShowChapterOptions(true);
            toast.info(`检测到 ${chapters.length} 个章节，请选择分章节方式`);
          } else {
            console.log('🔍 ❌ 未检测到多个章节（chapterTexts.length =', chapterTexts.length, '），不显示分章节选项');
          }
        } else {
          console.log('🔍 ❌ fileContent为空，跳过章节检测');
        }
        
        console.log('🔍🔍🔍 ===== 章节检测结束 =====');
      } else {
        console.log('🔍 Excel文件已在parseExcelFile内部完成章节检测，跳过文本章节检测');
      }
      
      // 自动补充缺失的音标和翻译，传递autoMatch参数
      await autoCompleteWords(words, shouldAutoMatch);
    } catch (error) {
      console.error('解析文件失败:', error);
      toast.error('解析文件失败');
    } finally {
      setParsing(false);
      setProcessingMessage('');
    }
  };

  const parseTextContent = (text: string): ParsedWord[] => {
    const lines = text.split('\n').filter(line => line.trim());
    const words: ParsedWord[] = [];
    const wordSet = new Set<string>();

    console.log('📝 开始解析文本，行数:', lines.length);
    console.log('📝 前5行预览:', lines.slice(0, 5));

    // 检测是否包含中文（表示可能有翻译）
    const hasChinese = /[\u4e00-\u9fa5]/.test(text);

    if (hasChinese) {
      console.log('✅ 检测到中文，尝试提取单词-翻译对');
      
      // 尝试检测表格格式（每行包含：单词 + 中文）
      // 降低检测门槛：只要有英文单词和中文就认为可能是表格格式
      const tableFormatLines = lines.filter(line => {
        const trimmed = line.trim();
        // 移除序号
        const lineWithoutNumber = trimmed.replace(/^\d+[.、)\s]*/, '');
        // 检查是否包含：英文单词 + 中文
        const hasEnglish = /^[a-zA-Z]+[-'\s.()…/,a-zA-Z.…]*/.test(lineWithoutNumber);
        const hasChinese = /[\u4e00-\u9fa5]/.test(lineWithoutNumber);
        return hasEnglish && hasChinese;
      });
      
      console.log(`📊 表格格式检测: ${tableFormatLines.length}/${lines.length} 行符合 (${Math.round(tableFormatLines.length / lines.length * 100)}%)`);
      
      // 如果超过30%的行符合表格格式，使用表格解析（降低阈值）
      if (tableFormatLines.length > lines.length * 0.3) {
        console.log('📊 检测到表格格式，使用表格解析');
        
        for (const line of lines) {
          const trimmedLine = line.trim();
          if (!trimmedLine) continue;
          
          // 移除行首的序号
          const lineWithoutNumber = trimmedLine.replace(/^\d+[.、)\s]*/, '');
          
          // 提取单词
          const wordMatch = lineWithoutNumber.match(/^([a-zA-Z]+[-'\s.()…/,a-zA-Z.…]*)/);
          if (!wordMatch) continue;
          
          let word = wordMatch[1].trim().toLowerCase();
          word = word.replace(/\s+/g, ' ');
          
          // 过滤词性缩写
          if (isPartOfSpeech(word)) {
            console.log(`⏭️ 跳过词性缩写: ${word}`);
            continue;
          }
          
          if (wordSet.has(word)) {
            console.log(`⏭️ 跳过重复单词: ${word}`);
            continue;
          }
          wordSet.add(word);
          
          // 提取音标
          const phoneticMatch = lineWithoutNumber.match(/[\[\(][^\]\)]*[\]\)]|\/[^\/]+\//);
          const phonetic = phoneticMatch ? phoneticMatch[0] : null;
          
          // 提取翻译（第一个中文字符开始，到音标或词性之前）
          let translation = '';
          const chineseMatch = lineWithoutNumber.match(/[\u4e00-\u9fa5]/);
          
          if (chineseMatch && chineseMatch.index !== undefined) {
            const chineseStart = chineseMatch.index;
            let restText = lineWithoutNumber.substring(chineseStart);
            
            // 移除音标部分
            if (phoneticMatch && phoneticMatch.index !== undefined) {
              const phoneticStart = phoneticMatch.index - chineseStart;
              if (phoneticStart > 0) {
                restText = restText.substring(0, phoneticStart);
              }
            }
            
            // 移除词性部分（查找词性缩写）
            const posMatch = restText.match(/\s+(n\.|v\.|adj\.|adv\.|prep\.|conj\.|pron\.|interj\.|art\.|num\.|vt\.|vi\.|aux\.|det\.|abbr\.|pl\.|sing\.|phr\.|int\.|词组|短语|缩写)/);
            if (posMatch && posMatch.index !== undefined) {
              restText = restText.substring(0, posMatch.index);
            }
            
            translation = restText.trim();
            // 清理标点符号
            translation = translation.replace(/[。；：\s]+$/g, '').trim();
          }
          
          // 提取词性
          const posMatch = lineWithoutNumber.match(/\s+(n\.|v\.|adj\.|adv\.|prep\.|conj\.|pron\.|interj\.|art\.|num\.|vt\.|vi\.|aux\.|det\.|abbr\.|pl\.|sing\.|phr\.|int\.|词组|短语|缩写)/);
          const partOfSpeech = posMatch ? posMatch[1] : null;
          
          console.log(`✅ 解析单词: ${word}, 翻译: ${translation || '(无)'}, 音标: ${phonetic || '(无)'}, 词性: ${partOfSpeech || '(无)'}`);
          
          const parsedWord = createParsedWord(word, translation, phonetic, partOfSpeech);
          
          // 检查是否需要审查（使用实际提取的翻译）
          const finalReviewCheck = checkWordNeedsReview(word, translation, phonetic);
          if (finalReviewCheck.needsReview) {
            parsedWord.needsReview = true;
            parsedWord.reviewReason = finalReviewCheck.reason;
            console.log(`⚠️ 需要审查: ${word} - ${finalReviewCheck.reason}`);
          }
          
          words.push(parsedWord);
        }
        
        if (words.length > 0) {
          console.log('✅ 表格格式解析成功，共', words.length, '个单词');
          return words;
        }
      }
      
      // 如果只有少数几行，可能是OCR返回的连续文本
      if (lines.length <= 3) {
        // 合并所有行
        const fullText = lines.join(' ');
        
        // 使用正则提取"英文单词 + 中文"的模式
        // 匹配：英文单词（可能包含连字符、点号、括号、省略号、斜线、逗号）后跟空格和中文
        const wordPairs = fullText.match(/\b[a-zA-Z]+[-'.()…/,a-zA-Z.…]*\s+[\u4e00-\u9fa5]+/g);
        
        if (wordPairs && wordPairs.length > 0) {
          console.log('🔍 识别到单词-翻译对:', wordPairs.length, '个');
          
          for (const pair of wordPairs) {
            const parts = pair.trim().split(/\s+/);
            const word = parts[0].toLowerCase();
            const translation = parts.slice(1).join(' ');
            
            if (word && /^[a-zA-Z]+[-'.()…/,a-zA-Z.…]*$/.test(word) && !wordSet.has(word)) {
              wordSet.add(word);
              
              const parsedWord = createParsedWord(word, translation || '');
              
              // 检查是否需要审查
              const reviewCheck = checkWordNeedsReview(word, translation, null);
              if (reviewCheck.needsReview) {
                parsedWord.needsReview = true;
                parsedWord.reviewReason = reviewCheck.reason;
              }
              
              words.push(parsedWord);
            }
          }
          
          // 如果找到了单词，直接返回
          if (words.length > 0) {
            console.log('✅ 成功解析', words.length, '个单词');
            return words;
          }
        }
      }
      
      // 逐行解析模式
      console.log('📋 尝试逐行解析...');
      
      for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine) continue;

        // 移除行首的序号（如 "1. ", "1、", "1) ", "1 ", "1abc"等）
        // 匹配：数字 + 可选的标点/空格
        const lineWithoutNumber = trimmedLine.replace(/^\d+[.、)\s]*/, '');

        // 跳过纯标题行（如"必背688个高频词第一组"）
        if (!lineWithoutNumber.match(/^[a-zA-Z]/)) {
          continue;
        }
        
        // 提取单词或词组（支持空格、连字符、撇号、点号、括号、省略号、斜线、逗号）
        // 匹配：字母开头，后面可以包含字母和特殊字符的任意组合
        // 例如：be angry with sb.、compare … to …、keep sb./sth. away、keep(kept,kept)等
        const wordMatch = lineWithoutNumber.match(/^([a-zA-Z]+[-'\s.()…/,a-zA-Z.…]*)/);
        if (wordMatch) {
          let word = wordMatch[1].trim().toLowerCase();
          
          // 清理多余空格
          word = word.replace(/\s+/g, ' ');
          
          // 过滤词性缩写
          if (isPartOfSpeech(word)) {
            continue;
          }
          
          if (!wordSet.has(word)) {
            wordSet.add(word);
            
            // 提取音标（如果有）
            const phoneticPart = lineWithoutNumber.match(/\/[^\/]+\/|\[[^\]]+\]/);
            const phonetic = phoneticPart ? phoneticPart[0] : null;
            
            // 提取翻译（第一个中文字符开始）
            const chineseMatch = lineWithoutNumber.match(/[\u4e00-\u9fa5]/);
            let translation = '';
            
            if (chineseMatch && chineseMatch.index !== undefined) {
              const chineseStart = chineseMatch.index;
              const restText = lineWithoutNumber.substring(chineseStart);
              
              // 提取中文翻译，去除括号内的记忆技巧
              const translationMatch = restText.match(/^([^(（]+)/);
              if (translationMatch) {
                translation = translationMatch[1].trim();
                // 移除标点符号，但保留逗号和顿号分隔的多个释义
                translation = translation.replace(/[。；：\s]+/g, ' ').trim();
              } else {
                // 如果没有括号，直接取所有中文
                translation = restText.trim();
              }
            }
            
            const parsedWord = createParsedWord(word, translation, phonetic);
            
            // 检查是否需要审查
            const reviewCheck = checkWordNeedsReview(word, translation, phonetic);
            if (reviewCheck.needsReview) {
              parsedWord.needsReview = true;
              parsedWord.reviewReason = reviewCheck.reason;
            }
            
            words.push(parsedWord);
          }
        }
      }
    } else {
      // 没有中文，提取所有英文单词（文章模式）
      console.log('📖 未检测到中文，使用文章模式提取单词');
      
      const wordMatches = text.match(/\b[a-zA-Z]+(?:'[a-zA-Z]+)?\b/g);
      
      if (wordMatches) {
        for (const match of wordMatches) {
          const cleanedWord = match.toLowerCase();
          
          // 过滤掉无效的缩写和词性
          if (/^'|'$/.test(cleanedWord) || /^(ll|re|ve|s|d|m|t)$/.test(cleanedWord) || isPartOfSpeech(cleanedWord)) {
            continue;
          }
          
          if (!wordSet.has(cleanedWord)) {
            wordSet.add(cleanedWord);
            
            const parsedWord = createParsedWord(cleanedWord);
            
            // 检查是否需要审查
            const reviewCheck = checkWordNeedsReview(cleanedWord, '', null);
            if (reviewCheck.needsReview) {
              parsedWord.needsReview = true;
              parsedWord.reviewReason = reviewCheck.reason;
            }
            
            words.push(parsedWord);
          }
        }
      }
    }

    console.log('✅ 解析完成，共', words.length, '个单词');
    return words;
  };

  const parseExcelFile = async (file: File): Promise<ParsedWord[]> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<any[]>(firstSheet, { header: 1 });

        // 智能识别表格列
        const columnInfos = detectTableColumns(rows);
        const hasWordColumn = columnInfos.some(c => c.type === 'word' && c.confidence > 0.6);
        const hasTranslationColumn = columnInfos.some(c => c.type === 'translation' && c.confidence > 0.6);
        
        console.log('📊 表格列识别结果:');
        console.log('  - 单词列:', hasWordColumn ? '✅ 已识别' : '❌ 未识别');
        console.log('  - 翻译列:', hasTranslationColumn ? '✅ 已识别' : '❌ 未识别');
        
        // 如果识别到了清晰的列结构，使用智能识别模式
        if (hasWordColumn) {
          console.log('🎯 使用智能列识别模式');
          const result = parseExcelWithColumnDetection(rows, columnInfos);
          
          // 如果检测到多个章节，设置状态并显示章节选项
          if (result.chapters.length > 1) {
            console.log('📊 智能识别检测到多个章节，准备显示章节选项');
            console.log('📊 章节列表:', result.chapters.map(ch => `${ch.name}: ${ch.words.length}个单词`));
            console.log('📊 调用setDetectedChapters，章节数量:', result.chapters.length);
            console.log('📊 调用setShowChapterOptions(true)');
            
            setDetectedChapters(result.chapters);
            setShowChapterOptions(true);
            
            // 使用setTimeout确保toast在状态更新后显示
            setTimeout(() => {
              toast.info(`检测到 ${result.chapters.length} 个章节，请选择分章节方式`);
            }, 100);
            
            // 返回所有章节的单词
            return resolve(result.chapters.flatMap(ch => ch.words));
          } else if (result.chapters.length === 1) {
            console.log('📊 智能识别只检测到1个章节，不显示章节选项');
            return resolve(result.chapters.flatMap(ch => ch.words));
          } else {
            console.log('📊 智能识别未检测到章节');
            return resolve(result.words);
          }
        }
        
        // 否则使用原有的检测逻辑
        const isStandardFormat = detectStandardFormat(rows);
        console.log('📊 表格格式检测:', isStandardFormat ? '规范格式（固定列）' : '自由格式');

        const words: ParsedWord[] = [];
        const chapters: ChapterGroup[] = [];
        let currentChapter: ChapterGroup | null = null;
        
        if (isStandardFormat) {
          // 规范格式：按固定列读取
          for (const row of rows) {
            if (!row || row.length === 0) continue;
            
            const firstCell = row[0] ? String(row[0]).trim() : '';
            
            // 检查是否是标题行
            const hasOnlyFirstColumn = firstCell && !row[1] && !row[2] && !row[3];
            const isTitleKeyword = /^(Unit|Lesson|Chapter|第.*课|第.*单元|Part|九年级)/i.test(firstCell);
            const isShortLine = firstCell.length < 30 && !/^[a-z]/i.test(firstCell);
            
            if (hasOnlyFirstColumn && (isTitleKeyword || isShortLine)) {
              if (currentChapter && currentChapter.words.length > 0) {
                chapters.push(currentChapter);
              }
              currentChapter = {
                name: firstCell,
                words: []
              };
              continue;
            }
            
            // 规范格式：按列读取（每4或5列一组）
            // 检测列间隔（4列或5列）
            const columnStep = detectColumnStep(row);
            
            for (let colIndex = 0; colIndex < row.length; colIndex += columnStep) {
              let wordCell = row[colIndex] ? String(row[colIndex]).trim() : '';
              
              if (!wordCell) continue;
              wordCell = wordCell.replace(/\s+/g, ' ');
              
              // 跳过序号
              if (/^\d+$/.test(wordCell)) {
                continue;
              }
              
              // 跳过词性缩写和词性组合（如 v./adj., n./v.）
              if (isPartOfSpeech(wordCell) || /^[a-z]+\.\/[a-z]+\.?$/i.test(wordCell)) {
                console.log(`⏭️ 跳过词性: ${wordCell}`);
                continue;
              }
              
              // 检查是否是有效的英文单词
              const isValidWord = /^[a-zA-Z]+[-'\s.()…/,a-zA-Z.…]*$/.test(wordCell);
              if (!isValidWord) {
                console.log(`⏭️ 跳过无效单词: ${wordCell}`);
                continue;
              }
              
              const word = wordCell.toLowerCase();
              
              // 按固定列读取翻译、音标、词性
              let translation = '';
              let phonetic: string | null = null;
              let partOfSpeech: string | null = null;
              
              // 查找翻译（向后1-3列）
              for (let offset = 1; offset <= 3 && colIndex + offset < row.length; offset++) {
                const cell = row[colIndex + offset] ? String(row[colIndex + offset]).trim() : '';
                if (!cell || /^\d+$/.test(cell)) continue;
                
                if (/[\u4e00-\u9fa5]/.test(cell)) {
                  translation = cell;
                  break;
                }
              }
              
              // 查找音标（向后1-3列）
              for (let offset = 1; offset <= 3 && colIndex + offset < row.length; offset++) {
                const cell = row[colIndex + offset] ? String(row[colIndex + offset]).trim() : '';
                if (!cell) continue;
                
                if (/[\[\]\/]/.test(cell) || /[əɪʊɛɔæʌɑː]/.test(cell)) {
                  phonetic = cell;
                  break;
                }
              }
              
              // 查找词性（向后1-3列）
              for (let offset = 1; offset <= 3 && colIndex + offset < row.length; offset++) {
                const cell = row[colIndex + offset] ? String(row[colIndex + offset]).trim() : '';
                if (!cell || /^\d+$/.test(cell)) continue;
                
                if (isPartOfSpeech(cell)) {
                  partOfSpeech = cell;
                  break;
                }
              }
              
              const parsedWord = createParsedWord(word, translation, phonetic, partOfSpeech);
              
              // 检查是否需要审查
              const reviewCheck = checkWordNeedsReview(word, translation, phonetic);
              if (reviewCheck.needsReview) {
                parsedWord.needsReview = true;
                parsedWord.reviewReason = reviewCheck.reason;
              }
              
              if (currentChapter) {
                parsedWord.chapterName = currentChapter.name;
                currentChapter.words.push(parsedWord);
              } else {
                words.push(parsedWord);
              }
            }
          }
        } else {
          // 自由格式：智能识别
          for (const row of rows) {
            if (!row || row.length === 0) continue;
            
            const firstCell = row[0] ? String(row[0]).trim() : '';
            
            // 检查是否是标题行
            const hasOnlyFirstColumn = firstCell && !row[1] && !row[2] && !row[3];
            const isTitleKeyword = /^(Unit|Lesson|Chapter|第.*课|第.*单元|Part|九年级)/i.test(firstCell);
            const isShortLine = firstCell.length < 30 && !/^[a-z]/i.test(firstCell);
            
            if (hasOnlyFirstColumn && (isTitleKeyword || isShortLine)) {
              if (currentChapter && currentChapter.words.length > 0) {
                chapters.push(currentChapter);
              }
              currentChapter = {
                name: firstCell,
                words: []
              };
              continue;
            }
            
            // 智能识别：遍历所有列
            for (let colIndex = 0; colIndex < row.length; colIndex++) {
              let wordCell = row[colIndex] ? String(row[colIndex]).trim() : '';
              
              if (!wordCell) continue;
              wordCell = wordCell.replace(/\s+/g, ' ');
              
              // 跳过序号和词性缩写
              if (/^\d+$/.test(wordCell) || isPartOfSpeech(wordCell)) {
                continue;
              }
              
              // 检查是否是有效的英文单词
              const isValidWord = /^[a-zA-Z]+[-'\s.()…/,a-zA-Z.…]*$/.test(wordCell);
              if (!isValidWord) continue;
              
              const word = wordCell.toLowerCase();
              let translation = '';
              let phonetic: string | null = null;
              let partOfSpeech: string | null = null;
              
              // 向后查找最多4列
              for (let offset = 1; offset <= 4 && colIndex + offset < row.length; offset++) {
                const nextCell = row[colIndex + offset] ? String(row[colIndex + offset]).trim() : '';
                if (!nextCell) continue;
                
                // 如果遇到下一个英文单词，停止查找
                const isNextWord = /^[a-zA-Z]+[-'\s.()…/,a-zA-Z.…]*$/.test(nextCell) && 
                                   !isPartOfSpeech(nextCell) && 
                                   !/^\d+$/.test(nextCell);
                if (isNextWord) break;
                
                // 判断单元格类型
                if (/[\[\]\/]/.test(nextCell) || /[əɪʊɛɔæʌɑː]/.test(nextCell)) {
                  if (!phonetic) phonetic = nextCell;
                } else if (isPartOfSpeech(nextCell)) {
                  if (!partOfSpeech) partOfSpeech = nextCell;
                } else if (/^\d+$/.test(nextCell)) {
                  continue;
                } else if (/[\u4e00-\u9fa5]/.test(nextCell)) {
                  if (!translation) translation = nextCell;
                }
              }
              
              const parsedWord = createParsedWord(word, translation, phonetic, partOfSpeech);
              
              // 检查是否需要审查
              const reviewCheck = checkWordNeedsReview(word, translation, phonetic);
              if (reviewCheck.needsReview) {
                parsedWord.needsReview = true;
                parsedWord.reviewReason = reviewCheck.reason;
              }
              
              if (currentChapter) {
                parsedWord.chapterName = currentChapter.name;
                currentChapter.words.push(parsedWord);
              } else {
                words.push(parsedWord);
              }
            }
          }
        }
        
        // 保存最后一个章节
        if (currentChapter && currentChapter.words.length > 0) {
          chapters.push(currentChapter);
        }
        
        // 如果检测到章节，返回所有章节的单词
        console.log('🔍🔍🔍 parseExcelFile完成，章节数量:', chapters.length);
        if (chapters.length > 0) {
          console.log('🔍 章节列表:', chapters.map(ch => `${ch.name}: ${ch.words.length}个单词`));
          const allWords = chapters.flatMap(ch => ch.words);
          
          // ✅ 降低门槛：只要检测到多个章节就显示
          if (chapters.length > 1) {
            console.log('📊 Excel检测到多个章节，准备显示章节选项');
            console.log('📊 调用setDetectedChapters，章节数量:', chapters.length);
            console.log('📊 调用setShowChapterOptions(true)');
            
            setDetectedChapters(chapters);
            setShowChapterOptions(true);
            
            // 使用setTimeout确保toast在状态更新后显示
            setTimeout(() => {
              toast.info(`检测到 ${chapters.length} 个章节，请选择分章节方式`);
            }, 100);
          } else {
            console.log('📊 Excel只检测到1个章节，不显示章节选项');
          }
          
          resolve(allWords);
        } else {
          console.log('📊 Excel未检测到章节');
          resolve(words);
        }
      };
      reader.readAsBinaryString(file);
    });
  };

  // 检测是否是规范格式（固定列布局）
  function detectStandardFormat(rows: any[][]): boolean {
    if (rows.length < 3) return false;
    
    let validRows = 0;
    let standardRows = 0;
    
    for (const row of rows.slice(0, Math.min(10, rows.length))) {
      if (!row || row.length < 4) continue;
      
      validRows++;
      
      // 检查前几列的模式
      const col0 = row[0] ? String(row[0]).trim() : '';
      const col1 = row[1] ? String(row[1]).trim() : '';
      const col2 = row[2] ? String(row[2]).trim() : '';
      const col3 = row[3] ? String(row[3]).trim() : '';
      
      // 规范格式特征：
      // 列0：英文单词
      // 列1：中文翻译
      // 列2：音标
      // 列3：词性
      const isCol0English = /^[a-zA-Z]+[-'\s.()…/,a-zA-Z.…]*$/.test(col0);
      const isCol1Chinese = /[\u4e00-\u9fa5]/.test(col1);
      const isCol2Phonetic = /[\[\]\/]/.test(col2) || /[əɪʊɛɔæʌɑː]/.test(col2);
      const isCol3POS = isPartOfSpeech(col3);
      
      if (isCol0English && (isCol1Chinese || isCol2Phonetic || isCol3POS)) {
        standardRows++;
      }
    }
    
    // 如果超过70%的行符合规范格式，则认为是规范格式
    return validRows > 0 && (standardRows / validRows) >= 0.7;
  }

  // 检测列间隔（4列或5列）
  function detectColumnStep(row: any[]): number {
    // 检查是否有序号列
    for (let i = 4; i < Math.min(row.length, 10); i++) {
      const cell = row[i] ? String(row[i]).trim() : '';
      if (/^\d+$/.test(cell)) {
        return 5; // 有序号列，间隔为5
      }
    }
    return 4; // 无序号列，间隔为4
  }

  // 解析OCR文件（PDF和图片）
  const parseOCRFile = async (file: File, ext: string): Promise<{ words: ParsedWord[]; text: string }> => {
    try {
      // 将文件转换为Base64
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = reader.result as string;
          // 移除data URL前缀
          const base64Data = result.split(',')[1];
          resolve(base64Data);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      console.log('📄 文件已转换为Base64，大小:', base64.length);

      // 调用OCR Edge Function
      let fileType: 'pdf' | 'image' | 'docx';
      if (ext === 'pdf') {
        fileType = 'pdf';
      } else if (ext === 'doc' || ext === 'docx') {
        fileType = 'docx';
      } else {
        fileType = 'image';
      }
      
      const message = fileType === 'docx' 
        ? '正在解析Word文档...' 
        : '正在识别文档内容，这可能需要1-2分钟...';
      
      toast.info(message, { duration: 5000 });
      
      const { data, error } = await supabase.functions.invoke('ocr-document', {
        body: {
          file: base64,
          fileType,
        },
      });

      if (error) {
        console.error('OCR识别失败:', error);
        throw new Error('OCR识别失败: ' + error.message);
      }

      if (!data) {
        throw new Error('OCR未返回数据');
      }

      console.log('✅ OCR识别完成:', data);

      // 检查是否有文本内容
      if (data.text && data.text.trim().length > 0) {
        console.log('📝 提取的文本长度:', data.text.length);
        console.log('📝 文本预览:', data.text.substring(0, 200));
        
        // 解析提取的文本
        const words = parseTextContent(data.text);
        
        if (words.length === 0) {
          toast.error('文档中未找到有效的英文单词');
          throw new Error('未找到有效单词');
        }
        
        toast.success(`成功识别 ${words.length} 个单词`, { duration: 3000 });
        // ✅ 返回单词列表和原始文本，用于章节检测
        return { words, text: data.text };
      }

      // 如果没有文本，抛出错误
      console.error('❌ OCR未返回文本内容');
      throw new Error('OCR识别失败：未返回文本内容');
    } catch (error) {
      console.error('解析OCR文件失败:', error);
      const errorMessage = error instanceof Error ? error.message : '解析OCR文件失败';
      toast.error(errorMessage);
      throw error;
    }
  };

  const autoCompleteWords = async (words: ParsedWord[], autoMatch?: boolean) => {
    // 如果没有传入autoMatch参数，使用状态值
    const shouldAutoMatch = autoMatch !== undefined ? autoMatch : enableAutoMatch;
    
    // 如果关闭了自动匹配，跳过API调用
    if (!shouldAutoMatch) {
      console.log('⚠️ 自动匹配已关闭，跳过API补充');
      
      // 标记缺失翻译的单词为需要审查
      for (const word of words) {
        if (!word.translation || word.translation === '' || word.translation === '（未找到释义）') {
          word.needsReview = true;
          word.reviewReason = '缺少翻译';
          word.translation = ''; // 清空无效翻译
        }
      }
      
      return;
    }
    
    const totalWords = words.length;
    
    // 筛选出需要补充音标或词性的单词（注意：不管翻译，只要缺音标或词性就补充）
    const wordsNeedingCompletion = words.filter(w => 
      !w.phonetic || !w.part_of_speech || 
      (!w.translation || w.translation === '' || w.translation === '（未找到释义）')
    );
    
    if (wordsNeedingCompletion.length === 0) {
      console.log('✅ 所有单词都有音标和词性，无需自动补充');
      return;
    }
    
    console.log(`📝 需要补充 ${wordsNeedingCompletion.length} / ${totalWords} 个单词`);
    console.log(`📝 需要补充的单词列表:`, wordsNeedingCompletion.map(w => w.word).join(', '));
    
    setProcessingProgress({ current: 0, total: wordsNeedingCompletion.length });
    setProcessingMessage(`正在补充缺失的音标和词性... (${wordsNeedingCompletion.length}个)`);
    
    // 串行处理，避免并发导致的性能问题
    for (let i = 0; i < wordsNeedingCompletion.length; i++) {
      const word = wordsNeedingCompletion[i];
      
      // 更新进度
      setProcessingProgress({ current: i + 1, total: wordsNeedingCompletion.length });
      
      word.status = 'processing';
      setParsedWords([...words]);

      try {
        const { data, error } = await supabase.functions.invoke('word-lookup', {
          body: { word: word.word },
        });

        if (error) {
          console.error(`查询单词 ${word.word} 失败:`, error);
          // API失败时，只标记缺失翻译的单词
          if (!word.translation || word.translation === '' || word.translation === '（未找到释义）') {
            word.translation = '（未找到释义）';
          }
        } else if (data) {
          console.log(`✅ 单词 ${word.word} 返回数据:`, data);
          
          // 补充音标（如果用户没有提供）
          if (!word.phonetic && data.phonetic) {
            word.phonetic = data.phonetic;
            console.log(`  ✅ 补充音标: ${data.phonetic}`);
          }
          
          // 补充词性（如果用户没有提供）
          if (!word.part_of_speech && data.part_of_speech) {
            word.part_of_speech = data.part_of_speech;
            console.log(`  ✅ 补充词性: ${data.part_of_speech}`);
          }
          
          // 只有当用户没有提供翻译时，才补充翻译
          if (!word.hasOriginalTranslation) {
            if (!word.translation || word.translation === '' || word.translation === '（未找到释义）') {
              if (data.translation) {
                word.translation = data.translation;
                console.log(`  ✅ 补充翻译: ${data.translation}`);
                // 补充翻译后，清除needs_review标记
                word.needsReview = false;
                word.reviewReason = undefined;
              } else {
                word.translation = '（未找到释义）';
              }
            }
          } else {
            console.log(`  ⏭️ 保留用户翻译: ${word.translation}`);
          }
        } else {
          // 没有返回数据，只标记缺失翻译的单词
          if (!word.hasOriginalTranslation && (!word.translation || word.translation === '' || word.translation === '（未找到释义）')) {
            word.translation = '（未找到释义）';
          }
        }
      } catch (error) {
        console.error(`查询单词 ${word.word} 异常:`, error);
        // 异常时，只标记缺失翻译的单词
        if (!word.hasOriginalTranslation && (!word.translation || word.translation === '' || word.translation === '（未找到释义）')) {
          word.translation = '（未找到释义）';
        }
      }

      word.status = 'ready';
      setParsedWords([...words]);
    }
    
    // 完成后清除进度信息
    setProcessingMessage('');
    setProcessingProgress({ current: 0, total: 0 });
    
    console.log('✅ 自动补充完成');
  };

  const handleImport = async () => {
    if (parsedWords.length === 0) {
      toast.error('没有可导入的单词');
      return;
    }

    // 检查需要审查的单词
    const needsReviewWords = parsedWords.filter(w => w.needsReview);
    
    if (needsReviewWords.length > 0) {
      const reviewReasons = needsReviewWords.map(w => `${w.word} (${w.reviewReason})`).slice(0, 5);
      const moreCount = needsReviewWords.length > 5 ? ` 等${needsReviewWords.length}个` : '';
      
      const confirmImport = window.confirm(
        `检测到 ${needsReviewWords.length} 个单词可能需要您审查：\n\n${reviewReasons.join('\n')}${moreCount}\n\n这些单词将在导入后标记为红色，提醒您手动修正。\n\n是否继续导入？`
      );
      
      if (!confirmImport) {
        return;
      }
    }

    // 检查是否有单词缺少翻译或标记为"未找到释义"
    const missingTranslation = parsedWords.filter(w => !w.translation);
    const notFoundWords = parsedWords.filter(w => w.translation === '（未找到释义）');
    
    if (missingTranslation.length > 0) {
      toast.error('部分单词缺少翻译，请等待自动补充完成');
      return;
    }
    
    if (notFoundWords.length > 0) {
      const confirmImport = window.confirm(
        `有 ${notFoundWords.length} 个单词未找到释义（${notFoundWords.map(w => w.word).join(', ')}）。\n\n您可以：\n1. 点击"取消"，删除这些单词后再导入\n2. 点击"确定"，导入所有单词（未找到释义的单词可以在"单词管理"中手动编辑）`
      );
      
      if (!confirmImport) {
        return;
      }
    }

    try {
      setImporting(true);
      
      // 判断是否需要分章节导入
      if (chapterMode !== 'none' && detectedChapters.length > 0) {
        // 按章节导入
        for (const chapter of detectedChapters) {
          // 为每个章节创建一个collection
          const collection = await createCollection(chapter.name);
          
          const wordsToImport = chapter.words.map((w, index) => ({
            word: w.word,
            phonetic: w.phonetic,
            translation: w.translation,
            part_of_speech: w.part_of_speech,
            collection_id: collection.id,
            chapter_id: null,
            import_order: index + 1, // 添加导入顺序，从1开始
            needs_review: w.needsReview || false, // 标记需要审查的单词
            review_reason: w.reviewReason || null, // 审查原因
          }));

          await addWordsBatch(wordsToImport, enableDedupe);
        }
        
        const reviewCount = parsedWords.filter(w => w.needsReview).length;
        if (reviewCount > 0) {
          toast.success(`成功导入 ${detectedChapters.length} 个章节，共 ${parsedWords.length} 个单词。其中 ${reviewCount} 个单词需要审查，已标记为红色。`);
        } else {
          toast.success(`成功导入 ${detectedChapters.length} 个章节，共 ${parsedWords.length} 个单词`);
        }
      } else {
        // 不分章节，导入到选中的collection
        if (!selectedCollection) {
          toast.error('请选择或创建章节');
          return;
        }
        
        const wordsToImport = parsedWords.map((w, index) => ({
          word: w.word,
          phonetic: w.phonetic,
          translation: w.translation,
          part_of_speech: w.part_of_speech,
          collection_id: selectedCollection,
          chapter_id: null,
          import_order: index + 1, // 添加导入顺序，从1开始
          needs_review: w.needsReview || false, // 标记需要审查的单词
          review_reason: w.reviewReason || null, // 审查原因
        }));

        const result = await addWordsBatch(wordsToImport, enableDedupe);
        
        const reviewCount = parsedWords.filter(w => w.needsReview).length;
        if (result.duplicates > 0) {
          const message = reviewCount > 0 
            ? `成功导入 ${result.added.length} 个单词，${result.duplicates} 个重复单词已跳过。其中 ${reviewCount} 个单词需要审查，已标记为红色。`
            : `成功导入 ${result.added.length} 个单词，${result.duplicates} 个重复单词已跳过`;
          toast.success(message);
        } else {
          const message = reviewCount > 0
            ? `成功导入 ${result.added.length} 个单词。其中 ${reviewCount} 个单词需要审查，已标记为红色。`
            : `成功导入 ${result.added.length} 个单词`;
          toast.success(message);
        }
      }
      
      navigate('/words');
    } catch (error: any) {
      console.error('导入失败:', error);
      toast.error('导入失败');
    } finally {
      setImporting(false);
    }
  };

  const updateWord = (index: number, field: keyof ParsedWord, value: string) => {
    const updated = [...parsedWords];
    updated[index] = { ...updated[index], [field]: value };
    setParsedWords(updated);
  };

  const deleteWord = (index: number) => {
    const updated = parsedWords.filter((_, i) => i !== index);
    setParsedWords(updated);
    toast.success('已删除单词');
  };
  
  // 排序函数
  const sortWords = (order: 'import' | 'alpha') => {
    setSortOrder(order);
    
    let sorted: ParsedWord[];
    
    if (order === 'alpha') {
      // 按字母顺序排序（A-Z）
      sorted = [...parsedWords].sort((a, b) => a.word.localeCompare(b.word));
    } else {
      // 恢复导入顺序
      sorted = [...originalWords];
    }
    
    // 如果关闭了自动匹配，将缺失翻译的单词排在前面
    if (!enableAutoMatch) {
      const wordsWithIssues = sorted.filter(w => !w.translation || w.translation === '');
      const wordsWithoutIssues = sorted.filter(w => w.translation && w.translation !== '');
      sorted = [...wordsWithIssues, ...wordsWithoutIssues];
    }
    
    setParsedWords(sorted);
  };

  // 章节管理函数
  const handleEditCollection = (collection: Collection) => {
    setEditingCollection(collection);
    setEditCollectionName(collection.name);
  };

  const handleSaveCollectionName = async () => {
    if (!editingCollection || !editCollectionName.trim()) return;

    try {
      await updateCollectionName(editingCollection.id, editCollectionName.trim());
      await loadCollections();
      setEditingCollection(null);
      toast.success('重命名成功');
    } catch (error: any) {
      console.error('重命名失败:', error);
      if (error.message?.includes('duplicate')) {
        toast.error('章节名称已存在');
      } else {
        toast.error('重命名失败');
      }
    }
  };

  const handlePreviewCollection = async (collection: Collection) => {
    try {
      const words = await getWordsByCollection(collection.id);
      setPreviewWords(words);
      setPreviewCollection(collection);
    } catch (error) {
      console.error('加载单词失败:', error);
      toast.error('加载单词失败');
    }
  };

  const handleDeleteCollection = async () => {
    if (!deleteConfirmCollection) return;

    try {
      await deleteCollection(deleteConfirmCollection.id);
      await loadCollections();
      setDeleteConfirmCollection(null);
      toast.success('删除成功');
    } catch (error) {
      console.error('删除失败:', error);
      toast.error('删除失败');
    }
  };

  return (
    <div className="flex min-h-screen w-full flex-col bg-background">
      {/* 头部 */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/words')}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-xl font-bold text-foreground">文件导入单词</h1>
          </div>
        </div>
      </header>

      {/* 主内容 */}
      <main className="container mx-auto flex-1 px-4 py-6">
        {parsedWords.length === 0 ? (
          <Card className="mx-auto max-w-2xl border border-border p-8">
            <div className="flex flex-col items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-sm border-2 border-dashed border-border">
                <Upload className="h-8 w-8 text-muted-foreground" />
              </div>
              <div className="text-center">
                <h3 className="text-lg font-semibold text-foreground">选择文件导入</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  支持 .txt、.csv、.xlsx、.doc、.pdf、.jpg、.png 格式
                </p>
              </div>
              <label htmlFor="file-upload">
                <Button disabled={parsing} asChild>
                  <span>
                    {parsing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {parsing ? '解析中...' : '选择文件'}
                  </span>
                </Button>
              </label>
              <input
                id="file-upload"
                type="file"
                accept="*/*"
                onChange={handleFileChange}
                multiple
                className="hidden"
              />
            </div>
          </Card>
        ) : (
          <div className="space-y-4">
            {/* 章节选择和设置 */}
            <Card className="border border-border p-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>选择章节</Label>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowNewCollection(!showNewCollection)}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    新建章节
                  </Button>
                </div>

                {showNewCollection && (
                  <div className="flex gap-2">
                    <Input
                      placeholder="输入章节名称"
                      value={newCollectionName}
                      onChange={(e) => setNewCollectionName(e.target.value)}
                    />
                    <Button onClick={handleCreateCollection}>创建</Button>
                  </div>
                )}

                <Select value={selectedCollection} onValueChange={setSelectedCollection}>
                  <SelectTrigger>
                    <SelectValue placeholder="选择章节" />
                  </SelectTrigger>
                  <SelectContent>
                    {collections.map((col) => (
                      <SelectItem key={col.id} value={col.id}>
                        {col.name} ({col.word_count}词)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <Label htmlFor="dedupe-import">自动去重</Label>
                    <p className="text-xs text-muted-foreground mt-1">
                      同一章节内去重，不同章节可以有相同单词
                    </p>
                  </div>
                  <Switch
                    id="dedupe-import"
                    checked={enableDedupe}
                    onCheckedChange={setEnableDedupe}
                  />
                </div>
              </div>
            </Card>

            {/* 分章节选项 */}
            {(showChapterOptions || detectedChapters.length > 0) && (
              <Card className="border border-border p-4">
                <div className="space-y-3">
                  <Label>分章节导入</Label>
                  <p className="text-xs text-muted-foreground">
                    检测到 {detectedChapters.length} 个章节，共 {parsedWords.length} 个单词
                  </p>
                  
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="chapterMode"
                        value="title"
                        checked={chapterMode === 'title'}
                        onChange={(e) => setChapterMode(e.target.value as any)}
                        className="h-4 w-4"
                      />
                      <div>
                        <div className="text-sm font-medium">按标题分章节（推荐）</div>
                        <div className="text-xs text-muted-foreground">
                          以检测到的标题为分界点，每个标题创建一个章节
                        </div>
                      </div>
                    </label>
                    
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="chapterMode"
                        value="page"
                        checked={chapterMode === 'page'}
                        onChange={(e) => setChapterMode(e.target.value as any)}
                        className="h-4 w-4"
                      />
                      <div>
                        <div className="text-sm font-medium">按页/图片分章节</div>
                        <div className="text-xs text-muted-foreground">
                          每页或每张图片创建一个章节
                        </div>
                      </div>
                    </label>
                    
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="chapterMode"
                        value="none"
                        checked={chapterMode === 'none'}
                        onChange={(e) => setChapterMode(e.target.value as any)}
                        className="h-4 w-4"
                      />
                      <div>
                        <div className="text-sm font-medium">不分章节</div>
                        <div className="text-xs text-muted-foreground">
                          所有单词导入到选中的章节
                        </div>
                      </div>
                    </label>
                  </div>
                  
                  {/* 章节预览 */}
                  {chapterMode !== 'none' && detectedChapters.length > 0 && (
                    <div className="mt-3 space-y-2">
                      <div className="text-sm font-medium">章节预览：</div>
                      <div className="max-h-40 overflow-y-auto space-y-1">
                        {detectedChapters.map((chapter, index) => (
                          <div key={index} className="text-xs bg-muted p-2 rounded">
                            <span className="font-medium">{chapter.name}</span>
                            <span className="text-muted-foreground ml-2">({chapter.words.length}词)</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </Card>
            )}

            {/* 预览列表标题和操作 */}
            <div className="space-y-3">
              {/* 标题和提示 */}
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base md:text-lg font-semibold text-foreground">
                    预览列表 ({parsedWords.length} 个单词)
                  </h3>
                  <p className="text-xs md:text-sm text-muted-foreground">
                    请检查并确认，可手动修改后导入
                  </p>
                </div>
                
                {/* 排序按钮 */}
                <div className="flex gap-2">
                  <Button
                    variant={sortOrder === 'import' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => sortWords('import')}
                  >
                    按导入顺序
                  </Button>
                  <Button
                    variant={sortOrder === 'alpha' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => sortWords('alpha')}
                  >
                    按字母顺序
                  </Button>
                </div>
              </div>
              
              {/* 进度提示和操作按钮 */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3">
                {/* 进度提示 */}
                {processingMessage && processingProgress.total > 0 && (
                  <div className="flex items-center gap-2 rounded-md bg-muted px-3 py-1.5 text-xs md:text-sm text-muted-foreground">
                    <Loader2 className="h-3 w-3 md:h-4 md:w-4 animate-spin" />
                    <span>
                      {processingMessage} ({processingProgress.current}/{processingProgress.total})
                    </span>
                  </div>
                )}
                
                {/* 操作按钮 */}
                <div className="flex gap-2 ml-auto">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setParsedWords([]);
                      setFile(null);
                    }}
                  >
                    重新选择
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleImport}
                    disabled={importing || parsedWords.some(w => w.status === 'processing') || processingProgress.total > 0}
                  >
                    {importing && <Loader2 className="mr-2 h-3 w-3 md:h-4 md:w-4 animate-spin" />}
                    确认导入
                  </Button>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              {parsedWords.map((word, index) => {
                // 检查是否缺失翻译（关闭自动匹配时）
                const missingTranslation = !enableAutoMatch && (!word.translation || word.translation === '');
                const hasIssue = word.hasError || missingTranslation;
                
                return (
                  <Card 
                    key={index} 
                    className={`border p-3 ${hasIssue ? 'border-red-500 bg-red-50 dark:bg-red-950/20' : 'border-border'}`}
                  >
                    <div className="flex items-start gap-2">
                      {/* 状态图标 */}
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center">
                        {hasIssue ? (
                          <span className="text-red-600 dark:text-red-400">⚠️</span>
                        ) : word.status === 'processing' ? (
                          <Loader2 className="h-4 w-4 animate-spin text-primary" />
                        ) : word.status === 'ready' ? (
                          <Check className="h-4 w-4 text-primary" />
                        ) : (
                        <div className="h-2 w-2 rounded-full bg-muted" />
                      )}
                    </div>

                    {/* 内容区域 */}
                    <div className="flex-1 min-w-0">
                      {(word.hasError || missingTranslation) && (
                        <div className="mb-1 text-xs text-red-600 dark:text-red-400">
                          {word.errorMessage || (missingTranslation ? '⚠️ 缺少翻译内容' : '')}
                        </div>
                      )}
                      
                      {/* 桌面端：横向4列布局 */}
                      <div className="hidden md:grid md:grid-cols-4 md:gap-3">
                        <div>
                          <label className="text-xs text-muted-foreground">单词</label>
                          <input
                            type="text"
                            value={word.word}
                            onChange={(e) => {
                              updateWord(index, 'word', e.target.value);
                              const validation = validateWord(e.target.value);
                              const updatedWords = [...parsedWords];
                              updatedWords[index].hasError = !validation.valid;
                              updatedWords[index].errorMessage = validation.message;
                              setParsedWords(updatedWords);
                            }}
                            className={`w-full border-b bg-transparent py-1 text-sm focus:outline-none ${
                              word.hasError 
                                ? 'border-red-500 text-red-600 dark:text-red-400 focus:border-red-600' 
                                : 'border-border focus:border-primary'
                            }`}
                          />
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground">
                            音标
                            {!word.hasOriginalPhonetic && word.phonetic && (
                              <span className="ml-1 text-[10px] text-primary">(自动补充)</span>
                            )}
                          </label>
                          <input
                            type="text"
                            value={word.phonetic || ''}
                            onChange={(e) => updateWord(index, 'phonetic', e.target.value)}
                            className="w-full border-b border-border bg-transparent py-1 font-mono text-sm focus:border-primary focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground">
                            翻译
                            {!word.hasOriginalTranslation && word.translation && (
                              <span className="ml-1 text-[10px] text-primary">(自动补充)</span>
                            )}
                          </label>
                          <input
                            type="text"
                            value={word.translation}
                            onChange={(e) => updateWord(index, 'translation', e.target.value)}
                            className="w-full border-b border-border bg-transparent py-1 text-sm focus:border-primary focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground">
                            词性
                            {!word.hasOriginalPos && word.part_of_speech && (
                              <span className="ml-1 text-[10px] text-primary">(自动补充)</span>
                            )}
                          </label>
                          <input
                            type="text"
                            value={word.part_of_speech || ''}
                            onChange={(e) => updateWord(index, 'part_of_speech', e.target.value)}
                            placeholder="n./v./adj."
                            className="w-full border-b border-border bg-transparent py-1 text-sm focus:border-primary focus:outline-none"
                          />
                        </div>
                      </div>

                      {/* 移动端：紧凑的横向布局 */}
                      <div className="md:hidden space-y-1.5">
                        {/* 第一行：单词 - 翻译 */}
                        <div className="flex items-baseline gap-2">
                          <input
                            type="text"
                            value={word.word}
                            onChange={(e) => {
                              updateWord(index, 'word', e.target.value);
                              const validation = validateWord(e.target.value);
                              const updatedWords = [...parsedWords];
                              updatedWords[index].hasError = !validation.valid;
                              updatedWords[index].errorMessage = validation.message;
                              setParsedWords(updatedWords);
                            }}
                            className={`flex-shrink-0 w-24 border-b bg-transparent py-0.5 text-sm font-medium focus:outline-none ${
                              word.hasError 
                                ? 'border-red-500 text-red-600 dark:text-red-400 focus:border-red-600' 
                                : 'border-border focus:border-primary'
                            }`}
                            placeholder="单词"
                          />
                          <span className="text-muted-foreground">-</span>
                          <div className="flex-1 min-w-0 flex items-center gap-1">
                            <input
                              type="text"
                              value={word.translation}
                              onChange={(e) => updateWord(index, 'translation', e.target.value)}
                              className="flex-1 min-w-0 border-b border-border bg-transparent py-0.5 text-sm focus:border-primary focus:outline-none"
                              placeholder="翻译"
                            />
                            {!word.hasOriginalTranslation && word.translation && (
                              <span className="text-[10px] text-primary shrink-0">✨</span>
                            )}
                          </div>
                        </div>
                        
                        {/* 第二行：音标 | 词性 */}
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <div className="flex-1 min-w-0 flex items-center gap-1">
                            <input
                              type="text"
                              value={word.phonetic || ''}
                              onChange={(e) => updateWord(index, 'phonetic', e.target.value)}
                              className="flex-1 min-w-0 border-b border-border bg-transparent py-0.5 font-mono text-xs focus:border-primary focus:outline-none"
                              placeholder="音标"
                            />
                            {!word.hasOriginalPhonetic && word.phonetic && (
                              <span className="text-[10px] text-primary shrink-0">✨</span>
                            )}
                          </div>
                          <span>|</span>
                          <div className="flex items-center gap-1">
                            <input
                              type="text"
                              value={word.part_of_speech || ''}
                              onChange={(e) => updateWord(index, 'part_of_speech', e.target.value)}
                              placeholder="词性"
                              className="w-16 border-b border-border bg-transparent py-0.5 text-xs focus:border-primary focus:outline-none"
                            />
                            {!word.hasOriginalPos && word.part_of_speech && (
                              <span className="text-[10px] text-primary shrink-0">✨</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 删除按钮 */}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteWord(index)}
                      className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive"
                      title="删除单词"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </Card>
              );
              })}
            </div>
          </div>
        )}

        {/* 章节管理列表 */}
        {parsedWords.length === 0 && (
          <Card className="mx-auto mt-6 max-w-2xl border border-border p-4 md:p-6">
            <h3 className="mb-3 text-base md:text-lg font-semibold text-foreground">已导入的章节</h3>
            {collections.length === 0 ? (
              <p className="text-sm text-muted-foreground">暂无章节</p>
            ) : (
              <div className="space-y-2">
                {collections.map((collection) => (
                  <div
                    key={collection.id}
                    className="flex items-center gap-2 rounded-md border border-border p-2 md:p-3 transition-colors hover:bg-accent"
                  >
                    {/* 章节信息 */}
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-foreground text-sm md:text-base truncate">{collection.name}</h4>
                      <p className="text-xs md:text-sm text-muted-foreground">{collection.word_count} 个单词</p>
                    </div>
                    
                    {/* 操作按钮 */}
                    <div className="flex gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handlePreviewCollection(collection)}
                        className="h-7 w-7 md:h-8 md:w-8"
                        title="预览"
                      >
                        <Eye className="h-3.5 w-3.5 md:h-4 md:w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEditCollection(collection)}
                        className="h-7 w-7 md:h-8 md:w-8"
                        title="改名"
                      >
                        <Pencil className="h-3.5 w-3.5 md:h-4 md:w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteConfirmCollection(collection)}
                        className="h-7 w-7 md:h-8 md:w-8 text-destructive hover:bg-destructive/10"
                        title="删除"
                      >
                        <Trash2 className="h-3.5 w-3.5 md:h-4 md:w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}
      </main>

      {/* 重命名对话框 */}
      <Dialog open={!!editingCollection} onOpenChange={() => setEditingCollection(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>重命名章节</DialogTitle>
          </DialogHeader>
          <Input
            value={editCollectionName}
            onChange={(e) => setEditCollectionName(e.target.value)}
            placeholder="输入新名称"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingCollection(null)}>
              取消
            </Button>
            <Button onClick={handleSaveCollectionName}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 预览对话框 */}
      <Dialog open={!!previewCollection} onOpenChange={() => setPreviewCollection(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>{previewCollection?.name}</DialogTitle>
          </DialogHeader>
          <div className="max-h-[400px] space-y-1.5 overflow-y-auto">
            {previewWords.map((word) => (
              <div key={word.id} className="border-b border-border py-2 last:border-0">
                {/* 桌面端：横向布局 */}
                <div className="hidden md:flex md:items-center md:gap-4">
                  <span className="min-w-[100px] font-semibold">{word.word}</span>
                  {word.phonetic && <span className="min-w-[120px] font-mono text-sm text-muted-foreground">{word.phonetic}</span>}
                  <span className="flex-1 text-sm">{word.translation}</span>
                </div>
                
                {/* 移动端：紧凑布局 */}
                <div className="md:hidden space-y-0.5">
                  <div className="flex items-baseline gap-2">
                    <span className="font-semibold text-sm">{word.word}</span>
                    <span className="text-muted-foreground">-</span>
                    <span className="flex-1 text-sm">{word.translation}</span>
                  </div>
                  {word.phonetic && (
                    <div className="font-mono text-xs text-muted-foreground pl-1">{word.phonetic}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button onClick={() => setPreviewCollection(null)}>关闭</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除确认对话框 */}
      <Dialog open={!!deleteConfirmCollection} onOpenChange={() => setDeleteConfirmCollection(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            确定要删除章节 "{deleteConfirmCollection?.name}" 吗？该章节下的所有单词也将被删除，此操作无法撤销。
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmCollection(null)}>
              取消
            </Button>
            <Button
              onClick={handleDeleteCollection}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* 自动匹配翻译确认对话框 */}
      <Dialog open={showAutoMatchDialog} onOpenChange={setShowAutoMatchDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>选择导入方式</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              是否需要自动联网匹配音标与翻译？
            </p>
            <div className="space-y-3">
              <div className="rounded-lg border border-border p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-lg">✅</span>
                  <span className="font-medium">自动匹配（推荐）</span>
                </div>
                <p className="text-xs text-muted-foreground pl-7">
                  • 优先使用您文档中的翻译<br/>
                  • 自动补充缺失的音标和翻译<br/>
                  • 适合翻译不完整的文档
                </p>
              </div>
              <div className="rounded-lg border border-border p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-lg">📄</span>
                  <span className="font-medium">仅使用文档内容</span>
                </div>
                <p className="text-xs text-muted-foreground pl-7">
                  • 完全使用您文档中的内容<br/>
                  • 不调用任何API<br/>
                  • 缺失内容会标红提示<br/>
                  • 适合已有完整翻译的文档
                </p>
              </div>
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowAutoMatchDialog(false);
                setPendingFile(null);
              }}
              className="w-full sm:w-auto"
            >
              取消
            </Button>
            <Button
              variant="outline"
              onClick={() => handleConfirmAutoMatch(false)}
              className="w-full sm:w-auto"
            >
              📄 仅使用文档内容
            </Button>
            <Button
              onClick={() => handleConfirmAutoMatch(true)}
              className="w-full sm:w-auto"
            >
              ✅ 自动匹配
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
