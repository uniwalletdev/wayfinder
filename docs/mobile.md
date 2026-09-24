# Android and iOS apps

Wayfinder ships to phones three ways, all from this one codebase:

| | How people get it | What you need |
| --- | --- | --- |
| **PWA** | Open the site, *Add to Home Screen* | Nothing — works today |
| **Android** | Play Store, or sideload the APK | Play Console account ($25 once) for the store |
| **iOS** | App Store / TestFlight | Apple Developer Program ($99/yr) and a Mac or CI |

## How the native apps work

`android/` and `ios/` are [Capacitor](https://capacitorjs.com) projects. Wayfinder
is a server-rendered Next.js app — directions, geocoding, the Claude survey,
sign-in and the database all live on the server — so it can't be bundled as
static files. The native shell opens the **deployed site** in a full-screen
WebView and adds a real app icon, splash screen, store distribution and native
permission prompts (location, camera, motion).

Consequences worth knowing:

- **Ship the web app first.** A fix deployed to the site reaches every installed
  app immediately — no store review. A change to `android/`, `ios/`,
  `capacitor.config.ts` or permissions needs a new store build.
- **The first open needs a signal.** With no connection the app shows
  `mobile/www/offline.html`. After that the service worker (`public/sw.js`)
  serves what it has cached, as it does for the PWA.
- **Apple guideline 4.2** rejects apps that are "just a website". Wayfinder
  uses native location, camera and motion permissions and works as a
  navigation tool, which is the usual answer — but expect the reviewer to ask,
  and have the step-free routing and AR view ready to demo.

## Building

Set the site the app should load, then sync it into the native projects:

```bash
export WAYFINDER_URL=https://your-deployment.example   # no trailing slash
npm run mobile:sync
```

### Android

Needs JDK 21 and the Android SDK (Android Studio installs both).

```bash
npm run android:build        # -> android/app/build/outputs/apk/debug/app-debug.apk
npm run android:open         # or open in Android Studio and press Run
```

### iOS

Needs a Mac with Xcode 16+.

```bash
npm run ios:open             # opens Xcode; pick a simulator or your phone, press Run
```

For a device or TestFlight build, in Xcode: *App* target → *Signing &
Capabilities* → choose your team, then *Product → Archive*.

## CI builds

`.github/workflows/mobile.yml` builds both apps on every change to the native
projects, and on demand from the Actions tab (*Mobile apps → Run workflow*).
Each run uploads:

- `wayfinder-android` — `wayfinder-android-debug.apk`, installable on any
  Android phone (allow *Install unknown apps*), plus a signed `.aab` for the
  Play Store when signing secrets are set.
- `wayfinder-ios-simulator` — `Wayfinder-simulator.app.zip`, which runs in the
  iOS Simulator. Device builds need Apple signing (below).

Configure once in *Settings → Secrets and variables → Actions*:

| Name | Kind | Value |
| --- | --- | --- |
| `WAYFINDER_URL` | Variable | The production site URL |
| `ANDROID_KEYSTORE_BASE64` | Secret | `base64 -w0 release.jks` |
| `ANDROID_KEYSTORE_PASSWORD` | Secret | Keystore password |
| `ANDROID_KEY_ALIAS` | Secret | Key alias |
| `ANDROID_KEY_PASSWORD` | Secret | Key password |

Create the Android upload key once and keep it safe — losing it means you can't
update the app:

```bash
keytool -genkey -v -keystore release.jks -keyalg RSA -keysize 2048 -validity 10000 -alias wayfinder
```

iOS signing in CI needs an App Store Connect API key and a distribution
certificate; the simplest path is [fastlane match](https://docs.fastlane.tools/actions/match/).
Until that's set up, archive from Xcode on a Mac.

## Icons and splash

`mobile/assets/icon.svg` is the master. After changing it:

```bash
npm run mobile:icons
```

That rewrites the PWA icons in `public/`, every Android launcher density
(including the adaptive icon), the iOS app icon, and both platforms' splash
screens.

## App identity

- Bundle / application id: `app.wayfinder.nav` (`capacitor.config.ts`). Change
  it **before** the first store upload; it can't change afterwards.
- Display name: *Wayfinder*.
- Orientation: portrait on phones.
