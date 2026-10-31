package expo.modules.diagnosticlogs

import android.os.Process
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import java.util.concurrent.TimeoutException

class DiagnosticLogsModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("DiagnosticLogs")

    AsyncFunction("readOwnLogAsync") {
      // Android permits an app to read its own log buffer without READ_LOGS.
      // This deliberately excludes other apps and the system-wide log buffer.
      val process = ProcessBuilder(
        "logcat", "-d", "-b", "main", "-b", "crash",
        "--pid=${Process.myPid()}", "-t", "1500", "-v", "threadtime",
      ).redirectErrorStream(true).start()
      val executor = Executors.newSingleThreadExecutor()
      val output = executor.submit<String> {
        val text = StringBuilder()
        process.inputStream.bufferedReader().use { reader ->
          while (true) {
            val line = reader.readLine() ?: break
            text.append(line).append('\n')
            if (text.length > 256 * 1024) text.delete(0, text.length - 256 * 1024)
          }
        }
        text.toString()
      }
      try {
        "PID: ${Process.myPid()}\nLimit: 1500 recent messages / 262144 characters\n" +
          output.get(3, TimeUnit.SECONDS)
      } catch (_: TimeoutException) {
        "Native log collection timed out after 3 seconds."
      } finally {
        process.destroy()
        output.cancel(true)
        executor.shutdownNow()
      }
    }
  }
}
