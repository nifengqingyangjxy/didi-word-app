# 短语分割问题修复说明

## 问题描述

**用户反馈**：在"手动添加短语"模式下，输入短语后解析结果不正确。

**具体表现**：
- 输入：`be angry with sb.`
- 期望结果：单词栏显示 `be angry with sb.`
- 实际结果：
  - 单词栏：`be`
  - 翻译栏：`angry with sb.`

**问题截图**：
![问题截图](https://miaoda-conversation-file.cdn.bcebos.com/user-asmovv53jmkg/conv-asmoxmbk70u8/20260411/file-aw0q303hqj28.png)

---

## 问题分析

### 根本原因

在 `parseTextContent` 函数中，当输入内容**没有音标**和**没有中文翻译**时，代码执行以下逻辑：

```typescript
// 如果没有中文，尝试按空格分割
const firstSpaceIndex = lineWithoutNumber.indexOf(' ');
if (firstSpaceIndex > 0) {
  word = lineWithoutNumber.substring(0, firstSpaceIndex).trim();
  translation = lineWithoutNumber.substring(firstSpaceIndex + 1).trim();
} else {
  word = lineWithoutNumber;
}
```

**问题**：
- 这个逻辑按**第一个空格**分割内容
- 空格前的部分作为**单词**
- 空格后的部分作为**翻译**

**为什么会这样设计**：
- 这个逻辑是为**单词模式**设计的
- 在单词模式下，用户可能输入：`apple 苹果`
- 系统需要将 `apple` 识别为单词，`苹果` 识别为翻译

**为什么在短语模式下出错**：
- 短语本身包含空格（如 `be angry with sb.`）
- 按第一个空格分割会破坏短语的完整性
- 导致短语被错误地分成两部分

---

## 解决方案

### 修改策略

在没有音标和中文翻译的情况下，根据**模式**采取不同策略：

| 模式 | 处理方式 | 示例输入 | 解析结果 |
|------|---------|---------|---------|
| **短语模式** | 整行作为单词/短语，翻译为空 | `be angry with sb.` | 单词：`be angry with sb.`<br>翻译：（空） |
| **单词模式** | 按第一个空格分割 | `apple 苹果` | 单词：`apple`<br>翻译：`苹果` |

### 修改代码

**文件**：`src/pages/AddWordPage.tsx`

**位置**：`parseTextContent` 函数，第138-155行

**修改前**：
```typescript
} else {
  // 如果没有中文，尝试按空格分割
  const firstSpaceIndex = lineWithoutNumber.indexOf(' ');
  if (firstSpaceIndex > 0) {
    word = lineWithoutNumber.substring(0, firstSpaceIndex).trim();
    translation = lineWithoutNumber.substring(firstSpaceIndex + 1).trim();
  } else {
    word = lineWithoutNumber;
  }
}
```

**修改后**：
```typescript
} else {
  // 如果没有中文
  // 短语模式：整行作为单词/短语
  // 单词模式：尝试按空格分割
  if (mode === 'phrase') {
    word = lineWithoutNumber;
    translation = '';
  } else {
    // 单词模式：按空格分割
    const firstSpaceIndex = lineWithoutNumber.indexOf(' ');
    if (firstSpaceIndex > 0) {
      word = lineWithoutNumber.substring(0, firstSpaceIndex).trim();
      translation = lineWithoutNumber.substring(firstSpaceIndex + 1).trim();
    } else {
      word = lineWithoutNumber;
    }
  }
}
```

---

## 测试验证

### 测试用例1：短语模式 - 无翻译

**输入**：
```
be angry with sb.
```

**解析结果**：
- 单词：`be angry with sb.`
- 音标：（空）
- 翻译：（空）
- 词性：（空）

**✅ 通过**：短语完整保留，没有被分割

---

### 测试用例2：短语模式 - 有翻译

**输入**：
```
be angry with sb. 生某人的气
```

**解析结果**：
- 单词：`be angry with sb.`
- 音标：（空）
- 翻译：`生某人的气`
- 词性：（空）

**✅ 通过**：短语和翻译正确分离

---

### 测试用例3：短语模式 - 有音标和翻译

**输入**：
```
be angry with sb. /bi: ˈæŋɡri wɪð sb./ 生某人的气
```

**解析结果**：
- 单词：`be angry with sb.`
- 音标：`/bi: ˈæŋɡri wɪð sb./`
- 翻译：`生某人的气`
- 词性：（空）

**✅ 通过**：短语、音标、翻译都正确识别

---

### 测试用例4：单词模式 - 无翻译

**输入**：
```
apple
```

**解析结果**：
- 单词：`apple`
- 音标：（空）
- 翻译：（空）
- 词性：（空）

**✅ 通过**：单词正确识别

---

### 测试用例5：单词模式 - 有翻译（无中文）

**输入**：
```
apple fruit
```

**解析结果**：
- 单词：`apple`
- 音标：（空）
- 翻译：`fruit`
- 词性：（空）

**✅ 通过**：单词和翻译按空格分割

---

### 测试用例6：单词模式 - 有翻译（有中文）

**输入**：
```
apple 苹果
```

**解析结果**：
- 单词：`apple`
- 音标：（空）
- 翻译：`苹果`
- 词性：（空）

**✅ 通过**：单词和翻译按中文字符分割

---

## 影响范围

### 受影响的场景

✅ **短语模式 + 无音标 + 无中文翻译**
- 修复前：短语被按第一个空格分割
- 修复后：短语完整保留

### 不受影响的场景

✅ **短语模式 + 有音标**
- 逻辑不变，按音标分割

✅ **短语模式 + 有中文翻译**
- 逻辑不变，按中文字符分割

✅ **单词模式 + 任何情况**
- 逻辑不变，保持原有行为

---

## 后续处理

### 用户操作流程

1. **输入短语**（无翻译）
   ```
   be angry with sb.
   ```

2. **点击"开始解析"**
   - 短语完整识别：`be angry with sb.`
   - 翻译为空

3. **自动补充**（可选）
   - 点击"自动补充"按钮
   - 系统调用 word-lookup API
   - 自动填充音标和翻译

4. **手动输入**（可选）
   - 手动输入翻译：`生某人的气`
   - 手动输入音标：`/bi: ˈæŋɡri wɪð sb./`

5. **保存**
   - 点击"保存"按钮
   - 如果翻译为空，系统自动调用API补充
   - 短语保存到数据库

---

## 技术细节

### 解析逻辑流程图

```
输入内容
    ↓
是否有音标？
    ├─ 是 → 按音标分割（单词 + 音标 + 翻译）
    └─ 否 → 是否有中文？
            ├─ 是 → 按中文字符分割（单词 + 翻译）
            └─ 否 → 是否为短语模式？
                    ├─ 是 → 整行作为单词，翻译为空
                    └─ 否 → 按第一个空格分割（单词 + 翻译）
```

### 关键判断条件

1. **音标检测**：`/\/[^\/]+\/|\[[^\]]+\]/`
   - 匹配 `/xxx/` 或 `[xxx]` 格式

2. **中文检测**：`/[\u4e00-\u9fa5]/`
   - 匹配任何中文字符

3. **模式判断**：`mode === 'phrase'`
   - 短语模式：保留完整短语
   - 单词模式：按空格分割

---

## 版本信息

- **修复版本**：v146.1
- **修复日期**：2026-04-11
- **相关文件**：`src/pages/AddWordPage.tsx`
- **Git提交**：3694d9b

---

## 相关文档

- [NEW_FEATURES_v146.md](./NEW_FEATURES_v146.md) - 完整功能说明
- [QUICK_GUIDE_v146.md](./QUICK_GUIDE_v146.md) - 快速使用指南

---

**修复完成！** ✅
