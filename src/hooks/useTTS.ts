import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/db/supabase';

interface UseTTSOptions {
  per?: number; // 发音人：0=度小美，1=度小宇，3=度逍遥，4=度丫丫
  spd?: number; // 语速：0-15，默认5
  pit?: number; // 音调：0-15，默认5
  vol?: number; // 音量：0-9，默认5
}

interface UseTTSReturn {
  speak: (text: string) => Promise<void>;
  stop: () => void;
  isSpeaking: boolean;
  error: string | null;
}

/**
 * 文本转语音Hook
 * 使用Supabase Edge Function调用百度TTS API
 * 支持移动端和微信浏览器
 */
export function useTTS(options: UseTTSOptions = {}): UseTTSReturn {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
    setIsSpeaking(false);
  }, []);

  const speak = useCallback(
    async (text: string) => {
      try {
        setError(null);

        // 停止当前播放
        stop();

        if (!text || text.trim().length === 0) {
          throw new Error('文本不能为空');
        }

        setIsSpeaking(true);

        // 获取当前会话
        const {
          data: { session },
        } = await supabase.auth.getSession();

        // 调用Edge Function
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/text-to-speech`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${session?.access_token ?? import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            },
            body: JSON.stringify({
              text,
              per: options.per ?? 0,
              spd: options.spd ?? 5,
              pit: options.pit ?? 5,
              vol: options.vol ?? 5,
            }),
          }
        );

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || `TTS failed: ${response.status}`);
        }

        // 获取音频Blob
        const blob = await response.blob();
        const audioUrl = URL.createObjectURL(blob);
        audioUrlRef.current = audioUrl;

        // 创建Audio元素并播放
        const audio = new Audio(audioUrl);
        audioRef.current = audio;

        // 返回Promise，等待播放完成
        return new Promise<void>((resolve, reject) => {
          audio.onended = () => {
            stop();
            resolve();
          };

          audio.onerror = () => {
            const errorMsg = '音频播放失败';
            setError(errorMsg);
            stop();
            reject(new Error(errorMsg));
          };

          audio.play().catch((err) => {
            console.error('播放失败:', err);
            setError('音频播放失败');
            stop();
            reject(err);
          });
        });
      } catch (err) {
        console.error('TTS error:', err);
        setError(err instanceof Error ? err.message : '语音播放失败');
        setIsSpeaking(false);
        throw err;
      }
    },
    [options, stop]
  );

  return {
    speak,
    stop,
    isSpeaking,
    error,
  };
}
