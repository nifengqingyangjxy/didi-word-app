/**
 * 存储工具函数
 * 用于检测和管理数据持久化
 */

import { db } from '@/db/indexeddb';

/**
 * 检查IndexedDB是否可用
 */
export async function checkIndexedDBAvailable(): Promise<boolean> {
  try {
    if (!('indexedDB' in window)) {
      console.error('IndexedDB不可用');
      return false;
    }
    
    // 尝试打开数据库
    await db.open();
    console.log('IndexedDB可用');
    return true;
  } catch (error) {
    console.error('IndexedDB打开失败:', error);
    return false;
  }
}

/**
 * 请求持久化存储权限
 */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    // 检查浏览器是否支持持久化存储API
    if (!navigator.storage || !navigator.storage.persist) {
      console.warn('浏览器不支持持久化存储API');
      // 即使不支持，也返回true，因为IndexedDB本身就是持久化的
      return true;
    }
    
    // 先检查是否已经持久化
    const alreadyPersisted = await navigator.storage.persisted();
    if (alreadyPersisted) {
      console.log('存储已经持久化');
      return true;
    }
    
    // 请求持久化
    const isPersisted = await navigator.storage.persist();
    console.log('持久化存储:', isPersisted ? '已授权' : '未授权');
    
    // 即使未授权，也返回true，因为IndexedDB本身就是持久化的
    // 只是在某些情况下（如存储空间不足）可能会被清除
    return true;
  } catch (error) {
    console.error('请求持久化存储失败:', error);
    // 出错时也返回true，不影响用户使用
    return true;
  }
}

/**
 * 检查存储是否已持久化
 */
export async function checkStoragePersisted(): Promise<boolean> {
  try {
    if (navigator.storage && navigator.storage.persisted) {
      const isPersisted = await navigator.storage.persisted();
      console.log('存储持久化状态:', isPersisted);
      return isPersisted;
    }
    return false;
  } catch (error) {
    console.error('检查存储持久化状态失败:', error);
    return false;
  }
}

/**
 * 获取存储使用情况
 */
export async function getStorageEstimate(): Promise<{
  usage: number;
  quota: number;
  usageInMB: number;
  quotaInMB: number;
  percentage: number;
} | null> {
  try {
    if (navigator.storage && navigator.storage.estimate) {
      const estimate = await navigator.storage.estimate();
      const usage = estimate.usage || 0;
      const quota = estimate.quota || 0;
      
      return {
        usage,
        quota,
        usageInMB: Math.round(usage / 1024 / 1024 * 100) / 100,
        quotaInMB: Math.round(quota / 1024 / 1024 * 100) / 100,
        percentage: quota > 0 ? Math.round(usage / quota * 100) : 0,
      };
    }
    return null;
  } catch (error) {
    console.error('获取存储使用情况失败:', error);
    return null;
  }
}

/**
 * 导出所有数据为JSON
 */
export async function exportAllData(): Promise<string> {
  try {
    const data = {
      version: 1,
      exportTime: new Date().toISOString(),
      words: await db.words.toArray(),
      collections: await db.collections.toArray(),
      wrong_words: await db.wrong_words.toArray(),
      wrong_words_history: await db.wrong_words_history.toArray(),
      study_records: await db.study_records.toArray(),
      settings: await db.settings.toArray(),
    };
    
    return JSON.stringify(data, null, 2);
  } catch (error) {
    console.error('导出数据失败:', error);
    throw error;
  }
}

/**
 * 从JSON导入数据
 */
export async function importAllData(jsonString: string): Promise<void> {
  try {
    const data = JSON.parse(jsonString);
    
    // 验证数据格式
    if (!data.version || !data.exportTime) {
      throw new Error('无效的备份文件格式');
    }
    
    // 清空现有数据
    await db.words.clear();
    await db.collections.clear();
    await db.wrong_words.clear();
    await db.wrong_words_history.clear();
    await db.study_records.clear();
    await db.settings.clear();
    
    // 导入数据
    if (data.collections && data.collections.length > 0) {
      await db.collections.bulkAdd(data.collections);
    }
    if (data.words && data.words.length > 0) {
      await db.words.bulkAdd(data.words);
    }
    if (data.wrong_words && data.wrong_words.length > 0) {
      await db.wrong_words.bulkAdd(data.wrong_words);
    }
    if (data.wrong_words_history && data.wrong_words_history.length > 0) {
      await db.wrong_words_history.bulkAdd(data.wrong_words_history);
    }
    if (data.study_records && data.study_records.length > 0) {
      await db.study_records.bulkAdd(data.study_records);
    }
    if (data.settings && data.settings.length > 0) {
      await db.settings.bulkAdd(data.settings);
    }
    
    console.log('数据导入成功');
  } catch (error) {
    console.error('导入数据失败:', error);
    throw error;
  }
}

/**
 * 检测是否为移动设备
 */
function isMobileDevice(): boolean {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

/**
 * 检测是否为Android设备
 */
function isAndroidDevice(): boolean {
  return /Android/i.test(navigator.userAgent);
}

/**
 * 检测是否为iOS设备
 */
function isIOSDevice(): boolean {
  return /iPhone|iPad|iPod/i.test(navigator.userAgent);
}

/**
 * 检测是否支持Web Share API
 */
function supportsWebShare(): boolean {
  return 'share' in navigator && 'canShare' in navigator;
}

/**
 * 获取Chrome版本号
 */
function getChromeVersion(): number {
  const match = navigator.userAgent.match(/Chrome\/(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

/**
 * 下载数据备份文件（简化版）
 * Android: 直接下载到Download文件夹，不弹对话框
 * iOS: 使用Web Share API
 * 桌面端: 使用File System Access API
 */
export async function downloadBackup(): Promise<void> {
  try {
    const jsonString = await exportAllData();
    const blob = new Blob([jsonString], { type: 'application/json' });
    
    // 生成默认文件名（使用纯英文，避免中文兼容性问题）
    const defaultFileName = `didi-words-backup-${new Date().toISOString().split('T')[0]}.json`;
    
    console.log('=== 开始导出备份 ===');
    console.log('User Agent:', navigator.userAgent);
    
    // Android: 使用传统下载方式（APK WebView完全支持）
    if (isAndroidDevice()) {
      console.log('=== Android 导出开始 ===');
      console.log('文件名:', defaultFileName);
      console.log('文件大小:', blob.size, 'bytes');
      console.log('文件类型:', blob.type);
      
      try {
        // 使用传统下载方式（APK中的WebView完全支持）
        console.log('Android: 使用传统下载方式');
        const url = URL.createObjectURL(blob);
        console.log('Blob URL 创建成功:', url);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = defaultFileName;
        a.style.display = 'none';
        
        document.body.appendChild(a);
        console.log('下载链接已添加到DOM');
        
        a.click();
        console.log('点击事件已触发');
        
        // ✅ 关键修复：大幅延长延迟到30秒，给Android微信WebView足够时间完成异步下载
        // Android微信的下载是异步的，交给内部下载器处理，需要更长的时间
        setTimeout(() => {
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          console.log('✅ Android: 资源已清理（30秒后）');
        }, 30000);
        
        console.log('✅ Android: 传统下载方式执行完成');
        return;
      } catch (error: any) {
        console.error('❌ Android 下载失败:', error);
        throw error;
      }
    }
    
    // iOS: 使用Web Share API
    if (isIOSDevice() && supportsWebShare()) {
      console.log('iOS: 尝试使用 Web Share API');
      try {
        const file = new File([blob], defaultFileName, { type: 'application/json' });
        
        // 检查是否可以分享文件
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: 'DIDI单词助记数据备份',
            text: '导出的单词数据备份文件',
          });
          console.log('✅ iOS: Web Share API 分享成功');
          return;
        } else {
          console.log('⚠️ iOS: 不支持分享文件，使用传统下载');
        }
      } catch (error: any) {
        console.error('❌ iOS: Web Share API 失败:', error.name, error.message);
        // 用户取消分享
        if (error.name === 'AbortError') {
          console.log('ℹ️ iOS: 用户取消了分享');
          throw new Error('用户取消分享');
        }
        console.log('⚠️ iOS: 降级到传统下载方式');
        // 降级到传统方式
      }
    }
    
    // 桌面端: 使用File System Access API
    if (!isMobileDevice() && 'showSaveFilePicker' in window) {
      console.log('桌面端: 尝试使用 File System Access API');
      try {
        const handle = await (window as any).showSaveFilePicker({
          suggestedName: defaultFileName,
          types: [
            {
              description: 'JSON文件',
              accept: {
                'application/json': ['.json'],
              },
            },
          ],
        });
        
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        
        console.log('✅ 桌面端: File System Access API 保存成功');
        return;
      } catch (error: any) {
        console.error('❌ 桌面端: File System Access API 失败:', error.name, error.message);
        // 用户取消选择
        if (error.name === 'AbortError') {
          console.log('ℹ️ 桌面端: 用户取消了文件保存对话框');
          throw new Error('用户取消保存');
        }
        console.log('⚠️ 桌面端: 降级到传统下载方式');
        // 降级到传统方式
      }
    }
    
    // 传统下载方式（最后的降级方案）
    console.log('使用传统下载方式');
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = defaultFileName;
    a.style.display = 'none';
    
    document.body.appendChild(a);
    a.click();
    
    // 延迟清理（给足够时间完成下载）
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      console.log('✅ 传统下载方式: 下载完成');
    }, 5000);
    
  } catch (error) {
    console.error('❌ 下载备份文件失败:', error);
    throw error;
  }
}

/**
 * 从文件恢复数据
 */
export async function restoreFromFile(file: File): Promise<void> {
  try {
    const text = await file.text();
    await importAllData(text);
    console.log('数据恢复成功');
  } catch (error) {
    console.error('恢复数据失败:', error);
    throw error;
  }
}

/**
 * 检查是否有数据
 */
export async function hasData(): Promise<boolean> {
  try {
    const wordCount = await db.words.count();
    return wordCount > 0;
  } catch (error) {
    console.error('检查数据失败:', error);
    return false;
  }
}

/**
 * 获取数据统计
 */
export async function getDataStats(): Promise<{
  wordCount: number;
  collectionCount: number;
  wrongWordCount: number;
  studyRecordCount: number;
}> {
  try {
    const [wordCount, collectionCount, wrongWordCount, studyRecordCount] = await Promise.all([
      db.words.count(),
      db.collections.count(),
      db.wrong_words.count(),
      db.study_records.count(),
    ]);
    
    return {
      wordCount,
      collectionCount,
      wrongWordCount,
      studyRecordCount,
    };
  } catch (error) {
    console.error('获取数据统计失败:', error);
    return {
      wordCount: 0,
      collectionCount: 0,
      wrongWordCount: 0,
      studyRecordCount: 0,
    };
  }
}
