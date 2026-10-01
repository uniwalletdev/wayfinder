// Build the debug APK on any OS: export the pages, sync them into the Android
// project, run Gradle. npm scripts run through cmd.exe on Windows, where
// "./gradlew" is not a command, so the Gradle step picks gradlew.bat there and
// ./gradlew elsewhere. Needs JDK 21 and the Android SDK (Android Studio
// installs both); CI builds the same APK without any of this installed.
//
//   npm run android:build   -> android/app/build/outputs/apk/debug/app-debug.apk
import { spawnSync } from "child_process"
import { createRequire } from "module"
import { fileURLToPath } from "url"

function run(cmd, args, options = {}) {
  const result = spawnSync(cmd, args, { stdio: "inherit", ...options })
  if (result.error) {
    console.error(result.error.message)
    process.exit(1)
  }
  if (result.status !== 0) process.exit(result.status ?? 1)
}

const require = createRequire(import.meta.url)
const windows = process.platform === "win32"

run(process.execPath, [fileURLToPath(new URL("./app-shell-build.mjs", import.meta.url))])
run(process.execPath, [require.resolve("@capacitor/cli/bin/capacitor"), "sync", "android"])
run(windows ? "gradlew.bat" : "./gradlew", ["assembleDebug"], { cwd: "android", shell: windows })

console.log("\nAPK: android/app/build/outputs/apk/debug/app-debug.apk")
