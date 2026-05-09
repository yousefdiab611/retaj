# iOS configuration

## Camera (barcode scanning)

Add to `ios/Runner/Info.plist` **inside** the root `<dict>`:

```xml
<key>NSCameraUsageDescription</key>
<string>RETAJ STORE uses the camera to scan product barcodes at checkout.</string>
```

Apple requires a clear, user-facing purpose string.

## Local network (HTTP debugging)

For HTTP to a dev machine, you may need **App Transport Security** exceptions during development only. Prefer HTTPS in production.

Example (debug-only; remove for App Store if inappropriate):

```xml
<key>NSAppTransportSecurity</key>
<dict>
  <key>NSAllowsLocalNetworking</key>
  <true/>
</dict>
```

## Safe area

Screens use `SafeArea` / default `Scaffold` insets where needed for notched iPhones.

## Signing

Open `ios/Runner.xcworkspace` in Xcode → **Signing & Capabilities** → select your team.
