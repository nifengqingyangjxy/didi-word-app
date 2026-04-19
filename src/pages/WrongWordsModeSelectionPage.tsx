import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, BookOpen, PenTool, Shuffle } from 'lucide-react';

export default function WrongWordsModeSelectionPage() {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* 顶部导航栏 */}
      <header className="sticky top-0 z-10 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="container flex h-14 items-center gap-4 px-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/wrong-words')}
            className="shrink-0"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-lg font-semibold">易错词专项练习</h1>
          </div>
        </div>
      </header>

      {/* 主内容区域 */}
      <main className="container flex-1 px-4 py-6">
        <div className="mx-auto max-w-4xl space-y-6">
          {/* 页面说明 */}
          <Card>
            <CardHeader>
              <CardTitle>选择练习模式</CardTitle>
              <CardDescription>
                针对易错词库中的单词进行专项练习，选择适合您的练习模式
              </CardDescription>
            </CardHeader>
          </Card>

          {/* 模式选择卡片 */}
          <div className="grid gap-4 md:grid-cols-3">
            {/* 英汉模式 */}
            <Card className="cursor-pointer transition-all hover:border-primary hover:shadow-md" onClick={() => navigate('/wrong-words/practice/english-chinese/settings')}>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                    <BookOpen className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">英汉模式</CardTitle>
                    <CardDescription className="text-xs">选择题模式</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  看英文单词，选择正确的中文释义。适合快速复习和巩固记忆。
                </p>
              </CardContent>
            </Card>

            {/* 汉英模式 */}
            <Card className="cursor-pointer transition-all hover:border-primary hover:shadow-md" onClick={() => navigate('/wrong-words/practice/chinese-english/settings')}>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                    <PenTool className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">汉英模式</CardTitle>
                    <CardDescription className="text-xs">填字符模式</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  看中文释义，填写英文单词。适合深度记忆和拼写练习。
                </p>
              </CardContent>
            </Card>

            {/* 混合模式 */}
            <Card className="cursor-pointer transition-all hover:border-primary hover:shadow-md" onClick={() => navigate('/wrong-words/practice/mixed/settings')}>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                    <Shuffle className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">混合模式</CardTitle>
                    <CardDescription className="text-xs">随机交替</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  英汉和汉英题型随机交替出现，全面提升记忆效果。
                </p>
              </CardContent>
            </Card>
          </div>

          {/* 提示信息 */}
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <div className="text-2xl">💡</div>
                <div className="flex-1 space-y-1">
                  <p className="text-sm font-medium">练习建议</p>
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    <li>• 英汉模式：适合初次复习，快速识别易错词</li>
                    <li>• 汉英模式：适合深度记忆，强化拼写能力</li>
                    <li>• 混合模式：适合全面巩固，提升综合能力</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
