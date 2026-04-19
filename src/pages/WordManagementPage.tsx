import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { getAllCollections, updateCollectionName, deleteCollection, getWordsByCollection } from '@/db/api';
import type { Collection, Word } from '@/types';
import { ArrowLeft, Upload, Plus, Eye, Pencil, Trash2, FileEdit, Search, MoreVertical } from 'lucide-react';
import { toast } from 'sonner';

export default function WordManagementPage() {
  const navigate = useNavigate();
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  
  // 存储每个章节是否有需要审查的单词
  const [collectionsWithReview, setCollectionsWithReview] = useState<Set<string>>(new Set());
  
  // 章节搜索状态
  const [collectionSearchQuery, setCollectionSearchQuery] = useState('');

  // 对话框状态
  const [previewCollection, setPreviewCollection] = useState<Collection | null>(null);
  const [previewWords, setPreviewWords] = useState<Word[]>([]);
  const [originalPreviewWords, setOriginalPreviewWords] = useState<Word[]>([]); // 保存原始顺序
  const [previewSortOrder, setPreviewSortOrder] = useState<'import' | 'alpha'>('import'); // 预览排序方式
  const [editingCollection, setEditingCollection] = useState<Collection | null>(null);
  const [editCollectionName, setEditCollectionName] = useState('');
  const [deleteConfirmCollection, setDeleteConfirmCollection] = useState<Collection | null>(null);

  useEffect(() => {
    loadCollections();
  }, []);

  const loadCollections = async () => {
    try {
      setLoading(true);
      const data = await getAllCollections();
      setCollections(data);
      
      // 检查每个章节是否有需要审查的单词
      const reviewSet = new Set<string>();
      for (const collection of data) {
        const words = await getWordsByCollection(collection.id);
        const hasReviewWords = words.some(w => w.needs_review);
        if (hasReviewWords) {
          reviewSet.add(collection.id);
        }
      }
      setCollectionsWithReview(reviewSet);
    } catch (error) {
      console.error('加载章节失败:', error);
      toast.error('加载章节失败');
    } finally {
      setLoading(false);
    }
  };

  const handlePreviewCollection = async (collection: Collection) => {
    try {
      const words = await getWordsByCollection(collection.id);
      setOriginalPreviewWords(words); // 保存原始顺序
      setPreviewWords(words);
      setPreviewSortOrder('import'); // 重置为导入顺序
      setPreviewCollection(collection);
    } catch (error) {
      console.error('加载单词失败:', error);
      toast.error('加载单词失败');
    }
  };
  
  // 预览排序函数
  const handlePreviewSort = (order: 'import' | 'alpha') => {
    setPreviewSortOrder(order);
    
    if (order === 'import') {
      // 恢复导入顺序
      setPreviewWords([...originalPreviewWords]);
    } else {
      // 按字母顺序排序
      const sorted = [...previewWords].sort((a, b) => {
        const wordA = a.word.toLowerCase();
        const wordB = b.word.toLowerCase();
        return wordA.localeCompare(wordB);
      });
      setPreviewWords(sorted);
    }
  };

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

  const handleModifyCollection = (collection: Collection) => {
    // 跳转到编辑页面，传递章节ID
    navigate(`/words/edit/${collection.id}`);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' });
  };
  
  // 过滤章节列表
  const filteredCollections = collections.filter(collection => 
    collection.name.toLowerCase().includes(collectionSearchQuery.toLowerCase())
  );

  return (
    <div className="flex min-h-screen w-full flex-col bg-background">
      {/* 头部 */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/home')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-xl font-bold text-foreground">单词管理</h1>
          </div>
        </div>
      </header>

      {/* 主内容 */}
      <main className="container mx-auto flex-1 px-4 py-6">
        <Tabs defaultValue="import" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="import">文件导入</TabsTrigger>
            <TabsTrigger value="manual">手动添加</TabsTrigger>
          </TabsList>

          {/* 文件导入标签页 */}
          <TabsContent value="import" className="space-y-6">
            <div className="flex justify-center">
              <Button onClick={() => navigate('/words/import')} size="lg" className="gap-2">
                <Upload className="h-5 w-5" />
                导入文件
              </Button>
            </div>

            {/* 已导入的章节列表 */}
            <Card className="border border-border p-4 md:p-6">
              <h3 className="mb-3 text-base md:text-lg font-semibold text-foreground">已导入的章节</h3>
              
              {/* 搜索框 */}
              {collections.length > 0 && (
                <div className="relative mb-4">
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
              
              {loading ? (
                <div className="text-center text-muted-foreground">加载中...</div>
              ) : collections.length === 0 ? (
                <p className="text-sm text-muted-foreground">暂无章节，请先导入文件</p>
              ) : filteredCollections.length === 0 ? (
                <p className="text-sm text-muted-foreground">未找到匹配的章节</p>
              ) : (
                <>
                  {/* 桌面端：表格布局 */}
                  <div className="hidden md:block max-h-[500px] overflow-y-auto">
                    <table className="w-full">
                      <thead className="sticky top-0 bg-card">
                        <tr className="border-b border-border">
                          <th className="pb-3 text-left text-sm font-semibold text-foreground">章节名</th>
                          <th className="pb-3 text-left text-sm font-semibold text-foreground">导入日期</th>
                          <th className="pb-3 text-left text-sm font-semibold text-foreground">单词数量</th>
                          <th className="pb-3 text-right text-sm font-semibold text-foreground">操作</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredCollections.map((collection) => (
                          <tr key={collection.id} className="border-b border-border transition-colors hover:bg-accent">
                            <td className="py-3 text-sm font-medium text-foreground">
                              <div className="flex items-center gap-2">
                                {collection.name}
                                {collectionsWithReview.has(collection.id) && (
                                  <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-3 text-sm text-muted-foreground">{formatDate(collection.created_at)}</td>
                            <td className="py-3 text-sm text-muted-foreground">{collection.word_count} 个</td>
                            <td className="py-3 text-right">
                              <div className="flex justify-end gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handlePreviewCollection(collection)}
                                  className="h-8 gap-1"
                                >
                                  <Eye className="h-4 w-4" />
                                  预览
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleEditCollection(collection)}
                                  className="h-8 gap-1"
                                >
                                  <Pencil className="h-4 w-4" />
                                  改名
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleModifyCollection(collection)}
                                  className="h-8 gap-1"
                                >
                                  <FileEdit className="h-4 w-4" />
                                  修改
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setDeleteConfirmCollection(collection)}
                                  className="h-8 gap-1 text-destructive hover:bg-destructive/10"
                                >
                                  <Trash2 className="h-4 w-4" />
                                  删除
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* 移动端：卡片布局 */}
                  <div className="md:hidden max-h-[500px] space-y-2 overflow-y-auto">
                    {filteredCollections.map((collection) => (
                      <Card
                        key={collection.id}
                        className="border border-border p-3"
                      >
                        <div className="flex items-center gap-3">
                          {/* 章节信息 */}
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-sm text-foreground truncate mb-1 flex items-center gap-2">
                              {collection.name}
                              {collectionsWithReview.has(collection.id) && (
                                <span className="relative flex h-2 w-2">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                  <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                                </span>
                              )}
                            </h4>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <span>{formatDate(collection.created_at)}</span>
                              <span>•</span>
                              <span className="rounded-full bg-primary/10 px-2 py-0.5 font-medium text-primary">
                                {collection.word_count} 个
                              </span>
                            </div>
                          </div>
                          
                          {/* 操作菜单 */}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handlePreviewCollection(collection)}>
                                <Eye className="mr-2 h-4 w-4" />
                                预览
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleEditCollection(collection)}>
                                <Pencil className="mr-2 h-4 w-4" />
                                改名
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleModifyCollection(collection)}>
                                <FileEdit className="mr-2 h-4 w-4" />
                                修改
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={() => setDeleteConfirmCollection(collection)}
                                className="text-destructive focus:text-destructive"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                删除
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </Card>
                    ))}
                  </div>
                </>
              )}
            </Card>
          </TabsContent>

          {/* 手动添加标签页 */}
          <TabsContent value="manual" className="space-y-6">
            <div className="flex justify-center">
              <Button onClick={() => navigate('/words/add')} size="lg" className="gap-2">
                <Plus className="h-5 w-5" />
                手动添加单词
              </Button>
            </div>

            <Card className="border border-border p-6">
              <h3 className="mb-2 text-lg font-semibold text-foreground">使用说明</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>• 点击"手动添加单词"按钮，可以粘贴文章或单词列表</li>
                <li>• 系统会自动提取文章中的所有英文单词</li>
                <li>• 每个单词会自动补充音标和翻译</li>
                <li>• 添加的单词会保存到选定的章节中</li>
              </ul>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      {/* 预览对话框 */}
      <Dialog open={!!previewCollection} onOpenChange={() => setPreviewCollection(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{previewCollection?.name}</DialogTitle>
          </DialogHeader>
          
          {/* 排序按钮 */}
          <div className="flex gap-2 mb-4">
            <Button
              variant={previewSortOrder === 'import' ? 'default' : 'outline'}
              size="sm"
              onClick={() => handlePreviewSort('import')}
            >
              按导入顺序
            </Button>
            <Button
              variant={previewSortOrder === 'alpha' ? 'default' : 'outline'}
              size="sm"
              onClick={() => handlePreviewSort('alpha')}
            >
              按字母顺序
            </Button>
          </div>
          
          <div className="max-h-[500px] overflow-y-auto">
            <table className="w-full">
              <thead className="sticky top-0 bg-background">
                <tr className="border-b border-border">
                  <th className="pb-2 text-left text-sm font-semibold">单词</th>
                  <th className="pb-2 text-left text-sm font-semibold">音标</th>
                  <th className="pb-2 text-left text-sm font-semibold">翻译</th>
                </tr>
              </thead>
              <tbody>
                {previewWords.map((word) => (
                  <tr key={word.id} className="border-b border-border">
                    <td className="py-2 font-semibold">{word.word}</td>
                    <td className="py-2 font-mono text-sm text-muted-foreground">{word.phonetic || '-'}</td>
                    <td className="py-2 text-sm">{word.translation}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <DialogFooter>
            <Button onClick={() => setPreviewCollection(null)}>关闭</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
    </div>
  );
}

// v2.0 - 移除左滑功能，改为下拉菜单
