# 自动匹配音标与翻译确认对话框功能说明

## 功能概述

用户选择文件后，系统会弹出确认对话框，询问用户是否需要自动联网匹配音标与翻译。用户可以根据文件情况选择：
1. **自动匹配（推荐）**：优先使用文档中的翻译，自动补充缺失的音标和翻译
2. **仅使用文档内容**：完全使用文档中的内容，不调用任何API，缺失内容会标红提示

---

## 核心特性

### 1. 确认对话框

**触发时机**：用户选择文件后立即弹出

**对话框内容**：

```
┌─────────────────────────────────────────┐
│ 选择导入方式                             │
├─────────────────────────────────────────┤
│ 是否需要自动联网匹配音标与翻译？         │
│                                          │
│ ┌─────────────────────────────────────┐ │
│ │ ✅ 自动匹配（推荐）                  │ │
│ │ • 优先使用您文档中的翻译             │ │
│ │ • 自动补充缺失的音标和翻译           │ │
│ │ • 适合翻译不完整的文档               │ │
│ └─────────────────────────────────────┘ │
│                                          │
│ ┌─────────────────────────────────────┐ │
│ │ 📄 仅使用文档内容                    │ │
│ │ • 完全使用您文档中的内容             │ │
│ │ • 不调用任何API                      │ │
│ │ • 缺失内容会标红提示                 │ │
│ │ • 适合已有完整翻译的文档             │ │
│ └─────────────────────────────────────┘ │
│                                          │
│ [取消] [📄 仅使用文档内容] [✅ 自动匹配] │
└─────────────────────────────────────────┘
```

**按钮说明**：
- **取消**：关闭对话框，不处理文件
- **📄 仅使用文档内容**：关闭自动匹配，完全使用用户文档内容
- **✅ 自动匹配**：开启自动匹配，优先使用用户翻译，补充缺失内容（推荐）

---

## 操作流程

### 完整流程

```
步骤1：用户选择文件
  ↓
步骤2：系统弹出确认对话框
  ↓
步骤3：用户选择导入方式
  ├─ 选择"✅ 自动匹配"
  │   ↓
  │   enableAutoMatch = true
  │   ↓
  │   解析文件
  │   ↓
  │   优先使用用户翻译
  │   ↓
  │   调用API补充缺失内容
  │   ↓
  │   显示完整的单词列表
  │
  ├─ 选择"📄 仅使用文档内容"
  │   ↓
  │   enableAutoMatch = false
  │   ↓
  │   解析文件
  │   ↓
  │   仅使用用户文档内容
  │   ↓
  │   缺失内容标红并靠前显示
  │   ↓
  │   显示单词列表（缺失内容标红）
  │
  └─ 选择"取消"
      ↓
      关闭对话框
      ↓
      不处理文件
```

---

## 使用场景

### 场景1：用户有完整的翻译

**输入表格**：
```
| 单词    | 音标        | 中文意思      |
|---------|-------------|---------------|
| achieve | /ə'tʃi:v/   | 达到；实现    |
| active  | /'æktɪv/    | 积极的；活跃的|
```

**选择"✅ 自动匹配"**：
- ✅ 使用用户翻译："达到；实现"、"积极的；活跃的"
- ✅ 使用用户音标：/ə'tʃi:v/、/'æktɪv/
- ✅ 不调用API（已有完整数据）

**选择"📄 仅使用文档内容"**：
- ✅ 使用用户翻译："达到；实现"、"积极的；活跃的"
- ✅ 使用用户音标：/ə'tʃi:v/、/'æktɪv/
- ✅ 不调用API
- ✅ 不标红（数据完整）

---

### 场景2：用户翻译不完整

**输入表格**：
```
| 单词    | 音标        | 中文意思      |
|---------|-------------|---------------|
| achieve | /ə'tʃi:v/   | 达到；实现    |
| active  |             | 积极的；活跃的|
| advice  |             |               |
```

**选择"✅ 自动匹配"**：
- ✅ achieve: 使用用户翻译和音标
- ✅ active: 使用用户翻译，API补充音标
- ✅ advice: API补充翻译和音标

**选择"📄 仅使用文档内容"**：
- ✅ achieve: 使用用户翻译和音标，正常显示
- ⚠️ active: 使用用户翻译，缺失音标，标红显示
- ⚠️ advice: 缺失翻译和音标，标红显示，排在最前面

---

### 场景3：用户只有单词列表

**输入表格**：
```
| 单词    |
|---------|
| achieve |
| active  |
| advice  |
```

**选择"✅ 自动匹配"**：
- ✅ 所有单词调用API补充翻译和音标
- ✅ 显示完整的单词列表

**选择"📄 仅使用文档内容"**：
- ⚠️ 所有单词标红
- ⚠️ 所有单词显示"⚠️ 缺少翻译内容"
- ⚠️ 提示用户手动添加翻译

---

### 场景4：不同文件需要不同方式

**文件1**：已有完整翻译的教材单词表
- 选择"📄 仅使用文档内容"
- 完全使用教材翻译，不调用API

**文件2**：只有单词列表的生词本
- 选择"✅ 自动匹配"
- 调用API补充所有翻译和音标

**优势**：每次导入都可以根据文件情况灵活选择

---

## 代码实现

### 1. 状态管理

```typescript
const [enableAutoMatch, setEnableAutoMatch] = useState(true); // 自动匹配音标与翻译
const [showAutoMatchDialog, setShowAutoMatchDialog] = useState(false); // 显示确认对话框
const [pendingFile, setPendingFile] = useState<File | File[] | null>(null); // 待处理的文件
```

---

### 2. handleFileChange函数

**修改前**：直接解析文件
```typescript
const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const files = e.target.files;
  if (!files || files.length === 0) return;
  
  // 直接解析文件
  setFile(files[0]);
  await parseFile(files[0]);
};
```

**修改后**：弹出确认对话框
```typescript
const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const files = e.target.files;
  if (!files || files.length === 0) return;

  const supportedFormats = ['txt', 'csv', 'xlsx', 'xls', 'doc', 'docx', 'pdf', 'jpg', 'jpeg', 'png', 'bmp'];
  
  // 检查所有文件格式
  for (let i = 0; i < files.length; i++) {
    const ext = files[i].name.split('.').pop()?.toLowerCase();
    if (!supportedFormats.includes(ext || '')) {
      toast.error(`不支持的文件格式: ${files[i].name}`);
      return;
    }
  }

  // 保存待处理的文件，显示确认对话框
  const imageExts = ['jpg', 'jpeg', 'png', 'bmp'];
  const firstExt = files[0].name.split('.').pop()?.toLowerCase();
  
  if (files.length > 1 && imageExts.includes(firstExt || '')) {
    // 多图片上传
    setPendingFile(Array.from(files));
  } else {
    // 单文件上传
    setPendingFile(files[0]);
  }
  
  // 显示确认对话框
  setShowAutoMatchDialog(true);
};
```

---

### 3. handleConfirmAutoMatch函数

**新增函数**：处理用户选择
```typescript
const handleConfirmAutoMatch = async (autoMatch: boolean) => {
  setEnableAutoMatch(autoMatch);
  setShowAutoMatchDialog(false);
  
  if (!pendingFile) return;
  
  // 根据文件类型处理
  if (Array.isArray(pendingFile)) {
    // 多图片上传
    await parseMultipleImages(pendingFile);
  } else {
    // 单文件上传
    setFile(pendingFile);
    await parseFile(pendingFile);
  }
  
  setPendingFile(null);
};
```

**关键点**：
- 接收用户选择（true/false）
- 设置`enableAutoMatch`状态
- 关闭对话框
- 根据文件类型调用相应的解析函数
- 清理`pendingFile`

---

### 4. 确认对话框UI

```typescript
<Dialog open={showAutoMatchDialog} onOpenChange={setShowAutoMatchDialog}>
  <DialogContent className="sm:max-w-md">
    <DialogHeader>
      <DialogTitle>选择导入方式</DialogTitle>
    </DialogHeader>
    <div className="space-y-4 py-4">
      <p className="text-sm text-muted-foreground">
        是否需要自动联网匹配音标与翻译？
      </p>
      <div className="space-y-3">
        {/* 自动匹配选项 */}
        <div className="rounded-lg border border-border p-3 space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-lg">✅</span>
            <span className="font-medium">自动匹配（推荐）</span>
          </div>
          <p className="text-xs text-muted-foreground pl-7">
            • 优先使用您文档中的翻译<br/>
            • 自动补充缺失的音标和翻译<br/>
            • 适合翻译不完整的文档
          </p>
        </div>
        
        {/* 仅使用文档内容选项 */}
        <div className="rounded-lg border border-border p-3 space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-lg">📄</span>
            <span className="font-medium">仅使用文档内容</span>
          </div>
          <p className="text-xs text-muted-foreground pl-7">
            • 完全使用您文档中的内容<br/>
            • 不调用任何API<br/>
            • 缺失内容会标红提示<br/>
            • 适合已有完整翻译的文档
          </p>
        </div>
      </div>
    </div>
    <DialogFooter className="flex-col sm:flex-row gap-2">
      <Button
        variant="outline"
        onClick={() => {
          setShowAutoMatchDialog(false);
          setPendingFile(null);
        }}
        className="w-full sm:w-auto"
      >
        取消
      </Button>
      <Button
        variant="outline"
        onClick={() => handleConfirmAutoMatch(false)}
        className="w-full sm:w-auto"
      >
        📄 仅使用文档内容
      </Button>
      <Button
        onClick={() => handleConfirmAutoMatch(true)}
        className="w-full sm:w-auto"
      >
        ✅ 自动匹配
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

**UI特性**：
- 清晰的标题和说明
- 两个选项卡片式展示
- 每个选项有详细说明
- 图标辅助识别（✅ 和 📄）
- 响应式布局（移动端友好）
- 三个按钮：取消、仅使用文档内容、自动匹配

---

```typescript
const autoCompleteWords = async (words: ParsedWord[]) => {
  // 如果关闭了自动匹配，跳过API调用
  if (!enableAutoMatch) {
    console.log('⚠️ 自动匹配已关闭，跳过API补充');
    
    // 标记缺失翻译的单词为需要审查
    for (const word of words) {
      if (!word.translation || word.translation === '' || word.translation === '（未找到释义）') {
        word.needsReview = true;
        word.reviewReason = '缺少翻译';
        word.translation = ''; // 清空无效翻译
      }
    }
    
    return;
  }
  
  // 原有的API调用逻辑
  const totalWords = words.length;
  const wordsNeedingCompletion = words.filter(w => !w.translation || w.translation === '' || w.translation === '（未找到释义）');
  
  if (wordsNeedingCompletion.length === 0) {
    console.log('✅ 所有单词都有翻译，无需自动补充');
    return;
  }
  
  // 串行处理，调用API补充
  for (let i = 0; i < wordsNeedingCompletion.length; i++) {
    const word = wordsNeedingCompletion[i];
    // ... API调用逻辑
  }
};
```

---

### 3. sortWords函数

```typescript
const sortWords = (order: 'import' | 'alpha') => {
  setSortOrder(order);
  
  let sorted: ParsedWord[];
  
  if (order === 'alpha') {
    // 按字母顺序排序（A-Z）
    sorted = [...parsedWords].sort((a, b) => a.word.localeCompare(b.word));
  } else {
    // 恢复导入顺序
    sorted = [...originalWords];
  }
  
  // 如果关闭了自动匹配，将缺失翻译的单词排在前面
  if (!enableAutoMatch) {
    const wordsWithIssues = sorted.filter(w => !w.translation || w.translation === '');
    const wordsWithoutIssues = sorted.filter(w => w.translation && w.translation !== '');
    sorted = [...wordsWithIssues, ...wordsWithoutIssues];
  }
  
  setParsedWords(sorted);
};
```

---

### 4. parseFile函数

```typescript
const parseFile = async (file: File) => {
  // ... 解析逻辑
  
  if (words.length === 0) {
    toast.error('未识别到有效单词内容');
    return;
  }

  // 如果关闭了自动匹配，将缺失翻译的单词排在前面
  if (!enableAutoMatch) {
    const wordsWithIssues = words.filter(w => !w.translation || w.translation === '');
    const wordsWithoutIssues = words.filter(w => w.translation && w.translation !== '');
    words = [...wordsWithIssues, ...wordsWithoutIssues];
  }

  setParsedWords(words);
  setOriginalWords([...words]);
  
  // ... 后续逻辑
};
```

---

### 5. UI渲染

```typescript
{parsedWords.map((word, index) => {
  // 检查是否缺失翻译（关闭自动匹配时）
  const missingTranslation = !enableAutoMatch && (!word.translation || word.translation === '');
  const hasIssue = word.hasError || missingTranslation;
  
  return (
    <Card 
      key={index} 
      className={`border p-3 ${hasIssue ? 'border-red-500 bg-red-50 dark:bg-red-950/20' : 'border-border'}`}
    >
      <div className="flex items-start gap-2">
        {/* 状态图标 */}
        <div className="flex h-6 w-6 shrink-0 items-center justify-center">
          {hasIssue ? (
            <span className="text-red-600 dark:text-red-400">⚠️</span>
          ) : word.status === 'processing' ? (
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
          ) : word.status === 'ready' ? (
            <Check className="h-4 w-4 text-primary" />
          ) : (
            <div className="h-2 w-2 rounded-full bg-muted" />
          )}
        </div>

        {/* 内容区域 */}
        <div className="flex-1 min-w-0">
          {(word.hasError || missingTranslation) && (
            <div className="mb-1 text-xs text-red-600 dark:text-red-400">
              {word.errorMessage || (missingTranslation ? '⚠️ 缺少翻译内容' : '')}
            </div>
          )}
          
          {/* 单词输入框 */}
          {/* ... */}
        </div>
      </div>
    </Card>
  );
})}
```

---

## 优势

### 1. 更直观的交互

✅ 用户选择文件后立即询问
✅ 不需要提前设置
✅ 每次导入都可以选择
✅ 符合用户操作习惯

---

### 2. 更清晰的说明

✅ 详细说明每个选项的作用
✅ 图标辅助识别（✅ 和 📄）
✅ 卡片式设计，信息层次清晰
✅ 适用场景说明

---

### 3. 更灵活的使用

✅ 不同文件可以选择不同方式
✅ 不需要记住上次的设置
✅ 每次都可以根据文件情况选择
✅ 支持取消操作

---

### 4. 更友好的设计

✅ 响应式布局（移动端友好）
✅ 清晰的按钮布局
✅ 主要操作突出显示
✅ 符合用户预期

---

## 测试建议

### 测试用例1：文件选择流程

**步骤**：
1. 点击"选择文件"
2. 选择一个Excel文件
3. 验证弹出确认对话框

**预期结果**：
- ✅ 对话框正常弹出
- ✅ 标题为"选择导入方式"
- ✅ 显示两个选项卡片
- ✅ 显示三个按钮

---

### 测试用例2：选择自动匹配

**步骤**：
1. 选择文件
2. 在对话框中点击"✅ 自动匹配"
3. 验证文件解析和API调用

**预期结果**：
- ✅ 对话框关闭
- ✅ 开始解析文件
- ✅ 优先使用用户翻译
- ✅ 调用API补充缺失内容
- ✅ 显示完整的单词列表

---

### 测试用例3：选择仅使用文档内容

**步骤**：
1. 选择文件
2. 在对话框中点击"📄 仅使用文档内容"
3. 验证文件解析和标红显示

**预期结果**：
- ✅ 对话框关闭
- ✅ 开始解析文件
- ✅ 仅使用用户文档内容
- ✅ 不调用API
- ✅ 缺失内容标红并靠前显示

---

### 测试用例4：取消操作

**步骤**：
1. 选择文件
2. 在对话框中点击"取消"
3. 验证对话框关闭

**预期结果**：
- ✅ 对话框关闭
- ✅ 文件未被处理
- ✅ 可以重新选择文件

---

### 测试用例5：多图片上传

**步骤**：
1. 选择多张图片
2. 验证弹出确认对话框
3. 选择导入方式
4. 验证图片解析

**预期结果**：
- ✅ 对话框正常弹出
- ✅ 选择后正常处理多张图片
- ✅ 根据选择决定是否调用API

---

## 常见问题

### Q1: 为什么改成弹出对话框而不是开关？

**A**: 弹出对话框更符合用户操作习惯：
- 用户选择文件后立即询问，更直观
- 每次导入都可以根据文件情况选择
- 不需要提前设置或记住上次的选择
- 减少用户操作步骤

---

### Q2: 如果我每次都选择同一个选项，会不会很麻烦？

**A**: 不会，因为：
- 对话框操作很简单，只需点击一次
- 默认推荐"自动匹配"，符合大多数用户需求
- 如果需要，可以添加"记住我的选择"功能

---

### Q3: 取消后文件会被删除吗？

**A**: 不会，取消只是关闭对话框，不处理文件。您可以重新选择文件。

---

### Q4: 多图片上传也会弹出对话框吗？

**A**: 是的，无论是单文件还是多图片上传，都会弹出确认对话框。

---

### Q5: 如何查看我选择了哪个选项？

**A**: 可以通过以下方式判断：
- 选择"自动匹配"：会显示"正在补充缺失的翻译和音标..."进度提示
- 选择"仅使用文档内容"：不会显示API调用进度，缺失内容会标红

---

## 总结

新版本的确认对话框功能：

✅ **更直观**：用户选择文件后立即询问
✅ **更清晰**：详细说明每个选项的作用
✅ **更灵活**：每次导入都可以选择不同方式
✅ **更友好**：图标和卡片式设计
✅ **更高效**：减少用户操作步骤

这完全满足了用户的需求：
- ❌ 旧方式：开关位置不对，在设置区域
- ✅ 新方式：文件选择后弹出确认对话框
- ✅ 用户可以每次选择是否自动匹配
- ✅ 关闭自动匹配后，仅使用用户文档内容
