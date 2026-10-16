Pod::Spec.new do |s|
  s.name = 'NativeLayout'
  s.version = '1.0.0'
  s.summary = 'SwiftUI navigation modifiers for the native iPad layout'
  s.description = 'Coordinates SwiftUI split navigation with embedded UIKit navigation stacks.'
  s.author = ''
  s.homepage = 'https://github.com/lonzzi/nekofin'
  s.platforms = { :ios => '16.4' }
  s.source = { git: '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.dependency 'ExpoUI'
  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES' }
  s.source_files = '**/*.{h,m,mm,swift,hpp,cpp}'
end
