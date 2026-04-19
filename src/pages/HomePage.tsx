import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { getWordsCount } from '@/db/api';
import { 
  BookOpen, 
  GraduationCap, 
  Mic, 
  AlertCircle, 
  BarChart3, 
  Settings 
} from 'lucide-react';

export default function HomePage() {
  const navigate = useNavigate();
  const [wordsCount, setWordsCount] = useState<number>(0);

  useEffect(() => {
    loadWordsCount();
  }, []);

  const loadWordsCount = async () => {
    try {
      const count = await getWordsCount();
      setWordsCount(count);
    } catch (error) {
      console.error('加载单词数量失败:', error);
    }
  };

  const menuItems = [
    {
      title: '单词管理',
      icon: BookOpen,
      description: '添加、导入、管理单词',
      path: '/words',
    },
    {
      title: '学习模式',
      icon: GraduationCap,
      description: '英汉、汉英记忆训练',
      path: '/study-mode',
    },
    {
      title: '跟读学习',
      icon: Mic,
      description: '发音练习与评测',
      path: '/read-aloud-settings',
    },
    {
      title: '易错题库',
      icon: AlertCircle,
      description: '专项突破易错词',
      path: '/wrong-words',
    },
    {
      title: '学习统计',
      icon: BarChart3,
      description: '查看学习进度',
      path: '/statistics',
    },
    {
      title: '设置',
      icon: Settings,
      description: '个性化配置',
      path: '/settings',
    },
  ];

  return (
    <div className="flex min-h-screen w-full flex-col bg-background">
      {/* 头部 */}
      <header className="border-b-2 border-border/50 bg-gradient-card shadow-sm">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="gradient-text text-3xl font-bold">DIDI单词助记</h1>
              <p className="mt-1 text-sm text-muted-foreground">本地单词学习工具 · 打开即用</p>
            </div>
            <div className="rounded-xl border-2 border-primary/20 bg-primary/5 px-6 py-3 text-center">
              <div className="text-xs font-medium text-muted-foreground">词库总量</div>
              <div className="mt-1 text-3xl font-bold text-primary">{wordsCount}</div>
            </div>
          </div>
        </div>
      </header>

      {/* 主内容 */}
      <main className="container mx-auto flex-1 px-4 py-8">
        <div className="grid gap-4 md:grid-cols-2 md:gap-6">
          {menuItems.map((item) => {
            const Icon = item.icon;
            return (
              <Card
                key={item.path}
                className="group card-shadow hover-lift cursor-pointer overflow-hidden border-2 border-border/50 bg-gradient-card transition-all hover:border-primary/50"
                onClick={() => navigate(item.path)}
              >
                <div className="flex items-start gap-4 p-6">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border-2 border-border/50 bg-muted/50 transition-all group-hover:border-primary group-hover:bg-primary/10 group-hover:shadow-md">
                    <Icon className="h-7 w-7 text-muted-foreground transition-colors group-hover:text-primary" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-foreground transition-colors group-hover:text-primary">{item.title}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{item.description}</p>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </main>
    </div>
  );
}
