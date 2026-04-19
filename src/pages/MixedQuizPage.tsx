import { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { getWordsByCollections, addOrUpdateWrongWord, decreaseWrongWordWeight, addStudyRecord, getWrongWordsByWeight, getAllWrongWords, getSetting } from '@/db/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import type { Word, QuizResult } from '@/types';
import { ArrowLeft, AlertCircle, Volume2 } from 'lucide-react';
import { toast } from 'sonner';
import { useTTS } from '@/hooks/useTTS';

interface QuizOption {
  label: string;
  value: string;
  isCorrect: boolean;
}

type QuestionType = 'english_chinese' | 'chinese_english';

interface WordWithWrongInfo extends Word {
  isFromWrongWords?: boolean;
  wrongWordWeight?: number;
}

/**
 * 提取翻译的主要部分（用于答题显示）
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
  
  // 如果包含顿号，取前3个
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

export default function MixedQuizPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const collectionIds = searchParams.get('collections')?.split(',') || [];
  const wordCount = parseInt(searchParams.get('count') || '20');
  const wrongWordInsertion = searchParams.get('wrongWordInsertion') === 'true';
  const wrongWordCount = parseInt(searchParams.get('wrongWordCount') || '10');
  const includePhrases = searchParams.get('includePhrases') !== 'false'; // 默认包含词组

  const [words, setWords] = useState<WordWithWrongInfo[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [questionType, setQuestionType] = useState<QuestionType>('english_chinese');
  
  // 英汉模式状态
  const [options, setOptions] = useState<QuizOption[]>([]);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  
  // 汉英模式状态
  const [maskedWord, setMaskedWord] = useState('');
  const [userInputs, setUserInputs] = useState<string[]>([]);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [isPhraseMode, setIsPhraseMode] = useState(false); // 是否是词组模式
  const [phraseInput, setPhraseInput] = useState(''); // 词组完整输入
  
  const [showResult, setShowResult] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
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

  const keyboard = [
    ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
    ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
    ['Z', 'X', 'C', 'V', 'B', 'N', 'M'],
  ];

  useEffect(() => {
    loadWords();
    loadSettings();
  }, []);

  useEffect(() => {
    if (words.length > 0 && currentIndex < words.length) {
      generateQuestion();
    }
  }, [currentIndex, words]);

  // 单独监听questionType变化，当题型确定后再决定是否播放
  useEffect(() => {
    if (words.length > 0 && currentIndex < words.length && questionType === 'english_chinese' && autoPlayEnabled) {
      playWordPronunciation();
    }
  }, [questionType]);

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
    console.log('playWordPronunciation called:', {
      currentIndex,
      wordsLength: words.length,
      hasCurrentWord: !!words[currentIndex],
      questionType,
      autoPlayEnabled,
    });

    if (!words[currentIndex]) {
      console.warn('当前单词不存在，跳过播放');
      return;
    }

    if (questionType !== 'english_chinese') {
      console.log('非英汉模式，跳过播放');
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

  const generateQuestion = () => {
    // 随机选择题型
    const type: QuestionType = Math.random() > 0.5 ? 'english_chinese' : 'chinese_english';
    setQuestionType(type);

    if (type === 'english_chinese') {
      generateOptions();
    } else {
      generateMaskedWord();
    }
  };

  const generateOptions = () => {
    const currentWord = words[currentIndex];
    const correctAnswer = getMainTranslation(currentWord.translation);

    const otherWords = words.filter((_, idx) => idx !== currentIndex);
    const shuffledOthers = otherWords.sort(() => Math.random() - 0.5);
    const distractors = shuffledOthers.slice(0, 3).map(w => getMainTranslation(w.translation));

    const allOptions = [
      { label: 'A', value: correctAnswer, isCorrect: true },
      { label: 'B', value: distractors[0] || '选项B', isCorrect: false },
      { label: 'C', value: distractors[1] || '选项C', isCorrect: false },
      { label: 'D', value: distractors[2] || '选项D', isCorrect: false },
    ];

    const shuffled = allOptions.sort(() => Math.random() - 0.5);
    shuffled.forEach((opt, idx) => {
      opt.label = ['A', 'B', 'C', 'D'][idx];
    });

    setOptions(shuffled);
    setSelectedOption(null);
    setShowResult(false);
  };

  const generateMaskedWord = () => {
    const currentWord = words[currentIndex].word;
    
    // 检测是否是词组（包含空格）
    const isPhrase = currentWord.includes(' ');
    setIsPhraseMode(isPhrase);
    
    if (isPhrase) {
      // 词组模式：使用完整输入
      setPhraseInput('');
      setMaskedWord('');
      setUserInputs([]);
      setShowResult(false);
      setIsCorrect(false);
    } else {
      // 单词模式：字母填空
      const upperWord = currentWord.toUpperCase();
      const length = upperWord.length;
      
      const revealCount = Math.max(1, Math.floor(length * 0.3));
      const revealIndices = new Set<number>();
      
      while (revealIndices.size < revealCount) {
        revealIndices.add(Math.floor(Math.random() * length));
      }

      let masked = '';
      const inputs: string[] = [];
      
      for (let i = 0; i < length; i++) {
        if (revealIndices.has(i)) {
          masked += upperWord[i];
          inputs.push(upperWord[i]);
        } else {
          masked += '*';
          inputs.push('');
        }
      }

      setMaskedWord(masked);
      setUserInputs(inputs);
      setPhraseInput('');
      setShowResult(false);
      setIsCorrect(false);
      
      const firstEmptyIndex = inputs.findIndex((input: string) => input === '');
      setFocusedIndex(firstEmptyIndex >= 0 ? firstEmptyIndex : 0);
    }
  };

  const handleSelectOption = (option: QuizOption) => {
    if (showResult) return;

    setSelectedOption(option.label);
    setShowResult(true);

    const currentWord = words[currentIndex];
    const correct = option.isCorrect;
    setIsCorrect(correct);

    const result: QuizResult = {
      word: currentWord,
      userAnswer: option.value,
      isCorrect: correct,
    };
    setResults([...results, result]);

    // 更新易错词权重
    if (correct) {
      // 答对：如果该词在易错词库中，权重-1
      decreaseWrongWordWeight(currentWord.id).catch(console.error);
    } else {
      // 答错：权重+3
      addOrUpdateWrongWord(currentWord.id).catch(console.error);
    }
  };

  const handleKeyPress = (letter: string) => {
    if (showResult) return;

    const newInputs = [...userInputs];
    
    if (focusedIndex < newInputs.length && newInputs[focusedIndex] === '') {
      newInputs[focusedIndex] = letter;
      setUserInputs(newInputs);
      
      const nextEmptyIndex = newInputs.findIndex((input, idx) => idx > focusedIndex && input === '');
      if (nextEmptyIndex >= 0) {
        setFocusedIndex(nextEmptyIndex);
      }
    }
  };

  const handleInputClick = (index: number) => {
    if (showResult) return;
    if (userInputs[index] === '' || maskedWord[index] === '*') {
      setFocusedIndex(index);
    }
  };

  const handleBackspace = () => {
    if (showResult) return;

    const newInputs = [...userInputs];
    if (newInputs[focusedIndex] !== '' && maskedWord[focusedIndex] === '*') {
      newInputs[focusedIndex] = '';
      setUserInputs(newInputs);
    } else {
      for (let i = focusedIndex - 1; i >= 0; i--) {
        if (maskedWord[i] === '*' && newInputs[i] !== '') {
          newInputs[i] = '';
          setUserInputs(newInputs);
          setFocusedIndex(i);
          break;
        }
      }
    }
  };

  const handleSubmitFillIn = () => {
    const currentWord = words[currentIndex];
    const correctAnswer = currentWord.word.toLowerCase();
    
    let userAnswer: string;
    let correct: boolean;
    
    if (isPhraseMode) {
      // 词组模式：比较完整输入
      userAnswer = phraseInput.trim().toLowerCase();
      correct = userAnswer === correctAnswer;
    } else {
      // 单词模式：比较字母填空
      userAnswer = userInputs.join('').toLowerCase();
      correct = userAnswer === correctAnswer;
    }

    setIsCorrect(correct);
    setShowResult(true);

    const result: QuizResult = {
      word: currentWord,
      userAnswer,
      isCorrect: correct,
    };
    setResults([...results, result]);

    // 更新易错词权重
    if (correct) {
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
        mode: 'mixed',
      });
    } catch (error) {
      console.error('保存学习记录失败:', error);
    }

    navigate('/quiz-result', {
      state: {
        results: results,
        mode: 'mixed',
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
  
  // 检查是否可以提交
  const canSubmit = questionType === 'chinese_english'
    ? (isPhraseMode 
        ? phraseInput.trim().length > 0 
        : userInputs.every((input, idx) => input !== '' || maskedWord[idx] !== '*'))
    : true;

  return (
    <div className="flex min-h-screen w-full flex-col bg-background">
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => setShowExitConfirm(true)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex-1">
              <h1 className="text-xl font-bold text-foreground">混合模式</h1>
              <p className="text-sm text-muted-foreground">
                {currentIndex + 1} / {words.length} · {questionType === 'english_chinese' ? '英汉' : '汉英'}
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
              
              {questionType === 'english_chinese' ? (
                <>
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

                  {/* 英汉模式：下一题按钮（在选项下方） */}
                  {showResult && (
                    <div className="flex justify-center">
                      <Button onClick={handleNext} size="lg" className="w-full">
                        {currentIndex < words.length - 1 ? '下一题' : '查看结果'}
                      </Button>
                    </div>
                  )}

                  {/* 英汉模式：结果显示（在下一题按钮下方） */}
                  {showResult && (
                    <div className="space-y-4">
                      <div className={`rounded-lg p-4 text-center ${
                        isCorrect
                          ? 'bg-green-500/20 text-green-700 dark:text-green-300'
                          : 'bg-red-500/20 text-red-700 dark:text-red-300'
                      }`}>
                        <div className="text-lg font-semibold">
                          {isCorrect ? '✓ 回答正确' : '✗ 回答错误'}
                        </div>
                        {!isCorrect && (
                          <div className="mt-2">
                            <div className="text-sm">正确答案：{getMainTranslation(currentWord.translation)}</div>
                            <div className="text-sm">你的答案：{options.find(o => o.label === selectedOption)?.value}</div>
                          </div>
                        )}
                      </div>

                      <div className="rounded-lg border border-border bg-muted p-4">
                        <div className="space-y-2 text-sm">
                          <div><span className="font-semibold">单词：</span>{currentWord.word}</div>
                          {currentWord.phonetic && (
                            <div><span className="font-semibold">音标：</span>{currentWord.phonetic}</div>
                          )}
                          <div><span className="font-semibold">翻译：</span>{currentWord.translation}</div>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">请根据中文释义填写单词</p>
                    <h2 className={`mt-2 text-2xl font-bold break-words ${currentWord.isFromWrongWords ? 'text-purple-600 dark:text-purple-400' : 'text-foreground'}`}>
                      {getMainTranslation(currentWord.translation)}
                    </h2>
                    {currentWord.part_of_speech && (
                      <p className={`mt-1 text-sm ${currentWord.isFromWrongWords ? 'text-purple-500 dark:text-purple-400' : 'text-muted-foreground'}`}>
                        [{currentWord.part_of_speech}]
                      </p>
                    )}
                  </div>

                  {/* 输入区域 */}
                  {isPhraseMode ? (
                    /* 词组模式：完整输入框 */
                    <div className="space-y-4">
                      <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                        <Badge variant="secondary">词组</Badge>
                        <span>请输入完整词组</span>
                      </div>
                      <input
                        type="text"
                        value={phraseInput}
                        onChange={(e) => setPhraseInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && phraseInput.trim() && !showResult) {
                            handleSubmitFillIn();
                          }
                        }}
                        disabled={showResult}
                        placeholder="输入词组..."
                        className="w-full rounded-md border-2 border-border bg-background px-4 py-3 text-center text-xl font-medium lowercase focus:border-primary focus:outline-none disabled:opacity-50"
                        autoFocus
                      />
                    </div>
                  ) : (
                    /* 单词模式：字母输入框 - 响应式大小，确保不超出页面 */
                    <div className="flex justify-center items-center gap-1 flex-wrap w-full px-2">
                      {(() => {
                        // 将单词按空格分割成多个部分
                        const parts: string[][] = [];
                        let currentPart: string[] = [];
                        
                        for (let i = 0; i < currentWord.word.length; i++) {
                          if (currentWord.word[i] === ' ') {
                            if (currentPart.length > 0) {
                              parts.push(currentPart);
                              currentPart = [];
                            }
                          } else {
                            currentPart.push(currentWord.word[i]);
                          }
                        }
                        if (currentPart.length > 0) {
                          parts.push(currentPart);
                        }
                        
                        // 渲染每个部分（单词）
                        let globalIndex = 0;
                        return parts.map((part, partIndex) => {
                          const partLength = part.length;
                          
                          // 响应式字母框大小计算
                          // 移动端可用宽度约为 343px（375px - 32px padding）
                          // 字母框间距：4px（gap-1）
                          
                          let boxSize = '';
                          if (partLength <= 6) {
                            // 6个字母以内：使用较大字母框（w-14 = 56px）
                            boxSize = 'w-14 h-14 text-2xl';
                          } else if (partLength <= 8) {
                            // 7-8个字母：使用中等字母框（w-11 = 44px）
                            boxSize = 'w-11 h-11 text-xl';
                          } else if (partLength <= 10) {
                            // 9-10个字母：使用较小字母框（w-9 = 36px）
                            boxSize = 'w-9 h-9 text-lg';
                          } else if (partLength <= 12) {
                            // 11-12个字母：使用更小字母框（w-8 = 32px）
                            boxSize = 'w-8 h-8 text-base';
                          } else if (partLength <= 15) {
                            // 13-15个字母：使用很小字母框（w-7 = 28px）
                            boxSize = 'w-7 h-7 text-sm';
                          } else {
                            // 16个字母以上：使用最小字母框（w-6 = 24px）
                            boxSize = 'w-6 h-6 text-xs';
                          }
                          
                          const partElements = part.map((_, letterIndex) => {
                            const index = globalIndex + letterIndex;
                            const isRevealed = maskedWord[index] !== '*';
                            const isFocused = focusedIndex === index && !showResult;
                            
                            return (
                              <div
                                key={index}
                                onClick={() => handleInputClick(index)}
                                className={`flex ${boxSize} items-center justify-center rounded-md border-2 font-bold lowercase transition-colors shrink-0 ${
                                  isRevealed
                                    ? 'border-muted bg-muted text-muted-foreground'
                                    : isFocused
                                      ? 'border-primary bg-primary/10'
                                      : userInputs[index]
                                        ? 'border-border bg-card text-foreground'
                                        : 'border-dashed border-border bg-background'
                                } ${showResult && !isCorrect ? 'border-red-500' : ''} ${
                                  showResult && isCorrect ? 'border-green-500' : ''
                                }`}
                              >
                                {userInputs[index] || (isFocused ? '|' : '')}
                              </div>
                            );
                          });
                          
                          globalIndex += partLength + 1; // +1 for space
                          
                          return (
                            <div key={partIndex} className="flex gap-1 items-center justify-center">
                              {partElements}
                              {partIndex < parts.length - 1 && <div className="w-2" />}
                            </div>
                          );
                        });
                      })()}
                    </div>
                  )}

                  {!showResult && !isPhraseMode && (
                    <div className="space-y-2">
                      {keyboard.map((row, rowIndex) => (
                        <div key={rowIndex} className="flex justify-center gap-1">
                          {row.map((letter) => (
                            <Button
                              key={letter}
                              variant="outline"
                              size="sm"
                              onClick={() => handleKeyPress(letter)}
                              className="h-10 w-8 min-w-0 p-0 text-sm font-semibold lowercase sm:w-10"
                            >
                              {letter}
                            </Button>
                          ))}
                        </div>
                      ))}
                      <div className="flex justify-center gap-2">
                        <Button variant="outline" onClick={handleBackspace} className="px-4 sm:px-6">
                          删除
                        </Button>
                        <Button onClick={handleSubmitFillIn} disabled={!canSubmit} className="px-6 sm:px-8">
                          提交答案
                        </Button>
                      </div>
                    </div>
                  )}
                  
                  {/* 词组模式提交按钮 */}
                  {!showResult && isPhraseMode && (
                    <div className="flex justify-center">
                      <Button
                        onClick={handleSubmitFillIn}
                        disabled={!canSubmit}
                        size="lg"
                        className="w-full"
                      >
                        提交答案
                      </Button>
                    </div>
                  )}

                  {/* 汉英模式：下一题按钮（在填空区/键盘下方） */}
                  {showResult && (
                    <div className="flex justify-center">
                      <Button onClick={handleNext} size="lg" className="w-full">
                        {currentIndex < words.length - 1 ? '下一题' : '查看结果'}
                      </Button>
                    </div>
                  )}

                  {/* 汉英模式：结果显示（在下一题按钮下方） */}
                  {showResult && (
                    <div className="space-y-4">
                      <div className={`rounded-lg p-4 text-center ${
                        isCorrect
                          ? 'bg-green-500/20 text-green-700 dark:text-green-300'
                          : 'bg-red-500/20 text-red-700 dark:text-red-300'
                      }`}>
                        <div className="text-lg font-semibold">
                          {isCorrect ? '✓ 回答正确' : '✗ 回答错误'}
                        </div>
                        {!isCorrect && (
                          <div className="mt-2">
                            <div className="text-sm">正确答案：{currentWord.word}</div>
                            <div className="text-sm">你的答案：{isPhraseMode ? phraseInput : userInputs.join('')}</div>
                          </div>
                        )}
                      </div>

                      <div className="rounded-lg border border-border bg-muted p-4">
                        <div className="space-y-2 text-sm">
                          <div><span className="font-semibold">单词：</span>{currentWord.word}</div>
                          {currentWord.phonetic && (
                            <div><span className="font-semibold">音标：</span>{currentWord.phonetic}</div>
                          )}
                          <div><span className="font-semibold">翻译：</span>{currentWord.translation}</div>
                        </div>
                      </div>
                    </div>
                  )}
                </>
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
