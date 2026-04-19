# APK问题修复指南

## 问题1：文件导入功能无效 ❌

### 现象
- 点击"选择文件"按钮没有反应
- 无法打开文件选择器
- 在微信小程序中正常，在APK中无效

### 原因
APK的WebView需要在`WebChromeClient`中实现`onShowFileChooser`方法来处理文件选择。

### 解决方案

在`MainActivity.kt`中添加以下代码：

#### 1. 添加变量声明

```kotlin
class MainActivity : AppCompatActivity() {
    
    private lateinit var webView: WebView
    private val PERMISSION_REQUEST_CODE = 100
    private val FILE_CHOOSER_REQUEST_CODE = 101  // 新增
    private var mFilePathCallback: ValueCallback<Array<Uri>>? = null  // 新增
```

#### 2. 添加import语句

```kotlin
import android.app.Activity  // 新增
import android.content.Intent  // 新增
```

#### 3. 在WebChromeClient中添加onShowFileChooser

```kotlin
webView.webChromeClient = object : WebChromeClient() {
    // ... 其他方法 ...
    
    // 处理文件选择（Android 5.0+）
    override fun onShowFileChooser(
        webView: WebView?,
        filePathCallback: ValueCallback<Array<Uri>>?,
        fileChooserParams: FileChooserParams?
    ): Boolean {
        // 清除之前的回调
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
```

#### 4. 添加onActivityResult方法

```kotlin
// 在MainActivity类的最后添加
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
```

---

## 问题2：持久化存储授权失败 ⚠️

### 现象
- 点击"授权持久化存储"后显示错误
- 提示"浏览器可能不支持或用户已拒绝了请求"
- 但实际上APK中的数据是持久的

### 原因
- APK的WebView中，`navigator.storage.persist()`可能返回`false`
- 但这不代表数据不持久
- APK的IndexedDB数据存储在应用私有目录，只有卸载应用时才会被清除

### 解决方案

**已在代码中修复**，无需修改MainActivity。

Web应用会自动检测是否在APK中运行：
- 如果在APK中，即使`persist()`返回`false`，也会显示"数据已持久化"
- 提示信息："应用数据存储在私有目录，关闭应用后不会丢失"

---

## 完整的MainActivity.kt示例

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
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            allowFileAccess = true
            allowContentAccess = true
            cacheMode = WebSettings.LOAD_DEFAULT
            setSupportZoom(true)
            builtInZoomControls = true
            displayZoomControls = false
            useWideViewPort = true
            loadWithOverviewMode = true
            
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
            }
        }
        
        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                return false
            }
        }
        
        webView.webChromeClient = object : WebChromeClient() {
            override fun onPermissionRequest(request: PermissionRequest?) {
                request?.grant(request.resources)
            }
            
            override fun onJsAlert(view: WebView?, url: String?, message: String?, result: JsResult?): Boolean {
                Toast.makeText(this@MainActivity, message, Toast.LENGTH_SHORT).show()
                result?.confirm()
                return true
            }
            
            // 处理文件选择
            override fun onShowFileChooser(
                webView: WebView?,
                filePathCallback: ValueCallback<Array<Uri>>?,
                fileChooserParams: FileChooserParams?
            ): Boolean {
                mFilePathCallback?.onReceiveValue(null)
                mFilePathCallback = filePathCallback
                
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
        
        webView.setDownloadListener { url, userAgent, contentDisposition, mimeType, contentLength ->
            downloadFile(url, contentDisposition, mimeType)
        }
    }
    
    private fun downloadFile(url: String, contentDisposition: String, mimeType: String) {
        try {
            val filename = URLUtil.guessFileName(url, contentDisposition, mimeType)
            
            val request = DownloadManager.Request(Uri.parse(url))
            request.setMimeType(mimeType)
            request.addRequestHeader("User-Agent", webView.settings.userAgentString)
            request.setDescription("正在下载...")
            request.setTitle(filename)
            request.allowScanningByMediaScanner()
            request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
            request.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, filename)
            
            val downloadManager = getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
            downloadManager.enqueue(request)
            
            Toast.makeText(this, "开始下载: $filename", Toast.LENGTH_SHORT).show()
        } catch (e: Exception) {
            Toast.makeText(this, "下载失败: ${e.message}", Toast.LENGTH_SHORT).show()
        }
    }
    
    private fun requestPermissions() {
        val permissions = mutableListOf<String>()
        
        if (Build.VERSION.SDK_INT <= Build.VERSION_CODES.P) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.WRITE_EXTERNAL_STORAGE) 
                != PackageManager.PERMISSION_GRANTED) {
                permissions.add(Manifest.permission.WRITE_EXTERNAL_STORAGE)
            }
        }
        
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) 
            != PackageManager.PERMISSION_GRANTED) {
            permissions.add(Manifest.permission.RECORD_AUDIO)
        }
        
        if (permissions.isNotEmpty()) {
            ActivityCompat.requestPermissions(this, permissions.toTypedArray(), PERMISSION_REQUEST_CODE)
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
                val dataUri = data.data
                if (dataUri != null) {
                    arrayOf(dataUri)
                } else {
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

## 测试步骤

### 1. 更新MainActivity.kt

将上面的完整代码复制到您的Android项目中。

### 2. 重新构建APK

```bash
# 在Android Studio中
Build > Build Bundle(s) / APK(s) > Build APK(s)
```

### 3. 安装到设备

```bash
adb install app/build/outputs/apk/debug/app-debug.apk
```

### 4. 测试文件导入

1. 打开应用
2. 进入"单词管理"
3. 点击"文件导入"
4. 点击"选择文件"按钮
5. **应该打开系统文件选择器** ✅
6. 选择一个文件（.txt、.csv、.xlsx等）
7. **文件应该正常导入** ✅

### 5. 测试持久化存储

1. 进入"数据管理"
2. 点击"授权持久化存储"按钮
3. **应该显示"数据已持久化"** ✅
4. **提示信息："应用数据存储在私有目录，关闭应用后不会丢失"** ✅

---

## 常见问题

### Q1: 文件选择器打开后选择文件没反应？

**检查**：
- 确认`onActivityResult`方法已添加
- 确认`mFilePathCallback`不为null
- 查看Logcat日志是否有错误

### Q2: 仍然显示"浏览器可能不支持"？

**检查**：
- 确认已更新到最新的Web应用代码（v274+）
- 清除应用数据后重新测试
- 查看Logcat日志

### Q3: 选择多个文件只导入了一个？

**原因**：
- 代码已支持多文件选择
- 检查`clipData`处理逻辑

---

## 验证成功的标志

✅ **文件导入**：
- 点击"选择文件"打开系统文件选择器
- 可以浏览文件系统
- 选择文件后正常导入
- 显示导入进度和结果

✅ **持久化存储**：
- 点击"授权持久化存储"显示成功
- 提示信息正确
- 关闭应用后数据不丢失

✅ **数据导出**：
- 点击"导出数据备份"
- 文件下载到Download文件夹
- 可以在文件管理器中找到

---

## 技术说明

### 文件选择工作流程

1. 用户点击`<input type="file">`
2. WebView触发`onShowFileChooser`
3. 创建文件选择Intent
4. 调用`startActivityForResult`
5. 系统打开文件选择器
6. 用户选择文件
7. `onActivityResult`接收结果
8. 通过`filePathCallback`返回给WebView
9. JavaScript获取文件内容

### APK中的数据持久化

- **存储位置**：`/data/data/com.didi.wordhelper/app_webview/`
- **访问权限**：仅应用自己可访问
- **持久性**：关闭应用后不丢失
- **清除条件**：只有卸载应用时才会被清除
- **无需授权**：不需要Storage API的persist()授权

---

## 总结

两个问题都已修复：

1. **文件导入**：添加`onShowFileChooser`和`onActivityResult`
2. **持久化存储**：改进错误处理，正确识别APK环境

更新MainActivity.kt后重新构建APK即可解决所有问题。
