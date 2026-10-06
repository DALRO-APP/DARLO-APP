package com.dalro.kakaomap

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.RectF
import com.kakao.vectormap.*
import com.kakao.vectormap.camera.CameraUpdateFactory
import com.kakao.vectormap.label.*
import com.kakao.vectormap.route.*
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.viewevent.EventDispatcher
import expo.modules.kotlin.views.ExpoView
import org.json.JSONArray
import org.json.JSONObject
import java.util.Collections
import java.util.WeakHashMap

class DalroKakaoMapView(context: Context, appContext: AppContext) : ExpoView(context, appContext) {
  override val shouldUseAndroidLayout = true
  private val onReady by EventDispatcher<Map<String, String>>()
  private val onError by EventDispatcher<Map<String, String>>()
  private var mapView: MapView? = null
  private var map: KakaoMap? = null
  private var appKey = ""
  private var active = false
  private var routes = JSONArray()
  private var camera: JSONObject? = null
  private var runner: JSONObject? = null
  private var startStyles: LabelStyles? = null
  private var endStyles: LabelStyles? = null
  private var runnerStyles: LabelStyles? = null
  private var start: Label? = null
  private var end: Label? = null
  private var running: Label? = null
  private var failed = false

  companion object {
    private val views = Collections.newSetFromMap(WeakHashMap<DalroKakaoMapView, Boolean>())
    private var foreground = true
    private var initializedKey: String? = null
    fun foreground(value: Boolean) { foreground = value; views.toList().forEach { if (value) it.resume() else it.mapView?.pause() } }
    fun destroyAll() { views.toList().forEach { it.destroy() }; views.clear() }
  }

  fun setAppKey(value: String) { appKey = value; resume() }
  fun setActive(value: Boolean) { active = value; if (value) resume() else mapView?.pause() }
  fun setRoutes(value: String) { routes = JSONArray(value); drawRoutes() }
  fun setCamera(value: String) { camera = JSONObject(value); moveCamera() }
  fun setRunner(value: String) { runner = if (value == "null") null else JSONObject(value); drawRunner() }
  override fun onAttachedToWindow() { super.onAttachedToWindow(); views.add(this); resume() }
  override fun onDetachedFromWindow() { destroy(); views.remove(this); super.onDetachedFromWindow() }

  private fun resume() {
    if (failed || !active || !foreground || !isAttachedToWindow || appKey.isEmpty()) return
    if (mapView != null) { mapView?.resume(); return }
    if (initializedKey != appKey) { KakaoMapSdk.init(context.applicationContext, appKey); initializedKey = appKey }
    val view = MapView(context)
    view.setFinishManually(true)
    view.layoutParams = LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT)
    mapView = view
    addView(view)
    view.start(object : MapLifeCycleCallback() {
      override fun onMapDestroy() {}
      override fun onMapError(error: Exception) {
        if (mapView !== view) return
        failed = true
        onError(mapOf("code" to "sdk", "message" to "카카오 지도 인증/연결에 실패했어요. Native 키, 패키지명, 서명 키 해시와 네트워크를 확인해 주세요."))
      }
    }, object : KakaoMapReadyCallback() {
      override fun getPosition(): LatLng = camera?.let { position(it) } ?: LatLng.from(37.5178, 126.9745)
      override fun getZoomLevel(): Int = camera?.optInt("zoomLevel", 15) ?: 15
      override fun onMapReady(kakaoMap: KakaoMap) {
        if (mapView !== view) return
        map = kakaoMap
        val labels = kakaoMap.labelManager
        startStyles = labels.addLabelStyles(LabelStyles.from("start", LabelStyle.from(marker("출발", Color.rgb(171, 255, 92)))))
        endStyles = labels.addLabelStyles(LabelStyles.from("end", LabelStyle.from(marker("도착", Color.rgb(198, 182, 255)))))
        runnerStyles = labels.addLabelStyles(LabelStyles.from("runner", LabelStyle.from(marker("달로", Color.WHITE))))
        drawRoutes(); moveCamera(); drawRunner()
        if (!active || !foreground) view.pause() else view.resume()
        onReady(emptyMap())
      }
    })
  }

  private fun destroy() {
    val view = mapView
    mapView = null
    map = null
    start = null
    end = null
    running = null
    startStyles = null
    endStyles = null
    runnerStyles = null
    failed = false
    view?.pause()
    view?.finish()
    if (view != null) removeView(view)
  }

  private fun drawRoutes() {
    val map = map ?: return
    val layer = map.routeLineManager.layer
    layer.removeAll()
    val labels = map.labelManager.layer
    start?.let { labels.remove(it) }; start = null
    end?.let { labels.remove(it) }; end = null
    for (i in 0 until routes.length()) {
      val route = routes.getJSONObject(i)
      val coordinates = route.getJSONArray("points")
      if (coordinates.length() < 2) continue
      val points = (0 until coordinates.length()).map { position(coordinates.getJSONObject(it)) }
      val selected = route.getBoolean("selected")
      val styles = RouteLineStyles.from(RouteLineStyle.from(if (selected) 8f else 5f, if (selected) Color.rgb(171, 255, 92) else Color.rgb(87, 125, 87), 2f, Color.BLACK))
      val segment = RouteLineSegment.from(points).setStyles(styles)
      layer.addRouteLine(RouteLineOptions.from(segment).setStylesSet(RouteLineStylesSet.from(styles)).setZOrder(if (selected) 1 else 0))
      if (selected && endStyles != null) route.optJSONObject("end")?.let { point ->
        end = labels.addLabel(LabelOptions.from("end", position(point)).setStyles(endStyles).setRank(100))
      }
      if (selected && startStyles != null) start = labels.addLabel(LabelOptions.from("start", points.first()).setStyles(startStyles).setRank(100))
    }
  }
  private fun drawRunner() {
    val labels = map?.labelManager?.layer ?: return
    val point = runner
    if (point == null) { running?.let { labels.remove(it) }; running = null; return }
    val existing = running
    if (existing != null) existing.moveTo(position(point))
    else if (runnerStyles != null) running = labels.addLabel(LabelOptions.from("runner", position(point)).setStyles(runnerStyles).setRank(101))
  }
  private fun moveCamera() {
    val camera = camera ?: return
    map?.moveCamera(CameraUpdateFactory.newCenterPosition(position(camera), camera.getInt("zoomLevel")))
  }
  private fun position(point: JSONObject): LatLng = LatLng.from(point.getDouble("latitude"), point.getDouble("longitude"))
  private fun marker(text: String, color: Int): Bitmap {
    val scale = resources.displayMetrics.density
    val width = ((if (text == "달로") 48 else 88) * scale).toInt()
    val height = (30 * scale).toInt()
    val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
    val canvas = Canvas(bitmap)
    val paint = Paint(Paint.ANTI_ALIAS_FLAG)
    paint.color = color
    canvas.drawRoundRect(RectF(0f, 0f, width.toFloat(), height.toFloat()), height / 2f, height / 2f, paint)
    paint.color = Color.BLACK; paint.textSize = 12 * scale; paint.isFakeBoldText = true; paint.textAlign = Paint.Align.CENTER
    canvas.drawText(text, width / 2f, height / 2f - (paint.descent() + paint.ascent()) / 2f, paint)
    return bitmap
  }
}
