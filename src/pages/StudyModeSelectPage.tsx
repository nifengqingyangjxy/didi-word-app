import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ArrowLeft, ArrowRight } from 'lucide-react';

export default function StudyModeSelectPage() {
  const navigate = useNavigate();

  const modes = [
    {
      title: '英汉模式',
      description: '看英文单词，从ABCD四个选项中选择正确的中文释义',
      path: '/study/english-chinese/mode?mode=english_chinese',
    },
    {
      title: '汉英模式',
      description: '看中文释义，根据提示填写完整的英文单词',
      path: '/study/chinese-english/mode?mode=chinese_english',
    },
    {
      title: '混合模式',
      description: '随机出现英汉或汉英题目，全面提升记忆能力',
      path: '/study/english-chinese/mode?mode=mixed',
    },
  ];

  return (
    <div className="flex min-h-screen w-full flex-col bg-background">
      {/* 头部 */}
      <header className="border-b-2 border-border/50 bg-gradient-card shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/home')}
              className="hover:bg-primary/10"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-xl font-bold text-foreground">学习模式选择</h1>
          </div>
        </div>
      </header>

      {/* 主内容 */}
      <main className="container mx-auto flex-1 px-4 py-8">
        <div className="mx-auto max-w-2xl space-y-4">
          {modes.map((mode) => (
            <Card
              key={mode.path}
              className="group card-shadow hover-lift cursor-pointer overflow-hidden border-2 border-border/50 bg-gradient-card transition-all hover:border-primary/50"
              onClick={() => navigate(mode.path)}
            >
              <div className="flex items-center justify-between p-6">
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-foreground transition-colors group-hover:text-primary">{mode.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{mode.description}</p>
                </div>
                <div className="ml-4 flex h-10 w-10 items-center justify-center rounded-full border-2 border-border/50 bg-muted/50 transition-all group-hover:border-primary group-hover:bg-primary/10">
                  <ArrowRight className="h-5 w-5 text-muted-foreground transition-colors group-hover:text-primary" />
                </div>
              </div>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}
