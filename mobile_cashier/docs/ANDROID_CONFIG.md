# Android configuration

## Permissions

In `android/app/src/main/AndroidManifest.xml`, ensure:

```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
  <uses-permission android:name="android.permission.INTERNET" />
  <uses-permission android:name="android.permission.CAMERA" />
  <!-- … -->
</manifest>
```

`flutter create` usually includes `INTERNET`; add `CAMERA` if missing.

## Cleartext HTTP (development only)

To allow `http://` to a dev server, you can add `android:usesCleartextTraffic="true"` on `<application>` **only for debug builds** via `android/app/src/debug/AndroidManifest.xml`, or use a Network Security Configuration. Prefer HTTPS for production.

## minSdkVersion

`mobile_scanner` typically requires **minSdk 21+**. Set in `android/app/build.gradle.kts` under `defaultConfig { minSdk = … }` if Gradle sync fails.

## Release APK / App Bundle

```bash
flutter build apk --release
flutter build appbundle --release
```
