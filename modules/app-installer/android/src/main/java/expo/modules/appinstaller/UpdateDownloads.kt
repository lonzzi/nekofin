package expo.modules.appinstaller

import android.Manifest
import android.app.DownloadManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Environment
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import org.json.JSONObject
import java.io.File
import java.security.MessageDigest
import java.util.concurrent.Executors

/** All durable download state belongs to Android, independently of the React runtime. */
internal class UpdateDownloads(private val context: Context, private val expectedPackage: String = "com.lonzzi.nekofin") {
  private val prefs = context.getSharedPreferences("nekofin-app-updates", Context.MODE_PRIVATE)
  private val manager = context.getSystemService(DownloadManager::class.java)
  private val notifications = context.getSystemService(NotificationManager::class.java)

  fun setLocalizedStrings(json: String) {
    JSONObject(json)
    prefs.edit().putString("localized-strings", json).apply()
  }

  fun text(key: String, fallback: String): String = runCatching {
    JSONObject(prefs.getString("localized-strings", "{}") ?: "{}").optString(key, fallback)
  }.getOrDefault(fallback)

  private fun root(): File = File(requireNotNull(context.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS)), "app-updates")

  fun file(uri: String): File {
    val parsed = Uri.parse(uri)
    require(parsed.scheme == "file") { text("updates.installationFileInvalid", "安装文件无效，请重新下载。") }
    val file = File(requireNotNull(parsed.path)).canonicalFile
    require(file.parentFile == root().canonicalFile && file.extension == "apk" && file.isFile) {
      text("updates.installationFileMissing", "安装文件已丢失，请重新下载。")
    }
    return file
  }

  private fun release(): JSONObject? = prefs.getString("release", null)?.let { JSONObject(it) }

  private fun validate(release: JSONObject): JSONObject {
    val tag = release.getString("tag")
    require(tag.matches(Regex("v[0-9]+\\.[0-9]+\\.[0-9]+(?:-[0-9A-Za-z.-]+)?(?:\\+[0-9A-Za-z.-]+)?")))
    require(release.getString("version") == tag.substring(1))
    val installer = release.getJSONObject("installer")
    val name = "nekofin-$tag-android-arm64.apk"
    val url = Uri.parse(installer.getString("url"))
    require(installer.getString("name") == name && installer.getLong("size") > 0)
    val source = release.optString("source", "github")
    require(source == "github" || source == "cnb")
    val host = if (source == "cnb") "cnb.cool" else "github.com"
    val segments = if (source == "cnb") listOf("lonzzi", "nekofin", "-", "releases", "download", tag, name)
      else listOf("lonzzi", "nekofin", "releases", "download", tag, name)
    require(url.scheme == "https" && url.host == host && url.port == -1 && url.userInfo == null && url.query == null && url.fragment == null)
    require(url.pathSegments == segments)
    if (source == "cnb") require(!installer.isNull("sha256"))
    if (!installer.isNull("sha256")) require(installer.getString("sha256").matches(Regex("[a-fA-F0-9]{64}")))
    return installer
  }

  fun verify(file: File, release: JSONObject) {
    val installer = validate(release)
    require(file.length() == installer.getLong("size")) { text("updates.downloadIncomplete", "安装包下载不完整，请重新下载。") }
    if (!installer.isNull("sha256")) {
      val digest = MessageDigest.getInstance("SHA-256")
      file.inputStream().buffered().use { stream ->
        val buffer = ByteArray(64 * 1024)
        var count = stream.read(buffer)
        while (count != -1) {
          digest.update(buffer, 0, count)
          count = stream.read(buffer)
        }
      }
      val actual = digest.digest().joinToString("") { "%02x".format(it) }
      require(actual.equals(installer.getString("sha256"), ignoreCase = true)) { text("updates.installerChecksumInvalid", "安装包校验失败，请重新下载。") }
    }
    @Suppress("DEPRECATION")
    val archive = context.packageManager.getPackageArchiveInfo(file.path, 0)
    require(archive?.packageName == expectedPackage) { text("updates.installerInvalid", "安装包无效，请重新下载。") }
  }

  fun start(json: String, automatic: Boolean): Map<String, Any?> = synchronized(lock) {
    val release = JSONObject(json)
    val installer = validate(release)
    val existing = snapshot()
    if (existing?.get("release") == json && existing["status"] != "error") return@synchronized existing
    cancel()
    val directory = root().apply { mkdirs() }
    directory.listFiles()?.forEach { it.delete() }
    val destination = File(directory, installer.getString("name"))
    val request = DownloadManager.Request(Uri.parse(installer.getString("url")))
      .setDestinationUri(Uri.fromFile(destination))
      .setTitle("NekoFin ${release.getString("version")}")
      .setDescription(if (automatic) text("updates.downloadingUnmeteredOnly", "正在下载更新（仅非计费网络）") else text("updates.downloading", "正在下载更新"))
      .setMimeType("application/vnd.android.package-archive")
      // A completed download must be verified before it can be opened for installation.
      .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE)
      .setAllowedOverMetered(!automatic)
      .setAllowedOverRoaming(!automatic)
    val id = manager.enqueue(request)
    if (!prefs.edit().putLong("id", id).putString("release", json)
        .putBoolean("automatic", automatic).remove("verified").remove("error").commit()) {
      manager.remove(id)
      error(text("updates.saveDownloadTaskFailed", "无法保存下载任务，请重试。"))
    }
    requireNotNull(snapshot())
  }

  fun snapshot(): Map<String, Any?>? = synchronized(lock) {
    val json = prefs.getString("release", null) ?: return@synchronized null
    val release = JSONObject(json)
    val installer = validate(release)
    val result = mutableMapOf<String, Any?>("release" to json, "automatic" to prefs.getBoolean("automatic", false), "progress" to 0)
    val id = prefs.getLong("id", -1)
    val savedError = prefs.getString("error", null)
    if (savedError != null) return@synchronized result.apply { put("status", "error"); put("error", savedError) }
    manager.query(DownloadManager.Query().setFilterById(id)).use { cursor ->
      if (!cursor.moveToFirst()) return@synchronized result.apply { put("status", "error"); put("error", text("updates.downloadTaskExpired", "下载任务已失效，请重新下载。")) }
      val status = cursor.getInt(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS))
      val bytes = cursor.getLong(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_BYTES_DOWNLOADED_SO_FAR))
      val total = cursor.getLong(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_TOTAL_SIZE_BYTES)).takeIf { it > 0 } ?: installer.getLong("size")
      result["progress"] = ((bytes * 100 / total).toInt()).coerceIn(0, 99)
      when (status) {
        DownloadManager.STATUS_SUCCESSFUL -> {
          val file = File(root(), installer.getString("name"))
          try {
            val fingerprint = "${file.length()}:${file.lastModified()}"
            if (prefs.getString("verified", null) != fingerprint) {
              verify(file, release)
              prefs.edit().putString("verified", fingerprint).apply()
            }
            result["status"] = "ready"
            result["progress"] = 100
            result["uri"] = Uri.fromFile(file).toString()
          } catch (_: Exception) {
            file.delete()
            prefs.edit().putString("error", text("updates.installerIncompleteOrInvalid", "安装包不完整或校验失败，请重新下载。")).apply()
            result["status"] = "error"
            result["error"] = text("updates.installerIncompleteOrInvalid", "安装包不完整或校验失败，请重新下载。")
          }
        }
        DownloadManager.STATUS_FAILED -> {
          result["status"] = "error"
          result["error"] = text("updates.downloadFailedRetry", "下载失败，请检查网络和可用存储空间后重试。")
        }
        else -> {
          result["status"] = "downloading"
          if (status == DownloadManager.STATUS_PAUSED || status == DownloadManager.STATUS_PENDING) {
            result["waiting"] = if (prefs.getBoolean("automatic", false)) text("updates.waitingForUnmeteredNetwork", "等待非计费网络或系统重试") else text("updates.waitingForNetwork", "等待网络或系统重试")
          }
        }
      }
    }
    result
  }

  fun cancel() = synchronized(lock) {
    val id = prefs.getLong("id", -1)
    if (id != -1L) manager.remove(id)
    prefs.edit().remove("id").remove("release").remove("automatic").remove("verified").remove("error").remove("notified").commit()
    notifications.cancel(NOTIFICATION_ID)
  }

  fun verifyForInstall(uri: String): File = synchronized(lock) {
    val release = requireNotNull(release()) { text("updates.taskExpired", "更新任务已失效，请重新下载。") }
    file(uri).also { file ->
      require(file.name == release.getJSONObject("installer").getString("name"))
      verify(file, release)
      notifications.cancel(NOTIFICATION_ID)
    }
  }

  fun setPlaying(active: Boolean) {
    playing = active
    if (active) notifications.cancel(NOTIFICATION_ID)
  }

  fun notifyCompleted(id: Long) = synchronized(lock) {
    if (prefs.getLong("id", -1) != id || playing) return@synchronized
    if (snapshot()?.get("status") != "ready" || prefs.getLong("notified", -1) == id) return@synchronized
    if (Build.VERSION.SDK_INT >= 33 && ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return@synchronized
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      notifications.createNotificationChannel(NotificationChannel(CHANNEL, text("updates.title", "应用更新"), NotificationManager.IMPORTANCE_LOW).apply {
        description = text("updates.installReminderDescription", "更新下载完成后提醒安装")
        setSound(null, null)
      })
    }
    val intent = context.packageManager.getLaunchIntentForPackage(context.packageName) ?: return@synchronized
    intent.action = Intent.ACTION_VIEW
    intent.data = Uri.parse("nekofin://about")
    intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
    val pending = PendingIntent.getActivity(context, NOTIFICATION_ID, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    val notification = NotificationCompat.Builder(context, CHANNEL)
      .setSmallIcon(android.R.drawable.stat_sys_download_done)
      .setContentTitle(text("updates.downloadedNotificationTitle", "NekoFin 更新已下载"))
      .setContentText(text("updates.downloadedNotificationDescription", "点按打开应用，选择是否安装新版本"))
      .setContentIntent(pending).setAutoCancel(true).setSilent(true).build()
    if (playing) return@synchronized
    notifications.notify(NOTIFICATION_ID, notification)
    prefs.edit().putLong("notified", id).apply()
  }

  companion object {
    // Playback stops with the process; a receiver in a new process must not inherit suppression.
    @Volatile private var playing = false
    private val lock = Any()
    private const val CHANNEL = "nekofin-app-updates"
    private const val NOTIFICATION_ID = 4127
  }
}

class UpdateDownloadReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action != DownloadManager.ACTION_DOWNLOAD_COMPLETE) return
    val id = intent.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, -1)
    val pending = goAsync()
    executor.execute {
      try { UpdateDownloads(context.applicationContext).notifyCompleted(id) }
      catch (_: Exception) { /* A failed verification is surfaced when the app next reads its task. */ }
      finally { pending.finish() }
    }
  }
  companion object { private val executor = Executors.newSingleThreadExecutor() }
}
