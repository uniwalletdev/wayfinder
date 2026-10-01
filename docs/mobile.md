# Android and iOS apps

Findway ships to phones three ways, all from this one codebase:

| | How people get it | What you need |
| --- | --- | --- |
| **Web / PWA** | Open the site, *Add to Home Screen* | Nothing — works today |
| **Android** | Play Store, or sideload the APK | Play Console account for the store |
| **iOS** | App Store / TestFlight | Apple Developer Program; builds run in CI, no Mac needed |

## How the native apps work

`android/` and `ios/` are [Capacitor](https://capacitorjs.com) projects that
carry the interface **inside the app**. `npm run mobile:build`
(`scripts/app-shell-build.mjs`) makes a static export of the pages into `out/`,
and `cap sync` copies that export, every floor plan included, into both native
projects. Only `/api` is remote: directions, geocoding, the Claude survey,
shared venues and signals are called on the deployment named by
`FINDWAY_API_URL` when the app was built.

What that buys, compared with a shell that loads the website:

- **Opens straight onto the map, instantly.** Inside the apps the root page is
  the navigation screen; the marketing page is web-only (`src/app/page.tsx`).
- **Works on first launch with no signal** for every venue the build ships
  with. Hospital basements are where first launches happen.
- **System permission prompts** for location, camera and motion, with the
  reasons written in `ios/App/App/Info.plist` and
  `android/app/src/main/AndroidManifest.xml`.
- **Real haptics on iPhone.** Safari has no vibration API, so the turn cue used
  to vanish on iOS; in the apps it goes through the system haptics engine
  (`src/lib/use-guidance-announcer.ts`).
- **App Store review.** Apple's guideline 4.2 rejects apps that are a
  repackaged website. An app whose interface ships in the binary and uses
  native capabilities is on the right side of it. Still write reviewer notes
  naming a demo venue and destination: the reviewer is nowhere near a
  hospital, so anything GPS-led looks broken without them.

Consequences worth knowing:

- **A change under `src/` or `public/` reaches installed apps only through a
  new app build.** The website updates on deploy; the apps do not, so plan
  store releases for anything users must see on the phone.
- **Sign-in stays on the web for now.** Clerk's proxy cannot run inside a
  static export, so the apps are built without a Clerk key and run in the
  anonymous mode the app has always supported. Saved places and venue
  ownership are web features until Clerk's client SDK is wired into the apps.
- **Share links and poster QR codes** are written against the website
  (`publicOrigin()` in `src/lib/app-shell.ts`), never the app's own origin.
- **The API allows the apps' origins.** `src/proxy.ts` answers CORS preflights
  for `capacitor://localhost` and `https://localhost` on `/api`, without
  credentials. A deployment running an older version of `src/proxy.ts` will
  refuse the apps' calls.

## Building

You do not need to build locally to ship. CI (below) builds both apps on
GitHub's machines, including iOS, which cannot be built on Windows or Linux
at all. Build locally only to run the app on a phone or emulator from Android
Studio or Xcode.

Start from a current checkout: `git pull origin main`, or a fresh
`git clone https://github.com/uniwalletdev/wayfinder.git`. An older copy is
missing the scripts below. Then:

```bash
npm ci
npm run mobile:build     # -> out/
npm run mobile:sync      # mobile:build, then cap sync into android/ and ios/
```

The apps call `https://wayfinder-theta.vercel.app` unless `FINDWAY_API_URL`
names another deployment. Set it in the shell before the build:

| Shell | Command |
| --- | --- |
| Windows Command Prompt | `set FINDWAY_API_URL=https://your-deployment` |
| Windows PowerShell | `$env:FINDWAY_API_URL="https://your-deployment"` |
| macOS / Linux | `export FINDWAY_API_URL=https://your-deployment` |

`FINDWAY_SITE_URL` likewise sets the origin shared links are written on, when
it differs from the API deployment. On Windows, type the commands without the
`#` comments shown here: Command Prompt reads them as part of the command.

### Android

Needs JDK 21 and the Android SDK (Android Studio installs both). Works on
Windows, macOS and Linux.

```bash
npm run android:build        # -> android/app/build/outputs/apk/debug/app-debug.apk
npm run android:open         # or open in Android Studio and press Run
```

To try the app on a phone without any of that, download the `findway-android`
artifact from the latest *Mobile apps* run on GitHub and install the APK it
contains, allowing *Install unknown apps* when asked.

### iOS

Needs a Mac with Xcode 26 or later for local work, since App Store Connect
refuses uploads built with an older SDK; CI below builds without one.

```bash
npm run ios:open             # opens Xcode; pick a simulator or your phone, press Run
```

## CI builds

`.github/workflows/mobile.yml` builds both apps on every change to the native
projects, and on demand from the Actions tab (*Mobile apps → Run workflow*).
Each run uploads:

- `findway-android` — `findway-android-debug.apk`, installable on any Android
  phone (allow *Install unknown apps*), plus `findway-android-release.aab` for
  the Play Store once Android signing is configured.
- `findway-ios-simulator` — `Findway-simulator.app.zip`, which runs in the iOS
  Simulator.
- `findway-ios` — `findway-ios-release.ipa` for TestFlight and the App Store,
  once Apple signing is configured.

A store build's build number (Android `versionCode`, iOS `CFBundleVersion`) is
the workflow run number, so every run can be uploaded without editing a
project. The version people see (`1.0`) is set by hand in
`android/app/build.gradle` and in Xcode.

The workflow defaults `FINDWAY_API_URL` to `https://wayfinder-theta.vercel.app`.
Override it with a repository variable of the same name, or per run.

### Getting to TestFlight and Play internal testing

1. **Apple.** In [App Store Connect](https://appstoreconnect.apple.com):
   - *Certificates, Identifiers & Profiles → Identifiers → +*: register an
     App ID with bundle ID `ai.findway.app`.
   - *Apps → +*: create the app named Findway with that bundle ID. The SKU is
     any unique string, for example `findway-ios`.
   - *Users and Access → Integrations → App Store Connect API → Team Keys →
     +*: role **Admin**. Download the `.p8` (offered once) and note the
     **Key ID** next to it and the **Issuer ID** above the list.
   - Team ID: *Membership details* at developer.apple.com/account.
   - Add the four `APPLE_*` / `APP_STORE_CONNECT_*` secrets from the table.
     Nothing else is needed: the workflow uses Xcode cloud signing, so no
     certificate or provisioning profile is ever created or exported.
2. **Android.** Create the upload key once (below) and add the four
   `ANDROID_*` secrets. Run the workflow, download
   `findway-android-release.aab` from the run and upload it by hand to a new
   app in the [Play Console](https://play.google.com/console) (*Testing →
   Internal testing → Create release*). The console needs that first upload to
   learn the app; from then on the workflow can upload (step 4).
3. **Run it.** *Actions → Mobile apps → Run workflow*, tick **upload**. The
   iOS build appears in TestFlight under the app a few minutes after
   processing; add testers there. Android goes to the internal testing track
   once step 4 is done; until then take the `.aab` from the run's artifacts.
4. **Optional: let CI upload to Play.** Create a Google Cloud service account
   with a JSON key, invite its email in *Play Console → Users and permissions*
   with *Release apps to testing tracks* on the app, and store the JSON in
   `PLAY_SERVICE_ACCOUNT_JSON`.

| Name | Kind | Value |
| --- | --- | --- |
| `FINDWAY_API_URL` | Variable | Optional: the deployment the apps call, if not the default |
| `ANDROID_KEYSTORE_BASE64` | Secret | `base64 -w0 release.jks` |
| `ANDROID_KEYSTORE_PASSWORD` | Secret | Keystore password |
| `ANDROID_KEY_ALIAS` | Secret | Key alias |
| `ANDROID_KEY_PASSWORD` | Secret | Key password |
| `APPLE_TEAM_ID` | Secret | 10-character Team ID |
| `APP_STORE_CONNECT_KEY_ID` | Secret | Key ID of the API key |
| `APP_STORE_CONNECT_ISSUER_ID` | Secret | Issuer ID shown with the API keys |
| `APP_STORE_CONNECT_KEY_P8` | Secret | Full contents of the downloaded `.p8` file |
| `PLAY_SERVICE_ACCOUNT_JSON` | Secret | Optional: service-account JSON key for Play uploads |

Create the Android upload key once. The easiest way needs no Java installed:
add a repository secret `ANDROID_KEYSTORE_PASSWORD` with a password you choose,
run *Actions → Android upload key → Run workflow*, download its
`android-upload-key` artifact, and keep `release.jks` somewhere safe. Paste
the contents of `release.jks.b64` into `ANDROID_KEYSTORE_BASE64`, and add
`ANDROID_KEY_ALIAS` = `findway` and `ANDROID_KEY_PASSWORD` = the same password.
The same key can be made locally instead:

```bash
keytool -genkey -v -keystore release.jks -keyalg RSA -keysize 2048 -validity 10000 -alias findway
```

Play signs the app with its own key, so a lost upload key can be reset
through Play Console support, but that is a day of delay worth avoiding.

Before releasing to testers, both consoles also ask for a privacy policy URL
(the site's `/privacy` page) and a data-collection declaration (Play's *Data
safety* form, App Store *App Privacy*). Location and camera are used on the
device; what the app sends to the server is set out in
[`location-data-and-gdpr.md`](location-data-and-gdpr.md). Apple also expects
iPad screenshots while the Xcode target supports iPad.

## Store listings and screenshots

[`store-listing.md`](store-listing.md) has the listing text for both stores,
the privacy-form answers, the App Review notes and the pre-release checklist.
*Actions → Store screenshots → Run workflow* renders every required
screenshot size and Play's feature graphic from the app itself
(`scripts/store-screenshots.mjs`) into the `store-screenshots` artifact.

## Icons and splash

`mobile/assets/icon.svg` is the master. After changing it:

```bash
npm run mobile:icons
```

That rewrites the PWA icons in `public/`, every Android launcher density
(including the adaptive icon), the iOS app icon, and both platforms' splash
screens.

## App identity

- Bundle / application id: `ai.findway.app` (`capacitor.config.ts`,
  `android/app/build.gradle`, the Xcode project). It cannot change after the
  first store upload.
- Display name: *Findway*.
- Orientation: portrait on phones.
