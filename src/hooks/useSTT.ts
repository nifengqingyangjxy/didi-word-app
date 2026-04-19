import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/db/supabase';

interface UseSTTOptions {
  maxDuration?: number; // 最大录音时长（毫秒），默认5000ms
  silenceThreshold?: number; // 静音阈值（0-255），默认10
  silenceDuration?: number; // 静音持续时间（毫秒），默认1500ms后自动停止
  onStart?: () => void;
  onStop?: () => void;
  onResult?: (text: string) => void;
  onError?: (error: string) => void;
}

interface UseSTTReturn {
  startRecording: (targetWord?: string) => Promise<void>;
  stopRecording: () => Promise<string | null>;
  isRecording: boolean;
  error: string | null;
  isSupported: boolean;
}

/**
 * 将音频Blob转换为WAV格式
 * 使用Web Audio API进行转换
 */
async function convertToWav(audioBlob: Blob): Promise<Blob> {
  // 创建AudioContext
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
    sampleRate: 16000, // 设置采样率为16000
  });

  // 读取音频数据
  const arrayBuffer = await audioBlob.arrayBuffer();
  
  // 解码音频数据
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

  // 获取音频数据
  const channelData = audioBuffer.getChannelData(0); // 获取第一个声道
  const samples = new Float32Array(channelData.length);
  samples.set(channelData);

  // 转换为16位PCM
  const pcmData = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }

  // 创建WAV文件头
  const wavHeader = createWavHeader(pcmData.length * 2, 16000, 1, 16);
  
  // 合并头部和数据
  const wavData = new Uint8Array(wavHeader.length + pcmData.length * 2);
  wavData.set(wavHeader, 0);
  wavData.set(new Uint8Array(pcmData.buffer), wavHeader.length);

  // 创建Blob
  return new Blob([wavData], { type: 'audio/wav' });
}

/**
 * 创建WAV文件头
 */
function createWavHeader(dataLength: number, sampleRate: number, channels: number, bitsPerSample: number): Uint8Array {
  const header = new ArrayBuffer(44);
  const view = new DataView(header);

  // RIFF标识
  writeString(view, 0, 'RIFF');
  // 文件大小
  view.setUint32(4, 36 + dataLength, true);
  // WAVE标识
  writeString(view, 8, 'WAVE');
  // fmt子块
  writeString(view, 12, 'fmt ');
  // fmt子块大小
  view.setUint32(16, 16, true);
  // 音频格式（PCM）
  view.setUint16(20, 1, true);
  // 声道数
  view.setUint16(22, channels, true);
  // 采样率
  view.setUint32(24, sampleRate, true);
  // 字节率
  view.setUint32(28, sampleRate * channels * bitsPerSample / 8, true);
  // 块对齐
  view.setUint16(32, channels * bitsPerSample / 8, true);
  // 位深度
  view.setUint16(34, bitsPerSample, true);
  // data子块
  writeString(view, 36, 'data');
  // 数据大小
  view.setUint32(40, dataLength, true);

  return new Uint8Array(header);
}

/**
 * 写入字符串到DataView
 */
function writeString(view: DataView, offset: number, string: string): void {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

/**
 * 语音识别Hook
 * 使用MediaRecorder API录音，然后通过Edge Function识别
 * 支持所有浏览器，包括微信浏览器
 */
export function useSTT(options: UseSTTOptions = {}): UseSTTReturn {
  const {
    maxDuration = 5000,
    silenceThreshold = 10,
    silenceDuration = 1500,
    onStart,
    onStop,
    onResult,
    onError,
  } = options;

  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSupported] = useState(() => {
    // 检查浏览器是否支持MediaRecorder
    return !!(typeof MediaRecorder !== 'undefined' && navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  });

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const targetWordRef = useRef<string | undefined>(undefined);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastSoundTimeRef = useRef<number>(0);
  const vadCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // 语音活动检测（VAD）函数
  const checkVoiceActivity = useCallback(() => {
    if (!analyserRef.current) return;

    const analyser = analyserRef.current;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    
    analyser.getByteFrequencyData(dataArray);
    
    // 计算平均音量
    let sum = 0;
    for (let i = 0; i < bufferLength; i++) {
      sum += dataArray[i];
    }
    const average = sum / bufferLength;
    
    // 检测是否有声音
    if (average > silenceThreshold) {
      lastSoundTimeRef.current = Date.now();
      console.log('检测到声音，音量:', average.toFixed(2));
    } else {
      // 检查静音持续时间
      const silenceDurationMs = Date.now() - lastSoundTimeRef.current;
      if (silenceDurationMs > silenceDuration && lastSoundTimeRef.current > 0) {
        console.log('检测到静音超过', silenceDuration, 'ms，自动停止录音');
        stopRecording();
      }
    }
  }, [silenceThreshold, silenceDuration]);

  const startRecording = useCallback(async (targetWord?: string) => {
    try {
      setError(null);
      targetWordRef.current = targetWord;

      if (!isSupported) {
        throw new Error('您的浏览器不支持录音功能');
      }

      if (isRecording) {
        console.log('已在录音中，忽略重复调用');
        return;
      }

      // 请求麦克风权限
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000, // 设置采样率为16000
        },
      });

      streamRef.current = stream;

      // 创建AudioContext用于VAD检测
      // iOS Safari需要在用户交互后才能创建AudioContext，所以需要try-catch保护
      try {
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        audioContextRef.current = audioContext;
        
        const source = audioContext.createMediaStreamSource(stream);
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 2048;
        analyser.smoothingTimeConstant = 0.8;
        
        source.connect(analyser);
        analyserRef.current = analyser;
        
        // 初始化最后声音时间
        lastSoundTimeRef.current = Date.now();
        
        // 启动VAD检测（每100ms检测一次）
        vadCheckIntervalRef.current = setInterval(() => {
          checkVoiceActivity();
        }, 100);
        
        console.log('VAD检测已启动');
      } catch (vadError) {
        console.warn('VAD检测初始化失败（可能是iOS限制），将使用固定时长录音:', vadError);
        // VAD失败时，依然可以正常录音，只是不会自动停止
      }

      // 创建MediaRecorder
      // 优先尝试使用wav格式，如果不支持则使用其他格式
      let mimeType = 'audio/webm';
      if (MediaRecorder.isTypeSupported('audio/wav')) {
        mimeType = 'audio/wav';
      } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
        mimeType = 'audio/mp4';
      } else if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        mimeType = 'audio/webm;codecs=opus';
      } else if (MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')) {
        mimeType = 'audio/ogg;codecs=opus';
      }

      console.log('Using mimeType:', mimeType);

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType,
      });

      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      // 收集音频数据
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      // 录音结束
      mediaRecorder.onstop = async () => {
        console.log('录音结束');
        setIsRecording(false);
        
        // 停止所有音轨
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
        }

        if (onStop) {
          onStop();
        }
      };

      // 开始录音
      mediaRecorder.start();
      setIsRecording(true);

      if (onStart) {
        onStart();
      }

      // 设置最大录音时长
      timeoutRef.current = setTimeout(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
          console.log('录音超时，自动停止');
          stopRecording();
        }
      }, maxDuration);

    } catch (err) {
      console.error('开始录音失败:', err);
      const errorMessage = err instanceof Error ? err.message : '开始录音失败';
      setError(errorMessage);
      setIsRecording(false);
      
      if (onError) {
        onError(errorMessage);
      }

      // 清理资源
      if (vadCheckIntervalRef.current) {
        clearInterval(vadCheckIntervalRef.current);
        vadCheckIntervalRef.current = null;
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
    }
  }, [isSupported, isRecording, maxDuration, onStart, onStop, onError, checkVoiceActivity]);

  const stopRecording = useCallback(async (): Promise<string | null> => {
    try {
      // 清除超时定时器
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }

      // 清除VAD检测定时器
      if (vadCheckIntervalRef.current) {
        clearInterval(vadCheckIntervalRef.current);
        vadCheckIntervalRef.current = null;
      }

      // 清除静音定时器
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }

      // 关闭AudioContext
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }

      analyserRef.current = null;

      if (!mediaRecorderRef.current || mediaRecorderRef.current.state !== 'recording') {
        console.log('没有正在进行的录音');
        return null;
      }

      // 停止录音
      return new Promise((resolve, reject) => {
        const mediaRecorder = mediaRecorderRef.current!;

        mediaRecorder.onstop = async () => {
          try {
            console.log('录音结束，开始处理音频');
            setIsRecording(false);

            // 停止所有音轨
            if (streamRef.current) {
              streamRef.current.getTracks().forEach(track => track.stop());
              streamRef.current = null;
            }

            if (onStop) {
              onStop();
            }

            // 合并音频数据
            const audioBlob = new Blob(audioChunksRef.current, {
              type: mediaRecorder.mimeType,
            });

            console.log('音频大小:', audioBlob.size, 'bytes');
            console.log('音频类型:', audioBlob.type);

            if (audioBlob.size === 0) {
              throw new Error('录音数据为空');
            }

            // 如果不是wav或m4a格式，需要转换
            let finalAudioBlob = audioBlob;
            let audioFormat = 'wav'; // 默认使用wav格式

            // 检查是否是纯WAV格式（不带编码器）
            if (audioBlob.type === 'audio/wav' || audioBlob.type === 'audio/wave') {
              audioFormat = 'wav';
              console.log('✅ 音频格式：WAV（无需转换）');
            } else {
              // 所有其他格式都需要转换为WAV
              // 因为百度API对格式要求很严格
              console.log('⚠️ 音频格式需要转换为WAV');
              console.log('原始格式:', audioBlob.type);
              console.log('原始大小:', audioBlob.size, 'bytes');
              
              try {
                const startTime = Date.now();
                finalAudioBlob = await convertToWav(audioBlob);
                audioFormat = 'wav';
                const convertTime = Date.now() - startTime;
                
                console.log('✅ 音频转换成功！');
                console.log('转换耗时:', convertTime, 'ms');
                console.log('转换后大小:', finalAudioBlob.size, 'bytes');
                console.log('转换后类型:', finalAudioBlob.type);
              } catch (convertError) {
                console.error('❌ 音频转换失败:', convertError);
                console.error('错误详情:', convertError instanceof Error ? convertError.message : String(convertError));
                
                // 转换失败，返回错误
                throw new Error(`音频格式转换失败: ${convertError instanceof Error ? convertError.message : '未知错误'}`);
              }
            }

            // 将Blob转换为Base64
            const reader = new FileReader();
            reader.onloadend = async () => {
              try {
                const base64Audio = reader.result as string;
                
                console.log('📤 准备发送到API...');
                console.log('原始音频大小:', finalAudioBlob.size, 'bytes'); // 原始文件大小
                console.log('Base64长度:', base64Audio.length);
                console.log('音频格式:', audioFormat);
                console.log('目标单词:', targetWordRef.current);

                // 调用Edge Function进行语音识别
                const {
                  data: { session },
                } = await supabase.auth.getSession();

                console.log('🔑 Session状态:', session ? '已登录' : '未登录');

                const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/speech-to-text`;
                console.log('📡 API地址:', apiUrl);

                const response = await fetch(
                  apiUrl,
                  {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      Authorization: `Bearer ${session?.access_token ?? import.meta.env.VITE_SUPABASE_ANON_KEY}`,
                    },
                    body: JSON.stringify({
                      audio: base64Audio,
                      targetWord: targetWordRef.current,
                      format: audioFormat, // 传递音频格式
                      audioSize: finalAudioBlob.size, // 传递原始音频文件的字节数
                    }),
                  }
                );

                console.log('📥 API响应状态:', response.status, response.statusText);

                if (!response.ok) {
                  const errorData = await response.json().catch(() => ({}));
                  console.error('❌ API错误:', errorData);
                  throw new Error(errorData.error || `识别失败: ${response.status}`);
                }

                const result = await response.json();
                console.log('📊 API返回结果:', result);
                
                const recognizedText = result.text || '';

                console.log('✅ 最终识别结果:');
                console.log('  - 文本:', recognizedText);
                console.log('  - 长度:', recognizedText.length);
                console.log('  - 类型:', typeof recognizedText);
                console.log('  - 是否为空:', recognizedText === '');

                if (onResult) {
                  console.log('📤 调用onResult回调，传递识别结果');
                  onResult(recognizedText);
                }

                resolve(recognizedText);
              } catch (err) {
                console.error('语音识别失败:', err);
                const errorMessage = err instanceof Error ? err.message : '语音识别失败';
                setError(errorMessage);
                
                if (onError) {
                  onError(errorMessage);
                }
                
                reject(err);
              }
            };

            reader.onerror = () => {
              const errorMessage = '读取音频数据失败';
              setError(errorMessage);
              
              if (onError) {
                onError(errorMessage);
              }
              
              reject(new Error(errorMessage));
            };

            reader.readAsDataURL(finalAudioBlob); // 使用转换后的音频
          } catch (err) {
            console.error('处理录音失败:', err);
            const errorMessage = err instanceof Error ? err.message : '处理录音失败';
            setError(errorMessage);
            
            if (onError) {
              onError(errorMessage);
            }
            
            reject(err);
          }
        };

        mediaRecorder.stop();
      });
    } catch (err) {
      console.error('停止录音失败:', err);
      const errorMessage = err instanceof Error ? err.message : '停止录音失败';
      setError(errorMessage);
      
      if (onError) {
        onError(errorMessage);
      }
      
      return null;
    }
  }, [onStop, onResult, onError]);

  return {
    startRecording,
    stopRecording,
    isRecording,
    error,
    isSupported,
  };
}
