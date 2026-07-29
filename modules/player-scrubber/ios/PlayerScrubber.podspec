Pod::Spec.new do |s|
  s.name           = 'PlayerScrubber'
  s.version        = '1.0.0'
  s.summary        = 'Native media playback scrubber for nekofin'
  s.description    = 'A UISlider-backed media scrubber with the native iOS 26 interaction style.'
  s.author         = ''
  s.homepage       = 'https://github.com/lonzzi/nekofin'
  s.platforms      = {
    :ios => '16.4'
  }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = '**/*.{h,m,mm,swift,hpp,cpp}'
end
