import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { addWordsBatch, getAllCollections, createCollection } from '@/db/api';
import { supabase } from '@/db/supabase';
import type { Collection } from '@/types';
import { ArrowLeft, Loader2, Plus } from 'lucide-react';
import { toast } from 'sonner';

interface ParsedWord {
  word: string;
  phonetic: string | null;
  translation: string;
  part_of_speech: string | null;
  status: 'pending' | 'processing' | 'ready';
  hasError?: boolean; // 标记是否有错误
  errorMessage?: string; // 错误信息
}

// 验证单词是否有效
function validateWord(word: string): { valid: boolean; message?: string } {
  // 检查是否为空
  if (!word || !word.trim()) {
    return { valid: false, message: '单词不能为空' };
  }
  
  // 检查是否只包含字母
  if (!/^[a-zA-Z]+$/.test(word)) {
    return { valid: false, message: '单词只能包含英文字母' };
  }
  
  // 检查长度（1个字母的单词可能有效，如"a"、"I"）
  if (word.length > 45) {
    return { valid: false, message: '单词过长，可能不是有效单词' };
  }
  
  // 检查是否包含重复字母过多（可能是拼写错误）
  const repeatedPattern = /(.)\1{4,}/; // 同一字母连续出现5次以上
  if (repeatedPattern.test(word)) {
    return { valid: false, message: '单词包含过多重复字母' };
  }
  
  return { valid: true };
}

export default function AddWordPage() {
  const navigate = useNavigate();
  const [textInput, setTextInput] = useState('');
  const [parsedWords, setParsedWords] = useState<ParsedWord[]>([]);
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [selectedCollection, setSelectedCollection] = useState<string>('');
  const [newCollectionName, setNewCollectionName] = useState('');
  const [showNewCollection, setShowNewCollection] = useState(false);
  const [enableDedupe, setEnableDedupe] = useState(true);
  
  // 添加模式：'word' 表示单词模式，'phrase' 表示短语模式
  const [addMode, setAddMode] = useState<'word' | 'phrase'>('word');

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

  const handleParse = async () => {
    if (!textInput.trim()) {
      toast.error('请输入内容');
      return;
    }

    setParsing(true);
    const words = parseTextContent(textInput, addMode);
    setParsedWords(words);

    // 自动补充音标和翻译
    await autoCompleteWords(words);
    setParsing(false);
  };

  const parseTextContent = (text: string, mode: 'word' | 'phrase' = 'word'): ParsedWord[] => {
    const words: ParsedWord[] = [];
    const wordSet = new Set<string>(); // 用于去重

    // 首先检查是否是格式化的单词列表（包含音标或明确的单词-翻译格式）
    const lines = text.split('\n').filter(line => line.trim());
    let hasFormattedWords = false;

    // 检测是否有音标
    const hasPhonetic = text.match(/\/[^\/]+\/|\[[^\]]+\]/);
    
    // 检测是否有中文（表示有翻译）
    const hasChinese = /[\u4e00-\u9fa5]/.test(text);

    // 短语模式：直接按行解析，每行作为一个短语
    // 单词模式：如果有音标或中文，认为是格式化的单词列表
    if (mode === 'phrase' || hasPhonetic || hasChinese) {
      hasFormattedWords = true;
      
      for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine) continue;

        // 移除行首的序号（如 "1. ", "1、", "1) "等）
        const lineWithoutNumber = trimmedLine.replace(/^\d+[.、)]\s*/, '');

        let word = '';
        let phonetic: string | null = null;
        let translation = '';

        // 匹配音标
        const phoneticMatch = lineWithoutNumber.match(/\/[^\/]+\/|\[[^\]]+\]/);
        
        if (phoneticMatch) {
          const phoneticIndex = phoneticMatch.index!;
          const phoneticEnd = phoneticIndex + phoneticMatch[0].length;
          
          word = lineWithoutNumber.substring(0, phoneticIndex).trim();
          phonetic = phoneticMatch[0];
          translation = lineWithoutNumber.substring(phoneticEnd).trim();
        } else {
          // 没有音标，尝试分割单词和翻译
          // 查找第一个中文字符的位置
          const chineseMatch = lineWithoutNumber.match(/[\u4e00-\u9fa5]/);
          if (chineseMatch && chineseMatch.index !== undefined) {
            word = lineWithoutNumber.substring(0, chineseMatch.index).trim();
            translation = lineWithoutNumber.substring(chineseMatch.index).trim();
          } else {
            // 如果没有中文
            // 短语模式：整行作为单词/短语
            // 单词模式：尝试按空格分割
            if (mode === 'phrase') {
              word = lineWithoutNumber;
              translation = '';
            } else {
              // 单词模式：按空格分割
              const firstSpaceIndex = lineWithoutNumber.indexOf(' ');
              if (firstSpaceIndex > 0) {
                word = lineWithoutNumber.substring(0, firstSpaceIndex).trim();
                translation = lineWithoutNumber.substring(firstSpaceIndex + 1).trim();
              } else {
                word = lineWithoutNumber;
              }
            }
          }
        }

        // 过滤无效单词
        // 再次确保移除任何残留的序号
        word = word.replace(/^\d+[.、)]\s*/, '').trim();
        
        // 短语模式：保留所有包含英文字母的内容（包括空格、点号、省略号等）
        // 单词模式：只保留纯英文字母的单词
        const isValid = mode === 'phrase' 
          ? /[a-zA-Z]/.test(word) // 短语模式：只要包含字母即可
          : /^[a-zA-Z]+$/.test(word); // 单词模式：只能是纯字母
        
        if (word && isValid && !wordSet.has(word.toLowerCase())) {
          wordSet.add(word.toLowerCase());
          
          // 短语模式下不验证单词格式
          const validation = mode === 'phrase' 
            ? { valid: true }
            : validateWord(word);
          
          words.push({
            word: word.toLowerCase(),
            phonetic,
            translation: translation || '',
            part_of_speech: null,
            status: 'pending',
            hasError: !validation.valid,
            errorMessage: validation.message,
          });
        }
      }
    }

    // 如果没有格式化的单词列表，则从文章中提取所有英文单词
    // 注意：短语模式下不应该自动提取，因为短语需要用户明确输入
    if ((!hasFormattedWords || words.length === 0) && mode === 'word') {
      // 使用正则提取所有英文单词（2个字母以上）
      const wordMatches = text.match(/\b[a-zA-Z]{2,}\b/g);
      
      if (wordMatches) {
        for (const match of wordMatches) {
          const lowerWord = match.toLowerCase();
          
          // 过滤常见停用词和过短的单词
          if (!wordSet.has(lowerWord) && lowerWord.length >= 2) {
            wordSet.add(lowerWord);
            
            // 验证单词
            const validation = validateWord(lowerWord);
            
            words.push({
              word: lowerWord,
              phonetic: null,
              translation: '',
              part_of_speech: null,
              status: 'pending',
              hasError: !validation.valid,
              errorMessage: validation.message,
            });
          }
        }
      }
    }

    return words;
  };

  const autoCompleteWords = async (words: ParsedWord[]) => {
    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      
      if (word.phonetic && word.translation && word.part_of_speech) {
        word.status = 'ready';
        setParsedWords([...words]);
        continue;
      }

      word.status = 'processing';
      setParsedWords([...words]);

      try {
        const { data, error } = await supabase.functions.invoke('word-lookup', {
          body: { word: word.word },
        });

        if (error) {
          console.error(`查询单词 ${word.word} 失败:`, error);
          if (!word.translation) {
            word.translation = '（未找到释义）';
          }
        } else if (data) {
          console.log(`单词 ${word.word} 返回数据:`, data);
          if (!word.phonetic && data.phonetic) {
            word.phonetic = data.phonetic;
          }
          if (!word.translation && data.translation) {
            word.translation = data.translation;
          }
          if (!word.part_of_speech && data.part_of_speech) {
            word.part_of_speech = data.part_of_speech;
          }
          
          if (!word.translation) {
            word.translation = '（未找到释义）';
          }
        } else {
          if (!word.translation) {
            word.translation = '（未找到释义）';
          }
        }
      } catch (error) {
        console.error(`查询单词 ${word.word} 异常:`, error);
        if (!word.translation) {
          word.translation = '（未找到释义）';
        }
      }

      word.status = 'ready';
      setParsedWords([...words]);
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

  const handleSave = async () => {
    if (parsedWords.length === 0) {
      toast.error('没有可保存的单词');
      return;
    }

    if (!selectedCollection) {
      toast.error('请选择或创建章节');
      return;
    }

    const missingTranslation = parsedWords.filter(w => !w.translation);
    if (missingTranslation.length > 0) {
      toast.error('部分单词缺少翻译，请等待自动补充完成');
      return;
    }

    try {
      setSaving(true);
      const wordsToSave = parsedWords.map((w, index) => ({
        word: w.word,
        phonetic: w.phonetic,
        translation: w.translation,
        part_of_speech: w.part_of_speech,
        collection_id: selectedCollection,
        chapter_id: null, // 暂时不支持章节
        import_order: index + 1, // 添加导入顺序
      }));

      const result = await addWordsBatch(wordsToSave, enableDedupe);
      
      if (result.duplicates > 0) {
        toast.success(`成功添加 ${result.added.length} 个单词，${result.duplicates} 个重复单词已跳过`);
      } else {
        toast.success(`成功添加 ${result.added.length} 个单词`);
      }
      
      navigate('/words');
    } catch (error: any) {
      console.error('保存失败:', error);
      toast.error('保存失败');
    } finally {
      setSaving(false);
    }
  };

  const updateWord = (index: number, field: keyof ParsedWord, value: string) => {
    const updated = [...parsedWords];
    updated[index] = { ...updated[index], [field]: value };
    setParsedWords(updated);
  };

  return (
    <div className="flex min-h-screen w-full flex-col bg-background">
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/words')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-xl font-bold text-foreground">添加单词</h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto flex-1 px-4 py-6">
        {parsedWords.length === 0 ? (
          <Card className="mx-auto max-w-4xl border border-border p-6">
            <div className="space-y-4">
              {/* 模式选择按钮 */}
              <div className="flex gap-2 mb-4">
                <Button
                  variant={addMode === 'word' ? 'default' : 'outline'}
                  onClick={() => setAddMode('word')}
                  className="flex-1"
                >
                  手动添加单词
                </Button>
                <Button
                  variant={addMode === 'phrase' ? 'default' : 'outline'}
                  onClick={() => setAddMode('phrase')}
                  className="flex-1"
                >
                  手动添加短语
                </Button>
              </div>
              
              <div>
                <Label htmlFor="text-input">
                  {addMode === 'word' ? '输入单词内容' : '输入短语内容'}
                </Label>
                <p className="mt-1 text-sm text-muted-foreground">
                  {addMode === 'word' 
                    ? '支持多种格式：每行一个单词，或粘贴整段文章自动提取单词'
                    : '每行一个短语，短语将作为整体保存（如：be angry with sb.）'
                  }
                </p>
              </div>
              <Textarea
                id="text-input"
                placeholder={
                  addMode === 'word'
                    ? "示例：&#10;apple /ˈæpl/ 苹果&#10;banana /bəˈnɑːnə/ 香蕉&#10;或直接粘贴文章内容..."
                    : "示例：&#10;be angry with sb. /bi: ˈæŋɡri wɪð sb./ 生某人的气&#10;compare … to … /kəmˈpeə ... tuː .../ 把...比作...&#10;at least /æt li:st/ 至少"
                }
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                className="min-h-[300px] font-mono"
              />
              <Button onClick={handleParse} disabled={parsing} className="w-full">
                {parsing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {parsing ? '解析中...' : '开始解析'}
              </Button>
            </div>
          </Card>
        ) : (
          <div className="space-y-4">
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
                    <Label htmlFor="dedupe">自动去重</Label>
                    <p className="text-xs text-muted-foreground mt-1">
                      同一章节内去重，不同章节可以有相同单词
                    </p>
                  </div>
                  <Switch
                    id="dedupe"
                    checked={enableDedupe}
                    onCheckedChange={setEnableDedupe}
                  />
                </div>
              </div>
            </Card>

            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-foreground">
                预览列表 ({parsedWords.length} 个单词)
              </h3>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setParsedWords([])}>
                  重新输入
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={saving || parsedWords.some(w => w.status === 'processing')}
                >
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  保存到章节
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              {parsedWords.map((word, index) => (
                <Card 
                  key={index} 
                  className={`border p-3 ${word.hasError ? 'border-red-500 bg-red-50 dark:bg-red-950/20' : 'border-border'}`}
                >
                  {word.hasError && (
                    <div className="mb-2 flex items-center gap-2 text-xs md:text-sm text-red-600 dark:text-red-400">
                      <span className="font-medium">⚠️ {word.errorMessage}</span>
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
                          // 重新验证单词
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
                      <label className="text-xs text-muted-foreground">音标</label>
                      <input
                        type="text"
                        value={word.phonetic || ''}
                        onChange={(e) => updateWord(index, 'phonetic', e.target.value)}
                        className="w-full border-b border-border bg-transparent py-1 font-mono text-sm focus:border-primary focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">翻译</label>
                      <input
                        type="text"
                        value={word.translation}
                        onChange={(e) => updateWord(index, 'translation', e.target.value)}
                        className="w-full border-b border-border bg-transparent py-1 text-sm focus:border-primary focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">词性</label>
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
                      <input
                        type="text"
                        value={word.translation}
                        onChange={(e) => updateWord(index, 'translation', e.target.value)}
                        className="flex-1 min-w-0 border-b border-border bg-transparent py-0.5 text-sm focus:border-primary focus:outline-none"
                        placeholder="翻译"
                      />
                    </div>
                    
                    {/* 第二行：音标 | 词性 */}
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <input
                        type="text"
                        value={word.phonetic || ''}
                        onChange={(e) => updateWord(index, 'phonetic', e.target.value)}
                        className="flex-1 min-w-0 border-b border-border bg-transparent py-0.5 font-mono text-xs focus:border-primary focus:outline-none"
                        placeholder="音标"
                      />
                      <span>|</span>
                      <input
                        type="text"
                        value={word.part_of_speech || ''}
                        onChange={(e) => updateWord(index, 'part_of_speech', e.target.value)}
                        placeholder="词性"
                        className="w-16 border-b border-border bg-transparent py-0.5 text-xs focus:border-primary focus:outline-none"
                      />
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
