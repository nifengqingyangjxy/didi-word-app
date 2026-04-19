# 🔍 语音识别调试指南

## 当前状态

已添加详细的调试日志，帮助定位"json param speech error"的具体原因。

## 如何查看调试日志

### 方法1：使用浏览器开发者工具（推荐）

1. **在电脑上打开应用**
   - 使用Chrome浏览器打开应用
   - 按F12打开开发者工具
   - 切换到"Console"标签

2. **进入跟读学习页面**
   - 点击"跟读学习"
   - 选择章节和单词数量

3. **开始录音并查看日志**
   - 点击"开始朗读"
   - 朗读单词
   - 在Console中查看详细日志

### 方法2：使用微信开发者工具

1. **在微信开发者工具中打开**
   - 打开微信开发者工具
   - 输入应用URL
   - 打开"Console"面板

2. **测试并查看日志**
   - 进入跟读学习页面
   - 点击"开始朗读"
   - 查看Console输出

### 方法3：使用vconsole（移动端）

如果需要在真实手机上查看日志，我可以添加vconsole支持。

## 日志说明

### 前端日志（useSTT Hook）

```
录音开始
Using mimeType: audio/webm;codecs=opus
录音结束，开始处理音频
音频大小: 12345 bytes
音频类型: audio/webm;codecs=opus
⚠️ 音频格式不支持，开始转换为WAV...
原始格式: audio/webm;codecs=opus
原始大小: 12345 bytes
✅ 音频转换成功！
转换耗时: 123 ms
转换后大小: 54321 bytes
转换后类型: audio/wav
📤 准备发送到API...
Base64长度: 72428
音频格式: wav
目标单词: hello
🔑 Session状态: 未登录
📡 API地址: https://xxx.supabase.co/functions/v1/speech-to-text
📥 API响应状态: 200 OK
📊 API返回结果: {text: "hello", confidence: 0.9}
✅ 识别结果: hello
```

### Edge Function日志

```
📥 收到请求
音频大小: 54321 bytes
音频格式: wav
目标单词: hello
Base64前缀: data:audio/wav;base64,UklGRiQAAABXQVZFZm10...
🔑 API密钥已配置
📤 准备调用百度API...
API端点: https://app-asmoxmbk70u9-api-Aa2PZnjEw5NL-gateway.appmiaoda.com/server_api
请求参数: {format: "wav", rate: 16000, cuid: "web-user-1234567890", len: 54321, speechLength: 72428}
📊 百度API返回: {"err_no":0,"err_msg":"success.","result":["hello"]}
✅ 识别成功!
识别文本: hello
目标单词: hello
```

### 错误日志示例

如果出现错误，会看到类似的日志：

```
❌ 音频转换失败: DOMException: Unable to decode audio data
错误详情: Unable to decode audio data
```

或者：

```
❌ 百度API错误: 400 Bad Request
❌ 识别错误: 3301 json param speech error
音频格式错误，当前格式: wav
```

## 需要收集的信息

如果问题仍然存在，请提供以下信息：

1. **音频信息**
   - 原始格式（例如：audio/webm;codecs=opus）
   - 原始大小（bytes）
   - 转换后格式
   - 转换后大小

2. **API请求信息**
   - Base64长度
   - 音频格式参数
   - 请求参数（format, rate, len）

3. **API响应信息**
   - 响应状态码
   - 错误代码（err_no）
   - 错误信息（err_msg）

4. **设备信息**
   - 设备型号（例如：iPhone 13, 小米11）
   - 浏览器（例如：微信浏览器, Chrome）
   - 操作系统版本

## 常见问题排查

### 问题1：音频转换失败

**日志特征**：
```
❌ 音频转换失败: ...
```

**可能原因**：
- 浏览器不支持Web Audio API
- 音频数据损坏
- 音频格式不支持

**解决方案**：
- 尝试使用不同的浏览器
- 检查麦克风权限
- 确保录音时长足够（至少1秒）

### 问题2：API返回格式错误

**日志特征**：
```
❌ 识别错误: 3301 json param speech error
```

**可能原因**：
- 音频格式不正确
- Base64编码有问题
- 音频数据损坏

**解决方案**：
- 检查转换后的音频格式
- 检查Base64数据长度
- 尝试重新录音

### 问题3：音频太小或太大

**日志特征**：
```
音频大小: 100 bytes  // 太小
音频大小: 15000000 bytes  // 太大
```

**可能原因**：
- 录音时间太短
- 录音时间太长
- 没有录到声音

**解决方案**：
- 确保录音时长在1-5秒之间
- 检查麦克风是否正常工作
- 在安静环境中测试

## 下一步

1. **在电脑浏览器中测试**
   - 打开Chrome开发者工具
   - 进入跟读学习页面
   - 点击"开始朗读"
   - 查看Console日志
   - 截图或复制日志内容

2. **提供日志信息**
   - 将Console中的日志复制给我
   - 特别是带有❌标记的错误日志
   - 以及API请求和响应的详细信息

3. **我会根据日志**
   - 定位具体问题
   - 提供针对性的解决方案
   - 修复代码

## 临时测试方案

如果您现在就想测试，可以：

1. **在电脑上测试**
   - 使用Chrome浏览器
   - 打开开发者工具
   - 查看详细日志

2. **截图发给我**
   - Console中的所有日志
   - 特别是错误信息
   - 我会立即分析并修复

让我们一起找出问题的根源！💪
