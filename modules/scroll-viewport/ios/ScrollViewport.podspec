Pod::Spec.new do |s|
  s.name = 'ScrollViewport'
  s.version = '1.0.0'
  s.summary = 'Size empty content to the native scroll viewport'
  s.description = 'Uses adjusted scroll insets to lay out empty states before drawing.'
  s.author = ''
  s.homepage = 'https://github.com/lonzzi/nekofin'
  s.platforms = { :ios => '16.4' }
  s.source = { git: '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.dependency 'React-Core'
  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES' }
  s.source_files = '**/*.{h,m,mm,swift}'
end
