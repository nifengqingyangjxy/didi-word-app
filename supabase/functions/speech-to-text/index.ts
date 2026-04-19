// 语音识别 Edge Function
// 使用百度短语音识别标准版API进行真实的语音识别
// 支持移动端和微信浏览器

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface STTRequest {
  audio: string; // Base64编码的音频数据
  targetWord?: string; // 目标单词（用于参考）
  format?: string; // 音频格式：wav, m4a, webm
  audioSize?: number; // 原始音频文件的字节数（重要！）
}

Deno.serve(async (req) => {
  // 处理CORS预检请求
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // 解析请求
    const { audio, targetWord, format = 'wav', audioSize: clientAudioSize }: STTRequest = await req.json();

    if (!audio || audio.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: 'Audio data is required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // 移除Base64前缀，获取纯base64数据
    const base64Data = audio.replace(/^data:audio\/[^;]+;base64,/, '');
    
    // 使用客户端传递的原始音频大小，如果没有则计算base64解码后的大小
    const audioSize = clientAudioSize || Math.floor((base64Data.length * 3) / 4);
    
    console.log('📥 收到请求');
    console.log('原始音频大小:', audioSize, 'bytes');
    console.log('Base64数据长度:', base64Data.length);
    console.log('音频格式:', format);
    console.log('目标单词:', targetWord);

    if (audioSize > 10 * 1024 * 1024) {
      return new Response(
        JSON.stringify({ error: 'Audio file too large (max 10MB)' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // 检查音频是否太小（可能没有录到声音）
    if (audioSize < 1000) {
      return new Response(
        JSON.stringify({
          text: '',
          confidence: 0.0,
          error: 'Audio too short or no speech detected',
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // 获取API密钥
    const apiKey = Deno.env.get('INTEGRATIONS_API_KEY');
    if (!apiKey) {
      console.error('❌ INTEGRATIONS_API_KEY未配置');
      throw new Error('INTEGRATIONS_API_KEY not configured');
    }

    console.log('🔑 API密钥已配置');

    // 调用百度短语音识别标准版API
    console.log('📤 准备调用百度API...');
    console.log('API端点: https://app-asmoxmbk70u9-api-Aa2PZnjEw5NL-gateway.appmiaoda.com/server_api');
    
    // 重要：len参数必须是原始音频文件的字节数，不是base64的长度
    const requestBody = {
      format: format, // 音频格式
      rate: 16000,    // 采样率
      channel: 1,     // 声道数
      cuid: 'web-user-' + Date.now(), // 用户唯一标识
      speech: base64Data, // 纯base64编码的音频数据（不含前缀）
      len: audioSize, // 原始音频文件的字节数
      dev_pid: 1737,  // 语言模型：1737=英语，1537=普通话（默认）
    };
    
    console.log('请求参数:', {
      format: requestBody.format,
      rate: requestBody.rate,
      channel: requestBody.channel,
      cuid: requestBody.cuid,
      len: requestBody.len,
      dev_pid: requestBody.dev_pid,
      speechLength: base64Data.length,
    });
    
    const response = await fetch(
      'https://app-asmoxmbk70u9-api-Aa2PZnjEw5NL-gateway.appmiaoda.com/server_api',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Gateway-Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify(requestBody),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ 百度API错误:', response.status, errorText);
      throw new Error(`STT API failed: ${response.status} ${errorText}`);
    }

    // 解析识别结果
    const result = await response.json();
    console.log('📊 百度API返回:', JSON.stringify(result));

    // 检查错误
    if (result.err_no !== 0) {
      console.error('❌ 识别错误:', result.err_no, result.err_msg);
      
      // 如果是音频格式问题，返回友好的错误信息
      if (result.err_no === 3301) {
        console.error('音频格式错误，当前格式:', format);
        return new Response(
          JSON.stringify({
            text: '',
            confidence: 0.0,
            error: 'Audio format not supported. Please try again.',
          }),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
      
      throw new Error(`STT error: ${result.err_msg || 'Unknown error'}`);
    }

    // 获取识别结果
    const recognizedText = result.result && result.result.length > 0 
      ? result.result[0].toLowerCase().trim() 
      : '';

    console.log('✅ 识别成功!');
    console.log('识别文本:', recognizedText);
    console.log('目标单词:', targetWord);

    // 返回识别结果
    return new Response(
      JSON.stringify({
        text: recognizedText,
        confidence: 0.9, // API不返回置信度，使用默认值
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in speech-to-text function:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
