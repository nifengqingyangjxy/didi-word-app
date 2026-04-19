# Android APK 封装指南

本应用是一个纯前端Web应用，可以轻松封装成Android APK。

## 方案一：使用 Android Studio + WebView（推荐）

### 1. 准备工作

**构建Web应用**：
```bash
npm run build
```

构建完成后，`dist`文件夹包含所有静态文件。

---

### 2. 创建Android项目

**步骤**：
1. 打开Android Studio
2. 创建新项目：Empty Activity
3. 包名：`com.didi.wordhelper`（或自定义）
4. 语言：Kotlin 或 Java
5. 最低SDK：API 24 (Android 7.0)

---

### 3. 配置WebView

**AndroidManifest.xml**：
```xml
<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="com.didi.wordhelper">

    <!-- 网络权限 -->
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
    
    <!-- 存储权限（用于下载文件） -->
    <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" 
        android:maxSdkVersion="28" />
    <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" 
        android:maxSdkVersion="32" />
    
    <!-- 麦克风权限（用于跟读功能） -->
    <uses-permission android:name="android.permission.RECORD_AUDIO" />

    <application
        android:allowBackup="true"
        android:icon="@mipmap/ic_launcher"
        android:label="DIDI单词助记"
        android:roundIcon="@mipmap/ic_launcher_round"
        android:supportsRtl="true"
        android:theme="@style/Theme.AppCompat.Light.NoActionBar"
        android:usesCleartextTraffic="true">
        
        <activity
            android:name=".MainActivity"
            android:configChanges="orientation|screenSize|keyboardHidden"
            android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
    </application>
</manifest>
```

---

### 4. MainActivity代码

**Kotlin版本**：
```kotlin
package com.didi.wordhelper

import android.Manifest
import android.annotation.SuppressLint
import android.app.Activity
import android.app.DownloadManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.webkit.*
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat

class MainActivity : AppCompatActivity() {
    
    private lateinit var webView: WebView
    private val PERMISSION_REQUEST_CODE = 100
    private val FILE_CHOOSER_REQUEST_CODE = 101
    private var mFilePathCallback: ValueCallback<Array<Uri>>? = null
    
    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        webView = WebView(this)
        setContentView(webView)
        
        // 请求权限
        requestPermissions()
        
        // 配置WebView
        setupWebView()
        
        // 加载应用
        webView.loadUrl("file:///android_asset/index.html")
    }
    
    private fun setupWebView() {
        webView.settings.apply {
            // 启用JavaScript
            javaScriptEnabled = true
            
            // 启用DOM存储（IndexedDB需要）
            domStorageEnabled = true
            
            // 启用数据库
            databaseEnabled = true
            
            // 允许文件访问
            allowFileAccess = true
            allowContentAccess = true
            
            // 缓存设置
            cacheMode = WebSettings.LOAD_DEFAULT
            
            // 支持缩放
            setSupportZoom(true)
            builtInZoomControls = true
            displayZoomControls = false
            
            // 自适应屏幕
            useWideViewPort = true
            loadWithOverviewMode = true
            
            // 支持多窗口
            setSupportMultipleWindows(false)
            
            // 允许混合内容（如果需要）
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
            }
        }
        
        // WebViewClient
        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                return false
            }
            
            override fun onReceivedError(view: WebView?, request: WebResourceRequest?, error: WebResourceError?) {
                super.onReceivedError(view, request, error)
                Toast.makeText(this@MainActivity, "加载失败", Toast.LENGTH_SHORT).show()
            }
        }
        
        // WebChromeClient（支持文件下载、权限请求、文件选择等）
        webView.webChromeClient = object : WebChromeClient() {
            // 处理权限请求（麦克风等）
            override fun onPermissionRequest(request: PermissionRequest?) {
                request?.grant(request.resources)
            }
            
            // 处理JS alert
            override fun onJsAlert(view: WebView?, url: String?, message: String?, result: JsResult?): Boolean {
                Toast.makeText(this@MainActivity, message, Toast.LENGTH_SHORT).show()
                result?.confirm()
                return true
            }
            
            // 处理文件选择（Android 5.0+）
            override fun onShowFileChooser(
                webView: WebView?,
                filePathCallback: ValueCallback<Array<Uri>>?,
                fileChooserParams: FileChooserParams?
            ): Boolean {
                // 保存回调
                mFilePathCallback?.onReceiveValue(null)
                mFilePathCallback = filePathCallback
                
                // 创建文件选择Intent
                val intent = fileChooserParams?.createIntent()
                try {
                    startActivityForResult(intent, FILE_CHOOSER_REQUEST_CODE)
                } catch (e: Exception) {
                    mFilePathCallback = null
                    Toast.makeText(this@MainActivity, "无法打开文件选择器", Toast.LENGTH_SHORT).show()
                    return false
                }
                return true
            }
        }
        
        // 下载监听器
        webView.setDownloadListener { url, userAgent, contentDisposition, mimeType, contentLength ->
            downloadFile(url, contentDisposition, mimeType)
        }
    }
    
    private fun downloadFile(url: String, contentDisposition: String, mimeType: String) {
        try {
            // 获取文件名
            val filename = URLUtil.guessFileName(url, contentDisposition, mimeType)
            
            // 创建下载请求
            val request = DownloadManager.Request(Uri.parse(url))
            request.setMimeType(mimeType)
            request.addRequestHeader("User-Agent", webView.settings.userAgentString)
            request.setDescription("正在下载...")
            request.setTitle(filename)
            request.allowScanningByMediaScanner()
            request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
            request.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, filename)
            
            // 开始下载
            val downloadManager = getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
            downloadManager.enqueue(request)
            
            Toast.makeText(this, "开始下载: $filename", Toast.LENGTH_SHORT).show()
        } catch (e: Exception) {
            Toast.makeText(this, "下载失败: ${e.message}", Toast.LENGTH_SHORT).show()
        }
    }
    
    private fun requestPermissions() {
        val permissions = mutableListOf<String>()
        
        // 存储权限
        if (Build.VERSION.SDK_INT <= Build.VERSION_CODES.P) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.WRITE_EXTERNAL_STORAGE) 
                != PackageManager.PERMISSION_GRANTED) {
                permissions.add(Manifest.permission.WRITE_EXTERNAL_STORAGE)
            }
        }
        
        // 麦克风权限
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) 
            != PackageManager.PERMISSION_GRANTED) {
            permissions.add(Manifest.permission.RECORD_AUDIO)
        }
        
        if (permissions.isNotEmpty()) {
            ActivityCompat.requestPermissions(this, permissions.toTypedArray(), PERMISSION_REQUEST_CODE)
        }
    }
    
    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == PERMISSION_REQUEST_CODE) {
            if (grantResults.all { it == PackageManager.PERMISSION_GRANTED }) {
                Toast.makeText(this, "权限已授予", Toast.LENGTH_SHORT).show()
            } else {
                Toast.makeText(this, "部分权限未授予，某些功能可能无法使用", Toast.LENGTH_LONG).show()
            }
        }
    }
    
    override fun onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack()
        } else {
            super.onBackPressed()
        }
    }
    
    // 处理文件选择结果
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        
        if (requestCode == FILE_CHOOSER_REQUEST_CODE) {
            if (mFilePathCallback == null) return
            
            val results = if (resultCode == Activity.RESULT_OK && data != null) {
                // 处理单个文件
                val dataUri = data.data
                if (dataUri != null) {
                    arrayOf(dataUri)
                } else {
                    // 处理多个文件
                    val clipData = data.clipData
                    if (clipData != null) {
                        Array(clipData.itemCount) { i ->
                            clipData.getItemAt(i).uri
                        }
                    } else {
                        null
                    }
                }
            } else {
                null
            }
            
            mFilePathCallback?.onReceiveValue(results)
            mFilePathCallback = null
        }
    }
}
```

---

### 5. 添加Web文件

**步骤**：
1. 在Android项目中创建`assets`文件夹：
   - 路径：`app/src/main/assets/`

2. 复制构建文件：
   - 将`dist`文件夹中的所有文件复制到`assets`文件夹
   - 包括：`index.html`、`assets/`文件夹等

**目录结构**：
```
app/src/main/assets/
├── index.html
├── assets/
│   ├── index-xxx.js
│   ├── index-xxx.css
│   └── ...
└── ...
```

---

### 6. 构建APK

**步骤**：
1. 在Android Studio中，点击 `Build` > `Build Bundle(s) / APK(s)` > `Build APK(s)`
2. 等待构建完成
3. APK文件位置：`app/build/outputs/apk/debug/app-debug.apk`

**签名APK（发布版本）**：
1. 点击 `Build` > `Generate Signed Bundle / APK`
2. 选择 `APK`
3. 创建或选择密钥库
4. 填写密钥信息
5. 选择 `release` 构建类型
6. 点击 `Finish`

---

## 方案二：使用 Capacitor（更简单）

### 1. 安装Capacitor

```bash
npm install @capacitor/core @capacitor/cli
npm install @capacitor/android
```

### 2. 初始化Capacitor

```bash
npx cap init
```

填写信息：
- App name: `DIDI单词助记`
- App ID: `com.didi.wordhelper`
- Web directory: `dist`

### 3. 添加Android平台

```bash
npx cap add android
```

### 4. 构建并同步

```bash
npm run build
npx cap sync
```

### 5. 在Android Studio中打开

```bash
npx cap open android
```

### 6. 配置权限

编辑 `android/app/src/main/AndroidManifest.xml`，添加权限（同方案一）。

### 7. 构建APK

在Android Studio中构建APK（同方案一）。

---

## 重要配置说明

### 1. 文件下载

**关键配置**：
- `domStorageEnabled = true`：启用IndexedDB
- `databaseEnabled = true`：启用数据库
- `setDownloadListener`：监听下载事件
- `DownloadManager`：处理文件下载

**下载位置**：
- 默认：`/storage/emulated/0/Download/`
- 用户可以在文件管理器中找到

---

### 2. 麦克风权限（跟读功能）

**权限声明**：
```xml
<uses-permission android:name="android.permission.RECORD_AUDIO" />
```

**运行时请求**：
```kotlin
ActivityCompat.requestPermissions(this, 
    arrayOf(Manifest.permission.RECORD_AUDIO), 
    PERMISSION_REQUEST_CODE)
```

**WebChromeClient处理**：
```kotlin
override fun onPermissionRequest(request: PermissionRequest?) {
    request?.grant(request.resources)
}
```

---

### 3. 数据持久化

**IndexedDB支持**：
- `domStorageEnabled = true`
- `databaseEnabled = true`
- 数据存储在应用私有目录
- 卸载应用时数据会被清除

**数据位置**：
```
/data/data/com.didi.wordhelper/app_webview/Default/IndexedDB/
```

---

## 测试清单

### 功能测试

- [ ] 应用启动正常
- [ ] 页面加载正常
- [ ] 单词添加功能
- [ ] 单词列表显示
- [ ] 学习模式正常
- [ ] 跟读功能（麦克风权限）
- [ ] **数据导出功能** ⭐
- [ ] **数据导入功能** ⭐
- [ ] 数据持久化（关闭重开数据仍在）
- [ ] 易错词库功能
- [ ] 学习统计功能

### 数据导出测试（重点）

1. **导出测试**：
   - [ ] 点击"导出数据备份"
   - [ ] 文件自动下载
   - [ ] 在Download文件夹找到文件
   - [ ] 文件名格式正确：`DIDI单词助记-备份-YYYY-MM-DD.json`
   - [ ] 文件可以打开，内容是JSON格式

2. **导入测试**：
   - [ ] 点击"从备份恢复"
   - [ ] 选择之前导出的文件
   - [ ] 数据恢复成功
   - [ ] 所有单词、学习记录都恢复

3. **跨设备测试**：
   - [ ] 在设备A导出数据
   - [ ] 将文件传输到设备B
   - [ ] 在设备B导入数据
   - [ ] 数据完整恢复

---

## 常见问题

### Q1: 文件下载失败？

**原因**：
- 存储权限未授予
- DownloadManager未正确配置

**解决**：
- 检查权限声明
- 检查运行时权限请求
- 检查DownloadListener配置

---

### Q2: 麦克风无法使用？

**原因**：
- 麦克风权限未授予
- WebChromeClient未处理权限请求

**解决**：
- 检查权限声明
- 检查运行时权限请求
- 检查WebChromeClient的onPermissionRequest

---

### Q3: 数据丢失？

**原因**：
- IndexedDB未启用
- 应用被卸载

**解决**：
- 确保`domStorageEnabled = true`
- 确保`databaseEnabled = true`
- 定期导出备份

---

### Q4: 页面显示异常？

**原因**：
- 构建文件路径错误
- 资源文件未正确复制

**解决**：
- 检查`vite.config.ts`中的`base`配置（应该是`./`）
- 确保所有文件都复制到`assets`文件夹
- 检查`index.html`中的资源路径

---

## 优化建议

### 1. 应用图标

替换默认图标：
- 准备不同尺寸的图标（48x48, 72x72, 96x96, 144x144, 192x192）
- 放置在`res/mipmap-*`文件夹
- 更新`AndroidManifest.xml`中的`android:icon`

---

### 2. 启动画面

添加启动画面：
- 创建`res/drawable/splash.xml`
- 在`styles.xml`中配置
- 在MainActivity中处理

---

### 3. 应用签名

生成密钥库：
```bash
keytool -genkey -v -keystore my-release-key.jks -keyalg RSA -keysize 2048 -validity 10000 -alias my-key-alias
```

配置`build.gradle`：
```gradle
android {
    signingConfigs {
        release {
            storeFile file("my-release-key.jks")
            storePassword "your-password"
            keyAlias "my-key-alias"
            keyPassword "your-password"
        }
    }
    buildTypes {
        release {
            signingConfig signingConfigs.release
        }
    }
}
```

---

### 4. 混淆配置

启用ProGuard：
```gradle
buildTypes {
    release {
        minifyEnabled true
        proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
    }
}
```

---

## 发布到Google Play

### 1. 准备工作

- [ ] 应用图标（512x512）
- [ ] 应用截图（至少2张）
- [ ] 应用描述
- [ ] 隐私政策URL
- [ ] 签名的APK或AAB

### 2. 创建应用

1. 访问 [Google Play Console](https://play.google.com/console)
2. 创建新应用
3. 填写应用信息
4. 上传APK或AAB
5. 填写商店信息
6. 提交审核

---

## 总结

本应用已经完全适配Android APK封装：

✅ **数据导出**：使用传统下载方式，文件自动保存到Download文件夹
✅ **数据导入**：通过文件选择器选择备份文件
✅ **数据持久化**：IndexedDB存储，关闭重开数据仍在
✅ **跟读功能**：支持麦克风权限请求
✅ **离线使用**：所有功能都是本地的，无需网络

**推荐使用方案一（Android Studio + WebView）**，更灵活，更容易定制。

如有问题，请参考常见问题部分，或查看Android官方文档。
