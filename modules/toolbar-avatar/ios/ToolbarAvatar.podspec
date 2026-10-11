Pod::Spec.new do |s|
  s.name           = 'ToolbarAvatar'
  s.version        = '1.0.0'
  s.summary        = 'Circular UIKit images for native navigation bar avatars'
  s.description    = 'Clips account images into transparent circles for UIBarButtonItem menus.'
  s.author         = ''
  s.homepage       = 'https://github.com/lonzzi/nekofin'
  s.platforms      = { :ios => '16.4' }
  s.source         = { git: '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES' }
  s.source_files = '**/*.{h,m,mm,swift,hpp,cpp}'
end
