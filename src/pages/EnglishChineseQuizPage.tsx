import { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { getWordsByCollections, addOrUpdateWrongWord, decreaseWrongWordWeight, addStudyRecord, getWrongWordsByWeight, getAllWrongWords, getSetting } from '@/db/api';
import type { Word, QuizResult } from '@/types';
import { ArrowLeft, AlertCircle, Volume2 } from 'lucide-react';
import { toast } from 'sonner';
import { useTTS } from '@/hooks/useTTS';

interface QuizOption {
  label: string;
  value: string;
  isCorrect: boolean;
}

interface WordWithWrongInfo extends Word {
  isFromWrongWords?: boolean;
  wrongWordWeight?: number;
}

/**
 * 提取翻译的主要部分（用于答题选项）
 * 规则：
 * 1. 如果翻译包含分号（；），取第一个分号前的内容（第一个词性的释义）
 * 2. 如果翻译包含逗号（，），取前3个逗号分隔的内容
 * 3. 如果翻译超过30个字符，截取前30个字符
 * 4. 否则返回完整翻译
 * 
 * 注：API返回的翻译格式为"释义1，释义2，释义3；另一词性释义1，释义2"
 */
function getMainTranslation(translation: string): string {
  if (!translation) return '';
  
  // 如果包含分号，取第一个分号前的内容
  if (translation.includes('；')) {
    const parts = translation.split('；');
    return parts[0].trim();
  }
  
  // 如果包含逗号，取前3个
  if (translation.includes('，')) {
    const parts = translation.split('，');
    if (parts.length > 3) {
      return parts.slice(0, 3).join('，');
    }
  }
  
  // 如果超过30个字符，截取
  if (translation.length > 30) {
    return translation.substring(0, 30) + '...';
  }
  
  return translation;
}

export default function EnglishChineseQuizPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const collectionIds = searchParams.get('collections')?.split(',') || [];
  const wordCount = parseInt(searchParams.get('count') || '20');
  const wrongWordInsertion = searchParams.get('wrongWordInsertion') === 'true';
  const wrongWordCount = parseInt(searchParams.get('wrongWordCount') || '10');
  const includePhrases = searchParams.get('includePhrases') !== 'false'; // 默认包含词组

  const [words, setWords] = useState<WordWithWrongInfo[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [options, setOptions] = useState<QuizOption[]>([]);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [results, setResults] = useState<QuizResult[]>([]);
  const [startTime] = useState(Date.now());
  const [loading, setLoading] = useState(true);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [autoPlayEnabled, setAutoPlayEnabled] = useState(true);
  const [autoPlayCount, setAutoPlayCount] = useState(1);

  // 使用ref标记是否正在播放，用于中断播放
  const isPlayingRef = useRef(false);

  // 使用TTS hook
  const { speak, stop: stopTTS, isSpeaking } = useTTS();

  useEffect(() => {
    loadWords();
    loadSettings();
  }, []);

  useEffect(() => {
    if (words.length > 0 && currentIndex < words.length) {
      generateOptions();
      // 自动播放单词读音
      if (autoPlayEnabled) {
        playWordPronunciation();
      }
    }
  }, [currentIndex, words]);

  const loadSettings = async () => {
    try {
      const [autoPlay, playCount] = await Promise.all([
        getSetting('auto_play_pronunciation'),
        getSetting('auto_play_count'),
      ]);
      if (autoPlay !== null) setAutoPlayEnabled(autoPlay === 'true');
      if (playCount) setAutoPlayCount(Number(playCount));
    } catch (error) {
      console.error('加载设置失败:', error);
    }
  };

  // 播放单词读音（支持连续播放）
  const playWordPronunciation = async () => {
    console.log('EnglishChineseQuizPage playWordPronunciation called:', {
      currentIndex,
      wordsLength: words.length,
      hasCurrentWord: !!words[currentIndex],
      autoPlayEnabled,
      autoPlayCount,
    });

    if (!words[currentIndex]) {
      console.warn('当前单词不存在，跳过播放');
      return;
    }
    
    // 如果已在播放，先停止
    if (isPlayingRef.current) {
      console.log('已在播放中，先停止');
      stopTTS();
      isPlayingRef.current = false;
    }
    
    isPlayingRef.current = true;
    const word = words[currentIndex].word;
    const count = autoPlayCount;
    
    console.log('开始播放单词:', word, '次数:', count);
    
    try {
      for (let i = 0; i < count; i++) {
        // 检查是否被中断
        if (!isPlayingRef.current) {
          console.log('播放被中断');
          return;
        }
        
        await speak(word);
        
        // 检查是否被中断
        if (!isPlayingRef.current) {
          console.log('播放被中断（播放后）');
          return;
        }
        
        // 如果不是最后一次，等待1秒
        if (i < count - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    } catch (error) {
      console.error('播放失败:', error);
    } finally {
      isPlayingRef.current = false;
    }
  };

  const loadWords = async () => {
    try {
      setLoading(true);
      let data: WordWithWrongInfo[] = [];

      if (collectionIds.length > 0 && collectionIds[0]) {
        data = await getWordsByCollections(collectionIds);
      } else {
        toast.error('请选择章节');
        navigate('/study-mode-select');
        return;
      }

      if (data.length === 0) {
        toast.error('所选章节为空，请先添加单词');
        navigate('/words');
        return;
      }

      // 根据设置过滤词组
      if (!includePhrases) {
        data = data.filter(word => !word.word.includes(' '));
        if (data.length === 0) {
          toast.error('过滤词组后没有可用单词');
          navigate('/study-mode-select');
          return;
        }
      }

      // 随机打乱并限制数量
      data = data.sort(() => Math.random() - 0.5).slice(0, wordCount);
      
      // 如果启用易错词插入，获取易错词并混入
      if (wrongWordInsertion && wrongWordCount > 0) {
        const wrongWords = await getWrongWordsByWeight(wrongWordCount);
        const allWrongWords = await getAllWrongWords();
        
        // 创建易错词权重映射
        const wrongWordWeightMap = new Map<string, number>();
        allWrongWords.forEach(ww => {
          wrongWordWeightMap.set(ww.word_id, ww.weight);
        });
        
        // 提取易错词的单词信息并标记
        const wrongWordsWithInfo: WordWithWrongInfo[] = wrongWords
          .map(ww => ww.word)
          .filter((word): word is Word => word !== undefined)
          .map(word => ({
            ...word,
            isFromWrongWords: true,
            wrongWordWeight: wrongWordWeightMap.get(word.id) || 3,
          }));
        
        // 过滤掉已经在data中的单词（避免重复）
        const existingWordIds = new Set(data.map(w => w.id));
        const uniqueWrongWords = wrongWordsWithInfo.filter(w => !existingWordIds.has(w.id));
        
        // 混入易错词
        data = [...data, ...uniqueWrongWords];
        
        // 再次随机打乱
        data = data.sort(() => Math.random() - 0.5);
      }
      
      setWords(data);
    } catch (error) {
      console.error('加载单词失败:', error);
      toast.error('加载单词失败');
    } finally {
      setLoading(false);
    }
  };

  const generateOptions = () => {
    const currentWord = words[currentIndex];
    const correctAnswer = getMainTranslation(currentWord.translation);

    // 获取其他单词作为干扰项
    const otherWords = words.filter((_, idx) => idx !== currentIndex);
    const shuffledOthers = otherWords.sort(() => Math.random() - 0.5);
    const distractors = shuffledOthers.slice(0, 3).map(w => getMainTranslation(w.translation));

    // 组合选项
    const allOptions = [
      { label: 'A', value: correctAnswer, isCorrect: true },
      { label: 'B', value: distractors[0] || '选项B', isCorrect: false },
      { label: 'C', value: distractors[1] || '选项C', isCorrect: false },
      { label: 'D', value: distractors[2] || '选项D', isCorrect: false },
    ];

    // 随机打乱选项顺序
    const shuffled = allOptions.sort(() => Math.random() - 0.5);
    // 重新分配ABCD标签
    shuffled.forEach((opt, idx) => {
      opt.label = ['A', 'B', 'C', 'D'][idx];
    });

    setOptions(shuffled);
    setSelectedOption(null);
    setShowResult(false);
  };

  const handleSelectOption = (option: QuizOption) => {
    if (showResult) return;

    setSelectedOption(option.label);
    setShowResult(true);

    const currentWord = words[currentIndex];
    const isCorrect = option.isCorrect;

    // 记录结果
    const result: QuizResult = {
      word: currentWord,
      userAnswer: option.value,
      isCorrect,
    };
    setResults([...results, result]);

    // 更新易错词权重
    if (isCorrect) {
      // 答对：如果该词在易错词库中，权重-1
      decreaseWrongWordWeight(currentWord.id).catch(console.error);
    } else {
      // 答错：权重+3
      addOrUpdateWrongWord(currentWord.id).catch(console.error);
    }
  };

  const handleNext = () => {
    // 立即停止当前播放
    stopTTS();
    // 标记停止播放
    isPlayingRef.current = false;
    
    if (currentIndex < words.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      handleFinish();
    }
  };

  const handleFinish = async () => {
    const duration = Math.floor((Date.now() - startTime) / 1000 / 60);
    const correctCount = results.filter(r => r.isCorrect).length;
    const accuracy = results.length > 0 ? (correctCount / results.length) * 100 : 0;

    try {
      await addStudyRecord({
        study_date: new Date().toISOString().split('T')[0],
        study_duration: duration,
        words_studied: results.length,
        correct_count: correctCount,
        total_count: results.length,
        accuracy,
        mode: 'english_chinese',
      });
    } catch (error) {
      console.error('保存学习记录失败:', error);
    }

    navigate('/quiz-result', {
      state: {
        results: results,
        mode: 'english_chinese',
      },
    });
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-muted-foreground">加载中...</p>
      </div>
    );
  }

  if (words.length === 0) {
    return null;
  }

  const currentWord = words[currentIndex];
  const progress = ((currentIndex + 1) / words.length) * 100;

  return (
    <div className="flex min-h-screen w-full flex-col bg-background">
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => setShowExitConfirm(true)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex-1">
              <h1 className="text-xl font-bold text-foreground">英汉模式</h1>
              <p className="text-sm text-muted-foreground">
                {currentIndex + 1} / {words.length}
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto flex-1 px-4 py-6">
        <div className="mx-auto max-w-2xl space-y-6">
          <Progress value={progress} className="h-2" />

          <Card className="border border-border p-8">
            <div className="space-y-6">
              {/* 易错词提示 */}
              {currentWord.isFromWrongWords && (
                <div className="flex items-center justify-center gap-2 rounded-lg bg-purple-500/10 p-3 text-purple-700 dark:text-purple-300">
                  <AlertCircle className="h-5 w-5" />
                  <div className="text-sm">
                    <span className="font-semibold">本题来自易错词库</span>
                    <span className="mx-2">·</span>
                    <span>当前权重 {currentWord.wrongWordWeight}</span>
                    <span className="mx-2">·</span>
                    <span>加油！</span>
                  </div>
                </div>
              )}
              
              <div className="text-center">
                <div className="flex items-center justify-center gap-3">
                  <h2 className={`text-3xl font-bold ${currentWord.isFromWrongWords ? 'text-purple-600 dark:text-purple-400' : 'text-foreground'}`}>
                    {currentWord.word}
                  </h2>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={playWordPronunciation}
                    disabled={isSpeaking}
                    className="h-10 w-10"
                  >
                    <Volume2 className={`h-5 w-5 ${isSpeaking ? 'text-primary animate-pulse' : ''}`} />
                  </Button>
                </div>
                {currentWord.phonetic && (
                  <p className={`mt-2 font-mono text-lg ${currentWord.isFromWrongWords ? 'text-purple-500 dark:text-purple-400' : 'text-muted-foreground'}`}>
                    {currentWord.phonetic}
                  </p>
                )}
              </div>

              <div className="space-y-3">
                {options.map((option) => {
                  let buttonClass = 'w-full justify-start text-left h-auto py-4 px-6';
                  
                  if (showResult && selectedOption === option.label) {
                    if (option.isCorrect) {
                      buttonClass += ' bg-green-500/20 border-green-500 text-green-700 dark:text-green-300';
                    } else {
                      buttonClass += ' bg-red-500/20 border-red-500 text-red-700 dark:text-red-300';
                    }
                  } else if (showResult && option.isCorrect) {
                    buttonClass += ' bg-green-500/20 border-green-500 text-green-700 dark:text-green-300';
                  }

                  return (
                    <Button
                      key={option.label}
                      variant="outline"
                      className={buttonClass}
                      onClick={() => handleSelectOption(option)}
                      disabled={showResult}
                    >
                      <span className="mr-4 font-bold shrink-0">{option.label}.</span>
                      <span className="break-words whitespace-normal">{option.value}</span>
                    </Button>
                  );
                })}
              </div>

              {showResult && (
                <div className="flex justify-center pt-4">
                  <Button onClick={handleNext} size="lg">
                    {currentIndex < words.length - 1 ? '下一题' : '查看结果'}
                  </Button>
                </div>
              )}
            </div>
          </Card>
        </div>
      </main>

      {/* 退出确认对话框 */}
      <Dialog open={showExitConfirm} onOpenChange={setShowExitConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认退出</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            确定要退出当前学习吗？当前进度将不会被保存。
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowExitConfirm(false)}>
              继续学习
            </Button>
            <Button onClick={() => navigate('/study-mode-select')}>
              确认退出
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
