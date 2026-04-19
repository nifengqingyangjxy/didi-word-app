import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { getSetting, updateSetting, clearWrongWords, clearWords, clearCollections } from '@/db/api';
import { ArrowLeft, Trash2, Database } from 'lucide-react';
import { toast } from 'sonner';
import { APP_VERSION, APP_NAME, APP_COPYRIGHT } from '@/constants/version';

export default function SettingsPage() {
  const navigate = useNavigate();
  const [threshold, setThreshold] = useState(60);
  const [wrongWordInsertionEnabled, setWrongWordInsertionEnabled] = useState(true);
  const [wrongWordInsertionCount, setWrongWordInsertionCount] = useState(10);
  const [autoPlayEnabled, setAutoPlayEnabled] = useState(true); // 自动播放单词读音
  const [autoPlayCount, setAutoPlayCount] = useState(1); // 自动播放次数（1-3次）
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showClearDialog, setShowClearDialog] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const [thresholdValue, insertionEnabled, insertionCount, autoPlay, playCount] = await Promise.all([
        getSetting('pronunciation_threshold'),
        getSetting('wrong_word_insertion_enabled'),
        getSetting('wrong_word_insertion_count'),
        getSetting('auto_play_pronunciation'),
        getSetting('auto_play_count'),
      ]);
      
      if (thresholdValue) setThreshold(Number(thresholdValue));
      if (insertionEnabled) setWrongWordInsertionEnabled(insertionEnabled === 'true');
      if (insertionCount) setWrongWordInsertionCount(Number(insertionCount));
      if (autoPlay !== null) setAutoPlayEnabled(autoPlay === 'true');
      if (playCount) setAutoPlayCount(Number(playCount));
    } catch (error) {
      console.error('加载设置失败:', error);
      toast.error('加载设置失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await Promise.all([
        updateSetting('pronunciation_threshold', String(threshold)),
        updateSetting('wrong_word_insertion_enabled', String(wrongWordInsertionEnabled)),
        updateSetting('wrong_word_insertion_count', String(wrongWordInsertionCount)),
        updateSetting('auto_play_pronunciation', String(autoPlayEnabled)),
        updateSetting('auto_play_count', String(autoPlayCount)),
      ]);
      toast.success('保存成功');
    } catch (error) {
      console.error('保存设置失败:', error);
      toast.error('保存设置失败');
    } finally {
      setSaving(false);
    }
  };

  const handleClearDatabase = async () => {
    if (confirmText !== '确认') {
      toast.error('请输入"确认"以继续');
      return;
    }

    try {
      setClearing(true);
      await Promise.all([
        clearWrongWords(),
        clearWords(),
        clearCollections(),
      ]);
      toast.success('数据库已清空');
      setShowClearDialog(false);
      setConfirmText('');
    } catch (error) {
      console.error('清空数据库失败:', error);
      toast.error('清空数据库失败');
    } finally {
      setClearing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">加载中...</p>
      </div>
    );
  }

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
            <h1 className="text-xl font-bold text-foreground">设置</h1>
          </div>
        </div>
      </header>

      {/* 主内容 */}
      <main className="container mx-auto flex-1 px-4 py-6">
        <Card className="mx-auto max-w-2xl border border-border p-6">
          <div className="space-y-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="threshold" className="text-base">
                  发音准确率阈值
                </Label>
                <span className="text-2xl font-bold text-primary">{threshold}%</span>
              </div>
              <Slider
                id="threshold"
                min={0}
                max={100}
                step={5}
                value={[threshold]}
                onValueChange={(value) => setThreshold(value[0])}
                className="w-full"
              />
              <p className="text-sm text-muted-foreground">
                跟读学习时，发音匹配度达到此阈值即判定为合格
              </p>
            </div>

            {/* 易错词插入开关 */}
            <div className="space-y-4 border-t border-border pt-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label htmlFor="wrong-word-insertion" className="text-base">
                    易错词插入
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    在学习模式中自动插入易错词
                  </p>
                </div>
                <Switch
                  id="wrong-word-insertion"
                  checked={wrongWordInsertionEnabled}
                  onCheckedChange={setWrongWordInsertionEnabled}
                />
              </div>
            </div>

            {/* 易错词插入数量 */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label 
                  htmlFor="insertion-count" 
                  className={`text-base ${!wrongWordInsertionEnabled ? 'text-muted-foreground' : ''}`}
                >
                  易错词插入数量
                </Label>
                <span className={`text-2xl font-bold ${wrongWordInsertionEnabled ? 'text-primary' : 'text-muted-foreground'}`}>
                  {wrongWordInsertionCount}
                </span>
              </div>
              <Slider
                id="insertion-count"
                min={1}
                max={50}
                step={1}
                value={[wrongWordInsertionCount]}
                onValueChange={(value) => setWrongWordInsertionCount(value[0])}
                disabled={!wrongWordInsertionEnabled}
                className="w-full"
              />
              <p className="text-sm text-muted-foreground">
                {wrongWordInsertionEnabled 
                  ? '易错词库中随机加入学习模式的单词数量' 
                  : '请先开启易错词插入功能'}
              </p>
            </div>

            {/* 自动播放单词读音开关 */}
            <div className="space-y-4 border-t border-border pt-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label htmlFor="auto-play" className="text-base">
                    自动播放单词读音
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    在英汉模式和混合模式中自动播放英文单词发音
                  </p>
                </div>
                <Switch
                  id="auto-play"
                  checked={autoPlayEnabled}
                  onCheckedChange={setAutoPlayEnabled}
                />
              </div>
            </div>

            {/* 自动播放次数 */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label 
                  htmlFor="play-count" 
                  className={`text-base ${!autoPlayEnabled ? 'text-muted-foreground' : ''}`}
                >
                  自动播放次数
                </Label>
                <span className={`text-2xl font-bold ${autoPlayEnabled ? 'text-primary' : 'text-muted-foreground'}`}>
                  {autoPlayCount} 次
                </span>
              </div>
              <Slider
                id="play-count"
                min={1}
                max={3}
                step={1}
                value={[autoPlayCount]}
                onValueChange={(value) => setAutoPlayCount(value[0])}
                disabled={!autoPlayEnabled}
                className="w-full"
              />
              <p className="text-sm text-muted-foreground">
                {autoPlayEnabled 
                  ? '每次播放间隔1秒，最多播放3次' 
                  : '请先开启自动播放功能'}
              </p>
            </div>

            {/* 数据管理入口 */}
            <div className="border-t border-border pt-6">
              <Button
                variant="outline"
                onClick={() => navigate('/data-management')}
                className="w-full gap-2"
              >
                <Database className="h-4 w-4" />
                数据管理与备份
              </Button>
              <p className="mt-2 text-sm text-muted-foreground">
                查看存储状态、导出备份、恢复数据
              </p>
            </div>

            <div className="flex gap-3 border-t border-border pt-6">
              <Button
                variant="outline"
                onClick={() => navigate('/home')}
                className="flex-1"
              >
                取消
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving}
                className="flex-1"
              >
                {saving ? '保存中...' : '保存设置'}
              </Button>
            </div>

            {/* 危险区域 */}
            <div className="space-y-4 border-t border-destructive/20 pt-6">
              <div className="space-y-2">
                <Label className="text-base text-destructive">危险区域</Label>
                <p className="text-sm text-muted-foreground">
                  以下操作不可恢复，请谨慎操作
                </p>
              </div>
              <Button
                variant="destructive"
                onClick={() => setShowClearDialog(true)}
                className="w-full"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                清空数据库
              </Button>
            </div>
            
            {/* 版本信息 */}
            <div className="mt-6 border-t border-border pt-6 text-center">
              <p className="text-sm text-muted-foreground">
                {APP_NAME} v{APP_VERSION}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {APP_COPYRIGHT}
              </p>
            </div>
          </div>
        </Card>
      </main>

      {/* 清空数据库确认对话框 */}
      <Dialog open={showClearDialog} onOpenChange={setShowClearDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>清空数据库</DialogTitle>
            <DialogDescription>
              此操作将清空以下数据，且不可恢复：
              <ul className="mt-2 list-inside list-disc space-y-1">
                <li>所有易错词库</li>
                <li>所有上传的单词</li>
                <li>所有文件章节</li>
              </ul>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="confirm-text">
                请输入汉字"<span className="font-bold text-destructive">确认</span>"以继续
              </Label>
              <Input
                id="confirm-text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="请输入：确认"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowClearDialog(false);
                setConfirmText('');
              }}
              disabled={clearing}
            >
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={handleClearDatabase}
              disabled={clearing || confirmText !== '确认'}
            >
              {clearing ? '清空中...' : '确认清空'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
