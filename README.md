# 欢迎使用你的秒哒应用代码包
秒哒应用链接
    URL:https://www.miaoda.cn/projects/app-asmoxmbk70u9

# DIDI单词助记

[![Version](https://img.shields.io/badge/version-v144-blue.svg)](https://github.com/nifengqingyangjxy/didi-word-app)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Last Update](https://img.shields.io/badge/last%20update-2026--04--10-orange.svg)](https://github.com/nifengqingyangjxy/didi-word-app)

一款本地单词与词组学习工具，打开即用，无需注册登录。支持手动添加、文件导入单词，提供多种学习模式、跟读练习、易错词专项训练等功能。

## ✨ 主要特性

- 🚀 **开箱即用**：无需注册登录，打开即可使用
- 📝 **智能导入**：支持 .txt、.csv、.xlsx、.doc、.pdf 多种格式，自动补充音标、词性、翻译
- 🎯 **多种学习模式**：英汉选择题、汉英填字符、混合模式
- 🎤 **跟读练习**：语音识别，自动评分，支持自动播放
- ❌ **易错词库**：自动记录答错的单词，支持专项练习
- 📊 **学习统计**：记录学习时长、单词数量、正确率等数据
- 💾 **本地存储**：所有数据存储在本地，永不丢失
- 🔒 **隐私保护**：不收集任何个人信息

## 🚀 快速开始

### 在线使用
访问部署地址：[待部署]

### 本地开发

```bash
# 克隆仓库
git clone https://github.com/nifengqingyangjxy/didi-word-app.git

# 进入项目目录
cd didi-word-app

# 安装依赖
pnpm install

# 启动开发服务器
pnpm dev

# 构建生产版本
pnpm build
```

## 📖 使用说明

详细的使用说明请查看 [用户操作手册](USER_GUIDE.md)

## 🛠️ 技术栈

- **前端框架**：React 18 + TypeScript
- **UI组件库**：shadcn/ui + Tailwind CSS
- **构建工具**：Vite
- **数据存储**：IndexedDB (Dexie) + Supabase
- **语音功能**：Web Speech API + 百度TTS/STT
- **文件解析**：XLSX + JSZip
- **图表库**：Recharts

## 📦 项目结构

```
didi-word-app/
├── src/
│   ├── components/      # UI组件
│   │   ├── ui/         # shadcn/ui组件
│   │   └── layouts/    # 布局组件
│   ├── pages/          # 页面组件
│   ├── hooks/          # 自定义Hooks
│   ├── db/             # 数据库相关
│   ├── types/          # TypeScript类型定义
│   └── lib/            # 工具函数
├── supabase/           # Supabase配置
│   └── functions/      # Edge Functions
├── public/             # 静态资源
└── USER_GUIDE.md       # 用户操作手册
```

## 🔄 版本历史

### v144 (2026-04-10)
- ✅ 修复TTS播放被截断问题（词组和长句完整播放）
- ✅ 修复切换单词时未停止播放问题
- ✅ 添加播放次数记忆功能（localStorage持久化）
- ✅ 添加调试日志排查播放次数不生效问题
- ✅ 优化跟读学习页面章节列表高度限制

### v143 (2026-04-10)
- ✅ 优化朗读比对速度，减少等待时间
- ✅ 移除不必要的toast提示，提升用户体验

### v142 (2026-04-10)
- ✅ 添加自动播放功能（英文→停顿600ms→中文→停顿1s→重复）
- ✅ 添加自动播放开关和播放次数控制（1-3次）

### v141 (2026-04-10)
- ✅ 修复跟读学习页React闭包陷阱导致的双端录音错误

### v140 (2026-04-10)
- ✅ 修复iOS端朗读报错问题
- ✅ 修复混合模式播放逻辑问题

[查看完整版本历史](CHANGELOG.md)

## 🤝 贡献

欢迎提交Issue和Pull Request！

## 📄 许可证

[MIT License](LICENSE)

## 👨‍💻 作者

[@nifengqingyangjxy](https://github.com/nifengqingyangjxy)

## 🙏 致谢

感谢所有为这个项目做出贡献的开发者和用户！

---

**如果这个项目对您有帮助，请给一个⭐️Star支持一下！**
