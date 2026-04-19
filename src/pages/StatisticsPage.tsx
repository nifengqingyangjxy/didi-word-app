import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getDailyStatistics, getMonthlyStatistics } from '@/db/api';
import type { StudyRecord } from '@/types';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

export default function StatisticsPage() {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<'daily' | 'monthly'>('daily');
  const [records, setRecords] = useState<StudyRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStatistics();
  }, [viewMode]);

  const loadStatistics = async () => {
    try {
      setLoading(true);
      const data = viewMode === 'daily' 
        ? await getDailyStatistics(30)
        : await getMonthlyStatistics(12);
      setRecords(data);
    } catch (error) {
      console.error('加载统计数据失败:', error);
      toast.error('加载统计数据失败');
    } finally {
      setLoading(false);
    }
  };

  // 按日期聚合数据
  const aggregateData = () => {
    const dataMap = new Map<string, {
      date: string;
      duration: number;
      wordsCount: number;
      totalCorrect: number;
      totalCount: number;
    }>();

    for (const record of records) {
      const date = viewMode === 'daily' 
        ? record.study_date
        : record.study_date.substring(0, 7); // YYYY-MM

      const existing = dataMap.get(date) || {
        date,
        duration: 0,
        wordsCount: 0,
        totalCorrect: 0,
        totalCount: 0,
      };

      existing.duration += record.study_duration;
      existing.wordsCount += record.words_studied;
      existing.totalCorrect += record.correct_count;
      existing.totalCount += record.total_count;

      dataMap.set(date, existing);
    }

    return Array.from(dataMap.values()).map(item => ({
      date: item.date,
      duration: Math.round(item.duration / 60), // 转换为分钟
      wordsCount: item.wordsCount,
      accuracy: item.totalCount > 0 
        ? Number(((item.totalCorrect / item.totalCount) * 100).toFixed(1))
        : 0,
    }));
  };

  const chartData = aggregateData();

  return (
    <div className="flex min-h-screen w-full flex-col bg-background">
      {/* 头部 */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/home')}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-xl font-bold text-foreground">学习统计</h1>
          </div>
        </div>
      </header>

      {/* 主内容 */}
      <main className="container mx-auto flex-1 px-4 py-6">
        <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'daily' | 'monthly')}>
          <TabsList className="mb-6">
            <TabsTrigger value="daily">按天</TabsTrigger>
            <TabsTrigger value="monthly">按月</TabsTrigger>
          </TabsList>

          <TabsContent value={viewMode} className="space-y-6">
            {loading ? (
              <div className="text-center text-muted-foreground">加载中...</div>
            ) : chartData.length === 0 ? (
              <Card className="border border-border p-12">
                <div className="text-center text-muted-foreground">暂无学习记录</div>
              </Card>
            ) : (
              <>
                {/* 学习时长与单词数量 */}
                <Card className="border border-border p-6">
                  <h3 className="mb-4 text-lg font-semibold text-foreground">
                    学习时长与单词数量
                  </h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis 
                        dataKey="date" 
                        stroke="hsl(var(--muted-foreground))"
                        tick={{ fill: 'hsl(var(--muted-foreground))' }}
                      />
                      <YAxis 
                        stroke="hsl(var(--muted-foreground))"
                        tick={{ fill: 'hsl(var(--muted-foreground))' }}
                      />
                      <Tooltip 
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '0.125rem',
                        }}
                      />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="duration"
                        name="学习时长(分钟)"
                        stroke="hsl(var(--chart-1))"
                        strokeWidth={2}
                        dot={{ fill: 'hsl(var(--chart-1))' }}
                      />
                      <Line
                        type="monotone"
                        dataKey="wordsCount"
                        name="学习单词数"
                        stroke="hsl(var(--chart-2))"
                        strokeWidth={2}
                        dot={{ fill: 'hsl(var(--chart-2))' }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </Card>

                {/* 记忆正确率 */}
                <Card className="border border-border p-6">
                  <h3 className="mb-4 text-lg font-semibold text-foreground">
                    记忆正确率
                  </h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis 
                        dataKey="date" 
                        stroke="hsl(var(--muted-foreground))"
                        tick={{ fill: 'hsl(var(--muted-foreground))' }}
                      />
                      <YAxis 
                        domain={[0, 100]}
                        stroke="hsl(var(--muted-foreground))"
                        tick={{ fill: 'hsl(var(--muted-foreground))' }}
                      />
                      <Tooltip 
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '0.125rem',
                        }}
                      />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="accuracy"
                        name="正确率(%)"
                        stroke="hsl(var(--primary))"
                        strokeWidth={2}
                        dot={{ fill: 'hsl(var(--primary))' }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </Card>
              </>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
