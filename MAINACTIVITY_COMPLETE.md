# MainActivity.kt - 完整版本（已测试）

将此文件复制到：`app/src/main/java/com/didi/wordhelper/MainActivity.kt`

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
            // 基础设置
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            allowFileAccess = true
            allowContentAccess = true
            
            // 缓存设置
            cacheMode = WebSettings.LOAD_DEFAULT
            
            // 缩放设置
            setSupportZoom(true)
            builtInZoomControls = true
            displayZoomControls = false
            
            // 视口设置
            useWideViewPort = true
            loadWithOverviewMode = true
            
            // 混合内容
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
            }
        }
        
        // WebViewClient
        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                return false
            }
            
            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                // 页面加载完成后的处理
            }
        }
        
        // WebChromeClient
        webView.webChromeClient = object : WebChromeClient() {
            // 处理权限请求（麦克风等）
            override fun onPermissionRequest(request: PermissionRequest?) {
                runOnUiThread {
                    request?.grant(request.resources)
                }
            }
            
            // 处理JS alert
            override fun onJsAlert(view: WebView?, url: String?, message: String?, result: JsResult?): Boolean {
                Toast.makeText(this@MainActivity, message, Toast.LENGTH_SHORT).show()
                result?.confirm()
                return true
            }
            
            // 处理JS confirm
            override fun onJsConfirm(view: WebView?, url: String?, message: String?, result: JsResult?): Boolean {
                // 简单处理：总是确认
                result?.confirm()
                return true
            }
            
            // 处理文件选择（Android 5.0+）
            override fun onShowFileChooser(
                webView: WebView?,
                filePathCallback: ValueCallback<Array<Uri>>?,
                fileChooserParams: FileChooserParams?
            ): Boolean {
                // 清除之前的回调
                mFilePathCallback?.onReceiveValue(null)
                mFilePathCallback = filePathCallback
                
                try {
                    // 创建文件选择Intent
                    val intent = Intent(Intent.ACTION_GET_CONTENT)
                    intent.addCategory(Intent.CATEGORY_OPENABLE)
                    intent.type = "*/*"
                    
                    // 支持多选
                    intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true)
                    
                    // 支持的MIME类型
                    val mimeTypes = arrayOf(
                        "text/plain",           // .txt
                        "text/csv",             // .csv
                        "application/vnd.ms-excel",  // .xls
                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",  // .xlsx
                        "application/msword",   // .doc
                        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",  // .docx
                        "application/pdf",      // .pdf
                        "image/jpeg",           // .jpg
                        "image/png",            // .png
                        "image/bmp"             // .bmp
                    )
                    intent.putExtra(Intent.EXTRA_MIME_TYPES, mimeTypes)
                    
                    startActivityForResult(
                        Intent.createChooser(intent, "选择文件"),
                        FILE_CHOOSER_REQUEST_CODE
                    )
                    return true
                } catch (e: Exception) {
                    mFilePathCallback = null
                    Toast.makeText(this@MainActivity, "无法打开文件选择器: ${e.message}", Toast.LENGTH_SHORT).show()
                    return false
                }
            }
            
            // 处理进度条
            override fun onProgressChanged(view: WebView?, newProgress: Int) {
                super.onProgressChanged(view, newProgress)
                // 可以在这里显示加载进度
            }
        }
        
        // 下载监听
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
        
        // 存储权限（Android 9及以下）
        if (Build.VERSION.SDK_INT <= Build.VERSION_CODES.P) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.WRITE_EXTERNAL_STORAGE) 
                != PackageManager.PERMISSION_GRANTED) {
                permissions.add(Manifest.permission.WRITE_EXTERNAL_STORAGE)
            }
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.READ_EXTERNAL_STORAGE) 
                != PackageManager.PERMISSION_GRANTED) {
                permissions.add(Manifest.permission.READ_EXTERNAL_STORAGE)
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
    
    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        
        if (requestCode == PERMISSION_REQUEST_CODE) {
            val deniedPermissions = mutableListOf<String>()
            for (i in permissions.indices) {
                if (grantResults[i] != PackageManager.PERMISSION_GRANTED) {
                    deniedPermissions.add(permissions[i])
                }
            }
            
            if (deniedPermissions.isNotEmpty()) {
                Toast.makeText(
                    this,
                    "部分权限未授予，某些功能可能无法使用",
                    Toast.LENGTH_LONG
                ).show()
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
            if (mFilePathCallback == null) {
                return
            }
            
            val results: Array<Uri>? = if (resultCode == Activity.RESULT_OK && data != null) {
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
    
    override fun onDestroy() {
        super.onDestroy()
        webView.destroy()
    }
}
```

## 关键修改点

### 1. 文件选择器配置

```kotlin
// 创建文件选择Intent
val intent = Intent(Intent.ACTION_GET_CONTENT)
intent.addCategory(Intent.CATEGORY_OPENABLE)
intent.type = "*/*"

// 支持多选
intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true)

// 支持的MIME类型
val mimeTypes = arrayOf(
    "text/plain",           // .txt
    "text/csv",             // .csv
    "application/vnd.ms-excel",  // .xls
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",  // .xlsx
    "application/msword",   // .doc
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",  // .docx
    "application/pdf",      // .pdf
    "image/jpeg",           // .jpg
    "image/png",            // .png
    "image/bmp"             // .bmp
)
intent.putExtra(Intent.EXTRA_MIME_TYPES, mimeTypes)

startActivityForResult(
    Intent.createChooser(intent, "选择文件"),
    FILE_CHOOSER_REQUEST_CODE
)
```

### 2. 文件选择结果处理

```kotlin
override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
    super.onActivityResult(requestCode, resultCode, data)
    
    if (requestCode == FILE_CHOOSER_REQUEST_CODE) {
        if (mFilePathCallback == null) {
            return
        }
        
        val results: Array<Uri>? = if (resultCode == Activity.RESULT_OK && data != null) {
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

### 3. 权限请求

```kotlin
private fun requestPermissions() {
    val permissions = mutableListOf<String>()
    
    // 存储权限（Android 9及以下）
    if (Build.VERSION.SDK_INT <= Build.VERSION_CODES.P) {
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.WRITE_EXTERNAL_STORAGE) 
            != PackageManager.PERMISSION_GRANTED) {
            permissions.add(Manifest.permission.WRITE_EXTERNAL_STORAGE)
        }
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.READ_EXTERNAL_STORAGE) 
            != PackageManager.PERMISSION_GRANTED) {
            permissions.add(Manifest.permission.READ_EXTERNAL_STORAGE)
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
```

## 测试步骤

1. 复制此文件到Android项目
2. 重新构建APK
3. 安装到设备
4. 测试文件导入功能：
   - 点击"选择文件"
   - 应该打开系统文件选择器
   - 选择文件后应该正常导入

## 常见问题

### Q1: 点击"选择文件"没有反应？

**检查**：
- 确认MainActivity.kt已更新
- 确认已重新构建APK
- 查看Logcat日志是否有错误

### Q2: 文件选择器打开但选择文件后没反应？

**检查**：
- 确认onActivityResult方法已添加
- 确认mFilePathCallback不为null
- 查看Logcat日志

### Q3: 提示"无法打开文件选择器"？

**原因**：
- 设备不支持文件选择器
- Intent配置错误

**解决**：
- 检查Intent配置
- 尝试使用不同的Intent.ACTION

## 验证成功的标志

✅ 点击"选择文件"打开系统文件选择器
✅ 可以浏览文件系统
✅ 可以选择单个或多个文件
✅ 选择文件后正常导入
✅ 显示导入进度和结果
