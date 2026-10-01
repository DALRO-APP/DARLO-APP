import ExpoModulesCore

public class DalroKakaoMapModule: Module {
  public func definition() -> ModuleDefinition {
    Name("DalroKakaoMap")
    View(DalroKakaoMapView.self) {
      Events("onReady", "onError")
      Prop("appKey") { (view: DalroKakaoMapView, value: String) in view.setAppKey(value) }
      Prop("routesJson") { (view: DalroKakaoMapView, value: String) in view.setRoutes(value) }
      Prop("cameraJson") { (view: DalroKakaoMapView, value: String) in view.setCamera(value) }
      Prop("runnerJson") { (view: DalroKakaoMapView, value: String) in view.setRunner(value) }
      Prop("active") { (view: DalroKakaoMapView, value: Bool) in view.setActive(value) }
    }
  }
}
