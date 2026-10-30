package expo.modules.appinstaller

import android.app.DownloadManager
import android.app.Activity
import android.app.NotificationManager
import android.content.Context
import android.net.Uri
import android.os.Environment
import android.os.Bundle
import android.os.Build
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.json.JSONObject
import org.junit.After
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import java.io.File
import java.net.ServerSocket
import java.security.MessageDigest
import kotlin.concurrent.thread

@RunWith(AndroidJUnit4::class)
class UpdateDownloadsTest {
  private val context: Context get() = InstrumentationRegistry.getInstrumentation().targetContext
  private val prefs get() = context.getSharedPreferences("nekofin-app-updates", Context.MODE_PRIVATE)
  private val tag = "v0.1.0-beta.4"
  private val name = "nekofin-$tag-android-arm64.apk"
  private fun downloads() = UpdateDownloads(context, context.packageName)

  @Before fun reset() { downloads().setPlaying(false); downloads().cancel(); prefs.edit().clear().commit() }
  @After fun cleanup() { downloads().setPlaying(false); downloads().cancel() }

  private fun release(size: Long, sha: String? = null): JSONObject = JSONObject().apply {
    put("tag", tag); put("version", tag.substring(1))
    put("url", "https://github.com/lonzzi/nekofin/releases/tag/$tag")
    put("installer", JSONObject().apply {
      put("name", name); put("size", size)
      put("url", "https://github.com/lonzzi/nekofin/releases/download/$tag/$name")
      put("sha256", sha ?: JSONObject.NULL)
    })
  }

  @Test fun startsOneSystemTaskAndCancelsItWithoutAnActivity() {
    val json = release(100).toString()
    val first = downloads().start(json, true)
    val id = prefs.getLong("id", -1)
    assertTrue(id > 0)
    assertEquals("downloading", first["status"])
    assertEquals(id, prefs.getLong("id", -1))
    downloads().start(json, true)
    assertEquals(id, prefs.getLong("id", -1))
    assertEquals(true, UpdateDownloads(context).snapshot()?.get("automatic"))
    downloads().cancel()
    assertNull(downloads().snapshot())
  }

  @Test fun rejectsOffRepositorySourcesBeforeScheduling() {
    val json = release(100)
    json.getJSONObject("installer").put("url", "https://other.example/update.apk")
    assertThrows(IllegalArgumentException::class.java) { downloads().start(json.toString(), false) }
    assertEquals(-1, prefs.getLong("id", -1).toInt())
  }

  private fun cnbRelease(): JSONObject = release(100, "a".repeat(64)).apply {
    put("source", "cnb")
    put("url", "https://cnb.cool/lonzzi/nekofin/-/releases/tag/$tag")
    getJSONObject("installer").put("url", "https://cnb.cool/lonzzi/nekofin/-/releases/download/$tag/$name")
  }

  @Test fun acceptsCanonicalCnbDownloadsWithChecksums() {
    val state = downloads().start(cnbRelease().toString(), true)
    assertEquals("downloading", state["status"])
    assertTrue(prefs.getLong("id", -1) > 0)
  }

  @Test fun rejectsMissingChecksumsMismatchedSourcesAndOffRepositoryCnbUrls() {
    val missing = cnbRelease().apply { getJSONObject("installer").put("sha256", JSONObject.NULL) }
    val mismatched = cnbRelease().apply { put("source", "github") }
    val offRepository = cnbRelease().apply { getJSONObject("installer").put("url", "https://cnb.cool/other/nekofin/-/releases/download/$tag/$name") }
    val query = cnbRelease().apply { getJSONObject("installer").put("url", "https://cnb.cool/lonzzi/nekofin/-/releases/download/$tag/$name?redirect=elsewhere") }
    for (json in listOf(missing, mismatched, offRepository, query)) {
      assertThrows(IllegalArgumentException::class.java) { downloads().start(json.toString(), false) }
      assertEquals(-1, prefs.getLong("id", -1).toInt())
    }
  }

  /** The system downloads this test application's real APK from a local HTTP server. */
  private fun finishSystemDownload(corrupt: Boolean = false): Map<String, Any?> {
    val apk = File(context.applicationInfo.sourceDir)
    val sha = apk.inputStream().use { stream ->
      val digest = MessageDigest.getInstance("SHA-256")
      val buffer = ByteArray(65536)
      var count = stream.read(buffer)
      while (count != -1) { digest.update(buffer, 0, count); count = stream.read(buffer) }
      digest.digest().joinToString("") { "%02x".format(it) }
    }
    val server = ServerSocket(0)
    val worker = thread {
      server.accept().use { socket ->
        val input = socket.getInputStream().bufferedReader()
        while (input.readLine()?.isNotEmpty() == true) { }
        socket.getOutputStream().use { output ->
          output.write("HTTP/1.1 200 OK\r\nContent-Length: ${apk.length()}\r\nContent-Type: application/vnd.android.package-archive\r\nConnection: close\r\n\r\n".toByteArray())
          apk.inputStream().use { it.copyTo(output) }
        }
      }
    }
    val root = File(context.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS), "app-updates").apply { mkdirs() }
    val destination = File(root, name).apply { delete() }
    val request = DownloadManager.Request(Uri.parse("http://127.0.0.1:${server.localPort}/fixture.apk"))
      .setDestinationUri(Uri.fromFile(destination)).setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE)
    val id = context.getSystemService(DownloadManager::class.java).enqueue(request)
    prefs.edit().putLong("id", id).putString("release", release(apk.length(), if (corrupt) "0".repeat(64) else sha).toString()).putBoolean("automatic", true).commit()
    try {
      val end = System.currentTimeMillis() + 45000
      while (System.currentTimeMillis() < end) {
        val state = downloads().snapshot()!!
        if (state["status"] != "downloading") return state
        Thread.sleep(200)
      }
      error("System download did not finish")
    } finally { server.close(); worker.join(1000) }
  }

  @Test fun restoresAndVerifiesAnActualCompletedSystemDownload() {
    val state = finishSystemDownload()
    assertEquals("ready", state["status"])
    // Reconstructing the store simulates losing all React/module in-memory state.
    val restored = downloads().snapshot()!!
    assertEquals(state["uri"], restored["uri"])
    assertEquals(100, restored["progress"])
    downloads().verifyForInstall(restored["uri"] as String)
  }

  @Test fun corruptedDownloadsNeverBecomeInstallable() {
    assertEquals("error", finishSystemDownload(corrupt = true)["status"])
    assertThrows(IllegalArgumentException::class.java) { downloads().file("file:///outside.apk") }
  }

  @Test fun playbackSuppressesTheCompletionNotification() {
    downloads().setPlaying(true)
    assertEquals("ready", finishSystemDownload()["status"])
    downloads().notifyCompleted(prefs.getLong("id", -1))
    assertFalse(context.getSystemService(NotificationManager::class.java).activeNotifications.any { it.id == 4127 })
  }

  @Test fun stalePersistedPlaybackDoesNotSuppressTheCompletionNotification() {
    assertEquals("ready", finishSystemDownload()["status"])
    // Older versions persisted this flag, which can survive a terminated playback process.
    prefs.edit().putBoolean("playing", true).commit()
    downloads().notifyCompleted(prefs.getLong("id", -1))
    awaitCompletionNotification()
  }

  private fun awaitCompletionNotification(): android.app.Notification {
    val manager = context.getSystemService(NotificationManager::class.java)
    val end = System.currentTimeMillis() + 3000
    while (manager.activeNotifications.none { it.id == 4127 } && System.currentTimeMillis() < end) Thread.sleep(50)
    return manager.activeNotifications.first { it.id == 4127 }.notification
  }

  @Test fun completionNotificationIsSilentAndOpensTheUpdatePage() {
    assertEquals("ready", finishSystemDownload()["status"])
    downloads().setPlaying(false)
    downloads().notifyCompleted(prefs.getLong("id", -1))
    val manager = context.getSystemService(NotificationManager::class.java)
    val notification = awaitCompletionNotification()
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      assertEquals(NotificationManager.IMPORTANCE_LOW, manager.getNotificationChannel(notification.channelId).importance)
    }
    assertNull(notification.sound)
    assertNull(notification.vibrate)
    notification.contentIntent.send()
    InstrumentationRegistry.getInstrumentation().waitForIdleSync()
    val launchEnd = System.currentTimeMillis() + 3000
    while (UpdaterTestActivity.lastUri == null && System.currentTimeMillis() < launchEnd) Thread.sleep(50)
    assertEquals("nekofin://about", UpdaterTestActivity.lastUri)
    assertEquals("android.intent.action.VIEW", UpdaterTestActivity.lastAction)
  }
}

class UpdaterTestActivity : Activity() {
  override fun onCreate(state: Bundle?) {
    super.onCreate(state)
    lastUri = intent.data?.toString()
    lastAction = intent.action
  }
  companion object {
    @Volatile var lastUri: String? = null
    @Volatile var lastAction: String? = null
  }
}
