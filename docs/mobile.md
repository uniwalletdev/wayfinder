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
  Android phone (allow *Install unknown apps*), plus
  `wayfinder-android-release.aab` for the Play Store once Android signing is
  configured.
- `wayfinder-ios-simulator` — `Wayfinder-simulator.app.zip`, which runs in the
  iOS Simulator.
- `wayfinder-ios` — `wayfinder-ios-release.ipa` for TestFlight and the App
  Store, once Apple signing is configured.

A store build's build number (Android `versionCode`, iOS `CFBundleVersion`) is
the workflow run number, so every run can be uploaded without editing a
project. The version people see (`1.0`) is set by hand in
`android/app/build.gradle` and in Xcode. A store build is refused while
`WAYFINDER_URL` is empty, because the app would open the placeholder page.

### Getting to TestFlight and Play internal testing

1. **Set the site URL.** *Settings → Secrets and variables → Actions →
   Variables*: `WAYFINDER_URL` = the production site, no trailing slash.
2. **Apple.** In [App Store Connect](https://appstoreconnect.apple.com):
   - *Apps → +*: create the app with bundle ID `app.wayfinder.nav`. If the
     identifier is not offered, register it first at *Certificates,
     Identifiers & Profiles → Identifiers* on developer.apple.com.
   - *Users and Access → Integrations → App Store Connect API → Team Keys →
     +*: role **Admin**. Download the `.p8` (offered once) and note the
     **Key ID** next to it and the **Issuer ID** above the list.
   - Team ID: *Membership details* at developer.apple.com/account.
   - Add the four `APPLE_*` / `APP_STORE_CONNECT_*` secrets from the table.
     Nothing else is needed: the workflow uses Xcode cloud signing, so no
     certificate or provisioning profile is ever created or exported.
3. **Android.** Create the upload key once (command below) and add the four
   `ANDROID_*` secrets. Run the workflow, download
   `wayfinder-android-release.aab` from the run and upload it by hand to a new
   app in the [Play Console](https://play.google.com/console) (*Testing →
   Internal testing → Create release*). The console needs that first upload to
   learn the app; from then on the workflow can upload (step 5).
4. **Run it.** *Actions → Mobile apps → Run workflow*, tick **upload**. The
   iOS build appears in TestFlight under the app a few minutes after
   processing; add testers there. Android goes to the internal testing track
   once step 5 is done; until then take the `.aab` from the run's artifacts.
5. **Optional: let CI upload to Play.** Create a Google Cloud service account
   with a JSON key, invite its email in *Play Console → Users and permissions*
   with *Release apps to testing tracks* on the app, and store the JSON in
   `PLAY_SERVICE_ACCOUNT_JSON`.

| Name | Kind | Value |
| --- | --- | --- |
| `WAYFINDER_URL` | Variable | The production site URL |
| `ANDROID_KEYSTORE_BASE64` | Secret | `base64 -w0 release.jks` |
| `ANDROID_KEYSTORE_PASSWORD` | Secret | Keystore password |
| `ANDROID_KEY_ALIAS` | Secret | Key alias |
| `ANDROID_KEY_PASSWORD` | Secret | Key password |
| `APPLE_TEAM_ID` | Secret | 10-character Team ID |
| `APP_STORE_CONNECT_KEY_ID` | Secret | Key ID of the API key |
| `APP_STORE_CONNECT_ISSUER_ID` | Secret | Issuer ID shown with the API keys |
| `APP_STORE_CONNECT_KEY_P8` | Secret | Full contents of the downloaded `.p8` file |
| `PLAY_SERVICE_ACCOUNT_JSON` | Secret | Optional: service-account JSON key for Play uploads |

Create the Android upload key once and keep it safe — losing it means you can't
update the app:

```bash
keytool -genkey -v -keystore release.jks -keyalg RSA -keysize 2048 -validity 10000 -alias wayfinder
```

Before releasing to testers, both consoles also ask for a privacy policy URL
(the site's `/privacy` page) and a data-collection declaration (Play's *Data
safety* form, App Store *App Privacy*). Location and camera are used on the
device; what the app sends to the server is set out in
[`location-data-and-gdpr.md`](location-data-and-gdpr.md).

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
