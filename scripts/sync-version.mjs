// Runs before `vite build --mode app`: the iOS project takes its version
// from package.json, as Android's build.gradle and the app's own "Version"
// line do. The build number (CURRENT_PROJECT_VERSION) is the build's own.
import { readFileSync, writeFileSync } from 'node:fs'

const { version } = JSON.parse(readFileSync('package.json', 'utf8'))
const file = 'ios/App/App.xcodeproj/project.pbxproj'
const before = readFileSync(file, 'utf8')
const after = before.replace(/MARKETING_VERSION = [^;]+;/g, `MARKETING_VERSION = ${version};`)
if (after !== before) {
  writeFileSync(file, after)
  console.log(`iOS version set to ${version}`)
}
