import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { getWordsByCollection, updateWord, deleteWord, getCollectionById, addWord } from '@/db/api';
import { supabase } from '@/db/supabase';
import type { Word, Collection } from '@/types';
import { ArrowLeft, Trash2, Save, Plus, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function EditCollectionPage() {
  const navigate = useNavigate();
  const { collectionId } = useParams<{ collectionId: string }>();
  const [collection, setCollection] = useState<Collection | null>(null);
  const [words, setWords] = useState<Word[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // 新建单词相关状态
  const [newWords, setNewWords] = useState<Array<{
    id: string; // 临时ID
    word: string;
    phonetic: string | null;
    translation: string;
    part_of_speech: string | null;
    isNew: boolean;
    isLoading: boolean;
  }>>([]);

  useEffect(() => {
    if (collectionId) {
      loadData();
    }
  }, [collectionId]);

  const loadData = async () => {
    if (!collectionId) return;

    try {
      setLoading(true);
      const [collectionData, wordsData] = await Promise.all([
        getCollectionById(collectionId),
        getWordsByCollection(collectionId),
      ]);
      setCollection(collectionData || null);
      
      // 排序：需要审查的单词靠前
      const sortedWords = wordsData.sort((a, b) => {
        if (a.needs_review && !b.needs_review) return -1;
        if (!a.needs_review && b.needs_review) return 1;
        return 0;
      });
      
      setWords(sortedWords);
    } catch (error) {
      console.error('加载数据失败:', error);
      toast.error('加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateWord = (index: number, field: keyof Word, value: string) => {
    const updated = [...words];
    updated[index] = { ...updated[index], [field]: value };
    
    // 如果用户修改了单词或翻译，自动清除needs_review标记
    if ((field === 'word' || field === 'translation') && updated[index].needs_review) {
      updated[index].needs_review = false;
      updated[index].review_reason = null;
    }
    
    setWords(updated);
  };

  const handleDeleteWord = async (wordId: string) => {
    try {
      await deleteWord(wordId);
      setWords(words.filter(w => w.id !== wordId));
      toast.success('删除成功');
    } catch (error) {
      console.error('删除失败:', error);
      toast.error('删除失败');
    }
  };
  
  // 添加新建单词行
  const handleAddNewWordRow = () => {
    const tempId = `temp-${Date.now()}`;
    setNewWords([...newWords, {
      id: tempId,
      word: '',
      phonetic: null,
      translation: '',
      part_of_speech: null,
      isNew: true,
      isLoading: false,
    }]);
  };
  
  // 更新新建单词的字段
  const handleUpdateNewWord = (id: string, field: string, value: string) => {
    setNewWords(newWords.map(w => 
      w.id === id ? { ...w, [field]: value } : w
    ));
  };
  
  // 删除新建单词行
  const handleDeleteNewWordRow = (id: string) => {
    setNewWords(newWords.filter(w => w.id !== id));
  };
  
  // 自动补充单词信息
  const handleAutoComplete = async (id: string) => {
    // 使用函数式更新获取最新的newWords
    let targetWord: typeof newWords[0] | undefined;
    setNewWords(prev => {
      targetWord = prev.find(w => w.id === id);
      return prev;
    });
    
    if (!targetWord || !targetWord.word.trim()) {
      toast.error('请先输入单词');
      return;
    }
    
    // 设置加载状态
    setNewWords(prev => prev.map(w => 
      w.id === id ? { ...w, isLoading: true } : w
    ));
    
    try {
      const { data, error } = await supabase.functions.invoke('word-lookup', {
        body: { word: targetWord.word.trim() },
      });
      
      if (error) {
        console.error('查询单词失败:', error);
        toast.error('自动补充失败');
        setNewWords(prev => prev.map(w => 
          w.id === id ? { ...w, isLoading: false } : w
        ));
      } else if (data) {
        // 使用函数式更新确保状态正确
        setNewWords(prev => prev.map(w => {
          if (w.id === id) {
            return {
              ...w,
              phonetic: data.phonetic || w.phonetic,
              translation: data.translation || w.translation,
              part_of_speech: data.part_of_speech || w.part_of_speech,
              isLoading: false,
            };
          }
          return w;
        }));
        toast.success('自动补充成功');
      } else {
        setNewWords(prev => prev.map(w => 
          w.id === id ? { ...w, isLoading: false } : w
        ));
        toast.warning('未找到该单词的释义');
      }
    } catch (error) {
      console.error('自动补充失败:', error);
      toast.error('自动补充失败');
      setNewWords(prev => prev.map(w => 
        w.id === id ? { ...w, isLoading: false } : w
      ));
    }
  };

  // 检测单词输入是否有明显错误
  const validateWordInput = (word: string): { isValid: boolean; message: string } => {
    const trimmedWord = word.trim();
    
    // 检查是否为空
    if (!trimmedWord) {
      return { isValid: false, message: '单词不能为空' };
    }
    
    // 检查是否只包含数字
    if (/^\d+$/.test(trimmedWord)) {
      return { isValid: false, message: '单词不能只包含数字' };
    }
    
    // 检查是否包含中文字符
    if (/[\u4e00-\u9fa5]/.test(trimmedWord)) {
      return { isValid: false, message: '单词不应包含中文字符' };
    }
    
    // 检查是否包含特殊字符（允许字母、空格、连字符、撇号、点号）
    if (!/^[a-zA-Z\s\-'.]+$/.test(trimmedWord)) {
      return { isValid: false, message: '单词包含非法字符' };
    }
    
    // 检查是否过长（超过100个字符）
    if (trimmedWord.length > 100) {
      return { isValid: false, message: '单词过长（超过100个字符）' };
    }
    
    return { isValid: true, message: '' };
  };

  const handleSave = async () => {
    if (!collectionId) return;
    
    // 验证新建单词
    const invalidWords: string[] = [];
    const emptyTranslations: string[] = [];
    
    for (const newWord of newWords) {
      if (!newWord.word.trim()) {
        continue; // 跳过空单词
      }
      
      // 验证单词格式
      const validation = validateWordInput(newWord.word);
      if (!validation.isValid) {
        invalidWords.push(`"${newWord.word}": ${validation.message}`);
      }
      
      // 检查翻译是否为空
      if (!newWord.translation || !newWord.translation.trim()) {
        emptyTranslations.push(newWord.word);
      }
    }
    
    // 如果有格式错误的单词，询问用户是否继续
    if (invalidWords.length > 0) {
      const confirmed = window.confirm(
        `检测到以下单词可能有错误：\n\n${invalidWords.join('\n')}\n\n是否仍要保存？点击"确定"继续保存，点击"取消"返回修改。`
      );
      if (!confirmed) {
        setSaving(false);
        return;
      }
    }
    
    // 如果有翻译为空的单词，提示用户必须填写
    if (emptyTranslations.length > 0) {
      toast.error(
        `以下单词缺少中文翻译，请补充后再保存：\n${emptyTranslations.join('、')}`
      );
      setSaving(false);
      return;
    }
    
    try {
      setSaving(true);
      
      // 1. 更新所有现有单词
      for (const word of words) {
        // 检查单词是否还需要审查
        const needsReview = !word.translation || word.translation.trim() === '' || word.translation === '(未找到释义)';
        
        await updateWord(word.id, {
          word: word.word,
          phonetic: word.phonetic,
          translation: word.translation,
          part_of_speech: word.part_of_speech,
          needs_review: needsReview,
          review_reason: needsReview ? '缺少翻译' : null,
        });
      }
      
      // 2. 添加所有新建单词
      for (const newWord of newWords) {
        if (!newWord.word.trim()) {
          continue; // 跳过空单词
        }
        
        // 此时翻译已经验证过不为空
        const translation = newWord.translation.trim();
        const phonetic = newWord.phonetic;
        const part_of_speech = newWord.part_of_speech;
        
        // 获取当前最大import_order
        const allWords = await getWordsByCollection(collectionId);
        const maxOrder = allWords.length > 0 
          ? Math.max(...allWords.map(w => w.import_order || 0))
          : 0;
        
        await addWord({
          word: newWord.word.trim().toLowerCase(),
          phonetic: phonetic,
          translation: translation,
          part_of_speech: part_of_speech,
          collection_id: collectionId,
          chapter_id: null,
          import_order: maxOrder + 1,
          needs_review: false,
          review_reason: null,
        });
      }

      toast.success('保存成功');
      navigate('/words');
    } catch (error) {
      console.error('保存失败:', error);
      toast.error('保存失败');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-muted-foreground">加载中...</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full flex-col bg-background">
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate('/words')}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-xl font-bold text-foreground">编辑章节</h1>
                <p className="text-sm text-muted-foreground">{collection?.name}</p>
              </div>
            </div>
            <Button onClick={handleSave} disabled={saving} className="gap-2">
              <Save className="h-4 w-4" />
              {saving ? '保存中...' : '保存修改'}
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto flex-1 px-4 py-6">
        {/* 新建单词按钮 */}
        <div className="mb-4">
          <Button onClick={handleAddNewWordRow} variant="outline" className="gap-2">
            <Plus className="h-4 w-4" />
            新建单词
          </Button>
        </div>
        
        <div className="space-y-2">
          {/* 新建单词列表 */}
          {newWords.map((newWord) => (
            <Card key={newWord.id} className="border border-dashed border-primary p-3 bg-primary/5">
              <div className="flex items-start gap-2">
                {/* 桌面端：4列网格布局 + 自动补充按钮 */}
                <div className="hidden md:grid md:flex-1 md:gap-3 md:grid-cols-5">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">单词 *</label>
                    <Input
                      value={newWord.word}
                      onChange={(e) => handleUpdateNewWord(newWord.id, 'word', e.target.value)}
                      className="h-9"
                      placeholder="输入单词或短语"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">音标</label>
                    <Input
                      value={newWord.phonetic || ''}
                      onChange={(e) => handleUpdateNewWord(newWord.id, 'phonetic', e.target.value)}
                      className="h-9 font-mono"
                      placeholder="自动补充"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">翻译</label>
                    <Input
                      value={newWord.translation}
                      onChange={(e) => handleUpdateNewWord(newWord.id, 'translation', e.target.value)}
                      className="h-9"
                      placeholder="自动补充"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">词性</label>
                    <Input
                      value={newWord.part_of_speech || ''}
                      onChange={(e) => handleUpdateNewWord(newWord.id, 'part_of_speech', e.target.value)}
                      className="h-9"
                      placeholder="自动补充"
                    />
                  </div>
                  <div className="flex items-end">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => handleAutoComplete(newWord.id)}
                      disabled={newWord.isLoading || !newWord.word.trim()}
                      className="h-9 w-full"
                    >
                      {newWord.isLoading ? (
                        <>
                          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                          补充中
                        </>
                      ) : (
                        '自动补充'
                      )}
                    </Button>
                  </div>
                </div>

                {/* 移动端：垂直布局 */}
                <div className="flex flex-1 flex-col gap-2 md:hidden">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">单词 *</label>
                    <Input
                      value={newWord.word}
                      onChange={(e) => handleUpdateNewWord(newWord.id, 'word', e.target.value)}
                      className="h-9"
                      placeholder="输入单词或短语"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-muted-foreground">音标</label>
                      <Input
                        value={newWord.phonetic || ''}
                        onChange={(e) => handleUpdateNewWord(newWord.id, 'phonetic', e.target.value)}
                        className="h-9 font-mono"
                        placeholder="自动补充"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-muted-foreground">词性</label>
                      <Input
                        value={newWord.part_of_speech || ''}
                        onChange={(e) => handleUpdateNewWord(newWord.id, 'part_of_speech', e.target.value)}
                        className="h-9"
                        placeholder="自动补充"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">翻译</label>
                    <Input
                      value={newWord.translation}
                      onChange={(e) => handleUpdateNewWord(newWord.id, 'translation', e.target.value)}
                      className="h-9"
                      placeholder="自动补充"
                    />
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => handleAutoComplete(newWord.id)}
                    disabled={newWord.isLoading || !newWord.word.trim()}
                    className="w-full"
                  >
                    {newWord.isLoading ? (
                      <>
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                        补充中
                      </>
                    ) : (
                      '自动补充'
                    )}
                  </Button>
                </div>

                {/* 删除按钮 */}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDeleteNewWordRow(newWord.id)}
                  className="h-9 w-9 shrink-0 text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </Card>
          ))}
          
          {/* 现有单词列表 */}
          {words.map((word, index) => (
            <Card 
              key={word.id} 
              className={`border p-3 ${word.needs_review ? 'border-red-500 bg-red-50 dark:bg-red-950/20' : 'border-border'}`}
            >
              {word.needs_review && word.review_reason && (
                <div className="mb-2 flex items-center gap-2 text-xs text-red-600 dark:text-red-400">
                  <span className="font-medium">⚠️ 需要审查：</span>
                  <span>{word.review_reason}</span>
                </div>
              )}
              <div className="flex items-start gap-2">
                {/* 桌面端：4列网格布局 */}
                <div className="hidden md:grid md:flex-1 md:gap-3 md:grid-cols-4">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">单词</label>
                    <Input
                      value={word.word}
                      onChange={(e) => handleUpdateWord(index, 'word', e.target.value)}
                      className={`h-9 ${word.needs_review ? 'border-red-500 text-red-600 dark:text-red-400 font-semibold' : ''}`}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">音标</label>
                    <Input
                      value={word.phonetic || ''}
                      onChange={(e) => handleUpdateWord(index, 'phonetic', e.target.value)}
                      className="h-9 font-mono"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">翻译</label>
                    <Input
                      value={word.translation}
                      onChange={(e) => handleUpdateWord(index, 'translation', e.target.value)}
                      className={`h-9 ${word.needs_review ? 'border-red-500' : ''}`}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">词性</label>
                    <Input
                      value={word.part_of_speech || ''}
                      onChange={(e) => handleUpdateWord(index, 'part_of_speech', e.target.value)}
                      placeholder="n./v./adj."
                      className="h-9"
                    />
                  </div>
                </div>

                {/* 移动端：紧凑的横向布局 */}
                <div className="md:hidden flex-1 min-w-0 space-y-1.5">
                  {/* 第一行：单词 - 翻译 */}
                  <div className="flex items-center gap-2">
                    <Input
                      value={word.word}
                      onChange={(e) => handleUpdateWord(index, 'word', e.target.value)}
                      className={`flex-shrink-0 w-24 h-8 text-sm font-medium ${word.needs_review ? 'border-red-500 text-red-600 dark:text-red-400 font-semibold' : ''}`}
                      placeholder="单词"
                    />
                    <span className="text-muted-foreground">-</span>
                    <Input
                      value={word.translation}
                      onChange={(e) => handleUpdateWord(index, 'translation', e.target.value)}
                      className={`flex-1 min-w-0 h-8 text-sm ${word.needs_review ? 'border-red-500' : ''}`}
                      placeholder="翻译"
                    />
                  </div>
                  
                  {/* 第二行：音标 | 词性 */}
                  <div className="flex items-center gap-2">
                    <Input
                      value={word.phonetic || ''}
                      onChange={(e) => handleUpdateWord(index, 'phonetic', e.target.value)}
                      className="flex-1 min-w-0 h-7 font-mono text-xs"
                      placeholder="音标"
                    />
                    <span className="text-xs text-muted-foreground">|</span>
                    <Input
                      value={word.part_of_speech || ''}
                      onChange={(e) => handleUpdateWord(index, 'part_of_speech', e.target.value)}
                      placeholder="词性"
                      className="w-16 h-7 text-xs"
                    />
                  </div>
                </div>

                {/* 删除按钮 */}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDeleteWord(word.id)}
                  className="h-6 w-6 md:h-9 md:w-9 md:mt-6 shrink-0 text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="h-3 w-3 md:h-4 md:w-4" />
                </Button>
              </div>
            </Card>
          ))}
        </div>

        {words.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground">该章节暂无单词</p>
          </div>
        )}
      </main>
    </div>
  );
}
