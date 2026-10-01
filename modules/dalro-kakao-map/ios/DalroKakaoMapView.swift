import ExpoModulesCore
import KakaoMapsSDK
import UIKit

private struct Coordinate: Decodable {
  let latitude: Double
  let longitude: Double
  var point: MapPoint { MapPoint(longitude: longitude, latitude: latitude) }
}
private struct CourseLine: Decodable {
  let id: String
  let selected: Bool
  let points: [Coordinate]
}
private struct Camera: Decodable {
  let latitude: Double
  let longitude: Double
  let zoomLevel: Int
}

// Each React screen owns a controller. Pause hidden/background screens, and release on unmount.
class DalroKakaoMapView: ExpoView, MapControllerDelegate {
  let onReady = EventDispatcher()
  let onError = EventDispatcher()
  private let container = KMViewContainer(frame: .zero)
  private var controller: KMController?
  private var map: KakaoMap? { controller?.getView("dalro-map") as? KakaoMap }
  private var appKey = ""
  private var active = false
  private var authenticated = false
  private var preparing = false
  private var failed = false
  private var routes: [CourseLine] = []
  private var camera: Camera?
  private var runner: Coordinate?
  private static var initializedKey: String?

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    clipsToBounds = true
    addSubview(container)
    NotificationCenter.default.addObserver(self, selector: #selector(pause), name: UIApplication.willResignActiveNotification, object: nil)
    NotificationCenter.default.addObserver(self, selector: #selector(resume), name: UIApplication.didBecomeActiveNotification, object: nil)
  }

  deinit {
    NotificationCenter.default.removeObserver(self)
    controller?.pauseEngine()
    controller?.resetEngine()
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    container.frame = bounds
    map?.viewRect = container.bounds
    startIfPossible()
  }

  override func didMoveToWindow() {
    super.didMoveToWindow()
    if window == nil { pause() } else { startIfPossible() }
  }

  func setAppKey(_ value: String) { appKey = value; startIfPossible() }
  func setActive(_ value: Bool) {
    active = value
    if value { startIfPossible() } else { pause() }
  }
  func setRoutes(_ json: String) {
    guard let data = json.data(using: .utf8), let value = try? JSONDecoder().decode([CourseLine].self, from: data) else { return }
    routes = value
    drawRoutes()
  }
  func setCamera(_ json: String) {
    guard let data = json.data(using: .utf8), let value = try? JSONDecoder().decode(Camera.self, from: data) else { return }
    camera = value
    moveCamera()
  }
  func setRunner(_ json: String) {
    runner = json.data(using: .utf8).flatMap { try? JSONDecoder().decode(Coordinate.self, from: $0) }
    drawRunner()
  }

  @objc private func pause() { controller?.pauseEngine() }
  @objc private func resume() { startIfPossible() }

  private func startIfPossible() {
    guard !failed, active, window != nil, bounds.width > 0, bounds.height > 0,
          UIApplication.shared.applicationState == .active, !appKey.isEmpty else { return }
    if controller == nil {
      if Self.initializedKey != appKey {
        SDKInitializer.InitSDK(appKey: appKey)
        Self.initializedKey = appKey
      }
      controller = KMController(viewContainer: container)
      controller?.delegate = self
    }
    if authenticated { controller?.activateEngine() }
    else if !preparing { preparing = true; _ = controller?.prepareEngine() }
  }

  func authenticationSucceeded() {
    authenticated = true
    preparing = false
    startIfPossible()
  }
  func authenticationFailed(_ errorCode: Int, desc: String) {
    failed = true
    preparing = false
    authenticated = false
    onError(["code": String(errorCode), "message": "카카오 지도 인증에 실패했어요. Native 키와 iOS 번들 ID 등록, 지도 사용 설정을 확인해 주세요."])
  }
  func addViews() {
    let position = camera.map { MapPoint(longitude: $0.longitude, latitude: $0.latitude) }
      ?? MapPoint(longitude: 126.9745, latitude: 37.5178)
    controller?.addView(MapviewInfo(viewName: "dalro-map", viewInfoName: "map", defaultPosition: position, defaultLevel: camera?.zoomLevel ?? 15))
  }
  func addViewSucceeded(_ viewName: String, viewInfoName: String) {
    guard let map = map else { return }
    map.viewRect = container.bounds
    let manager = map.getRouteManager()
    for selected in [false, true] {
      let style = RouteStyle()
      style.addPerLevelStyle(PerLevelRouteStyle(width: selected ? 8 : 5,
        color: selected ? UIColor(red: 0.67, green: 1, blue: 0.36, alpha: 1) : UIColor(red: 0.34, green: 0.49, blue: 0.34, alpha: 1),
        strokeWidth: 2, strokeColor: .black, level: 0))
      let set = RouteStyleSet(styleID: selected ? "selected" : "candidate")
      set.addStyle(style)
      manager.addRouteStyleSet(set)
    }
    let labels = map.getLabelManager()
    for (id, text, color) in [("start", "출발·도착", UIColor(red: 0.67, green: 1, blue: 0.36, alpha: 1)), ("runner", "달로", UIColor.white)] {
      let icon = PoiIconStyle(symbol: marker(text, color: color))
      labels.addPoiStyle(PoiStyle(styleID: id, styles: [PerLevelPoiStyle(iconStyle: icon)]))
    }
    _ = labels.addLabelLayer(option: LabelLayerOptions(layerID: "markers", competitionType: .none, competitionUnit: .symbolFirst, orderType: .rank, zOrder: 100))
    drawRoutes()
    moveCamera()
    drawRunner()
    onReady([:])
  }
  func addViewFailed(_ viewName: String, viewInfoName: String) {
    failed = true
    onError(["code": "view", "message": "카카오 지도를 생성하지 못했어요. 다시 시도해 주세요."])
  }
  func containerDidResized(_ size: CGSize) { map?.viewRect = CGRect(origin: .zero, size: size) }
  func viewWillDestroyed(_ view: ViewBase) {}

  private func drawRoutes() {
    guard let map = map else { return }
    let manager = map.getRouteManager()
    manager.removeRouteLayer(layerID: "courses")
    guard let layer = manager.addRouteLayer(layerID: "courses", zOrder: 0) else { return }
    for route in routes where route.points.count >= 2 {
      let segment = RouteSegment(points: route.points.map { $0.point }, styleIndex: 0)
      let option = RouteOptions(routeID: route.id, styleID: route.selected ? "selected" : "candidate", zOrder: route.selected ? 1 : 0)
      option.segments = [segment]
      layer.addRoute(option: option)?.show()
    }
    if let labels = map.getLabelManager().getLabelLayer(layerID: "markers") {
      labels.removePoi(poiID: "start")
      if let point = routes.first(where: { $0.selected })?.points.first {
        labels.addPoi(option: PoiOptions(styleID: "start", poiID: "start"), at: point.point)?.show()
      }
    }
  }
  private func drawRunner() {
    guard let layer = map?.getLabelManager().getLabelLayer(layerID: "markers") else { return }
    if let runner = runner {
      if let poi = layer.getPoi(poiID: "runner") { poi.moveAt(runner.point, duration: 0) }
      else { layer.addPoi(option: PoiOptions(styleID: "runner", poiID: "runner"), at: runner.point)?.show() }
    } else { layer.removePoi(poiID: "runner") }
  }
  private func moveCamera() {
    guard let map = map, let camera = camera else { return }
    map.moveCamera(CameraUpdate.make(target: MapPoint(longitude: camera.longitude, latitude: camera.latitude), zoomLevel: camera.zoomLevel, mapView: map))
  }
  private func marker(_ text: String, color: UIColor) -> UIImage {
    let size = CGSize(width: text == "달로" ? 48 : 88, height: 30)
    return UIGraphicsImageRenderer(size: size).image { _ in
      color.setFill()
      UIBezierPath(roundedRect: CGRect(origin: .zero, size: size), cornerRadius: 15).fill()
      let attrs: [NSAttributedString.Key: Any] = [.font: UIFont.boldSystemFont(ofSize: 12), .foregroundColor: UIColor.black]
      let measured = (text as NSString).size(withAttributes: attrs)
      (text as NSString).draw(at: CGPoint(x: (size.width - measured.width) / 2, y: (size.height - measured.height) / 2), withAttributes: attrs)
    }
  }
}
