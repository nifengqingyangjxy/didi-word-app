import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { getWordsByCollections, addOrUpdateWrongWord, decreaseWrongWordWeight, addStudyRecord, getWrongWordsByWeight, getAllWrongWords } from '@/db/api';
import type { Word, QuizResult } from '@/types';
import { ArrowLeft, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

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

export default function ChineseEnglishQuizPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const collectionIds = searchParams.get('collections')?.split(',') || [];
  const wordCount = parseInt(searchParams.get('count') || '20');
  const wrongWordInsertion = searchParams.get('wrongWordInsertion') === 'true';
  const wrongWordCount = parseInt(searchParams.get('wrongWordCount') || '10');
  const includePhrases = searchParams.get('includePhrases') !== 'false'; // 默认包含词组

  const [words, setWords] = useState<WordWithWrongInfo[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [maskedWord, setMaskedWord] = useState('');
  const [userInputs, setUserInputs] = useState<string[]>([]);
  const [isPhraseMode, setIsPhraseMode] = useState(false); // 是否是词组模式
  const [phraseInput, setPhraseInput] = useState(''); // 词组完整输入
  const [showResult, setShowResult] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [results, setResults] = useState<QuizResult[]>([]);
  const [startTime] = useState(Date.now());
  const [loading, setLoading] = useState(true);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [showExitConfirm, setShowExitConfirm] = useState(false);

  const keyboard = [
    ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
    ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
    ['Z', 'X', 'C', 'V', 'B', 'N', 'M'],
  ];

  useEffect(() => {
    loadWords();
  }, []);

  useEffect(() => {
    if (words.length > 0 && currentIndex < words.length) {
      generateMaskedWord();
    }
  }, [currentIndex, words]);

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
      
      // 随机显示30-50%的字母
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
      
      // 聚焦到第一个空白输入框
      const firstEmptyIndex = inputs.findIndex((input: string) => input === '');
      setFocusedIndex(firstEmptyIndex >= 0 ? firstEmptyIndex : 0);
    }
  };

  const handleKeyPress = (letter: string) => {
    if (showResult) return;

    const currentWord = words[currentIndex].word.toUpperCase();
    const newInputs = [...userInputs];
    
    // 找到当前聚焦的空白位置
    if (focusedIndex < newInputs.length && newInputs[focusedIndex] === '') {
      newInputs[focusedIndex] = letter;
      setUserInputs(newInputs);
      
      // 移动到下一个空白位置
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
      // 回退到上一个可编辑位置
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

  const handleSubmit = () => {
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
        mode: 'chinese_english',
      });
    } catch (error) {
      console.error('保存学习记录失败:', error);
    }

    navigate('/quiz-result', {
      state: {
        results: results,
        mode: 'chinese_english',
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
  const canSubmit = isPhraseMode 
    ? phraseInput.trim().length > 0 
    : userInputs.every((input, idx) => input !== '' || maskedWord[idx] !== '*');

  return (
    <div className="flex min-h-screen w-full flex-col bg-background">
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => setShowExitConfirm(true)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex-1">
              <h1 className="text-xl font-bold text-foreground">汉英模式</h1>
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
                        handleSubmit();
                      }
                    }}
                    disabled={showResult}
                    placeholder="输入词组..."
                    className="w-full rounded-md border-2 border-border bg-background px-4 py-3 text-center text-xl font-medium lowercase focus:border-primary focus:outline-none disabled:opacity-50"
                    autoFocus
                  />
                </div>
              ) : (
                /* 单词模式：字母输入框 */
                <div className="flex justify-center gap-2">
                  {userInputs.map((input, index) => {
                    const isRevealed = maskedWord[index] !== '*';
                    const isFocused = focusedIndex === index && !showResult;
                    
                    return (
                      <div
                        key={index}
                        onClick={() => handleInputClick(index)}
                        className={`flex h-14 w-12 items-center justify-center rounded-md border-2 text-2xl font-bold lowercase transition-colors ${
                          isRevealed
                            ? 'border-muted bg-muted text-muted-foreground'
                            : isFocused
                              ? 'border-primary bg-primary/10'
                              : input
                                ? 'border-border bg-card text-foreground'
                                : 'border-dashed border-border bg-background'
                        } ${showResult && !isCorrect ? 'border-red-500' : ''} ${
                          showResult && isCorrect ? 'border-green-500' : ''
                        }`}
                      >
                        {input || (isFocused ? '|' : '')}
                      </div>
                    );
                  })}
                </div>
              )}

              {showResult && (
                <div className="text-center">
                  {isCorrect ? (
                    <p className="text-lg font-semibold text-green-600 dark:text-green-400">✓ 回答正确！</p>
                  ) : (
                    <div>
                      <p className="text-lg font-semibold text-red-600 dark:text-red-400">✗ 回答错误</p>
                      <p className="mt-2 text-sm text-muted-foreground">
                        正确答案：<span className="font-bold text-foreground">{currentWord.word}</span>
                      </p>
                    </div>
                  )}
                </div>
              )}

              {!showResult && !isPhraseMode && (
                <>
                  {/* 虚拟键盘（仅单词模式） */}
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
                      <Button
                        variant="outline"
                        onClick={handleBackspace}
                        className="px-4 sm:px-6"
                      >
                        删除
                      </Button>
                      <Button
                        onClick={handleSubmit}
                        disabled={!canSubmit}
                        className="px-6 sm:px-8"
                      >
                        提交答案
                      </Button>
                    </div>
                  </div>
                </>
              )}
              
              {/* 词组模式提交按钮 */}
              {!showResult && isPhraseMode && (
                <div className="flex justify-center pt-4">
                  <Button
                    onClick={handleSubmit}
                    disabled={!canSubmit}
                    size="lg"
                    className="px-12"
                  >
                    提交答案
                  </Button>
                </div>
              )}

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
