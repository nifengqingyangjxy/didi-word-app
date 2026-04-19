# 部署说明

本文档说明如何将DIDI单词助记推送到GitHub并部署到生产环境。

---

## 📦 推送到GitHub

### 方法1：使用推送脚本（推荐）

#### Linux / macOS
```bash
./push-to-github.sh
```

#### Windows
```cmd
push-to-github.bat
```

### 方法2：手动推送

```bash
# 1. 推送代码到master分支
git push -u origin master

# 2. 推送标签
git push origin v144
```

### 认证说明

#### HTTPS方式（推荐）
- **用户名**：您的GitHub用户名
- **密码**：Personal Access Token（不是GitHub登录密码）

**如何获取Personal Access Token**：
1. 登录GitHub
2. 点击右上角头像 → Settings
3. 左侧菜单 → Developer settings → Personal access tokens → Tokens (classic)
4. 点击 Generate new token (classic)
5. 勾选 `repo` 权限
6. 点击 Generate token
7. 复制生成的token（只显示一次，请妥善保存）

#### SSH方式
如果您已配置SSH密钥，可以修改远程仓库地址：
```bash
git remote set-url origin git@github.com:nifengqingyangjxy/didi-word-app.git
```

---

## 🚀 部署到生产环境

### 选项1：Vercel（推荐）

1. 访问 [Vercel](https://vercel.com/)
2. 使用GitHub账号登录
3. 点击 "New Project"
4. 导入 `nifengqingyangjxy/didi-word-app` 仓库
5. 配置构建设置：
   - **Framework Preset**: Vite
   - **Build Command**: `pnpm build`
   - **Output Directory**: `dist`
6. 添加环境变量（在Settings → Environment Variables）：
   ```
   VITE_SUPABASE_URL=你的Supabase URL
   VITE_SUPABASE_ANON_KEY=你的Supabase Anon Key
   ```
7. 点击 "Deploy"

**优点**：
- 免费
- 自动部署（推送代码后自动更新）
- 全球CDN加速
- 自动HTTPS

### 选项2：Netlify

1. 访问 [Netlify](https://www.netlify.com/)
2. 使用GitHub账号登录
3. 点击 "New site from Git"
4. 选择 `nifengqingyangjxy/didi-word-app` 仓库
5. 配置构建设置：
   - **Build command**: `pnpm build`
   - **Publish directory**: `dist`
6. 添加环境变量（在Site settings → Build & deploy → Environment）：
   ```
   VITE_SUPABASE_URL=你的Supabase URL
   VITE_SUPABASE_ANON_KEY=你的Supabase Anon Key
   ```
7. 点击 "Deploy site"

### 选项3：GitHub Pages

1. 在项目根目录创建 `.github/workflows/deploy.yml`：
   ```yaml
   name: Deploy to GitHub Pages

   on:
     push:
       branches: [ master ]

   jobs:
     build-and-deploy:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v3
         
         - name: Setup Node.js
           uses: actions/setup-node@v3
           with:
             node-version: '18'
         
         - name: Install pnpm
           uses: pnpm/action-setup@v2
           with:
             version: 8
         
         - name: Install dependencies
           run: pnpm install
         
         - name: Build
           run: pnpm build
           env:
             VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
             VITE_SUPABASE_ANON_KEY: ${{ secrets.VITE_SUPABASE_ANON_KEY }}
         
         - name: Deploy
           uses: peaceiris/actions-gh-pages@v3
           with:
             github_token: ${{ secrets.GITHUB_TOKEN }}
             publish_dir: ./dist
   ```

2. 在GitHub仓库设置中添加Secrets：
   - Settings → Secrets and variables → Actions
   - 添加 `VITE_SUPABASE_URL` 和 `VITE_SUPABASE_ANON_KEY`

3. 启用GitHub Pages：
   - Settings → Pages
   - Source: Deploy from a branch
   - Branch: gh-pages / (root)

### 选项4：自托管服务器

```bash
# 1. 克隆仓库
git clone https://github.com/nifengqingyangjxy/didi-word-app.git
cd didi-word-app

# 2. 安装依赖
pnpm install

# 3. 创建 .env 文件
cat > .env << EOF
VITE_SUPABASE_URL=你的Supabase URL
VITE_SUPABASE_ANON_KEY=你的Supabase Anon Key
EOF

# 4. 构建
pnpm build

# 5. 部署到Nginx
sudo cp -r dist/* /var/www/html/didi-word-app/

# 6. 配置Nginx
sudo nano /etc/nginx/sites-available/didi-word-app
```

Nginx配置示例：
```nginx
server {
    listen 80;
    server_name your-domain.com;

    root /var/www/html/didi-word-app;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # 启用gzip压缩
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
}
```

---

## 🔧 环境变量说明

### 必需的环境变量

| 变量名 | 说明 | 示例 |
|--------|------|------|
| `VITE_SUPABASE_URL` | Supabase项目URL | `https://xxx.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Supabase匿名密钥 | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` |

### 如何获取Supabase凭证

1. 登录 [Supabase](https://supabase.com/)
2. 选择您的项目
3. 点击左侧菜单 Settings → API
4. 复制 `Project URL` 和 `anon public` key

---

## 📝 版本管理

### 创建新版本

```bash
# 1. 更新版本号
# 编辑 package.json、README.md、CHANGELOG.md

# 2. 提交更改
git add -A
git commit -m "vXXX: 版本描述"

# 3. 创建标签
git tag -a vXXX -m "版本说明"

# 4. 推送
git push origin master
git push origin vXXX
```

### 版本号规则

遵循 [语义化版本](https://semver.org/lang/zh-CN/)：

- **主版本号**：不兼容的API修改
- **次版本号**：向下兼容的功能性新增
- **修订号**：向下兼容的问题修正

示例：
- `v1.0.0` → `v1.0.1`：Bug修复
- `v1.0.0` → `v1.1.0`：新增功能
- `v1.0.0` → `v2.0.0`：破坏性变更

---

## 🔍 故障排查

### 推送失败

**问题**：`fatal: Authentication failed`

**解决**：
1. 检查Personal Access Token是否正确
2. 确认token有 `repo` 权限
3. 尝试重新生成token

---

**问题**：`error: failed to push some refs`

**解决**：
```bash
# 拉取远程更改
git pull origin master --rebase

# 重新推送
git push origin master
```

---

### 部署失败

**问题**：构建失败，提示缺少环境变量

**解决**：
1. 检查部署平台的环境变量配置
2. 确认变量名拼写正确（区分大小写）
3. 确认变量值没有多余的空格或引号

---

**问题**：部署成功但页面空白

**解决**：
1. 检查浏览器控制台错误
2. 确认Supabase凭证正确
3. 检查网络请求是否被CORS阻止

---

## 📞 技术支持

如有问题，请：
1. 查看 [用户操作手册](USER_GUIDE.md)
2. 查看 [更新日志](CHANGELOG.md)
3. 在GitHub提交Issue：https://github.com/nifengqingyangjxy/didi-word-app/issues

---

**祝部署顺利！🎉**
