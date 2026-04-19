import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // 处理CORS预检请求
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { word } = await req.json();

    if (!word) {
      return new Response(
        JSON.stringify({ error: '请提供单词' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    let phonetic = null;
    let translation = null;
    let partOfSpeech = null;

    // 1. 使用金山词霸API获取中文翻译
    try {
      const icibResponse = await fetch(
        `https://dict-mobile.iciba.com/interface/index.php?c=word&m=getsuggest&nums=1&client=6&is_need_mean=1&word=${encodeURIComponent(word)}`
      );
      
      if (icibResponse.ok) {
        const icibData = await icibResponse.json();
        
        if (icibData?.message?.[0]) {
          const wordInfo = icibData.message[0];
          
          console.log(`[${word}] wordInfo.means:`, JSON.stringify(wordInfo.means));
          console.log(`[${word}] wordInfo.paraphrase:`, wordInfo.paraphrase);
          
          // 提取词性（从means数组获取所有词性）
          if (wordInfo.means && Array.isArray(wordInfo.means) && wordInfo.means.length > 0) {
            // 收集所有不同的词性
            const parts = wordInfo.means
              .map((m: any) => m.part)
              .filter((p: any) => p && typeof p === 'string')
              .map((p: string) => p.trim());
            
            // 去重并用/连接
            const uniqueParts = [...new Set(parts)];
            if (uniqueParts.length > 0) {
              partOfSpeech = uniqueParts.join('/');
              console.log(`[${word}] 提取的词性:`, partOfSpeech);
            }
          }
          
          // 获取翻译（从means数组构建，不包含词性）
          if (wordInfo.means && Array.isArray(wordInfo.means) && wordInfo.means.length > 0) {
            const meansList = wordInfo.means.map((m: any) => {
              const meanings = Array.isArray(m.means) ? m.means.join('，') : '';
              return meanings;
            }).filter(Boolean);
            translation = meansList.join('；');
            console.log(`[${word}] 从means构建的翻译:`, translation);
          }
          
          // 如果means数组为空，尝试使用paraphrase并清理词性
          if (!translation && wordInfo.paraphrase && typeof wordInfo.paraphrase === 'string') {
            let cleanTranslation = wordInfo.paraphrase;
            
            // 移除所有词性标记（包括开头、中间、结尾的）
            // 匹配模式：词性标记后跟点号，可能有&连接符
            cleanTranslation = cleanTranslation.replace(/(^|[;,，])\s*(pron|n|v|adj|art|conj|prep|adv|abbr|vi|vt|num|interj|det)\.\s*(&\s*(pron|n|v|adj|art|conj|prep|adv|abbr|vi|vt|num|interj|det)\.\s*)*/gi, '$1');
            
            // 清理开头和结尾的分隔符
            cleanTranslation = cleanTranslation.replace(/^[;,，\s]+|[;,，\s]+$/g, '');
            
            translation = cleanTranslation;
            console.log(`[${word}] 从paraphrase清理的翻译:`, translation);
          }
        }
      }
    } catch (error) {
      console.error('金山词霸API失败:', error);
    }

    // 2. 使用免费词典API获取音标（和备用翻译）
    try {
      const dictResponse = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${word}`);
      
      if (dictResponse.ok) {
        const dictData = await dictResponse.json();
        
        if (dictData && dictData[0]) {
          // 提取音标
          if (dictData[0].phonetic) {
            phonetic = dictData[0].phonetic;
          } else if (dictData[0].phonetics && Array.isArray(dictData[0].phonetics) && dictData[0].phonetics.length > 0) {
            // 优先选择带音频的音标
            const phoneticWithAudio = dictData[0].phonetics.find((p: any) => p.text && p.audio);
            if (phoneticWithAudio && phoneticWithAudio.text) {
              phonetic = phoneticWithAudio.text;
            } else {
              const firstPhonetic = dictData[0].phonetics.find((p: any) => p.text);
              if (firstPhonetic && firstPhonetic.text) {
                phonetic = firstPhonetic.text;
              }
            }
          }
          
          // 如果金山词霸没有返回翻译，使用英文定义作为备用
          if (!translation && dictData[0].meanings && Array.isArray(dictData[0].meanings) && dictData[0].meanings.length > 0) {
            const meanings = dictData[0].meanings;
            const definitions = meanings.map((m: any) => {
              const pos = m.partOfSpeech || '';
              const def = m.definitions && m.definitions[0]?.definition ? m.definitions[0].definition : '';
              return pos && def ? `${pos}. ${def}` : def;
            }).filter(Boolean).slice(0, 2); // 只取前两个释义
            translation = definitions.join('; ');
            
            // 如果金山词霸没有返回词性，从免费词典API获取
            if (!partOfSpeech && meanings[0]?.partOfSpeech) {
              partOfSpeech = meanings[0].partOfSpeech;
            }
          }
        }
      }
    } catch (error) {
      console.error('获取音标失败:', error);
    }

    // 确保返回的translation是字符串
    if (translation && typeof translation !== 'string') {
      translation = String(translation);
    }

    return new Response(
      JSON.stringify({
        word,
        phonetic: phonetic || null,
        translation: translation || null,
        part_of_speech: partOfSpeech || null
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Edge Function错误:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Unknown error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
