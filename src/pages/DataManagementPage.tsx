import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Download, Upload, Database, HardDrive, AlertCircle, CheckCircle, Cloud, Share2, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/db/supabase';
import {
  checkIndexedDBAvailable,
  requestPersistentStorage,
  checkStoragePersisted,
  getStorageEstimate,
  downloadBackup,
  restoreFromFile,
  hasData,
  getDataStats,
} from '@/utils/storage';

export default function DataManagementPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [dbAvailable, setDbAvailable] = useState(false);
  const [isPersisted, setIsPersisted] = useState(false);
  const [storageInfo, setStorageInfo] = useState<any>(null);
  const [dataExists, setDataExists] = useState(false);
  const [dataStats, setDataStats] = useState<any>(null);
  const [restoring, setRestoring] = useState(false);
  const [debugLogs, setDebugLogs] = useState<string[]>([]);
  const [exportingDatabase, setExportingDatabase] = useState(false);
  const [databaseStats, setDatabaseStats] = useState<any>(null);
  const [copyingData, setCopyingData] = useState(false);

  useEffect(() => {
    checkStorage();
    fetchDatabaseStats();
  }, []);

  const checkStorage = async () => {
    setLoading(true);
    try {
      // 检查IndexedDB可用性
      const available = await checkIndexedDBAvailable();
      setDbAvailable(available);

      // 检查持久化状态
      const persisted = await checkStoragePersisted();
      setIsPersisted(persisted);

      // 获取存储信息
      const estimate = await getStorageEstimate();
      setStorageInfo(estimate);

      // 检查是否有数据
      const exists = await hasData();
      setDataExists(exists);

      // 获取数据统计
      const stats = await getDataStats();
      setDataStats(stats);
    } catch (error) {
      console.error('检查存储失败:', error);
      toast.error('检查存储状态失败');
    } finally {
      setLoading(false);
    }
  };

  // 获取数据库统计信息
  const fetchDatabaseStats = async () => {
    try {
      // 获取单词总数
      const { count: wordCount } = await supabase
        .from('words')
        .select('*', { count: 'exact', head: true });

      // 获取词库数量
      const { count: collectionCount } = await supabase
        .from('collections')
        .select('*', { count: 'exact', head: true });

      // 获取易错词数量
      const { count: wrongWordCount } = await supabase
        .from('wrong_words')
        .select('*', { count: 'exact', head: true });

      // 获取学习记录数量
      const { count: studyRecordCount } = await supabase
        .from('study_records')
        .select('*', { count: 'exact', head: true });

      setDatabaseStats({
        wordCount: wordCount || 0,
        collectionCount: collectionCount || 0,
        wrongWordCount: wrongWordCount || 0,
        studyRecordCount: studyRecordCount || 0,
      });
    } catch (error) {
      console.error('获取数据库统计失败:', error);
    }
  };

  // 导出数据库数据
  const handleExportDatabase = async () => {
    try {
      setExportingDatabase(true);
      toast.info('正在导出数据库数据...');

      // 获取所有表的数据
      const [wordsResult, collectionsResult, wrongWordsResult, studyRecordsResult, settingsResult] = await Promise.all([
        supabase.from('words').select('*'),
        supabase.from('collections').select('*'),
        supabase.from('wrong_words').select('*'),
        supabase.from('study_records').select('*'),
        supabase.from('settings').select('*'),
      ]);

      // 检查错误
      if (wordsResult.error) throw wordsResult.error;
      if (collectionsResult.error) throw collectionsResult.error;
      if (wrongWordsResult.error) throw wrongWordsResult.error;
      if (studyRecordsResult.error) throw studyRecordsResult.error;
      if (settingsResult.error) throw settingsResult.error;

      // 构建导出数据
      const exportData = {
        version: '1.0',
        exportDate: new Date().toISOString(),
        data: {
          words: wordsResult.data || [],
          collections: collectionsResult.data || [],
          wrong_words: wrongWordsResult.data || [],
          study_records: studyRecordsResult.data || [],
          settings: settingsResult.data || [],
        },
        stats: {
          wordCount: wordsResult.data?.length || 0,
          collectionCount: collectionsResult.data?.length || 0,
          wrongWordCount: wrongWordsResult.data?.length || 0,
          studyRecordCount: studyRecordsResult.data?.length || 0,
        },
      };

      // 创建JSON文件（使用纯英文文件名，避免中文兼容性问题）
      const jsonString = JSON.stringify(exportData, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      // 创建下载链接
      const link = document.createElement('a');
      link.href = url;
      link.download = `didi-words-database-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // ✅ 关键修复：大幅延长延迟到30秒，给Android微信WebView足够时间完成异步下载
      // Android微信的下载是异步的，交给内部下载器处理，需要更长的时间
      // 如果过早释放URL，下载器无法读取完成，导致文件保存失败
      setTimeout(() => {
        URL.revokeObjectURL(url);
      }, 30000);

      // 检测是否是安卓微信
      const isAndroidWeChat = /Android/i.test(navigator.userAgent) && /MicroMessenger/i.test(navigator.userAgent);

      if (isAndroidWeChat) {
        toast.success('数据库数据导出成功', {
          description: '文件已保存到：文件管理 → Download 文件夹（请等待30秒确保下载完成）',
          duration: 10000,
        });
      } else {
        toast.success('数据库数据导出成功', {
          description: `已导出 ${exportData.stats.wordCount} 个单词，${exportData.stats.collectionCount} 个词库`,
        });
      }
    } catch (error: any) {
      console.error('导出数据库数据失败:', error);
      toast.error('导出数据库数据失败', {
        description: error.message || '请稍后重试',
      });
    } finally {
      setExportingDatabase(false);
    }
  };

  // 复制数据库数据到剪贴板
  const handleCopyDatabase = async () => {
    try {
      setCopyingData(true);
      toast.info('正在准备数据...');

      // 获取所有表的数据
      const [wordsResult, collectionsResult, wrongWordsResult, studyRecordsResult, settingsResult] = await Promise.all([
        supabase.from('words').select('*'),
        supabase.from('collections').select('*'),
        supabase.from('wrong_words').select('*'),
        supabase.from('study_records').select('*'),
        supabase.from('settings').select('*'),
      ]);

      // 检查错误
      if (wordsResult.error) throw wordsResult.error;
      if (collectionsResult.error) throw collectionsResult.error;
      if (wrongWordsResult.error) throw wrongWordsResult.error;
      if (studyRecordsResult.error) throw studyRecordsResult.error;
      if (settingsResult.error) throw settingsResult.error;

      // 构建导出数据
      const exportData = {
        version: '1.0',
        exportDate: new Date().toISOString(),
        data: {
          words: wordsResult.data || [],
          collections: collectionsResult.data || [],
          wrong_words: wrongWordsResult.data || [],
          study_records: studyRecordsResult.data || [],
          settings: settingsResult.data || [],
        },
        stats: {
          wordCount: wordsResult.data?.length || 0,
          collectionCount: collectionsResult.data?.length || 0,
          wrongWordCount: wrongWordsResult.data?.length || 0,
          studyRecordCount: studyRecordsResult.data?.length || 0,
        },
      };

      // 创建JSON字符串
      const jsonString = JSON.stringify(exportData, null, 2);

      // 复制到剪贴板
      await navigator.clipboard.writeText(jsonString);

      toast.success('数据已复制到剪贴板', {
        description: '打开微信"文件传输助手"，长按粘贴，保存为文件',
        duration: 10000,
      });
    } catch (error: any) {
      console.error('复制数据失败:', error);
      toast.error('复制数据失败', {
        description: error.message || '请稍后重试',
      });
    } finally {
      setCopyingData(false);
    }
  };
  const handleShareDatabase = async () => {
    try {
      setExportingDatabase(true);
      toast.info('正在准备分享数据...');

      // 获取所有表的数据
      const [wordsResult, collectionsResult, wrongWordsResult, studyRecordsResult, settingsResult] = await Promise.all([
        supabase.from('words').select('*'),
        supabase.from('collections').select('*'),
        supabase.from('wrong_words').select('*'),
        supabase.from('study_records').select('*'),
        supabase.from('settings').select('*'),
      ]);

      // 检查错误
      if (wordsResult.error) throw wordsResult.error;
      if (collectionsResult.error) throw collectionsResult.error;
      if (wrongWordsResult.error) throw wrongWordsResult.error;
      if (studyRecordsResult.error) throw studyRecordsResult.error;
      if (settingsResult.error) throw settingsResult.error;

      // 构建导出数据
      const exportData = {
        version: '1.0',
        exportDate: new Date().toISOString(),
        data: {
          words: wordsResult.data || [],
          collections: collectionsResult.data || [],
          wrong_words: wrongWordsResult.data || [],
          study_records: studyRecordsResult.data || [],
          settings: settingsResult.data || [],
        },
        stats: {
          wordCount: wordsResult.data?.length || 0,
          collectionCount: collectionsResult.data?.length || 0,
          wrongWordCount: wrongWordsResult.data?.length || 0,
          studyRecordCount: studyRecordsResult.data?.length || 0,
        },
      };

      // 创建JSON文件
      const jsonString = JSON.stringify(exportData, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const fileName = `didi-words-database-backup-${new Date().toISOString().split('T')[0]}.json`;
      const file = new File([blob], fileName, { type: 'application/json' });

      // 检查是否支持Web Share API
      if (!navigator.share) {
        toast.error('当前浏览器不支持分享功能', {
          description: '请使用下载功能保存数据',
        });
        return;
      }

      // 检查是否可以分享文件
      if (navigator.canShare && !navigator.canShare({ files: [file] })) {
        toast.error('当前浏览器不支持分享文件', {
          description: '请使用下载功能保存数据',
        });
        return;
      }

      // 使用Web Share API分享文件
      await navigator.share({
        files: [file],
        title: 'DIDI单词助记数据备份',
        text: `我的单词数据备份 - ${exportData.stats.wordCount}个单词，${exportData.stats.collectionCount}个词库`,
      });

      toast.success('分享成功', {
        description: '数据已分享',
      });
    } catch (error: any) {
      console.error('分享数据库数据失败:', error);
      
      // 用户取消分享
      if (error.name === 'AbortError') {
        console.log('用户取消了分享');
        return;
      }
      
      toast.error('分享失败', {
        description: error.message || '请使用下载功能保存数据',
      });
    } finally {
      setExportingDatabase(false);
    }
  };

  const handleRequestPersistence = async () => {
    try {
      // 先检查浏览器是否支持
      if (!navigator.storage || !navigator.storage.persist) {
        toast.success('数据已自动持久化', {
          description: 'IndexedDB数据会自动保存，建议定期导出备份',
        });
        setIsPersisted(true);
        return;
      }
      
      // 检查是否已经持久化
      const alreadyPersisted = await navigator.storage.persisted();
      if (alreadyPersisted) {
        toast.success('存储已经持久化', {
          description: '您的数据已受到保护',
        });
        setIsPersisted(true);
        return;
      }
      
      // 请求持久化
      const granted = await requestPersistentStorage();
      if (granted) {
        toast.success('持久化存储已授权', {
          description: '您的数据已受到保护，建议定期导出备份',
        });
        setIsPersisted(true);
      } else {
        // 在APK中，persist()可能返回false，但数据仍然是持久的
        // 因为APK的WebView数据存储在应用私有目录，不会被清除
        const isAndroid = /Android/i.test(navigator.userAgent);
        const isInApp = !('share' in navigator); // 简单判断是否在原生应用中
        
        if (isAndroid || isInApp) {
          toast.success('数据已持久化', {
            description: '应用数据存储在私有目录，关闭应用后不会丢失',
          });
          setIsPersisted(true);
        } else {
          toast.info('数据已自动保存', {
            description: 'IndexedDB会自动保存数据，建议定期导出备份以防万一',
          });
          setIsPersisted(true);
        }
      }
    } catch (error) {
      console.error('请求持久化存储失败:', error);
      
      // 在APK中，即使persist()失败，数据也是持久的
      const isAndroid = /Android/i.test(navigator.userAgent);
      if (isAndroid) {
        toast.success('数据已持久化', {
          description: '应用数据存储在私有目录，关闭应用后不会丢失',
        });
      } else {
        toast.info('数据已自动保存', {
          description: 'IndexedDB会自动保存数据，建议定期导出备份',
        });
      }
      setIsPersisted(true);
    }
  };

  const handleDownloadBackup = async () => {
    // 清空之前的日志
    setDebugLogs([]);
    
    const addLog = (message: string) => {
      console.log(message);
      setDebugLogs(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
    };
    
    try {
      addLog('=== 开始导出 ===');
      addLog(`User Agent: ${navigator.userAgent}`);
      addLog(`是否Android: ${/Android/i.test(navigator.userAgent)}`);
      addLog(`是否iOS: ${/iPhone|iPad|iPod/i.test(navigator.userAgent)}`);
      addLog(`是否微信: ${/MicroMessenger/i.test(navigator.userAgent)}`);
      addLog(`支持Web Share: ${'share' in navigator}`);
      addLog(`支持canShare: ${'canShare' in navigator}`);
      
      await downloadBackup();
      
      addLog('✅ 导出成功');
      
      // 检测设备类型
      const isAndroid = /Android/i.test(navigator.userAgent);
      const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
      const isMobile = isAndroid || isIOS;
      const supportsFilePicker = 'showSaveFilePicker' in window;
      const supportsShare = 'share' in navigator && 'canShare' in navigator;
      
      // Android: 传统下载
      if (isAndroid) {
        toast.success('备份文件已下载', {
          description: '文件已保存到Download文件夹',
        });
      }
      // iOS使用Web Share API
      else if (isIOS && supportsShare) {
        toast.success('备份文件已保存', {
          description: '文件已保存到您选择的位置',
        });
      }
      // 桌面端使用File System Access API
      else if (!isMobile && supportsFilePicker) {
        toast.success('备份文件已保存', {
          description: '文件已保存到您选择的位置',
        });
      }
      // 传统下载方式
      else {
        toast.success('备份文件已下载', {
          description: '请在浏览器的"下载"列表中查看',
        });
      }
    } catch (error: any) {
      console.error('下载备份失败:', error);
      addLog(`❌ 错误: ${error.message || error}`);
      
      // 用户取消 - 不显示错误，只显示提示
      if (error.message === '用户取消保存' || error.message === '用户取消分享') {
        // 不显示任何提示，用户主动取消不需要提示
        addLog('ℹ️ 用户取消了操作');
        return;
      }
      
      // 显示详细的错误信息
      const errorMessage = error.message || '未知错误';
      toast.error('导出备份失败', {
        description: errorMessage,
        duration: 5000,
      });
    }
  };

  const handleRestoreBackup = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setRestoring(true);
      await restoreFromFile(file);
      toast.success('数据恢复成功');
      
      // 重新检查存储状态
      await checkStorage();
    } catch (error) {
      console.error('恢复数据失败:', error);
      toast.error('恢复数据失败', {
        description: '请确保文件格式正确',
      });
    } finally {
      setRestoring(false);
      // 重置文件输入
      event.target.value = '';
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mb-4 text-lg text-muted-foreground">检查存储状态...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* 头部 */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/settings')}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-xl font-bold text-foreground">数据管理</h1>
          </div>
        </div>
      </header>

      {/* 主内容 */}
      <main className="container mx-auto flex-1 px-4 py-6">
        <div className="mx-auto max-w-2xl space-y-6">
          {/* 存储状态 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                存储状态
              </CardTitle>
              <CardDescription>查看应用的数据存储状态</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* IndexedDB可用性 */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">IndexedDB</span>
                <div className="flex items-center gap-2">
                  {dbAvailable ? (
                    <>
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span className="text-sm text-green-500">可用</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="h-4 w-4 text-destructive" />
                      <span className="text-sm text-destructive">不可用</span>
                    </>
                  )}
                </div>
              </div>

              {/* 持久化状态 */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">持久化存储</span>
                <div className="flex items-center gap-2">
                  {isPersisted ? (
                    <>
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span className="text-sm text-green-500">已授权</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="h-4 w-4 text-yellow-500" />
                      <span className="text-sm text-yellow-500">未授权</span>
                    </>
                  )}
                </div>
              </div>

              {/* 存储使用情况 */}
              {storageInfo && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">存储使用</span>
                    <span className="text-sm text-foreground">
                      {storageInfo.usageInMB} MB / {storageInfo.quotaInMB} MB
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full bg-primary transition-all"
                      style={{ width: `${storageInfo.percentage}%` }}
                    />
                  </div>
                  <div className="text-xs text-muted-foreground text-right">
                    已使用 {storageInfo.percentage}%
                  </div>
                </div>
              )}

              {/* 请求持久化 */}
              {!isPersisted && (
                <div className="rounded-sm border border-yellow-500/50 bg-yellow-500/10 p-4">
                  <p className="mb-2 text-sm font-semibold text-yellow-600 dark:text-yellow-500">
                    ⚠️ 建议授权持久化存储
                  </p>
                  <p className="mb-3 text-xs text-muted-foreground">
                    授权后，浏览器不会在存储空间不足时自动清除应用数据，确保您的学习记录不会丢失。
                  </p>
                  <Button
                    size="sm"
                    onClick={handleRequestPersistence}
                    className="w-full"
                  >
                    授权持久化存储
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 数据统计 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <HardDrive className="h-5 w-5" />
                本地数据统计
              </CardTitle>
              <CardDescription>查看应用中存储的本地数据量</CardDescription>
            </CardHeader>
            <CardContent>
              {dataExists ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">单词总数</span>
                    <span className="text-sm font-semibold text-foreground">
                      {dataStats?.wordCount || 0}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">词库数量</span>
                    <span className="text-sm font-semibold text-foreground">
                      {dataStats?.collectionCount || 0}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">易错词数</span>
                    <span className="text-sm font-semibold text-foreground">
                      {dataStats?.wrongWordCount || 0}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">学习记录</span>
                    <span className="text-sm font-semibold text-foreground">
                      {dataStats?.studyRecordCount || 0}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  暂无数据
                </div>
              )}
            </CardContent>
          </Card>

          {/* 数据库数据导出 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Cloud className="h-5 w-5" />
                数据库数据导出
              </CardTitle>
              <CardDescription>
                导出Supabase数据库中的所有用户数据
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* 数据库统计 */}
              {databaseStats && (
                <div className="space-y-3 rounded-lg border border-border p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">单词总数</span>
                    <span className="text-sm font-semibold text-foreground">
                      {databaseStats.wordCount}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">词库数量</span>
                    <span className="text-sm font-semibold text-foreground">
                      {databaseStats.collectionCount}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">易错词数</span>
                    <span className="text-sm font-semibold text-foreground">
                      {databaseStats.wrongWordCount}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">学习记录</span>
                    <span className="text-sm font-semibold text-foreground">
                      {databaseStats.studyRecordCount}
                    </span>
                  </div>
                </div>
              )}

              {/* 导出和复制按钮 */}
              <div className="space-y-3">
                <Button
                  onClick={handleExportDatabase}
                  disabled={exportingDatabase || copyingData || !databaseStats || databaseStats.wordCount === 0}
                  className="w-full"
                >
                  <Download className="mr-2 h-4 w-4" />
                  {exportingDatabase ? '正在导出...' : '下载数据库数据'}
                </Button>

                <Button
                  onClick={handleCopyDatabase}
                  disabled={exportingDatabase || copyingData || !databaseStats || databaseStats.wordCount === 0}
                  variant="outline"
                  className="w-full"
                >
                  <Copy className="mr-2 h-4 w-4" />
                  {copyingData ? '正在复制...' : '复制数据到剪贴板'}
                </Button>
              </div>

              {/* 说明 */}
              <div className="space-y-2">
                <div className="rounded-lg bg-yellow-500/10 border border-yellow-500/50 p-3">
                  <p className="text-xs font-semibold text-yellow-600 dark:text-yellow-500 mb-1">⚠️ 安卓微信用户请注意：</p>
                  <p className="text-xs text-muted-foreground">
                    <strong>强烈推荐使用"复制数据到剪贴板"</strong>，这是最可靠的方式。下载方式在部分安卓微信中可能失败。
                  </p>
                </div>
                
                <div className="rounded-lg bg-muted p-3">
                  <p className="text-xs font-semibold text-foreground mb-1">📋 复制方式（推荐）：</p>
                  <p className="text-xs text-muted-foreground">
                    1. 点击"复制数据到剪贴板"<br />
                    2. 打开微信"文件传输助手"<br />
                    3. 长按输入框，选择"粘贴"<br />
                    4. 发送后，长按消息保存为文件
                  </p>
                </div>

                <div className="rounded-lg bg-muted p-3">
                  <p className="text-xs font-semibold text-foreground mb-1">📥 下载方式：</p>
                  <p className="text-xs text-muted-foreground">
                    文件保存到：<strong>文件管理 → Download 文件夹</strong><br />
                    文件名：<strong>didi-words-database-backup-日期.json</strong><br />
                    <span className="text-yellow-600 dark:text-yellow-500">注意：请等待30秒确保下载完成</span>
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 备份与恢复 */}
          <Card>
            <CardHeader>
              <CardTitle>本地数据备份与恢复</CardTitle>
              <CardDescription>
                导出本地数据备份文件，或从备份文件恢复数据
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* 导出备份 */}
              <div>
                <Button
                  onClick={handleDownloadBackup}
                  disabled={!dataExists}
                  className="w-full gap-2"
                >
                  <Download className="h-4 w-4" />
                  导出数据备份
                </Button>
                <p className="mt-2 text-xs text-muted-foreground">
                  {(() => {
                    const isAndroid = /Android/i.test(navigator.userAgent);
                    const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
                    const isMobile = isAndroid || isIOS;
                    const supportsFilePicker = 'showSaveFilePicker' in window;
                    const supportsShare = 'share' in navigator && 'canShare' in navigator;
                    
                    // Android: 传统下载
                    if (isAndroid) {
                      return '点击后文件将自动下载到Download文件夹';
                    }
                    // iOS使用Web Share API
                    else if (isIOS && supportsShare) {
                      return '点击后选择"存储到文件"，然后选择保存位置';
                    }
                    // 桌面端使用File System Access API
                    else if (!isMobile && supportsFilePicker) {
                      return '点击后可选择保存位置和自定义文件名';
                    }
                    // 传统下载方式
                    else {
                      return '点击后文件将自动下载，请在浏览器下载列表中查看';
                    }
                  })()}
                </p>
              </div>

              {/* 导入备份 */}
              <div>
                <label htmlFor="restore-file">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={restoring}
                    className="w-full gap-2"
                    onClick={() => document.getElementById('restore-file')?.click()}
                  >
                    <Upload className="h-4 w-4" />
                    {restoring ? '恢复中...' : '从备份恢复'}
                  </Button>
                </label>
                <input
                  id="restore-file"
                  type="file"
                  accept=".json"
                  className="hidden"
                  onChange={handleRestoreBackup}
                  disabled={restoring}
                />
                <p className="mt-2 text-xs text-muted-foreground">
                  点击后选择之前导出的备份文件（.json格式）
                </p>
              </div>

              {/* 重要提示 */}
              <div className="rounded-sm border border-blue-500/50 bg-blue-500/10 p-4">
                <p className="mb-2 text-sm font-semibold text-blue-600 dark:text-blue-400">
                  💡 重要提示
                </p>
                <ul className="space-y-1 text-xs text-muted-foreground">
                  <li>• 定期导出备份，防止数据丢失</li>
                  <li>• 更换设备或浏览器时，可通过备份文件恢复数据</li>
                  <li>• 恢复数据会覆盖当前所有数据，请谨慎操作</li>
                  <li>• 建议将备份文件保存到云盘或其他安全位置</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* 调试日志（仅在有日志时显示） */}
          {debugLogs.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">调试日志</CardTitle>
                <CardDescription className="text-xs">
                  用于排查导出问题，请截图发送给开发者
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-sm bg-muted p-3 font-mono text-xs">
                  {debugLogs.map((log, index) => (
                    <div key={index} className="mb-1 text-muted-foreground">
                      {log}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* 常见问题 */}
          <Card>
            <CardHeader>
              <CardTitle>常见问题</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="mb-2 text-sm font-semibold text-foreground">
                  为什么关闭网页后数据会丢失？
                </p>
                <p className="text-xs text-muted-foreground">
                  可能的原因：1) 使用了浏览器的隐私/无痕模式；2) 浏览器设置为关闭时清除数据；3) 未授权持久化存储。
                  建议：授权持久化存储，并定期导出备份。
                </p>
              </div>
              <div>
                <p className="mb-2 text-sm font-semibold text-foreground">
                  更换浏览器后数据不见了？
                </p>
                <p className="text-xs text-muted-foreground">
                  不同浏览器的数据是独立的，无法共享。建议在旧浏览器中导出备份，然后在新浏览器中恢复。
                </p>
              </div>
              <div>
                <p className="mb-2 text-sm font-semibold text-foreground">
                  如何确保数据不丢失？
                </p>
                <p className="text-xs text-muted-foreground">
                  1) 授权持久化存储；2) 定期导出备份；3) 将备份文件保存到云盘；4) 避免使用隐私模式；5) 不要清除浏览器数据。
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
