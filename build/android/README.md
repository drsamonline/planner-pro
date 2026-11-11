# Android build (APK)

Planner Pro is a static app, so the APK is a thin WebView shell around the same
files — built with [Capacitor](https://capacitorjs.com). Nothing is rewritten for
mobile; `app/` is copied in as the web bundle.

## Build it locally

```bash
npm install
npm i -D @capacitor/cli @capacitor/core @capacitor/android
cp build/android/capacitor.config.json .
npx cap add android
npx cap sync android
cd android && ./gradlew assembleDebug
# → android/app/build/outputs/apk/debug/app-debug.apk
```

Requirements: Node 20+, JDK 21 (Capacitor 7 compiles with source/target 21), Android SDK (platform 35 + build-tools).

## Or let CI do it

`.github/workflows/android.yml` runs the same steps on every tag and attaches
`planner-pro-debug.apk` to the release. A signed release APK additionally needs:

1. A keystore (`keytool -genkey -v -keystore release.keystore -alias planner ...`).
2. Four repository secrets: `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`,
   `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`.
3. `./gradlew assembleRelease` instead of `assembleDebug`.

## Notes

- Storage is the WebView's `localStorage`, which survives app updates but is lost
  on uninstall or "clear data". Export a JSON backup from Settings.
- The service worker is skipped inside the WebView (the files are already local),
  so the app is offline by definition.
- `server.androidScheme: "https"` keeps `localStorage` on a secure origin.
