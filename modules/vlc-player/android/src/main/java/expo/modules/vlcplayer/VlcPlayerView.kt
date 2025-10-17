package expo.modules.vlcplayer

import android.R
import android.app.PendingIntent
import android.app.PendingIntent.FLAG_IMMUTABLE
import android.app.PendingIntent.FLAG_UPDATE_CURRENT
import android.app.PictureInPictureParams
import android.app.RemoteAction
import android.content.BroadcastReceiver
import android.content.Context
import android.content.ContextWrapper
import android.content.Intent
import android.content.IntentFilter
import android.graphics.drawable.Icon
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.Looper
import androidx.annotation.RequiresApi
import androidx.core.app.PictureInPictureModeChangedInfo
import androidx.lifecycle.LifecycleObserver
import expo.modules.core.logging.LogHandlers
import expo.modules.core.logging.Logger
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.viewevent.EventDispatcher
import expo.modules.kotlin.views.ExpoView
import org.videolan.libvlc.LibVLC
import org.videolan.libvlc.Media
import org.videolan.libvlc.MediaPlayer
import org.videolan.libvlc.interfaces.IMedia
import org.videolan.libvlc.util.VLCVideoLayout


class VlcPlayerView(context: Context, appContext: AppContext) : ExpoView(context, appContext), LifecycleObserver,
  MediaPlayer.EventListener {
  private val log = Logger(listOf(LogHandlers.createOSLogHandler(this::class.simpleName!!)))
  private val PIP_PLAY_PAUSE_ACTION = "PIP_PLAY_PAUSE_ACTION"
  private val PIP_REWIND_ACTION = "PIP_REWIND_ACTION"
  private val PIP_FORWARD_ACTION = "PIP_FORWARD_ACTION"

  private var libVLC: LibVLC? = null
  private var mediaPlayer: MediaPlayer? = null
  private lateinit var videoLayout: VLCVideoLayout
  private var isPaused: Boolean = false
  private var lastReportedState: Int? = null
  private var lastReportedIsPlaying: Boolean? = null
  private var media: Media? = null
  private var timeLeft: Long? = null

  private val onVideoProgress by EventDispatcher()
  private val onVideoStateChange by EventDispatcher()
  private val onVideoLoadEnd by EventDispatcher()
  private val onPipStarted by EventDispatcher()
  private val onMediaStatsChange by EventDispatcher()

  private var startPosition: Int? = 0
  private var isMediaReady: Boolean = false
  private var externalTrack: Map<String, String>? = null
  private var externalSubtitles: List<Map<String, String>>? = null
  var hasSource: Boolean = false

  private val handler = Handler(Looper.getMainLooper())
  private val updateStatsRunnable = object : Runnable {
    override fun run() {
      updateMediaStats()
      handler.postDelayed(this, 500L)
    }
  }
  private val currentActivity get() = context.findActivity()
  private val actions: MutableList<RemoteAction> = mutableListOf()
  private val remoteActionFilter = IntentFilter()
  private val playPauseIntent: Intent = Intent(PIP_PLAY_PAUSE_ACTION).setPackage(context.packageName)
  private val forwardIntent: Intent = Intent(PIP_FORWARD_ACTION).setPackage(context.packageName)
  private val rewindIntent: Intent = Intent(PIP_REWIND_ACTION).setPackage(context.packageName)
  private var actionReceiver: BroadcastReceiver = object : BroadcastReceiver() {
    override fun onReceive(context: Context?, intent: Intent?) {
      when (intent?.action) {
        PIP_PLAY_PAUSE_ACTION -> {
          if (isPaused) play() else pause()
          if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            setupPipActions()
            currentActivity.setPictureInPictureParams(getPipParams()!!)
          }
        }

        PIP_FORWARD_ACTION -> seekTo((mediaPlayer?.time?.toInt() ?: 0) + 15_000)
        PIP_REWIND_ACTION -> seekTo((mediaPlayer?.time?.toInt() ?: 0) - 15_000)
      }
    }
  }

  private var pipChangeListener: (PictureInPictureModeChangedInfo) -> Unit = { info ->
    if (!info.isInPictureInPictureMode && mediaPlayer?.isPlaying == true) {
      log.debug("Exiting PiP")
      timeLeft = mediaPlayer?.time
      pause()

      // Setting the media after reattaching the view allows for a fast video view render
      if (mediaPlayer?.vlcVout?.areViewsAttached() == false) {
        mediaPlayer?.attachViews(videoLayout, null, false, false)
        mediaPlayer?.media = media
        mediaPlayer?.play()
        timeLeft?.let { mediaPlayer?.time = it }
        mediaPlayer?.pause()

      }
    }
    onPipStarted(
      mapOf(
        "pipStarted" to info.isInPictureInPictureMode
      )
    )
  }

  init {
    setupView()
  }

  private fun setupView() {
    log.debug("Setting up view")
    setBackgroundColor(android.graphics.Color.WHITE)
    videoLayout = VLCVideoLayout(context).apply {
      layoutParams = LayoutParams(LayoutParams.WRAP_CONTENT, LayoutParams.WRAP_CONTENT)
    }
    videoLayout.keepScreenOn = true
    addView(videoLayout)
    log.debug("View setup complete")
  }

  private fun setupPiP() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    try {
      remoteActionFilter.addAction(PIP_PLAY_PAUSE_ACTION)
      remoteActionFilter.addAction(PIP_FORWARD_ACTION)
      remoteActionFilter.addAction(PIP_REWIND_ACTION)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
        currentActivity.registerReceiver(
          actionReceiver,
          remoteActionFilter,
          Context.RECEIVER_NOT_EXPORTED
        )
      }
      setupPipActions()
      currentActivity.apply {
        setPictureInPictureParams(getPipParams()!!)
        addOnPictureInPictureModeChangedListener(pipChangeListener)
      }
    } catch (e: IllegalStateException) {
      log.warn("Deferred PiP setup: activity not available yet")
    }
  }

  private var pipInitialized: Boolean = false

  override fun onAttachedToWindow() {
    super.onAttachedToWindow()
    if (!pipInitialized) {
      setupPiP()
      pipInitialized = true
    }
  }

  @RequiresApi(Build.VERSION_CODES.O)
  private fun setupPipActions() {
    actions.clear()
    actions.addAll(
      listOf(
        RemoteAction(
          Icon.createWithResource(context, R.drawable.ic_media_rew),
          "Rewind",
          "Rewind Video",
          PendingIntent.getBroadcast(
            context,
            0,
            rewindIntent,
            FLAG_UPDATE_CURRENT or FLAG_IMMUTABLE
          )
        ),
        RemoteAction(
          if (isPaused) Icon.createWithResource(context, R.drawable.ic_media_play)
          else Icon.createWithResource(context, R.drawable.ic_media_pause),
          "Play",
          "Play Video",
          PendingIntent.getBroadcast(
            context,
            if (isPaused) 0 else 1,
            playPauseIntent,
            FLAG_UPDATE_CURRENT or FLAG_IMMUTABLE
          )
        ),
        RemoteAction(
          Icon.createWithResource(context, R.drawable.ic_media_ff),
          "Skip",
          "Skip Forward",
          PendingIntent.getBroadcast(
            context,
            0,
            forwardIntent,
            FLAG_UPDATE_CURRENT or FLAG_IMMUTABLE
          )
        )
      )
    )
  }

  private fun getPipParams(): PictureInPictureParams? {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      var builder = PictureInPictureParams.Builder()
        .setActions(actions)

      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        builder = builder.setAutoEnterEnabled(true)
      }
      return builder.build()
    }
    return null
  }

  fun setSource(source: Map<String, Any>) {
    log.debug("setting source $source")
    if (hasSource) {
      log.debug("Source already set. Resuming")
      val isAttached = mediaPlayer?.vlcVout?.areViewsAttached()
      if (isAttached == false) {
        mediaPlayer?.attachViews(videoLayout, null, false, false)
      }
      play()
      return
    }
    val mediaOptions = source["mediaOptions"] as? Map<String, Any> ?: emptyMap()
    val autoplay = source["autoplay"] as? Boolean ?: false
    val isNetwork = source["isNetwork"] as? Boolean ?: false
    externalTrack = source["externalTrack"] as? Map<String, String>
    externalSubtitles = source["externalSubtitles"] as? List<Map<String, String>>
    startPosition = (source["startPosition"] as? Double)?.toInt() ?: 0

    val initOptions = source["initOptions"] as? MutableList<String> ?: mutableListOf()
    initOptions.add("--start-time=$startPosition")

    // Configure freetype for proper subtitle rendering, especially for CJK characters
    // Try common Android font paths for CJK support
    val fontPaths = listOf(
      "/system/fonts/NotoSansCJK-Regular.ttc",
      "/system/fonts/NotoSansHans-Regular.otf",
      "/system/fonts/DroidSansFallback.ttf",
      "/system/fonts/Roboto-Regular.ttf"
    )
    
    for (fontPath in fontPaths) {
      val fontFile = java.io.File(fontPath)
      if (fontFile.exists()) {
        log.debug("Using font for subtitles: $fontPath")
        initOptions.add("--freetype-font=$fontPath")
        break
      }
    }

    val uri = source["uri"] as? String

    // Handle video load start event
    // onVideoLoadStart?.invoke(mapOf("target" to reactTag ?: "null"))

    libVLC = LibVLC(context, initOptions)
    mediaPlayer = MediaPlayer(libVLC)
    val initiallyAttached = mediaPlayer?.vlcVout?.areViewsAttached()
    if (initiallyAttached == false) {
      mediaPlayer?.attachViews(videoLayout, null, false, false)
    }
    mediaPlayer?.setEventListener(this)

    log.debug("Loading network file: $uri")
    media = Media(libVLC, Uri.parse(uri))
    mediaPlayer?.media = media

    log.debug("Debug: Media options: $mediaOptions")
    // media.addOptions(mediaOptions)

    // Set initial external subtitles immediately like iOS
    setInitialExternalSubtitles()

    hasSource = true

    if (autoplay) {
      log.debug("Playing...")
      play()
    }
  }

  fun startPictureInPicture() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      currentActivity.enterPictureInPictureMode(getPipParams()!!)
    }
  }

  fun play() {
    mediaPlayer?.play()
    isPaused = false
    handler.post(updateStatsRunnable) // Start updating stats
  }

  fun pause() {
    mediaPlayer?.pause()
    isPaused = true
    handler.removeCallbacks(updateStatsRunnable) // Stop updating stats
  }

  fun stop() {
    mediaPlayer?.stop()
    handler.removeCallbacks(updateStatsRunnable) // Stop updating stats
  }

  fun seekTo(time: Int) {
    mediaPlayer?.let { player ->
      val wasPlaying = player.isPlaying
      if (wasPlaying) {
        player.pause()
      }

      val duration = player.length.toInt()
      val seekTime = if (time > duration) duration - 1000 else time
      player.time = seekTime.toLong()

      if (wasPlaying) {
        player.play()
      }
    }
  }

  fun setAudioTrack(trackIndex: Int) {
    mediaPlayer?.setAudioTrack(trackIndex)
  }

  fun getAudioTracks(): List<Map<String, Any>>? {
    log.debug("getAudioTracks ${mediaPlayer?.audioTracks}")
    val trackDescriptions = mediaPlayer?.audioTracks ?: return null

    return trackDescriptions.map { trackDescription ->
      mapOf("name" to trackDescription.name, "index" to trackDescription.id)
    }
  }

  fun setSubtitleTrack(trackIndex: Int) {
    mediaPlayer?.setSpuTrack(trackIndex)
  }

  // fun getSubtitleTracks(): List<Map<String, Any>>? {
  //     return mediaPlayer?.getSpuTracks()?.map { trackDescription ->
  //         mapOf("name" to trackDescription.name, "index" to trackDescription.id)
  //     }
  // }

  fun getSubtitleTracks(): List<Map<String, Any>>? {
    val subtitleTracks = mediaPlayer?.spuTracks?.map { trackDescription ->
      mapOf("name" to trackDescription.name, "index" to trackDescription.id)
    }

    // Debug statement to print the result
    log.debug("Subtitle Tracks: $subtitleTracks")

    return subtitleTracks
  }

  fun setSubtitleURL(subtitleURL: String, name: String) {
    log.debug("Setting subtitle URL: $subtitleURL, name: $name")
    mediaPlayer?.addSlave(IMedia.Slave.Type.Subtitle, Uri.parse(subtitleURL), true)
  }

  fun setVideoAspectRatio(aspectRatio: String?) {
    log.debug("Setting video aspect ratio: $aspectRatio")
    mediaPlayer?.aspectRatio = aspectRatio
  }

  fun setVideoScaleFactor(scaleFactor: Float) {
    log.debug("Setting video scale factor: $scaleFactor")
    mediaPlayer?.scale = scaleFactor
  }

  fun setRate(rate: Float) {
    log.debug("Setting playback rate: $rate")
    mediaPlayer?.rate = rate
  }

  private var lastMediaStats: Map<String, Any>? = null

  private fun updateMediaStats() {
    val m = media ?: return
    val stats = m.getStats() ?: return

    val currentStats: Map<String, Any> = mapOf(
      "readBytes" to stats.readBytes.toLong(),
      "inputBitrate" to stats.inputBitrate.toFloat(),
      "demuxReadBytes" to stats.demuxReadBytes.toLong(),
      "demuxBitrate" to stats.demuxBitrate.toFloat(),
      "demuxCorrupted" to stats.demuxCorrupted.toLong(),
      "demuxDiscontinuity" to stats.demuxDiscontinuity.toLong(),
      "decodedVideo" to stats.decodedVideo.toLong(),
      "decodedAudio" to stats.decodedAudio.toLong(),
      "displayedPictures" to stats.displayedPictures.toLong(),
      "lostPictures" to stats.lostPictures.toLong(),
      "playedAudioBuffers" to stats.playedAbuffers.toLong(),
      "lostAudioBuffers" to stats.lostAbuffers.toLong(),
      "sentPackets" to stats.sentPackets.toLong(),
      "sentBytes" to stats.sentBytes.toLong(),
      "sendBitrate" to stats.sendBitrate.toFloat()
    )

    val unchanged = lastMediaStats?.let { it == currentStats } ?: false
    if (unchanged) return

    lastMediaStats = currentStats

    onMediaStatsChange(
      mapOf(
        "target" to "null",
        "stats" to currentStats
      )
    )
  }

  private fun setInitialExternalSubtitles() {
    externalSubtitles?.let { subtitles ->
      for (subtitle in subtitles) {
        val subtitleName = subtitle["name"]
        val subtitleURL = subtitle["DeliveryUrl"]
        if (!subtitleName.isNullOrEmpty() && !subtitleURL.isNullOrEmpty()) {
          log.debug("Setting external subtitle: $subtitleName $subtitleURL")
          setSubtitleURL(subtitleURL, subtitleName)
        }
      }
    }
  }

  override fun onDetachedFromWindow() {
    log.debug("onDetachedFromWindow")
    super.onDetachedFromWindow()

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      currentActivity.setPictureInPictureParams(
        PictureInPictureParams.Builder()
          .setAutoEnterEnabled(false)
          .build()
      )
    }

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      currentActivity.unregisterReceiver(actionReceiver)
    }
    currentActivity.removeOnPictureInPictureModeChangedListener(pipChangeListener)

    mediaPlayer?.stop()
    handler.removeCallbacks(updateStatsRunnable) // Stop updating stats

    media?.release()
    mediaPlayer?.release()
    libVLC?.release()
    mediaPlayer = null
    media = null
    libVLC = null
  }

  override fun onEvent(event: MediaPlayer.Event) {
    keepScreenOn = event.type == MediaPlayer.Event.Playing || event.type == MediaPlayer.Event.Buffering
    when (event.type) {
      MediaPlayer.Event.Playing,
      MediaPlayer.Event.Paused,
      MediaPlayer.Event.Stopped,
      MediaPlayer.Event.Buffering,
      MediaPlayer.Event.EndReached,
      MediaPlayer.Event.EncounteredError -> updatePlayerState(event)

      MediaPlayer.Event.TimeChanged -> {
        updateVideoProgress() // Update progress immediately when time changes
      }
    }
  }

  private fun updatePlayerState(event: MediaPlayer.Event) {
    val player = mediaPlayer ?: return
    val currentState = event.type

    val stateInfo = mutableMapOf<String, Any>(
      "target" to "null", // Replace with actual target if needed
      "currentTime" to player.time.toInt(),
      "duration" to (player.media?.duration?.toInt() ?: 0),
      "error" to false,
      "isPlaying" to (currentState == MediaPlayer.Event.Playing),
      "isBuffering" to (!player.isPlaying && currentState == MediaPlayer.Event.Buffering)
    )

    // Todo: make enum - string to prevent this when statement from becoming exhaustive
    when (currentState) {
      MediaPlayer.Event.Playing ->
        stateInfo["state"] = "Playing"

      MediaPlayer.Event.Paused ->
        stateInfo["state"] = "Paused"

      MediaPlayer.Event.Buffering ->
        stateInfo["state"] = "Buffering"

      MediaPlayer.Event.EncounteredError -> {
        stateInfo["state"] = "Error"
        onVideoLoadEnd(stateInfo);
      }

      MediaPlayer.Event.Opening ->
        stateInfo["state"] = "Opening"
    }

    if (lastReportedState != currentState || lastReportedIsPlaying != player.isPlaying) {
      lastReportedState = currentState
      lastReportedIsPlaying = player.isPlaying
      onVideoStateChange(stateInfo)
    }
  }


  private fun updateVideoProgress() {
    val player = mediaPlayer ?: return

    val currentTimeMs = player.time.toInt()
    val durationMs = player.media?.duration?.toInt() ?: 0
    if (currentTimeMs >= 0 && currentTimeMs < durationMs) {
      // Set subtitle URL if available
      if (player.isPlaying && !isMediaReady) {
        isMediaReady = true
        externalTrack?.let {
          val name = it["name"]
          val deliveryUrl = it["DeliveryUrl"] ?: ""
          if (!name.isNullOrEmpty() && !deliveryUrl.isNullOrEmpty()) {
            setSubtitleURL(deliveryUrl, name)
          }
        }
      }
      onVideoProgress(
        mapOf(
          "currentTime" to currentTimeMs,
          "duration" to durationMs
        )
      );
    }
  }

  // Expo New Architecture: rely on view lifecycle instead of ReactActivityLifecycleListener
}

internal fun Context.findActivity(): androidx.activity.ComponentActivity {
  var context = this
  while (context is ContextWrapper) {
    if (context is androidx.activity.ComponentActivity) return context
    context = context.baseContext
  }
  throw IllegalStateException("Failed to find ComponentActivity")
}
