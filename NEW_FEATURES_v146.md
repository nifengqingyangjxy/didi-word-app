# 新功能说明：新建单词和手动添加短语

## 功能概述

本次更新添加了两个重要功能，提升用户添加单词和短语的体验：

1. **章节修改中新建单词**：在编辑章节时，可以直接添加新单词，支持列表式批量添加
2. **手动添加短语模式**：支持将短语作为整体保存，不分解成单个单词

---

## 功能1：章节修改中新建单词

### 使用场景

当用户编辑某个章节时，发现缺少某些单词，可以直接在编辑页面添加，无需返回到手动添加页面。

### 使用步骤

1. 进入"单词管理"页面
2. 点击某个章节的"修改"按钮（笔形图标）
3. 在页面顶部，点击"新建单词"按钮
4. 在新增的输入行中填写：
   - **单词**（必填）：输入单词或短语
   - **音标**（可选）：输入音标或点击"自动补充"
   - **翻译**（可选）：输入翻译或点击"自动补充"
   - **词性**（可选）：输入词性或点击"自动补充"
5. 点击"自动补充"按钮，系统自动查询并填充缺失信息
6. 可以继续点击"新建单词"添加更多单词
7. 点击右上角"保存修改"按钮
8. 系统自动为未补充翻译的单词查询释义并保存

### 功能特点

- ✅ **列表式添加**：可以一次添加多个单词，无需逐个保存
- ✅ **自动补充**：每行有独立的"自动补充"按钮，快速填充音标和翻译
- ✅ **智能保存**：保存时自动为空翻译的单词补充释义
- ✅ **视觉区分**：新建单词行使用虚线边框和浅色背景，易于识别
- ✅ **自动排序**：新单词的import_order自动设置为当前最大值+1
- ✅ **支持短语**：可以输入单词或短语（如 be angry with sb.）
- ✅ **加载状态**：补充时显示"补充中"状态，避免重复点击

### 示例

**场景**：编辑"九年级上第六单元"章节，需要添加3个新单词

**操作**：
1. 点击"新建单词"按钮，输入"guitar"
2. 点击"自动补充"，系统填充音标和翻译
3. 再次点击"新建单词"，输入"be angry with sb."
4. 点击"自动补充"，系统填充音标和翻译
5. 再次点击"新建单词"，输入"compare … to …"
6. 手动输入翻译"把...比作..."
7. 点击"保存修改"
8. 3个新单词全部保存到章节中

---

## 功能2：手动添加短语模式

### 使用场景

用户需要添加短语（如"be angry with sb."、"compare … to …"）时，希望短语作为整体保存，而不是被分解成多个单词。

### 使用步骤

1. 进入"单词管理"页面
2. 点击"手动添加"按钮
3. 在页面顶部选择模式：
   - **手动添加单词**：原有功能，只保留纯字母单词
   - **手动添加短语**：新功能，保留完整短语
4. 在文本框中输入内容：
   - 每行一个短语
   - 格式：`短语 音标 翻译`
   - 示例：
     ```
     be angry with sb. /bi: ˈæŋɡri wɪð sb./ 生某人的气
     compare … to … /kəmˈpeə ... tuː .../ 把...比作...
     at least /æt li:st/ 至少
     ```
5. 点击"开始解析"按钮
6. 检查解析结果，确认无误后点击"保存"

### 两种模式的区别

| 特性 | 手动添加单词 | 手动添加短语 |
|------|-------------|-------------|
| **输入内容** | 单个单词或文章 | 短语列表 |
| **识别规则** | 只保留纯字母单词 | 保留完整短语（包括空格、点号、省略号等） |
| **格式验证** | 严格验证（只能是字母） | 宽松验证（只要包含字母即可） |
| **自动提取** | 支持从文章中提取单词 | 不支持自动提取 |
| **适用场景** | 添加单个单词、批量导入单词 | 添加短语、固定搭配 |

### 支持的短语格式

#### 基本格式
- ✅ `at least`（多个单词）
- ✅ `get into`（多个单词）

#### 带点号
- ✅ `be angry with sb.`
- ✅ `compare sth. to sth.`

#### 带省略号
- ✅ `compare … to …`
- ✅ `from … to …`
- ✅ `not only … but also …`
- ✅ `either … or …`

#### 带连字符
- ✅ `well-known`
- ✅ `up-to-date`

#### 带撇号
- ✅ `don't`
- ✅ `can't`

#### 带括号
- ✅ `(试图某事的)观点`

### 示例

#### 示例1：添加短语

**输入**：
```
be angry with sb. /bi: ˈæŋɡri wɪð sb./ 生某人的气
compare … to … /kəmˈpeə ... tuː .../ 把...比作...
at least /æt li:st/ 至少
```

**解析结果**：
- 识别到3个短语
- 每个短语作为整体保存
- 不会被分解成单个单词

#### 示例2：单词模式 vs 短语模式

**输入内容**：
```
be angry with sb. 生某人的气
```

**单词模式**：
- 识别到4个单词：be, angry, with, sb
- 每个单词单独保存
- "sb."中的点号被移除

**短语模式**：
- 识别到1个短语：be angry with sb.
- 短语作为整体保存
- 点号被保留

---

## 技术实现

### 1. 新建单词功能

**文件**：`src/pages/EditCollectionPage.tsx`

**关键代码**：
```typescript
// 新建单词状态
const [newWords, setNewWords] = useState<Array<{
  id: string; // 临时ID
  word: string;
  phonetic: string | null;
  translation: string;
  part_of_speech: string | null;
  isNew: boolean;
  isLoading: boolean;
}>>([]);

// 添加新建单词行
const handleAddNewWordRow = () => {
  const tempId = `temp-${Date.now()}`;
  setNewWords([...newWords, {
    id: tempId,
    word: '',
    phonetic: null,
    translation: '',
    part_of_speech: null,
    isNew: true,
    isLoading: false,
  }]);
};

// 自动补充单词信息
const handleAutoComplete = async (id: string) => {
  const newWord = newWords.find(w => w.id === id);
  if (!newWord || !newWord.word.trim()) {
    toast.error('请先输入单词');
    return;
  }
  
  setNewWords(newWords.map(w => 
    w.id === id ? { ...w, isLoading: true } : w
  ));
  
  const { data, error } = await supabase.functions.invoke('word-lookup', {
    body: { word: newWord.word.trim() },
  });
  
  if (data) {
    setNewWords(newWords.map(w => {
      if (w.id === id) {
        return {
          ...w,
          phonetic: data.phonetic || w.phonetic,
          translation: data.translation || w.translation,
          part_of_speech: data.part_of_speech || w.part_of_speech,
          isLoading: false,
        };
      }
      return w;
    }));
  }
};

// 保存时处理新建单词
const handleSave = async () => {
  // 1. 更新现有单词
  for (const word of words) {
    await updateWord(word.id, { ... });
  }
  
  // 2. 添加新建单词
  for (const newWord of newWords) {
    if (!newWord.word.trim()) continue;
    
    // 如果没有翻译，自动补充
    let translation = newWord.translation;
    if (!translation) {
      const { data } = await supabase.functions.invoke('word-lookup', {
        body: { word: newWord.word.trim() },
      });
      translation = data?.translation || '（未找到释义）';
    }
    
    // 获取最大import_order
    const allWords = await getWordsByCollection(collectionId);
    const maxOrder = Math.max(...allWords.map(w => w.import_order || 0));
    
    await addWord({
      word: newWord.word.trim().toLowerCase(),
      phonetic: newWord.phonetic,
      translation: translation,
      part_of_speech: newWord.part_of_speech,
      collection_id: collectionId,
      chapter_id: null,
      import_order: maxOrder + 1,
    });
  }
};
```

### 2. 手动添加短语功能

**文件**：`src/pages/AddWordPage.tsx`

**关键代码**：
```typescript
// 添加模式状态
const [addMode, setAddMode] = useState<'word' | 'phrase'>('word');

// 修改parseTextContent函数，支持mode参数
const parseTextContent = (text: string, mode: 'word' | 'phrase' = 'word'): ParsedWord[] => {
  // 短语模式：直接按行解析，每行作为一个短语
  // 单词模式：如果有音标或中文，认为是格式化的单词列表
  if (mode === 'phrase' || hasPhonetic || hasChinese) {
    hasFormattedWords = true;
    // ...
  }
  
  // 短语模式：保留所有包含英文字母的内容
  // 单词模式：只保留纯英文字母的单词
  const isValid = mode === 'phrase' 
    ? /[a-zA-Z]/.test(word) // 短语模式：只要包含字母即可
    : /^[a-zA-Z]+$/.test(word); // 单词模式：只能是纯字母
  
  // 短语模式下不验证单词格式
  const validation = mode === 'phrase' 
    ? { valid: true }
    : validateWord(word);
  
  // ...
};
```

### 3. UI布局

**桌面端（≥768px）**：
- 新建单词：5列布局（单词、音标、翻译、词性、自动补充按钮）
- 现有单词：4列布局（单词、音标、翻译、词性）

**移动端（<768px）**：
- 垂直布局
- 音标和词性并排显示
- 自动补充按钮占满宽度

**视觉区分**：
- 新建单词：虚线边框 + 浅色背景（`border-dashed border-primary bg-primary/5`）
- 现有单词：实线边框 + 默认背景

---

## 使用建议

### 何时使用"新建单词"（章节修改页面）

- ✅ 编辑章节时发现缺少某些单词
- ✅ 需要批量添加多个单词到同一章节
- ✅ 单词已经有明确的音标和翻译，或需要自动补充
- ✅ 需要快速添加少量单词

### 何时使用"手动添加单词"

- ✅ 批量添加多个单词到不同章节
- ✅ 从文章中提取单词
- ✅ 需要自动补充音标和翻译
- ✅ 添加大量单词

### 何时使用"手动添加短语"

- ✅ 添加固定搭配（如 at least, get into）
- ✅ 添加带占位符的短语（如 be angry with sb.）
- ✅ 添加带省略号的短语（如 compare … to …）
- ✅ 添加多个单词组成的表达（如 not only … but also …）

---

## 常见问题

### Q1: 新建单词时，点击"自动补充"没有反应怎么办？

**可能原因**：
1. 单词输入框为空
2. 网络连接问题
3. word-lookup API服务异常

**解决方案**：
- 确保已输入单词
- 检查网络连接
- 如果API服务异常，可以手动输入音标和翻译
- 保存时系统会再次尝试自动补充

### Q2: 短语模式下，为什么有些短语没有被识别？

**可能原因**：
1. 短语不包含英文字母
2. 格式不正确（缺少翻译）

**解决方案**：
- 确保每行格式为：`短语 音标 翻译`（音标可选）
- 确保短语包含至少一个英文字母
- 如果只输入短语没有翻译，系统会识别短语并在解析后显示"（未找到释义）"

### Q3: 新建单词后，点击"保存修改"时提示失败怎么办？

**可能原因**：
1. 单词已存在（重复）
2. 网络连接问题
3. 数据库错误

**解决方案**：
- 检查是否有重复单词
- 确保网络连接正常
- 如果问题持续，尝试刷新页面重新操作

---

## 版本信息

- **功能版本**：v146
- **发布日期**：2026-04-11
- **相关文件**：
  - `src/pages/WordManagementPage.tsx`
  - `src/pages/AddWordPage.tsx`

---

## 反馈与支持

如有问题或建议，请：
1. 查看用户操作手册
2. 提交Issue到GitHub仓库
3. 联系技术支持

---

**祝您使用愉快！** 📖✨
