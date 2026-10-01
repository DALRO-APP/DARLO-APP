package com.dalro.kakaomap

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class DalroKakaoMapModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("DalroKakaoMap")
    View(DalroKakaoMapView::class) {
      Events("onReady", "onError")
      Prop("appKey") { view: DalroKakaoMapView, value: String -> view.setAppKey(value) }
      Prop("routesJson") { view: DalroKakaoMapView, value: String -> view.setRoutes(value) }
      Prop("cameraJson") { view: DalroKakaoMapView, value: String -> view.setCamera(value) }
      Prop("runnerJson") { view: DalroKakaoMapView, value: String -> view.setRunner(value) }
      Prop("active") { view: DalroKakaoMapView, value: Boolean -> view.setActive(value) }
    }
    OnActivityEntersForeground { DalroKakaoMapView.foreground(true) }
    OnActivityEntersBackground { DalroKakaoMapView.foreground(false) }
    OnDestroy { DalroKakaoMapView.destroyAll() }
  }
}
