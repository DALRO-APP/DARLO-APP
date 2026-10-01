Pod::Spec.new do |s|
  s.name           = 'DalroKakaoMap'
  s.version        = '1.0.0'
  s.summary        = 'DALRO native Kakao map view'
  s.description    = 'Kakao Maps SDK bridge for course lines and simulated runner markers'
  s.author         = 'DALRO'
  s.homepage       = 'https://docs.expo.dev/modules/'
  s.platforms      = {
    :ios => '16.4'
  }
  s.source         = { git: 'https://github.com/DALRO-APP/DARLO-APP.git' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.dependency 'KakaoMapsSDK', '2.12.0'

  # Swift/Objective-C compatibility
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
