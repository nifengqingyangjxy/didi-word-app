import { createClient } from 'jsr:@supabase/supabase-js@2';

Deno.serve(async (req) => {
  // CORS处理
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 获取所有需要更新的单词（part_of_speech为null或translation包含词性标记）
    const { data: words, error: fetchError } = await supabaseClient
      .from('words')
      .select('id, word, translation, part_of_speech')
      .or('part_of_speech.is.null,translation.like.%pron.%,translation.like.%n.%,translation.like.%v.%,translation.like.%adj.%,translation.like.%adv.%,translation.like.%conj.%,translation.like.%prep.%,translation.like.%art.%')
      .limit(200);

    if (fetchError) {
      throw fetchError;
    }

    if (!words || words.length === 0) {
      return new Response(
        JSON.stringify({ message: '没有需要更新的单词', updated: 0 }),
        { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
      );
    }

    let updated = 0;
    const errors: string[] = [];

    // 逐个单词调用word-lookup并更新
    for (const wordRecord of words) {
      try {
        // 调用word-lookup获取最新数据
        const lookupResponse = await fetch(
          `${Deno.env.get('SUPABASE_URL')}/functions/v1/word-lookup`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
            },
            body: JSON.stringify({ word: wordRecord.word }),
          }
        );

        if (!lookupResponse.ok) {
          errors.push(`${wordRecord.word}: lookup failed`);
          continue;
        }

        const lookupData = await lookupResponse.json();

        // 更新数据库
        const updateData: any = {};
        if (lookupData.phonetic) {
          updateData.phonetic = lookupData.phonetic;
        }
        if (lookupData.translation) {
          updateData.translation = lookupData.translation;
        }
        if (lookupData.part_of_speech) {
          updateData.part_of_speech = lookupData.part_of_speech;
        }

        if (Object.keys(updateData).length > 0) {
          const { error: updateError } = await supabaseClient
            .from('words')
            .update(updateData)
            .eq('id', wordRecord.id);

          if (updateError) {
            errors.push(`${wordRecord.word}: ${updateError.message}`);
          } else {
            updated++;
          }
        }

        // 避免API限流，每个请求间隔100ms
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        errors.push(`${wordRecord.word}: ${error.message}`);
      }
    }

    return new Response(
      JSON.stringify({
        message: `批量更新完成`,
        total: words.length,
        updated,
        errors: errors.length > 0 ? errors : undefined,
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  } catch (error) {
    console.error('批量更新失败:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }
});
