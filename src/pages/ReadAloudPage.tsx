import { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { getWordsByCollections, getSetting } from '@/db/api';
import type { Word } from '@/types';
import { ArrowLeft, Volume2, Mic, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useTTS } from '@/hooks/useTTS';
import { useSTT } from '@/hooks/useSTT';

/**
 * 截取翻译的前两个词
 * 例如："需要，想要，打算，通缉" -> "需要，想要"
 */
function getShortTranslation(translation: string): string {
  if (!translation) return '';
  
  // 按中文标点符号分割（，、；等）
  const parts = translation.split(/[，、；]/);
  
  // 取前两个非空部分
  const shortParts = parts
    .map(p => p.trim())
    .filter(p => p.length > 0)
    .slice(0, 2);
  
  return shortParts.join('，');
}

export default function ReadAloudPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const collectionIds = searchParams.get('collections')?.split(',') || [];
  const wordCount = parseInt(searchParams.get('count') || '20');
  const autoPlayEnabled = searchParams.get('autoPlay') === 'true';
  const autoPlayCount = parseInt(searchParams.get('autoPlayCount') || '1');

  // 调试：打印URL参数
  console.log('ReadAloudPage URL参数:', {
    autoPlayParam: searchParams.get('autoPlay'),
    autoPlayCountParam: searchParams.get('autoPlayCount'),
    autoPlayEnabled,
    autoPlayCountValue: autoPlayCount,
  });

  const [words, setWords] = useState<Word[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [matchScore, setMatchScore] = useState<number | null>(null);
  const [threshold, setThreshold] = useState(60);

  // 使用ref存储最新的words和currentIndex，避免闭包问题
  const wordsRef = useRef<Word[]>([]);
  const currentIndexRef = useRef(0);
  const autoPlayingRef = useRef(false); // 标记是否正在自动播放

  // 同步state到ref
  useEffect(() => {
    wordsRef.current = words;
  }, [words]);

  useEffect(() => {
    currentIndexRef.current = currentIndex;
  }, [currentIndex]);

  // 使用新的TTS hook（支持移动端和微信浏览器）
  const { speak, stop: stopTTS, isSpeaking, error: ttsError } = useTTS();

  // 使用新的STT hook（支持移动端和微信浏览器）
  const {
    startRecording: startSTT,
    stopRecording: stopSTT,
    isRecording,
    error: sttError,
    isSupported: sttSupported,
  } = useSTT({
    maxDuration: 10000, // 最大10秒
    silenceThreshold: 15, // 静音阈值
    silenceDuration: 1000, // 静音1秒后自动停止（优化：从1.5秒缩短到1秒）
    onStart: () => {
      // 移除toast提示，用户可以从按钮状态看到录音开始
      console.log('录音已开始');
    },
    onStop: () => {
      console.log('录音已停止');
    },
    onResult: (text) => {
      handleRecognitionResult(text);
    },
    onError: (error) => {
      // 只记录日志，不显示toast
      console.error('STT错误:', error);
    },
  });

  useEffect(() => {
    loadWords();
    loadThreshold();
    
    // 清理函数
    return () => {
      stopTTS(); // 停止TTS播放
    };
  }, []);

  const playAudio = async () => {
    if (isSpeaking) {
      console.log('已在播放中，忽略重复点击');
      return;
    }

    // 检查当前单词是否存在
    if (!words[currentIndex]) {
      console.error('当前单词不存在:', currentIndex, words.length);
      return;
    }

    try {
      const currentWord = words[currentIndex].word;
      await speak(currentWord);
    } catch (error) {
      console.error('播放失败:', error);
      toast.error('播放失败，请重试');
    }
  };

  // 自动播放函数：英文→停顿600ms→中文→停顿1s→重复
  const autoPlayWord = async () => {
    if (!words[currentIndex] || autoPlayingRef.current) {
      return;
    }

    autoPlayingRef.current = true;
    const currentWord = words[currentIndex];

    try {
      console.log('开始自动播放:', currentWord.word, '次数:', autoPlayCount);
      
      for (let i = 0; i < autoPlayCount; i++) {
        // 检查是否被中断
        if (!autoPlayingRef.current) {
          console.log('自动播放被中断');
          return;
        }
        
        console.log(`第 ${i + 1} 次播放`);
        
        // 播放英文
        await speak(currentWord.word);
        console.log('英文播放完成，等待600ms');
        
        // 检查是否被中断
        if (!autoPlayingRef.current) {
          console.log('自动播放被中断（英文播放后）');
          return;
        }
        
        // 停顿600ms
        await new Promise(resolve => setTimeout(resolve, 600));
        
        // 检查是否被中断
        if (!autoPlayingRef.current) {
          console.log('自动播放被中断（停顿后）');
          return;
        }
        
        // 播放中文翻译（只读前两个词）
        const shortTranslation = getShortTranslation(currentWord.translation);
        await speak(shortTranslation);
        console.log('中文播放完成，等待1000ms');
        
        // 检查是否被中断
        if (!autoPlayingRef.current) {
          console.log('自动播放被中断（中文播放后）');
          return;
        }
        
        // 停顿1s（如果不是最后一次）
        if (i < autoPlayCount - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
      console.log('自动播放完成');
    } catch (error) {
      console.error('自动播放失败:', error);
    } finally {
      autoPlayingRef.current = false;
    }
  };

  // 当单词切换时，如果开启了自动播放，则自动播放
  useEffect(() => {
    if (autoPlayEnabled && words.length > 0 && !loading) {
      console.log('触发自动播放，当前索引:', currentIndex);
      autoPlayWord();
    }
  }, [currentIndex, words, loading, autoPlayEnabled]);

  // 显示TTS错误（仅在播放失败时显示，不影响朗读流程）
  useEffect(() => {
    if (ttsError) {
      console.error('TTS错误:', ttsError);
      // 不显示toast，避免干扰用户
    }
  }, [ttsError]);

  // 显示STT错误（仅记录日志，不显示toast）
  useEffect(() => {
    if (sttError) {
      console.error('STT错误:', sttError);
      // 不显示toast，用户可以从页面状态看到结果
    }
  }, [sttError]);

  // 处理识别结果
  const handleRecognitionResult = (recognizedText: string) => {
    // 使用ref获取最新的值，避免闭包问题
    const currentWords = wordsRef.current;
    const currentIdx = currentIndexRef.current;

    console.log('🎯 识别结果处理:');
    console.log('  - 当前索引:', currentIdx);
    console.log('  - 单词总数:', currentWords.length);
    console.log('  - 原始识别文本:', recognizedText);

    // 检查当前单词是否存在
    if (!currentWords[currentIdx]) {
      console.error('handleRecognitionResult: 当前单词不存在', currentIdx, currentWords.length);
      toast.error('当前单词不存在');
      return;
    }

    const targetWord = currentWords[currentIdx].word.toLowerCase();
    const transcript = recognizedText.toLowerCase().trim();
    
    console.log('  - 处理后文本:', transcript);
    console.log('  - 目标单词:', targetWord);
    console.log('  - 文本长度:', transcript.length);
    console.log('  - 是否为空:', transcript === '');

    // 如果识别结果为空
    if (!transcript || transcript === '') {
      console.warn('⚠️ 识别结果为空！');
      setMatchScore(0);
      // 移除toast提示，用户可以从页面看到匹配度为0
      return;
    }

    // 计算匹配度
    const score = calculateMatchScore(transcript, targetWord);
    console.log('  - 匹配度:', score + '%');
    console.log('  - 识别文本:', transcript);
    console.log('  - 目标单词:', targetWord);
    setMatchScore(score);
    
    // 移除toast提示，用户可以从页面看到匹配度和结果
    // 不需要额外的弹窗干扰
  };

  // 开始录音
  const startRecording = async () => {
    if (!sttSupported) {
      toast.error('您的浏览器不支持录音功能', {
        description: '请使用Chrome、Edge或Safari浏览器',
        duration: 5000,
      });
      return;
    }

    if (isRecording) {
      console.log('已在录音中，忽略重复调用');
      return;
    }

    // 检查当前单词是否存在
    if (!words[currentIndex]) {
      console.error('当前单词不存在:', currentIndex, words.length);
      toast.error('当前单词不存在');
      return;
    }

    setMatchScore(null);
    const currentWord = words[currentIndex].word;
    await startSTT(currentWord);
  };

  const loadWords = async () => {
    try {
      setLoading(true);
      let data: Word[] = [];

      if (collectionIds.length > 0 && collectionIds[0]) {
        data = await getWordsByCollections(collectionIds);
      } else {
        toast.error('请选择章节');
        navigate('/read-aloud-settings');
        return;
      }

      if (data.length === 0) {
        toast.error('所选章节为空，请先添加单词');
        navigate('/words');
        return;
      }

      // 随机打乱并限制数量
      data = data.sort(() => Math.random() - 0.5).slice(0, wordCount);
      setWords(data);
    } catch (error) {
      console.error('加载单词失败:', error);
      toast.error('加载单词失败');
    } finally {
      setLoading(false);
    }
  };

  const loadThreshold = async () => {
    try {
      const value = await getSetting('pronunciation_threshold');
      if (value) {
        setThreshold(Number(value));
      }
    } catch (error) {
      console.error('加载阈值失败:', error);
    }
  };


  const calculateMatchScore = (transcript: string, target: string): number => {
    // 完全匹配
    if (transcript === target) return 100;

    // 包含目标单词
    if (transcript.includes(target)) return 90;

    // 计算编辑距离相似度
    const distance = levenshteinDistance(transcript, target);
    const maxLen = Math.max(transcript.length, target.length);
    const similarity = ((maxLen - distance) / maxLen) * 100;

    return Math.max(0, Math.round(similarity));
  };

  const levenshteinDistance = (str1: string, str2: string): number => {
    const matrix: number[][] = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  };

  const handleNext = () => {
    // 立即停止当前播放（无论是否在播放）
    stopTTS();
    
    // 标记停止自动播放
    autoPlayingRef.current = false;
    
    // 停止录音
    if (isRecording) {
      stopSTT();
    }
    
    if (currentIndex < words.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setMatchScore(null);
    } else {
      setCurrentIndex(0);
      setMatchScore(null);
    }
  };

  const handlePrevious = () => {
    // 立即停止当前播放（无论是否在播放）
    stopTTS();
    
    // 标记停止自动播放
    autoPlayingRef.current = false;
    
    // 停止录音
    if (isRecording) {
      stopSTT();
    }
    
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setMatchScore(null);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">加载中...</p>
      </div>
    );
  }

  if (words.length === 0) {
    return null;
  }

  const currentWord = words[currentIndex];
  const isPassed = matchScore !== null && matchScore >= threshold;

  return (
    <div className="flex min-h-screen w-full flex-col bg-background">
      {/* 头部 */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/read-aloud-settings')}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex-1">
              <h1 className="text-xl font-bold text-foreground">跟读学习</h1>
              <p className="text-sm text-muted-foreground">
                {currentIndex + 1} / {words.length}
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* 主内容 */}
      <main className="container mx-auto flex flex-1 items-center justify-center px-4 py-8">
        <Card className="w-full max-w-2xl border border-border p-8">
          <div className="space-y-8">
            {/* 单词显示 */}
            <div className="text-center">
              <h2 className="text-4xl font-bold text-foreground">{currentWord.word}</h2>
              {currentWord.phonetic && (
                <p className="phonetic mt-4 inline-block">{currentWord.phonetic}</p>
              )}
              <p className="mt-4 text-lg text-muted-foreground">{currentWord.translation}</p>
            </div>

            {/* 播放按钮 */}
            <div className="flex justify-center">
              <Button
                variant="outline"
                size="lg"
                onClick={playAudio}
                disabled={isSpeaking}
                className="gap-2"
              >
                {isSpeaking ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    播放中...
                  </>
                ) : (
                  <>
                    <Volume2 className="h-5 w-5" />
                    播放发音
                  </>
                )}
              </Button>
            </div>

            {/* 录音按钮 */}
            <div className="space-y-4">
              {!sttSupported && (
                <div className="rounded-sm border border-destructive bg-destructive/10 p-4 text-sm text-destructive">
                  <p className="font-semibold">⚠️ 语音识别不可用</p>
                  <p className="mt-1 text-xs">
                    您的浏览器不支持语音识别功能。iOS设备暂不支持，建议使用Android Chrome浏览器。
                  </p>
                </div>
              )}
              
              <Button
                size="lg"
                onClick={startRecording}
                disabled={isRecording || !sttSupported}
                className="w-full gap-2"
              >
                {isRecording ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    录音中...
                  </>
                ) : (
                  <>
                    <Mic className="h-5 w-5" />
                    开始朗读
                  </>
                )}
              </Button>

              {/* 匹配度结果 */}
              {matchScore !== null && (
                <div
                  className={`rounded-sm border p-4 text-center ${
                    isPassed
                      ? 'border-primary bg-primary/5'
                      : 'border-destructive bg-destructive/5'
                  }`}
                >
                  <div className="text-3xl font-bold" style={{ color: isPassed ? 'hsl(var(--primary))' : 'hsl(var(--destructive))' }}>
                    {matchScore}%
                  </div>
                  <p className="mt-2 text-sm" style={{ color: isPassed ? 'hsl(var(--primary))' : 'hsl(var(--destructive))' }}>
                    {isPassed ? '发音合格' : '发音不合格'}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    合格标准：≥ {threshold}%
                  </p>
                </div>
              )}
            </div>

            {/* 翻页按钮 */}
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={handlePrevious}
                disabled={currentIndex === 0}
                className="flex-1"
              >
                上一个
              </Button>
              <Button onClick={handleNext} className="flex-1">
                下一个
              </Button>
            </div>
          </div>
        </Card>
      </main>
    </div>
  );
}
