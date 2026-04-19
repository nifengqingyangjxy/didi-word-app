@echo off
chcp 65001 >nul
REM DIDI单词助记 - GitHub推送脚本 (Windows)
REM 版本: v144
REM 日期: 2026-04-10

echo ==========================================
echo   DIDI单词助记 - GitHub推送脚本
echo   版本: v144
echo   日期: 2026-04-10
echo ==========================================
echo.

REM 检查是否在正确的目录
if not exist "package.json" (
    echo ❌ 错误：请在项目根目录下运行此脚本
    pause
    exit /b 1
)

REM 显示当前状态
echo 📊 当前Git状态：
git status --short
echo.

REM 显示最近的提交
echo 📝 最近的提交：
git log --oneline -3
echo.

REM 显示标签
echo 🏷️  版本标签：
git tag -l
echo.

REM 确认推送
echo ⚠️  即将推送到GitHub仓库：
echo    https://github.com/nifengqingyangjxy/didi-word-app.git
echo.
set /p confirm="确认推送？(y/n): "

if /i not "%confirm%"=="y" (
    echo ❌ 取消推送
    pause
    exit /b 0
)

echo.
echo 🚀 开始推送...
echo.

REM 推送代码
echo 📤 推送代码到master分支...
git push -u origin master

if errorlevel 1 (
    echo.
    echo ❌ 推送失败！
    echo.
    echo 可能的原因：
    echo 1. 需要GitHub认证（用户名和密码或Personal Access Token）
    echo 2. 远程仓库不存在或无权限
    echo 3. 网络连接问题
    echo.
    echo 解决方案：
    echo 1. 如果使用HTTPS，需要输入GitHub用户名和Personal Access Token
    echo 2. 如果使用SSH，需要配置SSH密钥
    echo 3. 检查仓库地址是否正确
    echo.
    pause
    exit /b 1
)

echo.
echo 📤 推送标签...
git push origin v144

if errorlevel 1 (
    echo.
    echo ⚠️  标签推送失败，但代码已成功推送
    echo.
)

echo.
echo ==========================================
echo   ✅ 推送完成！
echo ==========================================
echo.
echo 📦 仓库地址：
echo    https://github.com/nifengqingyangjxy/didi-word-app
echo.
echo 📖 查看提交：
echo    https://github.com/nifengqingyangjxy/didi-word-app/commits/master
echo.
echo 🏷️  查看版本：
echo    https://github.com/nifengqingyangjxy/didi-word-app/releases
echo.
pause
