import 'package:flutter/foundation.dart';
import 'package:jwt_decoder/jwt_decoder.dart';

import '../core/api/retaj_api_client.dart';
import '../core/storage/secure_session_store.dart';
import '../models/auth_user.dart';

class AuthSession extends ChangeNotifier {
  AuthSession({
    required RetajApiClient api,
    required SecureSessionStore secure,
  })  : _api = api,
        _secure = secure;

  final RetajApiClient _api;
  final SecureSessionStore _secure;

  AuthUser? _user;
  bool _ready = false;
  bool _forbiddenRole = false;

  AuthUser? get user => _user;
  bool get ready => _ready;
  bool get isLoggedIn => _user != null;
  bool get forbiddenRole => _forbiddenRole;

  String? get branchIdForApi => _user?.branchId;

  Future<void> restore() async {
    _forbiddenRole = false;
    final u = await _secure.readUser();
    final token = await _secure.readAccessToken();
    if (u != null && token != null) {
      if (!u.isCashier) {
        _user = null;
        _forbiddenRole = true;
        await _secure.clear();
      } else {
        try {
          if (JwtDecoder.isExpired(token)) {
            final ok = await _api.refreshSession();
            if (!ok) {
              await _secure.clear();
              _user = null;
            } else {
              _user = await _secure.readUser();
            }
          } else {
            _user = u;
          }
        } catch (_) {
          await _secure.clear();
          _user = null;
        }
      }
    }
    _ready = true;
    notifyListeners();
  }

  Future<void> login(String username, String password) async {
    _forbiddenRole = false;
    final u = await _api.login(username: username, password: password);
    if (!u.isCashier) {
      await _api.logout();
      _forbiddenRole = true;
      _user = null;
      notifyListeners();
      throw StateError('CASHIER_ROLE_REQUIRED');
    }
    _user = u;
    notifyListeners();
  }

  Future<void> logout() async {
    await _api.logout();
    _user = null;
    _forbiddenRole = false;
    notifyListeners();
  }
}
