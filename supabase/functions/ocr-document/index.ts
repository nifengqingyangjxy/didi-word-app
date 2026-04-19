// OCR文档识别Edge Function
// 支持PDF和图片格式的文档识别

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface OCRRequest {
  file: string; // Base64编码的文件内容
  fileType: 'pdf' | 'image' | 'docx'; // 文件类型
}

interface OCRResponse {
  text: string; // 识别出的文本内容
  error?: string;
}

Deno.serve(async (req) => {
  // 处理CORS预检请求
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { file, fileType }: OCRRequest = await req.json();

    if (!file) {
      return new Response(
        JSON.stringify({ error: 'File data is required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('📄 收到OCR请求');
    console.log('文件类型:', fileType);
    console.log('文件大小:', file.length, 'bytes (base64)');

    // 如果是DOCX文件，直接解析，不走OCR API
    if (fileType === 'docx') {
      console.log('📝 检测到DOCX文件，直接解析...');
      
      try {
        // 将Base64转换为ArrayBuffer
        const binaryString = atob(file);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        const arrayBuffer = bytes.buffer;
        
        console.log('✅ DOCX文件已转换，大小:', arrayBuffer.byteLength, 'bytes');

        // 使用JSZip解压docx文件
        const JSZip = (await import('https://esm.sh/jszip@3.10.1')).default;
        const zip = await JSZip.loadAsync(arrayBuffer);
        
        // 读取document.xml文件
        const documentXml = await zip.file('word/document.xml')?.async('text');
        
        if (!documentXml) {
          console.error('❌ 未找到document.xml');
          return new Response(
            JSON.stringify({ error: 'Failed to extract text from DOCX document' }),
            {
              status: 500,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }

        console.log('📄 已提取document.xml');

        // 从XML中提取文本内容，保留段落结构
        const paragraphMatches = documentXml.match(/<w:p\b[^>]*>[\s\S]*?<\/w:p>/g);
        const paragraphs: string[] = [];
        
        if (paragraphMatches) {
          for (const paragraph of paragraphMatches) {
            // 从每个段落中提取所有<w:t>标签的文本
            const textMatches = paragraph.match(/<w:t[^>]*>([^<]+)<\/w:t>/g);
            
            if (textMatches) {
              const paragraphText = textMatches
                .map(match => {
                  const textMatch = match.match(/>([^<]+)</);
                  return textMatch ? textMatch[1] : '';
                })
                .join('');
              
              if (paragraphText.trim()) {
                paragraphs.push(paragraphText.trim());
              }
            }
          }
        }
        
        // 用换行符连接所有段落
        const extractedText = paragraphs.join('\n');

        console.log('✅ DOCX文本提取完成，段落数:', paragraphs.length);
        console.log('✅ 文本长度:', extractedText.length);
        console.log('文本预览:', extractedText.substring(0, 300));

        if (!extractedText || extractedText.trim().length === 0) {
          console.error('❌ 提取的文本为空');
          return new Response(
            JSON.stringify({ error: 'Extracted text is empty' }),
            {
              status: 500,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }

        // 返回提取的文本
        return new Response(
          JSON.stringify({
            text: extractedText.trim(),
          } as OCRResponse),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      } catch (parseError) {
        console.error('❌ 解析DOCX文档失败:', parseError);
        return new Response(
          JSON.stringify({ 
            error: 'Failed to parse DOCX document',
            details: parseError instanceof Error ? parseError.message : String(parseError),
          }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
    }

    // PDF和图片走OCR API
    // 获取API密钥
    const apiKey = Deno.env.get('INTEGRATIONS_API_KEY');
    if (!apiKey) {
      console.error('❌ INTEGRATIONS_API_KEY未配置');
      return new Response(
        JSON.stringify({ error: 'API key not configured' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('🔑 API密钥已配置');

    // 步骤1：提交OCR任务
    console.log('📤 提交OCR任务...');
    
    const submitUrl = 'https://app-asmoxmbk70u9-api-rY7JZ6jqrneL-gateway.appmiaoda.com/rest/2.0/ocr/v1/doc_convert/request';
    
    // 构建请求参数
    const params = new URLSearchParams();
    if (fileType === 'pdf') {
      params.append('pdf_file', file);
    } else {
      params.append('image', file);
    }

    const submitResponse = await fetch(submitUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Gateway-Authorization': `Bearer ${apiKey}`,
      },
      body: params.toString(),
    });

    if (!submitResponse.ok) {
      const errorText = await submitResponse.text();
      console.error('❌ 提交OCR任务失败:', submitResponse.status, errorText);
      return new Response(
        JSON.stringify({ error: `OCR task submission failed: ${errorText}` }),
        {
          status: submitResponse.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const submitResult = await submitResponse.json();
    console.log('✅ OCR任务已提交:', submitResult);

    if (!submitResult.success || !submitResult.result?.task_id) {
      console.error('❌ 任务提交失败:', submitResult.message);
      return new Response(
        JSON.stringify({ error: submitResult.message || 'Task submission failed' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const taskId = submitResult.result.task_id;
    console.log('📋 任务ID:', taskId);

    // 步骤2：轮询获取结果
    console.log('🔄 开始轮询任务状态...');
    
    const getResultUrl = 'https://app-asmoxmbk70u9-api-oYA6ZGjReooa-gateway.appmiaoda.com/rest/2.0/ocr/v1/doc_convert/get_request_result';
    
    let retryCount = 0;
    const maxRetries = 30; // 最多轮询30次（约2.5分钟）
    
    while (retryCount < maxRetries) {
      // 等待5秒后查询
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      retryCount++;
      console.log(`🔍 第${retryCount}次查询任务状态...`);

      const resultParams = new URLSearchParams();
      resultParams.append('task_id', taskId);

      const resultResponse = await fetch(getResultUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-Gateway-Authorization': `Bearer ${apiKey}`,
        },
        body: resultParams.toString(),
      });

      if (!resultResponse.ok) {
        const errorText = await resultResponse.text();
        console.error('❌ 查询任务状态失败:', resultResponse.status, errorText);
        continue; // 继续重试
      }

      const resultData = await resultResponse.json();
      console.log('📊 任务状态:', resultData);

      if (!resultData.success) {
        console.error('❌ 查询失败:', resultData.message);
        continue; // 继续重试
      }

      const retCode = resultData.result?.ret_code;
      const percent = resultData.result?.percent || 0;

      console.log(`进度: ${percent}%, 状态码: ${retCode}`);

      if (retCode === 3) {
        // 任务完成
        console.log('✅ 任务完成！');
        
        const resultDataObj = resultData.result?.result_data;
        if (!resultDataObj) {
          console.error('❌ 未找到结果数据');
          return new Response(
            JSON.stringify({ error: 'No result data found' }),
            {
              status: 500,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }

        // 获取Word文档下载链接
        const wordUrl = resultDataObj.word;
        if (!wordUrl) {
          console.error('❌ 未找到Word文档链接');
          return new Response(
            JSON.stringify({ error: 'No Word document URL found' }),
            {
              status: 500,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }

        console.log('📥 下载Word文档:', wordUrl);

        // 下载Word文档
        const docResponse = await fetch(wordUrl);
        if (!docResponse.ok) {
          console.error('❌ 下载Word文档失败:', docResponse.status);
          return new Response(
            JSON.stringify({ error: 'Failed to download Word document' }),
            {
              status: 500,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }

        // 获取文档内容并解析
        const docArrayBuffer = await docResponse.arrayBuffer();
        console.log('✅ Word文档已下载，大小:', docArrayBuffer.byteLength, 'bytes');

        try {
          // 使用JSZip解压docx文件
          const JSZip = (await import('https://esm.sh/jszip@3.10.1')).default;
          const zip = await JSZip.loadAsync(docArrayBuffer);
          
          // 读取document.xml文件
          const documentXml = await zip.file('word/document.xml')?.async('text');
          
          if (!documentXml) {
            console.error('❌ 未找到document.xml');
            return new Response(
              JSON.stringify({ error: 'Failed to extract text from Word document' }),
              {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              }
            );
          }

          console.log('📄 已提取document.xml');

          // 从XML中提取文本内容，保留段落结构
          // 匹配<w:p>段落标签，每个段落作为一行
          const paragraphMatches = documentXml.match(/<w:p\b[^>]*>[\s\S]*?<\/w:p>/g);
          const paragraphs: string[] = [];
          
          if (paragraphMatches) {
            for (const paragraph of paragraphMatches) {
              // 从每个段落中提取所有<w:t>标签的文本
              const textMatches = paragraph.match(/<w:t[^>]*>([^<]+)<\/w:t>/g);
              
              if (textMatches) {
                const paragraphText = textMatches
                  .map(match => {
                    const textMatch = match.match(/>([^<]+)</);
                    return textMatch ? textMatch[1] : '';
                  })
                  .join('');
                
                if (paragraphText.trim()) {
                  paragraphs.push(paragraphText.trim());
                }
              }
            }
          }
          
          // 用换行符连接所有段落
          const extractedText = paragraphs.join('\n');

          console.log('✅ 文本提取完成，段落数:', paragraphs.length);
          console.log('✅ 文本长度:', extractedText.length);
          console.log('文本预览:', extractedText.substring(0, 300));

          if (!extractedText || extractedText.trim().length === 0) {
            console.error('❌ 提取的文本为空');
            return new Response(
              JSON.stringify({ error: 'Extracted text is empty' }),
              {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              }
            );
          }

          // 返回提取的文本
          return new Response(
            JSON.stringify({
              text: extractedText.trim(),
            } as OCRResponse),
            {
              status: 200,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        } catch (parseError) {
          console.error('❌ 解析Word文档失败:', parseError);
          return new Response(
            JSON.stringify({ 
              error: 'Failed to parse Word document',
              details: parseError instanceof Error ? parseError.message : String(parseError),
            }),
            {
              status: 500,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }
      } else if (retCode === 1 || retCode === 2) {
        // 任务未开始或进行中，继续轮询
        console.log('⏳ 任务进行中，继续等待...');
        continue;
      } else {
        // 其他状态，任务失败
        console.error('❌ 任务失败，状态码:', retCode);
        return new Response(
          JSON.stringify({ error: `Task failed with code: ${retCode}` }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
    }

    // 超时
    console.error('❌ 任务超时');
    return new Response(
      JSON.stringify({ error: 'Task timeout after 2.5 minutes' }),
      {
        status: 408,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('❌ OCR处理失败:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'OCR processing failed',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
