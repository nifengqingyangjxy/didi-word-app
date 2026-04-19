import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { getAllCollections, getSetting, getAllWrongWords } from '@/db/api';
import type { Collection } from '@/types';
import { ArrowLeft, Search } from 'lucide-react';
import { toast } from 'sonner';

export default function ChineseEnglishModeSelectPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const mode = searchParams.get('mode') || 'chinese_english';

  const [collections, setCollections] = useState<Collection[]>([]);
  const [selectedCollections, setSelectedCollections] = useState<string[]>([]);
  const [wordCount, setWordCount] = useState(0); // 初始值改为0，后续动态设置
  const [loading, setLoading] = useState(true);
  
  // 章节搜索状态
  const [collectionSearchQuery, setCollectionSearchQuery] = useState('');
  
  // 词组筛选状态
  const [includePhrases, setIncludePhrases] = useState(true); // 是否包含词组
  
  // 易错词插入相关状态
  const [wrongWordInsertionEnabled, setWrongWordInsertionEnabled] = useState(false);
  const [wrongWordInsertionCount, setWrongWordInsertionCount] = useState(10);
  const [wrongWordInsertionChecked, setWrongWordInsertionChecked] = useState(false);
  const [wrongWordsAvailable, setWrongWordsAvailable] = useState(0);

  useEffect(() => {
    loadData();
  }, []);

  // 当选择的章节改变时，自动更新单词数量为所选章节的总数
  useEffect(() => {
    if (selectedCollections.length > 0 && collections.length > 0) {
      const totalWords = getTotalWords();
      setWordCount(totalWords);
    }
  }, [selectedCollections, collections]);

  const loadData = async () => {
    try {
      const [collectionsData, insertionEnabled, insertionCount, wrongWords] = await Promise.all([
        getAllCollections(),
        getSetting('wrong_word_insertion_enabled'),
        getSetting('wrong_word_insertion_count'),
        getAllWrongWords(),
      ]);
      
      setCollections(collectionsData);
      
      // 不再默认选中任何章节，让用户自己选择
      // if (collectionsData.length > 0) {
      //   setSelectedCollections([collectionsData[0].id]);
      //   setWordCount(collectionsData[0].word_count || 0);
      // }
      
      // 设置易错词插入状态
      const enabled = insertionEnabled === 'true';
      console.log('易错词插入设置 - enabled:', enabled, 'insertionEnabled:', insertionEnabled);
      setWrongWordInsertionEnabled(enabled);
      setWrongWordInsertionCount(Number(insertionCount) || 10);
      setWrongWordInsertionChecked(enabled); // 如果功能开启，默认勾选
      console.log('易错词插入状态已设置 - wrongWordInsertionChecked:', enabled);
      setWrongWordsAvailable(wrongWords.length);
    } catch (error) {
      console.error('加载数据失败:', error);
      toast.error('加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  const handleCollectionToggle = (collectionId: string) => {
    setSelectedCollections(prev => {
      if (prev.includes(collectionId)) {
        return prev.filter(id => id !== collectionId);
      } else {
        return [...prev, collectionId];
      }
    });
  };

  const handleStart = () => {
    if (selectedCollections.length === 0) {
      toast.error('请至少选择一个章节');
      return;
    }

    if (wordCount < 1) {
      toast.error('单词数量至少为1');
      return;
    }

    const params = new URLSearchParams({
      collections: selectedCollections.join(','),
      count: wordCount.toString(),
      wrongWordInsertion: wrongWordInsertionChecked ? 'true' : 'false',
      wrongWordCount: wrongWordInsertionCount.toString(),
      includePhrases: includePhrases ? 'true' : 'false', // 添加词组筛选参数
    });

    if (mode === 'english_chinese') {
      navigate(`/english-chinese-quiz?${params}`);
    } else if (mode === 'chinese_english') {
      navigate(`/chinese-english-quiz?${params}`);
    } else if (mode === 'mixed') {
      navigate(`/mixed-quiz?${params}`);
    }
  };
  
  const getActualWrongWordCount = () => {
    if (!wrongWordInsertionChecked || !wrongWordInsertionEnabled) return 0;
    return Math.min(wrongWordInsertionCount, wrongWordsAvailable);
  };
  
  const getTotalWordCount = () => {
    return wordCount + getActualWrongWordCount();
  };

  const getTotalWords = () => {
    return collections
      .filter(c => selectedCollections.includes(c.id))
      .reduce((sum, c) => sum + c.word_count, 0);
  };
  
  // 过滤章节列表
  const filteredCollections = collections.filter(collection => 
    collection.name.toLowerCase().includes(collectionSearchQuery.toLowerCase())
  );

  const modeTitle = mode === 'chinese_english' 
    ? '英汉模式' 
    : mode === 'chinese_english' 
      ? '汉英模式' 
      : '混合模式';

  const modeDescription = mode === 'chinese_english'
    ? '看英文选中文'
    : mode === 'chinese_english'
      ? '看中文填英文'
      : '随机出现英汉或汉英题目';

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-muted-foreground">加载中...</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full flex-col bg-background">
      <header className="border-b-2 border-border/50 bg-gradient-card shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/study-mode-select')} className="hover:bg-primary/10">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold text-foreground">{modeTitle}</h1>
              <p className="text-sm text-muted-foreground">{modeDescription}</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto flex-1 px-4 py-6">
        <div className="mx-auto max-w-2xl space-y-6">
          {/* 章节选择 */}
          <Card className="card-shadow border-2 border-border/50 bg-gradient-card p-6">
            <div className="space-y-4">
              <div>
                <Label className="text-base font-bold">选择章节</Label>
                <p className="mt-1 text-sm text-muted-foreground">
                  可多选，已选章节共 {getTotalWords()} 个单词
                </p>
              </div>

              {/* 搜索框 */}
              {collections.length > 0 && (
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="搜索章节名称..."
                    value={collectionSearchQuery}
                    onChange={(e) => setCollectionSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
              )}

              {collections.length === 0 ? (
                <p className="text-sm text-muted-foreground">暂无章节，请先添加单词</p>
              ) : filteredCollections.length === 0 ? (
                <p className="text-sm text-muted-foreground">未找到匹配的章节</p>
              ) : (
                <div className="max-h-[350px] space-y-3 overflow-y-auto rounded-md border-2 border-border/50 p-3">
                  {filteredCollections.map((collection) => (
                    <div
                      key={collection.id}
                      className="flex items-center space-x-3 rounded-lg border-2 border-border/50 bg-gradient-card p-3 transition-all hover:border-primary/50 hover:shadow-sm"
                    >
                      <Checkbox
                        id={collection.id}
                        checked={selectedCollections.includes(collection.id)}
                        onCheckedChange={() => handleCollectionToggle(collection.id)}
                      />
                      <label
                        htmlFor={collection.id}
                        className="flex-1 cursor-pointer text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        {collection.name}
                        <span className="ml-2 text-muted-foreground">({collection.word_count}词)</span>
                      </label>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>

          {/* 单词数量设置 */}
          <Card className="card-shadow border-2 border-border/50 bg-gradient-card p-6">
            <div className="space-y-4">
              <div>
                <Label className="text-base font-bold">单词数量</Label>
                <p className="mt-1 text-sm text-muted-foreground">
                  设置本次学习的单词数量
                </p>
              </div>

              <div className="space-y-4">
                <Slider
                  value={[wordCount]}
                  onValueChange={(value) => setWordCount(value[0])}
                  min={1}
                  max={getTotalWords() || 1}
                  step={1}
                  className="w-full"
                />

                <div className="flex items-center gap-4">
                  <Label htmlFor="word-count-input" className="whitespace-nowrap">
                    数量：
                  </Label>
                  <Input
                    id="word-count-input"
                    type="number"
                    value={wordCount}
                    onChange={(e) => {
                      const val = parseInt(e.target.value) || 1;
                      setWordCount(Math.max(1, Math.min(val, getTotalWords() || 1)));
                    }}
                    min={1}
                    max={getTotalWords() || 1}
                    className="w-24"
                  />
                  <span className="text-sm text-muted-foreground">个单词</span>
                </div>
              </div>
            </div>
          </Card>

          {/* 词组筛选选项 */}
          <Card className="card-shadow border-2 border-border/50 bg-gradient-card p-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Checkbox
                    id="include-phrases"
                    checked={includePhrases}
                    onCheckedChange={(checked) => setIncludePhrases(checked as boolean)}
                  />
                  <div>
                    <Label 
                      htmlFor="include-phrases" 
                      className="text-base font-semibold"
                    >
                      包含词组
                    </Label>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {includePhrases 
                        ? '学习内容包含单词和词组（如 "go through"）' 
                        : '仅学习单个单词，过滤所有词组'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {/* 易错词插入选项 */}
          <Card className="card-shadow border-2 border-border/50 bg-gradient-card p-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Checkbox
                    id="wrong-word-insertion"
                    checked={wrongWordInsertionChecked}
                    onCheckedChange={(checked) => {
                      console.log('易错词插入Checkbox点击 - checked:', checked, 'type:', typeof checked);
                      if (typeof checked === 'boolean') {
                        console.log('设置易错词插入状态为:', checked);
                        setWrongWordInsertionChecked(checked);
                      }
                    }}
                    disabled={!wrongWordInsertionEnabled}
                  />
                  <div>
                    <Label 
                      htmlFor="wrong-word-insertion" 
                      className={`text-base font-bold ${!wrongWordInsertionEnabled ? 'text-muted-foreground' : ''}`}
                    >
                      易错词插入
                    </Label>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {wrongWordInsertionEnabled 
                        ? `从易错词库中随机加入 ${getActualWrongWordCount()} 个单词` 
                        : '（可在设置页面中开启本功能）'}
                    </p>
                  </div>
                </div>
              </div>
              
              {wrongWordInsertionChecked && wrongWordInsertionEnabled && (
                <div className="rounded-md bg-muted p-3 text-sm">
                  <p className="text-foreground">
                    本次学习单词数量为 <span className="font-semibold text-primary">{wordCount}</span> 个单词，
                    易错词 <span className="font-semibold text-destructive">{getActualWrongWordCount()}</span> 个，
                    共计 <span className="font-semibold text-primary">{getTotalWordCount()}</span> 个
                  </p>
                  {wrongWordsAvailable < wrongWordInsertionCount && (
                    <p className="mt-2 text-muted-foreground">
                      （易错词库仅有 {wrongWordsAvailable} 个单词）
                    </p>
                  )}
                </div>
              )}
            </div>
          </Card>

          {/* 开始按钮 */}
          <Button
            onClick={handleStart}
            disabled={selectedCollections.length === 0 || getTotalWords() === 0}
            size="lg"
            className="w-full"
          >
            开始记忆
          </Button>
        </div>
      </main>
    </div>
  );
}
