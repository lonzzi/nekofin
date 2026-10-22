package expo.modules.appinstaller

import android.content.ClipData
import android.content.Intent
import android.net.Uri
import android.net.ConnectivityManager
import android.os.Build
import android.provider.Settings
import androidx.core.content.FileProvider
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.functions.Queues

class UpdateFileProvider : FileProvider()

class AppInstallerModule : Module() {
  private fun downloads() = UpdateDownloads(requireNotNull(appContext.reactContext))

  override fun definition() = ModuleDefinition {
    Name("AppInstaller")
    Function("setLocalizedStrings") { json: String -> downloads().setLocalizedStrings(json) }
    AsyncFunction("startDownloadAsync") { json: String, automatic: Boolean -> downloads().start(json, automatic) }
    AsyncFunction("getDownloadAsync") { downloads().snapshot() }
    AsyncFunction("cancelDownloadAsync") { downloads().cancel() }
    AsyncFunction("setPlaybackActiveAsync") { active: Boolean -> downloads().setPlaying(active) }
    AsyncFunction("isUnmeteredAsync") {
      val network = requireNotNull(appContext.reactContext).getSystemService(ConnectivityManager::class.java)
      network.activeNetwork != null && !network.isActiveNetworkMetered
    }
    // Verification and hashing run off the UI thread, including for restored downloads.
    AsyncFunction("prepareInstallAsync") { uri: String -> downloads().verifyForInstall(uri); uri }
    AsyncFunction("installApkAsync") { uri: String ->
      val file = downloads().file(uri)
      val context = requireNotNull(appContext.reactContext)
      val activity = requireNotNull(appContext.currentActivity) { downloads().text("updates.returnToAppToInstall", "请返回应用后重试安装。") }
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && !context.packageManager.canRequestPackageInstalls()) {
        activity.startActivity(Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
          Uri.parse("package:${context.packageName}")))
        "permission-required"
      } else {
        val contentUri = FileProvider.getUriForFile(context, "${context.packageName}.updates", file)
        val intent = Intent(Intent.ACTION_VIEW).apply {
          setDataAndType(contentUri, "application/vnd.android.package-archive")
          addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
          clipData = ClipData.newRawUri("NekoFin update", contentUri)
        }
        activity.startActivity(intent)
        "opened"
      }
    }.runOnQueue(Queues.MAIN)
  }
}
