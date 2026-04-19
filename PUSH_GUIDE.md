# 🚀 快速推送到GitHub

## 当前版本信息
- **版本号**: v144
- **日期**: 2026-04-10
- **仓库地址**: https://github.com/nifengqingyangjxy/didi-word-app.git

---

## 📦 推送步骤

### 方法1：使用推送脚本（最简单）

#### Windows用户
双击运行 `push-to-github.bat` 文件，或在命令行中执行：
```cmd
push-to-github.bat
```

#### Linux/macOS用户
在终端中执行：
```bash
./push-to-github.sh
```

### 方法2：手动推送

打开终端（或命令提示符），执行以下命令：

```bash
# 1. 进入项目目录
cd /workspace/app-asmoxmbk70u9

# 2. 推送代码到master分支
git push -u origin master

# 3. 推送标签
git push origin v144
```

---

## 🔑 认证信息

推送时需要输入GitHub认证信息：

- **用户名**: 您的GitHub用户名（例如：nifengqingyangjxy）
- **密码**: Personal Access Token（不是GitHub登录密码！）

### 如何获取Personal Access Token？

1. 登录GitHub：https://github.com
2. 点击右上角头像 → **Settings**
3. 左侧菜单 → **Developer settings** → **Personal access tokens** → **Tokens (classic)**
4. 点击 **Generate new token (classic)**
5. 填写说明（例如：DIDI单词助记）
6. 勾选 **repo** 权限（完整的仓库访问权限）
7. 点击 **Generate token**
8. **复制生成的token**（只显示一次，请妥善保存！）

---

## ✅ 推送成功后

访问以下链接查看您的代码：

- **仓库首页**: https://github.com/nifengqingyangjxy/didi-word-app
- **提交历史**: https://github.com/nifengqingyangjxy/didi-word-app/commits/master
- **版本标签**: https://github.com/nifengqingyangjxy/didi-word-app/tags

---

## ❓ 常见问题

### Q: 推送时提示"Authentication failed"
A: Personal Access Token输入错误或已过期，请重新生成token。

### Q: 推送时提示"Permission denied"
A: Token权限不足，请确保勾选了"repo"权限。

### Q: 推送时提示"remote: Repository not found"
A: 仓库地址错误或仓库不存在，请先在GitHub上创建仓库。

### Q: 如何创建GitHub仓库？
A: 
1. 登录GitHub
2. 点击右上角"+"号 → New repository
3. 仓库名称填写：didi-word-app
4. 选择Public或Private
5. 不要勾选"Initialize this repository with a README"
6. 点击"Create repository"

---

## 📞 需要帮助？

如果遇到问题，请查看详细的部署文档：[DEPLOY.md](DEPLOY.md)

---

**祝推送顺利！🎉**
