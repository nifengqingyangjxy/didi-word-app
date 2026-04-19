import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen } from 'lucide-react';

export default function WelcomePage() {
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setTimeout(() => {
      navigate('/home');
    }, 2000);

    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center bg-gradient-to-br from-background via-background to-primary/5">
      <div className="animate-fade-in flex flex-col items-center gap-8">
        <div className="relative">
          <div className="absolute inset-0 animate-pulse rounded-2xl bg-primary/20 blur-2xl"></div>
          <div className="relative flex h-28 w-28 items-center justify-center rounded-2xl border-4 border-primary/30 bg-gradient-primary shadow-xl">
            <BookOpen className="h-14 w-14 text-white" />
          </div>
        </div>
        <div className="text-center">
          <h1 className="gradient-text text-4xl font-bold">DIDI单词助记</h1>
          <p className="mt-3 text-base text-muted-foreground">打开即用 · 本地存储 · 高效记忆</p>
        </div>
        <div className="mt-4 flex gap-2">
          <div className="h-2 w-2 animate-bounce rounded-full bg-primary [animation-delay:-0.3s]"></div>
          <div className="h-2 w-2 animate-bounce rounded-full bg-primary [animation-delay:-0.15s]"></div>
          <div className="h-2 w-2 animate-bounce rounded-full bg-primary"></div>
        </div>
      </div>
    </div>
  );
}
