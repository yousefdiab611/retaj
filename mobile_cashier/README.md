# RETAJ STORE Cashier (Flutter)

Production-oriented **mobile POS client** for the RETAJ STORE backend: **Android + iOS** from one codebase.  
This folder contains **Dart sources only** until you run Flutter tooling to generate `android/` and `ios/`.

## Requirements

- [Flutter](https://docs.flutter.dev/get-started/install) **3.22+** (stable), with Android SDK + Xcode (macOS) for iOS.
- Retaj API reachable from the device or emulator (see [API base URL](#api-base-url)).

## First-time project bootstrap

From this directory:

```bash
flutter pub get
flutter create . --project-name retaj_cashier --org com.retaj.cashier
```

`flutter create` adds the **Android** and **iOS** host projects without overwriting your existing `lib/` and `pubspec.yaml`.

Then apply platform permissions:

- **iOS**: merge camera usage string into `ios/Runner/Info.plist` (see `docs/IOS_CONFIG.md`).
- **Android**: ensure `INTERNET` and `CAMERA` are declared (see `docs/ANDROID_CONFIG.md`).

## API base URL

| Environment      | Typical base URL                                       |
| ---------------- | ------------------------------------------------------ |
| Android emulator | `http://10.0.2.2:3001` (default in app)                |
| iOS Simulator    | `http://127.0.0.1:3001` (default)                      |
| Physical device  | Your machine’s LAN IP, e.g. `http://192.168.1.10:3001` |

Override in **Settings** inside the app, or at build time:

```bash
flutter run --dart-define=API_BASE_URL=https://api.example.com
```

All requests use paths under `/api` (e.g. `/api/auth/login`, `/api/products`).

## Backend integration (read-only contract)

| Feature           | Endpoint                                      |
| ----------------- | --------------------------------------------- |
| Login             | `POST /api/auth/login`                        |
| Refresh           | `POST /api/auth/refresh`                      |
| Logout            | `POST /api/auth/logout`                       |
| Products          | `GET /api/products?warehouseId=`              |
| Lookup            | `GET /api/products/lookup?code=&warehouseId=` |
| Warehouses        | `GET /api/warehouses`                         |
| Checkout          | `POST /api/transactions`                      |
| Receipt / invoice | `GET /api/transactions/:id`                   |

Branch context: **`X-Branch-Id`** is sent automatically from the logged-in cashier’s `branchId` (same as the web POS).

**Role**: only **`CASHIER`** accounts can use this app; admin/manager logins are rejected.

## Features

- JWT + secure storage (Keychain / Keystore via `flutter_secure_storage`)
- Warehouse selection and per-warehouse stock
- Product search + barcode scan (`mobile_scanner`) with **~350 ms debounce** on duplicate codes
- Cart, discount, payment method, checkout
- Offline queue for failed checkouts (`sqflite`) + background sync when online
- Dark mode (follows system)

## Builds

```bash
# Debug APK
flutter build apk --release

# iOS (on macOS, signing in Xcode)
flutter build ios --release
```

Open `ios/Runner.xcworkspace` in Xcode for signing, TestFlight, and App Store.

## Project layout

```
lib/
  main.dart, app.dart
  core/          # API client, secure storage, cache, offline DB
  models/
  screens/       # Login, POS, Scan, Cart, Receipt, Settings
  services/      # Checkout + offline sync
  state/         # Auth + POS cart
  theme/
  widgets/
docs/            # Platform permission snippets
```

## Scripts

- `scripts/bootstrap.ps1` — Windows helper to run `flutter create` when `android/` is missing.

## Troubleshooting

- **Cannot connect**: set API URL in Settings; confirm firewall and same Wi‑Fi for a physical device.
- **Camera black screen on iOS**: add `NSCameraUsageDescription` to `Info.plist` (see `docs/IOS_CONFIG.md`).
- **Cleartext HTTP blocked on Android 9+**: use HTTPS in production, or add a **network security config** for debug only (document in your release process).
