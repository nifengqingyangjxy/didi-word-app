import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { getAllWrongWords, searchWrongWords, getWrongWordsHistory, deleteWrongWordsBatch } from '@/db/api';
import type { WrongWord, WrongWordHistory } from '@/types';
import { ArrowLeft, Play, ArrowUpDown, Trash2, Edit } from 'lucide-react';
import { toast } from 'sonner';

export default function WrongWordsPage() {
  const navigate = useNavigate();
  const [wrongWords, setWrongWords] = useState<WrongWord[]>([]);
  const [wrongWordsHistory, setWrongWordsHistory] = useState<WrongWordHistory[]>([]);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [loading, setLoading] = useState(true);
  const [selectedWords, setSelectedWords] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  // 实时搜索
  useEffect(() => {
    const timer = setTimeout(() => {
      handleSearch();
    }, 300);
    return () => clearTimeout(timer);
  }, [searchKeyword, sortOrder]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [wrongWordsData, historyData] = await Promise.all([
        getAllWrongWords('weight', sortOrder),
        getWrongWordsHistory(),
      ]);
      setWrongWords(wrongWordsData);
      setWrongWordsHistory(historyData);
    } catch (error) {
      console.error('加载数据失败:', error);
      toast.error('加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    try {
      if (!searchKeyword.trim()) {
        const data = await getAllWrongWords('weight', sortOrder);
        setWrongWords(data);
      } else {
        const data = await searchWrongWords(searchKeyword.trim(), 'weight', sortOrder);
        setWrongWords(data);
      }
    } catch (error) {
      console.error('搜索失败:', error);
    }
  };

  const handleSortChange = (value: string) => {
    setSortOrder(value as 'asc' | 'desc');
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allWordIds = new Set(wrongWords.map(w => w.word_id));
      setSelectedWords(allWordIds);
    } else {
      setSelectedWords(new Set());
    }
  };

  const handleSelectWord = (wordId: string, checked: boolean) => {
    const newSelected = new Set(selectedWords);
    if (checked) {
      newSelected.add(wordId);
    } else {
      newSelected.delete(wordId);
    }
    setSelectedWords(newSelected);
  };

  const handleBatchDelete = async () => {
    if (selectedWords.size === 0) {
      toast.error('请先选择要删除的单词');
      return;
    }

    // 显示确认对话框
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    try {
      setDeleting(true);
      await deleteWrongWordsBatch(Array.from(selectedWords));
      toast.success(`已删除 ${selectedWords.size} 个易错词`);
      setSelectedWords(new Set());
      setShowDeleteConfirm(false);
      setMaintenanceMode(false);
      await loadData();
    } catch (error) {
      console.error('删除失败:', error);
      toast.error('删除失败');
    } finally {
      setDeleting(false);
    }
  };

  const toggleMaintenanceMode = () => {
    setMaintenanceMode(!maintenanceMode);
    setSelectedWords(new Set());
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
              onClick={() => navigate('/home')}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-xl font-bold text-foreground">易错词库</h1>
          </div>
        </div>
      </header>

      {/* 操作栏 */}
      <div className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-1 gap-2">
              <Input
                placeholder="输入单词搜索..."
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                className="max-w-md"
              />
              <Select value={sortOrder} onValueChange={handleSortChange}>
                <SelectTrigger className="w-[140px]">
                  <ArrowUpDown className="mr-2 h-4 w-4" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="desc">权重降序</SelectItem>
                  <SelectItem value="asc">权重升序</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button 
                onClick={() => navigate('/wrong-words/practice/mode-selection')} 
                disabled={wrongWords.length === 0 || maintenanceMode}
              >
                <Play className="mr-2 h-4 w-4" />
                开始专项练习
              </Button>
              <Button
                variant={maintenanceMode ? "default" : "outline"}
                onClick={toggleMaintenanceMode}
                disabled={wrongWords.length === 0}
              >
                <Edit className="mr-2 h-4 w-4" />
                易错词维护
              </Button>
              {maintenanceMode && selectedWords.size > 0 && (
                <Button
                  variant="destructive"
                  onClick={handleBatchDelete}
                  disabled={deleting}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  删除选中 ({selectedWords.size})
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 主内容区 */}
      <main className="container mx-auto flex-1 px-4 py-6">
        <Tabs defaultValue="current" className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="current">当前易错词</TabsTrigger>
            <TabsTrigger value="history">易错词表</TabsTrigger>
          </TabsList>

          {/* 当前易错词 */}
          <TabsContent value="current" className="mt-6">
            {loading ? (
              <div className="text-center text-muted-foreground">加载中...</div>
            ) : wrongWords.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <p className="text-muted-foreground">暂无易错词</p>
                <p className="mt-2 text-sm text-muted-foreground">继续加油练习吧</p>
              </div>
            ) : (
              <>
                {/* 全选控制 - 只在维护模式下显示 */}
                {maintenanceMode && (
                  <div className="mb-4 flex items-center gap-2 rounded-lg border border-border bg-card p-3">
                    <Checkbox
                      id="select-all"
                      checked={selectedWords.size === wrongWords.length && wrongWords.length > 0}
                      onCheckedChange={handleSelectAll}
                    />
                    <label
                      htmlFor="select-all"
                      className="cursor-pointer text-sm font-medium text-foreground"
                    >
                      全选 ({wrongWords.length} 个单词)
                    </label>
                  </div>
                )}

                <div className="space-y-2">
                  {wrongWords.map((wrongWord) => {
                    const word = wrongWord.word;
                    if (!word) return null;

                    return (
                      <Card key={wrongWord.id} className="border border-destructive/30 bg-destructive/5">
                        <div className="flex items-start gap-3 p-4">
                          {/* 复选框 - 只在维护模式下显示 */}
                          {maintenanceMode && (
                            <Checkbox
                              checked={selectedWords.has(wrongWord.word_id)}
                              onCheckedChange={(checked) => handleSelectWord(wrongWord.word_id, checked as boolean)}
                              className="mt-1"
                            />
                          )}
                          <div className="flex-1">
                            <div className="flex items-baseline gap-3">
                              <h3 className="text-lg font-semibold lowercase text-foreground">{word.word}</h3>
                              {word.phonetic && (
                                <span className="text-sm text-muted-foreground">{word.phonetic}</span>
                              )}
                            </div>
                            <p className="mt-1 text-sm text-muted-foreground">{word.translation}</p>
                            <div className="mt-2 flex gap-4 text-xs text-muted-foreground">
                              <span>错误次数: {wrongWord.error_count}</span>
                              <span className="font-semibold text-destructive">权重值: {wrongWord.weight}</span>
                            </div>
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </>
            )}
          </TabsContent>

          {/* 易错词表（历史） */}
          <TabsContent value="history" className="mt-6">
            {wrongWordsHistory.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <p className="text-muted-foreground">暂无历史记录</p>
                <p className="mt-2 text-sm text-muted-foreground">已移出的易错词会显示在这里</p>
              </div>
            ) : (
              <div className="space-y-2">
                {wrongWordsHistory.map((history) => {
                  const word = history.word;
                  if (!word) return null;

                  return (
                    <Card key={history.id} className="border border-border bg-card">
                      <div className="flex items-start justify-between p-4">
                        <div className="flex-1">
                          <div className="flex items-baseline gap-3">
                            <h3 className="text-lg font-semibold lowercase text-foreground">{word.word}</h3>
                            {word.phonetic && (
                              <span className="text-sm text-muted-foreground">{word.phonetic}</span>
                            )}
                          </div>
                          <p className="mt-1 text-sm text-muted-foreground">{word.translation}</p>
                          <div className="mt-2 flex gap-4 text-xs text-muted-foreground">
                            <span>历史错误次数: {history.total_errors}</span>
                            <span>移出时间: {new Date(history.removed_at).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>

      {/* 删除确认对话框 */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
            <DialogDescription>
              确定要删除选中的 {selectedWords.size} 个易错词吗？此操作不可恢复。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteConfirm(false)}
              disabled={deleting}
            >
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={deleting}
            >
              {deleting ? '删除中...' : '确认删除'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
