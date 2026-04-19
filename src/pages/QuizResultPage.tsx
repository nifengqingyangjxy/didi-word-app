import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import type { QuizResult } from '@/types';
import { Home, RotateCcw, CheckCircle2, XCircle } from 'lucide-react';

export default function QuizResultPage() {
  const navigate = useNavigate();
  const location = useLocation();
  
  // 安全地获取state，如果为null则重定向到首页
  const state = location.state as { results: QuizResult[]; mode: string } | null;
  
  if (!state || !state.results) {
    // 如果没有state数据，重定向到首页
    navigate('/', { replace: true });
    return null;
  }
  
  const { results, mode } = state;

  const totalCount = results.length;
  const correctCount = results.filter(r => r.isCorrect).length;
  const wrongCount = totalCount - correctCount;
  const accuracy = totalCount > 0 ? ((correctCount / totalCount) * 100).toFixed(1) : '0';

  const wrongWords = results.filter(r => !r.isCorrect);

  const handleRetry = () => {
    if (mode === 'english_chinese') {
      navigate('/study/english-chinese/mode');
    } else if (mode === 'chinese_english') {
      navigate('/study/chinese-english/mode');
    } else if (mode === 'mixed') {
      navigate('/study/mixed/mode');
    } else if (mode === 'wrong_words') {
      navigate('/wrong-words/practice-settings');
    } else {
      navigate('/');
    }
  };

  return (
    <div className="flex min-h-screen w-full flex-col bg-background">
      {/* 头部 */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4">
          <h1 className="text-xl font-bold text-foreground">记忆结果报告</h1>
        </div>
      </header>

      {/* 主内容 */}
      <main className="container mx-auto flex-1 px-4 py-8">
        <div className="mx-auto max-w-2xl space-y-6">
          {/* 统计卡片 */}
          <Card className="border border-border p-6">
            <div className="text-center">
              <div className="mb-6">
                <div className="text-5xl font-bold text-primary">{accuracy}%</div>
                <p className="mt-2 text-sm text-muted-foreground">正确率</p>
              </div>
              <div className="grid grid-cols-3 gap-4 border-t border-border pt-6">
                <div>
                  <div className="text-2xl font-semibold text-foreground">{totalCount}</div>
                  <p className="mt-1 text-xs text-muted-foreground">答题总数</p>
                </div>
                <div>
                  <div className="text-2xl font-semibold text-primary">{correctCount}</div>
                  <p className="mt-1 text-xs text-muted-foreground">正确数</p>
                </div>
                <div>
                  <div className="text-2xl font-semibold text-destructive">{wrongCount}</div>
                  <p className="mt-1 text-xs text-muted-foreground">错误数</p>
                </div>
              </div>
            </div>
          </Card>

          {/* 错题列表 */}
          {wrongWords.length > 0 && (
            <div>
              <h2 className="mb-3 text-lg font-semibold text-foreground">答错的单词</h2>
              <div className="space-y-2">
                {wrongWords.map((result, index) => (
                  <Card key={index} className="border border-destructive/30 bg-destructive/5 p-4">
                    <div className="flex items-start gap-3">
                      <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
                      <div className="flex-1">
                        <div className="flex items-baseline gap-2">
                          <span className="font-semibold text-foreground">{result.word.word}</span>
                          {result.word.phonetic && (
                            <span className="phonetic">{result.word.phonetic}</span>
                          )}
                        </div>
                        <p className="mt-1 text-sm text-foreground">{result.word.translation}</p>
                        <p className="mt-2 text-xs text-muted-foreground">
                          你的答案：<span className="text-destructive">{result.userAnswer}</span>
                        </p>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* 操作按钮 */}
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => navigate('/home')}
              className="flex-1"
            >
              <Home className="mr-2 h-4 w-4" />
              返回首页
            </Button>
            <Button onClick={handleRetry} className="flex-1">
              <RotateCcw className="mr-2 h-4 w-4" />
              再练一次
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
