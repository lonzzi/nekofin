require 'xcodeproj'
require 'fileutils'

output = ARGV.fetch(0)
root = File.expand_path('../..', __dir__)
project = Xcodeproj::Project.new(File.join(output, 'ScrubberTests.xcodeproj'))
app = project.new_target(:application, 'ScrubberTestApp', :ios, '16.4')
ui = project.new_target(:ui_test_bundle, 'ScrubberUITests', :ios, '16.4')
app.add_file_references([
  project.main_group.new_file(File.join(root, 'ios/MediaScrubberSlider.swift')),
  project.main_group.new_file(File.join(__dir__, 'ScrubberTestApp.swift'))
])
ui.add_file_references([project.main_group.new_file(File.join(__dir__, 'ScrubberGestureUITests.swift'))])
ui.add_file_references([project.main_group.new_file(ARGV[1])]) if ARGV[1]
ui.add_dependency(app)
[app, ui].each do |target|
  target.build_configurations.each do |config|
    config.build_settings['PRODUCT_BUNDLE_IDENTIFIER'] = "com.lonzzi.scrubbertests.#{target.name.downcase}"
    config.build_settings['SWIFT_VERSION'] = '5.0'
    config.build_settings['GENERATE_INFOPLIST_FILE'] = 'YES'
    config.build_settings['CODE_SIGNING_ALLOWED'] = 'NO'
    config.build_settings['TARGETED_DEVICE_FAMILY'] = '1,2'
  end
end
app.build_configurations.each do |config|
  config.build_settings['INFOPLIST_KEY_UIApplicationSceneManifest_Generation'] = 'YES'
  config.build_settings['INFOPLIST_KEY_UILaunchScreen_Generation'] = 'YES'
end
ui.build_configurations.each { |config| config.build_settings['TEST_TARGET_NAME'] = app.name }
project.save
scheme = Xcodeproj::XCScheme.new
scheme.add_build_target(app)
scheme.add_test_target(ui)
scheme.set_launch_target(app)
scheme.save_as(project.path, 'ScrubberTestApp', true)
