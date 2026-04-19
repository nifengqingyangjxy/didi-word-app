import { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { getAllWrongWords, getWrongWordsByMaxWeight, addOrUpdateWrongWord, decreaseWrongWordWeight, addStudyRecord, getSetting } from '@/db/api';
import type { Word, QuizResult, WrongWord } from '@/types';
import { ArrowLeft, AlertCircle, Volume2 } from 'lucide-react';
import { toast } from 'sonner';
import { useTTS } from '@/hooks/useTTS';

interface WordWithWrongInfo extends Word {
  wrongWordWeight?: number;
}

interface QuizOption {
  label: string;
  value: string;
  isCorrect: boolean;
}

type QuestionMode = 'english-chinese' | 'chinese-english';

/**
 * 提取翻译的主要部分（用于答题显示）
 */
function getMainTranslation(translation: string): string {
  if (!translation) return '';
  
  if (translation.includes('；')) {
    const parts = translation.split('；');
    return parts[0].trim();
  }
  
  if (translation.includes('，')) {
    const parts = translation.split('，');
    if (parts.length > 3) {
      return parts.slice(0, 3).join('，');
    }
  }
  
  if (translation.length > 30) {
    return translation.substring(0, 30) + '...';
  }
  
  return translation;
}

export default function WrongWordsPracticePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const practiceCount = parseInt(searchParams.get('count') || '20');
  const filterByWeight = searchParams.get('filterByWeight') === 'true';
  const maxWeight = parseInt(searchParams.get('maxWeight') || '3');
  const mode = searchParams.get('mode') || 'chinese-english'; // 默认汉英模式

  const [words, setWords] = useState<WordWithWrongInfo[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentQuestionMode, setCurrentQuestionMode] = useState<QuestionMode>('chinese-english'); // 当前题目模式
  
  // 英汉模式状态（选择题）
  const [options, setOptions] = useState<QuizOption[]>([]);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  
  // 汉英模式状态（填空题）
  const [maskedWord, setMaskedWord] = useState('');
  const [userInputs, setUserInputs] = useState<string[]>([]);
  const [focusedIndex, setFocusedIndex] = useState(0);
  
  const [showResult, setShowResult] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [currentAnswer, setCurrentAnswer] = useState(''); // 保存当前题目的完整答案
  const [results, setResults] = useState<QuizResult[]>([]);
  const [startTime] = useState(Date.now());
  const [loading, setLoading] = useState(true);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  
  // ✅ 发音功能状态
  const [autoPlayEnabled, setAutoPlayEnabled] = useState(true);
  const [autoPlayCount, setAutoPlayCount] = useState(2);
  const isPlayingRef = useRef(false);
  const { speak, stop: stopTTS, isSpeaking } = useTTS();

  const keyboard = [
    ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
    ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
    ['z', 'x', 'c', 'v', 'b', 'n', 'm'],
  ];

  useEffect(() => {
    loadWrongWords();
    loadSettings();
  }, []);

  useEffect(() => {
    if (words.length > 0 && currentIndex < words.length) {
      // 根据mode决定当前题目模式
      if (mode === 'mixed') {
        // 混合模式：随机选择
        setCurrentQuestionMode(Math.random() < 0.5 ? 'english-chinese' : 'chinese-english');
      } else {
        // 固定模式
        setCurrentQuestionMode(mode as QuestionMode);
      }
    }
  }, [currentIndex, words, mode]);

  useEffect(() => {
    if (words.length > 0 && currentIndex < words.length) {
      // 根据当前题目模式生成题目
      if (currentQuestionMode === 'english-chinese') {
        generateOptions();
      } else {
        generateMaskedWord();
      }
    }
  }, [currentQuestionMode, currentIndex, words]);

  const loadWrongWords = async () => {
    try {
      setLoading(true);
      let wordsList: Word[] = [];

      if (filterByWeight) {
        // 按权重筛选
        wordsList = await getWrongWordsByMaxWeight(maxWeight, practiceCount);
      } else {
        // 获取所有易错词
        const data = await getAllWrongWords();
        wordsList = data.map((ww: WrongWord) => ww.word).filter(Boolean) as Word[];
        // 随机打乱并限制数量
        wordsList = wordsList.sort(() => Math.random() - 0.5).slice(0, practiceCount);
      }

      if (wordsList.length === 0) {
        toast.error('暂无符合条件的易错词');
        navigate('/wrong-words/practice/mode-selection');
        return;
      }

      // 获取所有易错词的权重信息
      const allWrongWords = await getAllWrongWords();
      const weightMap = new Map<string, number>();
      allWrongWords.forEach(ww => {
        weightMap.set(ww.word_id, ww.weight);
      });

      // 添加权重信息
      const wordsWithWeight: WordWithWrongInfo[] = wordsList.map(word => ({
        ...word,
        wrongWordWeight: weightMap.get(word.id) || 3,
      }));

      setWords(wordsWithWeight);
    } catch (error) {
      console.error('加载易错词失败:', error);
      toast.error('加载易错词失败');
    } finally {
      setLoading(false);
    }
  };

  const generateOptions = () => {
    const currentWord = words[currentIndex];
    const correctAnswer = getMainTranslation(currentWord.translation);
    
    // 获取其他单词作为干扰项
    const otherWords = words.filter((_, index) => index !== currentIndex);
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
    const shuffledOptions = allOptions.sort(() => Math.random() - 0.5);
    
    // 重新分配标签
    shuffledOptions.forEach((option, index) => {
      option.label = String.fromCharCode(65 + index); // A, B, C, D
    });
    
    setOptions(shuffledOptions);
    setSelectedOption(null);
    setShowResult(false);
    setIsCorrect(false);
    
    // ✅ 英汉模式：自动播放单词读音
    if (autoPlayEnabled) {
      playWordPronunciation();
    }
  };
  
  // ✅ 加载设置
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
  
  // ✅ 播放单词读音（支持连续播放）
  const playWordPronunciation = async () => {
    if (!words[currentIndex]) {
      console.warn('当前单词不存在，跳过播放');
      return;
    }
    
    // 如果已在播放，先停止
    if (isPlayingRef.current) {
      stopTTS();
      isPlayingRef.current = false;
    }
    
    isPlayingRef.current = true;
    const word = words[currentIndex].word;
    const count = autoPlayCount;
    
    try {
      for (let i = 0; i < count; i++) {
        // 检查是否被中断
        if (!isPlayingRef.current) {
          return;
        }
        
        await speak(word);
        
        // 检查是否被中断
        if (!isPlayingRef.current) {
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

  const generateMaskedWord = () => {
    const currentWord = words[currentIndex].word; // 保持原始大小写
    const length = currentWord.length;
    
    // 随机显示30-50%的字母
    const revealCount = Math.max(1, Math.floor(length * 0.3));
    const revealIndices = new Set<number>();
    
    while (revealIndices.size < revealCount) {
      revealIndices.add(Math.floor(Math.random() * length));
    }
    
    let masked = '';
    for (let i = 0; i < length; i++) {
      masked += revealIndices.has(i) ? currentWord[i] : '*';
    }
    
    setMaskedWord(masked);
    setUserInputs(new Array(length).fill(''));
    setFocusedIndex(0);
    setShowResult(false);
    setIsCorrect(false);
  };

  const handleLetterClick = (letter: string) => {
    if (showResult) return;

    const newInputs = [...userInputs];
    let nextIndex = focusedIndex;

    // 找到下一个空位或未显示的位置
    for (let i = focusedIndex; i < maskedWord.length; i++) {
      if (maskedWord[i] === '*') {
        newInputs[i] = letter;
        nextIndex = i + 1;
        break;
      }
    }

    setUserInputs(newInputs);
    
    // 移动焦点到下一个空位
    for (let i = nextIndex; i < maskedWord.length; i++) {
      if (maskedWord[i] === '*' && !newInputs[i]) {
        setFocusedIndex(i);
        return;
      }
    }
    
    setFocusedIndex(maskedWord.length);
  };

  const handleBackspace = () => {
    if (showResult) return;

    const newInputs = [...userInputs];
    
    // 从当前焦点向前找到最近的已输入字母
    for (let i = focusedIndex - 1; i >= 0; i--) {
      if (maskedWord[i] === '*' && newInputs[i]) {
        newInputs[i] = '';
        setUserInputs(newInputs);
        setFocusedIndex(i);
        return;
      }
    }
  };

  const handleOptionSelect = (option: QuizOption) => {
    if (showResult) return;
    
    setSelectedOption(option.value);
    setIsCorrect(option.isCorrect);
    setShowResult(true);

    const currentWord = words[currentIndex];
    
    // 记录结果
    const result: QuizResult = {
      word: currentWord,
      userAnswer: option.value,
      isCorrect: option.isCorrect,
    };
    setResults([...results, result]);

    // 注意：易错词专项练习中，无论对错都不更新权重
    // 权重只在普通学习模式（英汉/汉英/混合）中更新
  };

  const handleSubmit = () => {
    const currentWord = words[currentIndex];
    
    // 构建完整答案：已显示的字母 + 用户输入的字母
    let fullAnswer = '';
    for (let i = 0; i < maskedWord.length; i++) {
      if (maskedWord[i] !== '*') {
        // 已显示的字母
        fullAnswer += maskedWord[i];
      } else {
        // 用户输入的字母
        fullAnswer += userInputs[i] || '';
      }
    }
    
    const correctAnswer = currentWord.word;
    
    // 不区分大小写比较
    const correct = fullAnswer.toLowerCase() === correctAnswer.toLowerCase();
    setIsCorrect(correct);
    setShowResult(true);
    setCurrentAnswer(fullAnswer); // 保存完整答案用于显示

    // 记录结果
    const result: QuizResult = {
      word: currentWord,
      userAnswer: fullAnswer,
      isCorrect: correct,
    };
    setResults([...results, result]);

    // 注意：易错词专项练习中，无论对错都不更新权重
    // 权重只在普通学习模式（英汉/汉英/混合）中更新
  };

  const handleNext = () => {
    // ✅ 停止当前播放
    stopTTS();
    isPlayingRef.current = false;
    
    if (currentIndex < words.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      handleFinish();
    }
  };

  const handleFinish = async () => {
    const duration = Math.floor((Date.now() - startTime) / 1000);
    const correctCount = results.filter(r => r.isCorrect).length;
    const accuracy = results.length > 0 ? (correctCount / results.length) * 100 : 0;

    try {
      await addStudyRecord({
        study_date: new Date().toISOString().split('T')[0],
        mode: 'wrong_words',
        study_duration: duration,
        words_studied: results.length,
        correct_count: correctCount,
        total_count: results.length,
        accuracy,
      });

      navigate('/quiz-result', {
        state: { results, mode: 'wrong_words' },
      });
    } catch (error) {
      console.error('保存学习记录失败:', error);
      navigate('/quiz-result', {
        state: { results, mode: 'wrong_words' },
      });
    }
  };

  const handleExit = () => {
    setShowExitConfirm(true);
  };

  const confirmExit = () => {
    navigate('/wrong-words/practice-settings');
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

  if (words.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="text-lg text-muted-foreground">暂无易错词</div>
        </div>
      </div>
    );
  }

  const currentWord = words[currentIndex];
  const progress = ((currentIndex + 1) / words.length) * 100;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Button variant="ghost" size="icon" onClick={handleExit}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="text-center">
            <div className="text-sm text-muted-foreground">
              {currentIndex + 1} / {words.length}
            </div>
          </div>
          <div className="w-10" />
        </div>
      </header>

      <main className="container mx-auto flex-1 px-4 py-6">
        <div className="mx-auto max-w-2xl space-y-6">
          <Progress value={progress} className="h-2" />

          <Card className="border border-border p-8">
            <div className="space-y-6">
              {/* 易错词提示 */}
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
              
              {/* 根据题目模式显示不同的UI */}
              {currentQuestionMode === 'english-chinese' ? (
                // 英汉模式：选择题
                <>
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">请选择正确的中文释义</p>
                    <div className="mt-2 flex items-center justify-center gap-3">
                      <h2 className="text-3xl font-bold text-purple-600 dark:text-purple-400">
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
                      <p className="mt-1 text-sm text-muted-foreground">
                        {currentWord.phonetic}
                      </p>
                    )}
                  </div>

                  {/* 选项 */}
                  <div className="space-y-3">
                    {options.map((option) => (
                      <Button
                        key={option.label}
                        variant="outline"
                        className={`w-full justify-start text-left h-auto py-4 px-6 ${
                          showResult
                            ? option.isCorrect
                              ? 'border-green-500 bg-green-500/20 text-green-700 dark:text-green-300'
                              : selectedOption === option.value
                                ? 'border-red-500 bg-red-500/20 text-red-700 dark:text-red-300'
                                : ''
                            : selectedOption === option.value
                              ? 'border-primary bg-primary/10'
                              : ''
                        }`}
                        onClick={() => handleOptionSelect(option)}
                        disabled={showResult}
                      >
                        <span className="mr-3 font-bold">{option.label}.</span>
                        <span className="break-words">{option.value}</span>
                      </Button>
                    ))}
                  </div>

                  {/* 英汉模式：下一题按钮（在选项下方） */}
                  {showResult && (
                    <div className="flex gap-3">
                      <Button className="w-full" size="lg" onClick={handleNext}>
                        {currentIndex < words.length - 1 ? '下一题' : '完成练习'}
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
                            <div className="text-sm">你的答案：{selectedOption}</div>
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
                // 汉英模式：填空题
                <>
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">请根据中文释义填写单词</p>
                    <h2 className="mt-2 text-2xl font-bold text-purple-600 dark:text-purple-400 break-words">
                      {getMainTranslation(currentWord.translation)}
                    </h2>
                    {currentWord.part_of_speech && (
                      <p className="mt-1 text-sm text-purple-500 dark:text-purple-400">
                        [{currentWord.part_of_speech}]
                      </p>
                    )}
                  </div>

                  {/* 字母输入框 - 响应式大小，确保不超出页面 */}
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
                        // 计算公式：可用宽度 = 字母数量 × 字母框宽度 + (字母数量 - 1) × 间距
                        // 字母框宽度 = (可用宽度 - (字母数量 - 1) × 间距) / 字母数量
                        
                        let boxSize = '';
                        if (partLength <= 6) {
                          // 6个字母以内：使用较大字母框（w-12 = 48px）
                          boxSize = 'w-12 h-12 text-xl';
                        } else if (partLength <= 8) {
                          // 7-8个字母：使用中等字母框（w-10 = 40px）
                          boxSize = 'w-10 h-10 text-lg';
                        } else if (partLength <= 10) {
                          // 9-10个字母：使用较小字母框（w-9 = 36px）
                          boxSize = 'w-9 h-9 text-base';
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
                              className={`flex ${boxSize} items-center justify-center rounded-md border-2 font-bold transition-colors shrink-0 ${
                                isRevealed
                                  ? 'border-muted bg-muted text-muted-foreground'
                                  : showResult
                                    ? isCorrect
                                      ? 'border-green-500 bg-green-500/20 text-green-700 dark:text-green-300'
                                      : 'border-red-500 bg-red-500/20 text-red-700 dark:text-red-300'
                                    : isFocused
                                      ? 'border-primary bg-primary/10'
                                      : 'border-border bg-background'
                              }`}
                            >
                              {isRevealed ? maskedWord[index] : showResult ? currentWord.word[index] : userInputs[index]}
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

                  {/* 虚拟键盘（只在汉英模式下显示） */}
                  {!showResult && (
                    <div className="space-y-2">
                      {keyboard.map((row, rowIndex) => (
                        <div key={rowIndex} className="flex justify-center gap-1">
                          {row.map((letter) => (
                            <Button
                              key={letter}
                              variant="outline"
                              className="h-10 w-8 min-w-0 p-0 text-base font-semibold sm:h-12 sm:w-10 sm:text-lg"
                              onClick={() => handleLetterClick(letter)}
                            >
                              {letter}
                            </Button>
                          ))}
                        </div>
                      ))}
                      <div className="flex justify-center">
                        <Button
                          variant="outline"
                          className="h-10 w-24 sm:h-12 sm:w-32"
                          onClick={handleBackspace}
                        >
                          删除
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* 汉英模式：提交/下一题按钮（在填空区下方） */}
                  <div className="flex gap-3">
                    {!showResult ? (
                      <Button className="w-full" size="lg" onClick={handleSubmit}>
                        提交答案
                      </Button>
                    ) : (
                      <Button className="w-full" size="lg" onClick={handleNext}>
                        {currentIndex < words.length - 1 ? '下一题' : '完成练习'}
                      </Button>
                    )}
                  </div>

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
                            <div className="text-sm">你的答案：{currentAnswer}</div>
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
          <p className="text-muted-foreground">
            退出后本次练习进度将不会保存，确定要退出吗？
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowExitConfirm(false)}>
              取消
            </Button>
            <Button variant="destructive" onClick={confirmExit}>
              确认退出
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
