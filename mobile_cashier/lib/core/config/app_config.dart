import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// API base URL without trailing slash (e.g. https://api.example.com or http://10.0.2.2:3001).
/// Android emulator → host machine: use http://10.0.2.2:PORT
/// iOS simulator → http://127.0.0.1:PORT
class AppConfig {
  AppConfig._();

  static const String prefsKeyApiBase = 'retaj_api_base_url';

  /// Compile-time override: `--dart-define=API_BASE_URL=https://api.example.com`
  static const String kDefineBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: '',
  );

  /// Default when nothing else is set (matches backend default port).
  static String get kDefaultBaseUrl {
    if (kIsWeb) return 'http://127.0.0.1:3001';
    switch (defaultTargetPlatform) {
      case TargetPlatform.android:
        return 'http://10.0.2.2:3001';
      case TargetPlatform.iOS:
        return 'http://127.0.0.1:3001';
      default:
        return 'http://127.0.0.1:3001';
    }
  }

  static Future<String> resolveApiBaseUrl() async {
    final p = await SharedPreferences.getInstance();
    final saved = p.getString(prefsKeyApiBase)?.trim();
    if (saved != null && saved.isNotEmpty) return _normalize(saved);
    if (kDefineBaseUrl.isNotEmpty) return _normalize(kDefineBaseUrl);
    return _normalize(kDefaultBaseUrl);
  }

  static Future<void> setApiBaseUrl(String? url) async {
    final p = await SharedPreferences.getInstance();
    if (url == null || url.trim().isEmpty) {
      await p.remove(prefsKeyApiBase);
    } else {
      await p.setString(prefsKeyApiBase, _normalize(url));
    }
  }

  static String _normalize(String u) => u.replaceAll(RegExp(r'/$'), '');
}
