import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../../models/auth_user.dart';

/// Access / refresh tokens and user snapshot — Keychain (iOS) / Keystore (Android).
class SecureSessionStore {
  SecureSessionStore({FlutterSecureStorage? storage})
      : _s = storage ??
            const FlutterSecureStorage(
              aOptions: AndroidOptions(encryptedSharedPreferences: true),
              iOptions: IOSOptions(accessibility: KeychainAccessibility.first_unlock_this_device),
            );

  final FlutterSecureStorage _s;

  static const _kAccess = 'retaj_access_token';
  static const _kRefresh = 'retaj_refresh_token';
  static const _kUser = 'retaj_user_json';

  Future<void> writeSession({
    required String accessToken,
    String? refreshToken,
    required AuthUser user,
  }) async {
    await _s.write(key: _kAccess, value: accessToken);
    if (refreshToken != null) {
      await _s.write(key: _kRefresh, value: refreshToken);
    }
    await _s.write(key: _kUser, value: jsonEncode(user.toJson()));
  }

  Future<String?> readAccessToken() => _s.read(key: _kAccess);

  Future<String?> readRefreshToken() => _s.read(key: _kRefresh);

  Future<AuthUser?> readUser() async {
    final raw = await _s.read(key: _kUser);
    if (raw == null || raw.isEmpty) return null;
    try {
      return AuthUser.fromJson(jsonDecode(raw) as Map<String, dynamic>);
    } catch (_) {
      return null;
    }
  }

  Future<void> clear() async {
    await _s.delete(key: _kAccess);
    await _s.delete(key: _kRefresh);
    await _s.delete(key: _kUser);
  }
}
