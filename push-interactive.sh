#!/bin/bash

# ============================================================================
# DIDI单词助记 - GitHub推送指南
# ============================================================================
# 版本: v144
# 日期: 2026-04-10
# 仓库: https://github.com/nifengqingyangjxy/didi-word-app.git
# ============================================================================

echo ""
echo "════════════════════════════════════════════════════════════════════════"
echo "                    DIDI单词助记 - GitHub推送指南"
echo "════════════════════════════════════════════════════════════════════════"
echo ""
echo "📦 版本: v144"
echo "📅 日期: 2026-04-10"
echo "🔗 仓库: https://github.com/nifengqingyangjxy/didi-word-app.git"
echo ""
echo "════════════════════════════════════════════════════════════════════════"
echo ""

# 检查是否在项目目录
if [ ! -f "package.json" ]; then
    echo "❌ 错误：请在项目根目录下运行此脚本"
    echo ""
    exit 1
fi

echo "✅ 项目目录检查通过"
echo ""

# 显示当前状态
echo "────────────────────────────────────────────────────────────────────────"
echo "📊 当前Git状态"
echo "────────────────────────────────────────────────────────────────────────"
git status --short
if [ $? -eq 0 ]; then
    echo "✅ Git状态正常"
else
    echo "❌ Git状态异常"
fi
echo ""

# 显示最近提交
echo "────────────────────────────────────────────────────────────────────────"
echo "📝 最近的提交"
echo "────────────────────────────────────────────────────────────────────────"
git log --oneline -5
echo ""

# 显示标签
echo "────────────────────────────────────────────────────────────────────────"
echo "🏷️  版本标签"
echo "────────────────────────────────────────────────────────────────────────"
git tag -l
echo ""

# 显示远程仓库
echo "────────────────────────────────────────────────────────────────────────"
echo "🌐 远程仓库"
echo "────────────────────────────────────────────────────────────────────────"
git remote -v
echo ""

echo "════════════════════════════════════════════════════════════════════════"
echo "                          ⚠️  重要提示"
echo "════════════════════════════════════════════════════════════════════════"
echo ""
echo "推送到GitHub需要认证信息："
echo ""
echo "  👤 用户名: nifengqingyangjxy"
echo "  🔑 密码: Personal Access Token (不是GitHub登录密码!)"
echo ""
echo "────────────────────────────────────────────────────────────────────────"
echo "如何获取Personal Access Token?"
echo "────────────────────────────────────────────────────────────────────────"
echo ""
echo "1. 登录GitHub: https://github.com"
echo "2. 点击右上角头像 → Settings"
echo "3. 左侧菜单 → Developer settings → Personal access tokens → Tokens (classic)"
echo "4. 点击 Generate new token (classic)"
echo "5. 填写说明 (例如: DIDI单词助记)"
echo "6. 勾选 'repo' 权限 (完整的仓库访问权限)"
echo "7. 点击 Generate token"
echo "8. 复制生成的token (只显示一次，请妥善保存!)"
echo ""
echo "════════════════════════════════════════════════════════════════════════"
echo ""

# 确认推送
read -p "❓ 是否已准备好Personal Access Token? (y/n): " confirm
echo ""

if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
    echo "❌ 取消推送"
    echo ""
    echo "💡 提示: 请先获取Personal Access Token后再运行此脚本"
    echo ""
    exit 0
fi

echo "════════════════════════════════════════════════════════════════════════"
echo "                          🚀 开始推送"
echo "════════════════════════════════════════════════════════════════════════"
echo ""

# 推送代码
echo "📤 正在推送代码到master分支..."
echo ""
echo "⚠️  请输入您的GitHub认证信息："
echo "   用户名: nifengqingyangjxy"
echo "   密码: [您的Personal Access Token]"
echo ""

git push -u origin master

if [ $? -ne 0 ]; then
    echo ""
    echo "════════════════════════════════════════════════════════════════════════"
    echo "                          ❌ 推送失败"
    echo "════════════════════════════════════════════════════════════════════════"
    echo ""
    echo "可能的原因："
    echo ""
    echo "1. ❌ Personal Access Token输入错误或已过期"
    echo "   解决: 重新生成token并重试"
    echo ""
    echo "2. ❌ Token权限不足"
    echo "   解决: 确保勾选了 'repo' 权限"
    echo ""
    echo "3. ❌ 远程仓库不存在"
    echo "   解决: 先在GitHub上创建仓库 'didi-word-app'"
    echo ""
    echo "4. ❌ 网络连接问题"
    echo "   解决: 检查网络连接后重试"
    echo ""
    echo "════════════════════════════════════════════════════════════════════════"
    echo ""
    echo "📖 详细帮助文档:"
    echo "   - PUSH_GUIDE.md (快速推送指南)"
    echo "   - DEPLOY.md (部署说明)"
    echo ""
    exit 1
fi

echo ""
echo "✅ 代码推送成功!"
echo ""

# 推送标签
echo "────────────────────────────────────────────────────────────────────────"
echo "📤 正在推送标签 v144..."
echo "────────────────────────────────────────────────────────────────────────"
echo ""

git push origin v144

if [ $? -ne 0 ]; then
    echo ""
    echo "⚠️  标签推送失败，但代码已成功推送"
    echo ""
    echo "您可以稍后手动推送标签:"
    echo "  git push origin v144"
    echo ""
else
    echo ""
    echo "✅ 标签推送成功!"
    echo ""
fi

echo "════════════════════════════════════════════════════════════════════════"
echo "                          ✅ 推送完成"
echo "════════════════════════════════════════════════════════════════════════"
echo ""
echo "🎉 恭喜! 您的代码已成功推送到GitHub!"
echo ""
echo "────────────────────────────────────────────────────────────────────────"
echo "📦 访问您的仓库"
echo "────────────────────────────────────────────────────────────────────────"
echo ""
echo "  🏠 仓库首页:"
echo "     https://github.com/nifengqingyangjxy/didi-word-app"
echo ""
echo "  📝 提交历史:"
echo "     https://github.com/nifengqingyangjxy/didi-word-app/commits/master"
echo ""
echo "  🏷️  版本标签:"
echo "     https://github.com/nifengqingyangjxy/didi-word-app/tags"
echo ""
echo "  📖 用户手册:"
echo "     https://github.com/nifengqingyangjxy/didi-word-app/blob/master/USER_GUIDE.md"
echo ""
echo "────────────────────────────────────────────────────────────────────────"
echo "🚀 下一步: 部署到生产环境"
echo "────────────────────────────────────────────────────────────────────────"
echo ""
echo "推荐使用Vercel部署 (免费、自动部署、全球CDN):"
echo ""
echo "1. 访问 https://vercel.com"
echo "2. 使用GitHub账号登录"
echo "3. 点击 'New Project'"
echo "4. 导入 'nifengqingyangjxy/didi-word-app' 仓库"
echo "5. 配置环境变量 (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)"
echo "6. 点击 'Deploy'"
echo ""
echo "详细部署说明请查看: DEPLOY.md"
echo ""
echo "════════════════════════════════════════════════════════════════════════"
echo ""
echo "感谢使用DIDI单词助记! 🎊"
echo ""
