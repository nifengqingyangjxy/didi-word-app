import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Slider } from '@/components/ui/slider';
import { getAllWrongWords, getMaxWrongWordWeight } from '@/db/api';
import { ArrowLeft, Plus, Minus, BookOpen } from 'lucide-react';
import { toast } from 'sonner';

export default function WrongWordsPracticeChineseEnglishSettingsPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [totalWrongWords, setTotalWrongWords] = useState(0);
  const [maxWeight, setMaxWeight] = useState(1);
  const [practiceCount, setPracticeCount] = useState(0); // 初始值为0，加载后设置为totalWrongWords
  const [filterByWeight, setFilterByWeight] = useState(false);
  const [selectedWeight, setSelectedWeight] = useState(3);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [wrongWords, maxWeightValue] = await Promise.all([
        getAllWrongWords(),
        getMaxWrongWordWeight(),
      ]);

      setTotalWrongWords(wrongWords.length);
      setMaxWeight(maxWeightValue);
      setSelectedWeight(Math.min(3, maxWeightValue));
      // 设置默认练习数量为库中最大单词数
      setPracticeCount(wrongWords.length);
    } catch (error) {
      console.error('加载数据失败:', error);
      toast.error('加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  const handleStart = () => {
    if (totalWrongWords === 0) {
      toast.error('暂无易错词');
      return;
    }

    const params = new URLSearchParams({
      count: practiceCount.toString(),
      filterByWeight: filterByWeight.toString(),
      maxWeight: selectedWeight.toString(),
      mode: 'chinese-english', // 添加模式参数
    });

    navigate(`/wrong-words/practice?${params.toString()}`);
  };

  const handleWeightDecrease = () => {
    setSelectedWeight(prev => Math.max(1, prev - 1));
  };

  const handleWeightIncrease = () => {
    setSelectedWeight(prev => Math.min(maxWeight, prev + 1));
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="text-lg text-muted-foreground">加载中...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/wrong-words/practice/mode-selection')}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold">汉英模式设置</h1>
          <div className="w-10" />
        </div>
      </header>

      <main className="container mx-auto flex-1 px-4 py-6">
        <div className="mx-auto max-w-2xl space-y-6">
          {/* 统计信息 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5" />
                易错词库统计
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-lg bg-muted p-4">
                  <div className="text-sm text-muted-foreground">总单词数</div>
                  <div className="mt-1 text-2xl font-bold text-primary">{totalWrongWords}</div>
                </div>
                <div className="rounded-lg bg-muted p-4">
                  <div className="text-sm text-muted-foreground">最高权重</div>
                  <div className="mt-1 text-2xl font-bold text-destructive">{maxWeight}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 练习设置 */}
          <Card>
            <CardHeader>
              <CardTitle>练习设置</CardTitle>
              <CardDescription>设置本次练习的参数</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* 练习数量 */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>练习数量</Label>
                  <span className="text-2xl font-bold text-primary">{practiceCount}</span>
                </div>
                <Slider
                  value={[practiceCount]}
                  onValueChange={(value) => setPracticeCount(value[0])}
                  min={1}
                  max={totalWrongWords}
                  step={1}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>1 个单词</span>
                  <span>{totalWrongWords} 个单词</span>
                </div>
              </div>

              {/* 按权重筛选 */}
              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="filter-by-weight"
                    checked={filterByWeight}
                    onCheckedChange={(checked) => setFilterByWeight(checked as boolean)}
                  />
                  <Label
                    htmlFor="filter-by-weight"
                    className="cursor-pointer text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    按权重随机
                  </Label>
                </div>

                {filterByWeight && (
                  <div className="ml-6 space-y-2">
                    <Label>权重上限</Label>
                    <div className="flex items-center gap-4">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={handleWeightDecrease}
                        disabled={selectedWeight <= 1}
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                      <div className="flex h-10 w-20 items-center justify-center rounded-md border border-border bg-muted">
                        <span className="text-lg font-semibold">{selectedWeight}</span>
                      </div>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={handleWeightIncrease}
                        disabled={selectedWeight >= maxWeight}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                      <span className="text-sm text-muted-foreground">
                        范围: 1 - {maxWeight}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      从权重 ≤ {selectedWeight} 的单词中随机选择 {practiceCount} 个单词进行练习
                    </p>
                  </div>
                )}

                {!filterByWeight && (
                  <p className="ml-6 text-sm text-muted-foreground">
                    从所有易错词中随机选择 {practiceCount} 个单词进行练习
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* 开始按钮 */}
          <Button
            className="w-full"
            size="lg"
            onClick={handleStart}
            disabled={totalWrongWords === 0}
          >
            {totalWrongWords === 0 ? '暂无易错词' : '开始练习'}
          </Button>
        </div>
      </main>
    </div>
  );
}
