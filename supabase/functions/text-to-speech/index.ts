// 文本转语音 Edge Function
// 使用百度短文本在线合成服务API
// 支持移动端和微信浏览器

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TTSRequest {
  text: string;
  per?: number; // 发音人：0=度小美，1=度小宇，3=度逍遥，4=度丫丫
  spd?: number; // 语速：0-15，默认5
  pit?: number; // 音调：0-15，默认5
  vol?: number; // 音量：0-9，默认5
}

Deno.serve(async (req) => {
  // 处理CORS预检请求
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // 获取API密钥
    const apiKey = Deno.env.get('INTEGRATIONS_API_KEY');
    if (!apiKey) {
      throw new Error('INTEGRATIONS_API_KEY not configured');
    }

    // 解析请求
    const { text, per = 0, spd = 5, pit = 5, vol = 5 }: TTSRequest = await req.json();

    if (!text || text.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: 'Text is required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // 检查文本长度（最大500个汉字）
    if (text.length > 500) {
      return new Response(
        JSON.stringify({ error: 'Text too long (max 500 characters)' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // 构建请求参数
    const params = new URLSearchParams({
      tex: encodeURIComponent(text),
      cuid: 'web-user',
      ctp: '1',
      aue: '3', // mp3格式
      per: per.toString(),
      spd: spd.toString(),
      pit: pit.toString(),
      vol: vol.toString(),
    });

    // 调用百度TTS API
    const response = await fetch(
      'https://app-asmoxmbk70u9-api-e94GZ5j0ljja-gateway.appmiaoda.com/text2audio',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-Gateway-Authorization': `Bearer ${apiKey}`,
        },
        body: params.toString(),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('TTS API error:', response.status, errorText);
      
      // 处理特定错误
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'API quota exceeded, please try again later' }),
          {
            status: 429,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
      
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'API balance insufficient' }),
          {
            status: 402,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      throw new Error(`TTS API failed: ${response.status} ${errorText}`);
    }

    // 获取音频数据
    const audioBuffer = await response.arrayBuffer();

    // 返回音频流
    return new Response(audioBuffer, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'audio/mpeg',
        'Content-Length': audioBuffer.byteLength.toString(),
        'Cache-Control': 'public, max-age=3600', // 缓存1小时
      },
    });
  } catch (error) {
    console.error('Error in text-to-speech function:', error);
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
