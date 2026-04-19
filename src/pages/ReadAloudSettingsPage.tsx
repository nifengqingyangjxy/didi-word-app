import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { getAllCollections } from '@/db/api';
import type { Collection } from '@/types';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

export default function ReadAloudSettingsPage() {
  const navigate = useNavigate();

  const [collections, setCollections] = useState<Collection[]>([]);
  const [selectedCollections, setSelectedCollections] = useState<string[]>([]);
  const [wordCount, setWordCount] = useState(0); // 初始值改为0，后续动态设置
  const [loading, setLoading] = useState(true);
  
  // 自动播放设置（从localStorage读取）
  const [autoPlayEnabled, setAutoPlayEnabled] = useState(() => {
    const saved = localStorage.getItem('readAloud_autoPlayEnabled');
    return saved !== null ? saved === 'true' : true; // 默认开启
  });
  
  const [autoPlayCount, setAutoPlayCount] = useState(() => {
    const saved = localStorage.getItem('readAloud_autoPlayCount');
    return saved !== null ? parseInt(saved) : 1; // 默认1次
  });

  // 保存自动播放开关到localStorage
  useEffect(() => {
    localStorage.setItem('readAloud_autoPlayEnabled', autoPlayEnabled.toString());
  }, [autoPlayEnabled]);

  // 保存播放次数到localStorage
  useEffect(() => {
    localStorage.setItem('readAloud_autoPlayCount', autoPlayCount.toString());
  }, [autoPlayCount]);

  useEffect(() => {
    loadCollections();
  }, []);

  // 当选择的章节改变时，自动更新单词数量为所选章节的总数
  useEffect(() => {
    if (selectedCollections.length > 0 && collections.length > 0) {
      const totalWords = getTotalWords();
      setWordCount(totalWords);
    }
  }, [selectedCollections, collections]);

  const loadCollections = async () => {
    try {
      const data = await getAllCollections();
      setCollections(data);
      
      // 不再默认选中任何章节，让用户自己选择
      // if (data.length > 0) {
      //   setSelectedCollections([data[0].id]);
      // }
    } catch (error) {
      console.error('加载章节失败:', error);
      toast.error('加载章节失败');
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

    console.log('开始跟读，参数:', {
      autoPlayEnabled,
      autoPlayCount,
    });

    const params = new URLSearchParams({
      collections: selectedCollections.join(','),
      count: wordCount.toString(),
      autoPlay: autoPlayEnabled.toString(),
      autoPlayCount: autoPlayCount.toString(),
    });

    console.log('URL参数:', params.toString());

    navigate(`/read-aloud?${params}`);
  };

  const getTotalWords = () => {
    return collections
      .filter(c => selectedCollections.includes(c.id))
      .reduce((sum, c) => sum + c.word_count, 0);
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
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/home')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold text-foreground">跟读学习设置</h1>
              <p className="text-sm text-muted-foreground">选择章节和单词数量</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto flex-1 px-4 py-6">
        <div className="mx-auto max-w-2xl space-y-6">
          {/* 章节选择 */}
          <Card className="border border-border p-6">
            <div className="space-y-4">
              <div>
                <Label className="text-base font-semibold">选择章节</Label>
                <p className="mt-1 text-sm text-muted-foreground">
                  可多选，已选章节共 {getTotalWords()} 个单词
                </p>
              </div>

              {collections.length === 0 ? (
                <p className="text-sm text-muted-foreground">暂无章节，请先添加单词</p>
              ) : (
                <div className="max-h-[350px] space-y-3 overflow-y-auto">
                  {collections.map((collection) => (
                    <div
                      key={collection.id}
                      className="flex items-center space-x-3 rounded-md border border-border p-3 transition-colors hover:bg-accent"
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
          <Card className="border border-border p-6">
            <div className="space-y-4">
              <div>
                <Label className="text-base font-semibold">单词数量</Label>
                <p className="mt-1 text-sm text-muted-foreground">
                  设置本次跟读的单词数量
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

          {/* 自动播放设置 */}
          <Card className="border border-border p-6">
            <div className="space-y-4">
              <div>
                <Label className="text-base font-semibold">自动播放设置</Label>
                <p className="mt-1 text-sm text-muted-foreground">
                  进入页面后自动播放英文发音和中文翻译
                </p>
              </div>

              <div className="space-y-4">
                {/* 自动播放开关 */}
                <div className="flex items-center justify-between rounded-md border border-border p-4">
                  <div className="space-y-0.5">
                    <Label htmlFor="auto-play" className="text-sm font-medium">
                      自动播放英文发音
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      进入即读英文→停顿600ms→读中文→停顿1s→重复
                    </p>
                  </div>
                  <Switch
                    id="auto-play"
                    checked={autoPlayEnabled}
                    onCheckedChange={setAutoPlayEnabled}
                  />
                </div>

                {/* 播放次数 */}
                {autoPlayEnabled && (
                  <div className="space-y-3">
                    <Label className="text-sm font-medium">播放次数</Label>
                    <div className="flex items-center gap-4">
                      <Slider
                        value={[autoPlayCount]}
                        onValueChange={(value) => setAutoPlayCount(value[0])}
                        min={1}
                        max={3}
                        step={1}
                        className="flex-1"
                      />
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          value={autoPlayCount}
                          onChange={(e) => {
                            const val = parseInt(e.target.value) || 1;
                            setAutoPlayCount(Math.max(1, Math.min(val, 3)));
                          }}
                          min={1}
                          max={3}
                          className="w-16 text-center"
                        />
                        <span className="text-sm text-muted-foreground">次</span>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      每个单词自动播放 {autoPlayCount} 次（英文+中文为1次）
                    </p>
                  </div>
                )}
              </div>
            </div>
          </Card>

          {/* 开始按钮 */}
          <Button
            onClick={handleStart}
            disabled={selectedCollections.length === 0 || getTotalWords() === 0}
            size="lg"
            className="w-full"
          >
            开始跟读
          </Button>
        </div>
      </main>
    </div>
  );
}
