import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:jwt_decoder/jwt_decoder.dart';

import '../../models/auth_user.dart';
import '../../models/product.dart';
import '../../models/sale_transaction.dart';
import '../../models/warehouse.dart';
import '../config/app_config.dart';
import '../storage/secure_session_store.dart';

/// HTTP client for Retaj backend (`/api/*`). Handles JWT refresh and branch header.
class RetajApiClient {
  RetajApiClient({
    required SecureSessionStore secureStore,
  }) : _secure = secureStore;

  final SecureSessionStore _secure;

  String? _cachedBaseUrl;

  Future<String> get baseUrl async {
    _cachedBaseUrl ??= await AppConfig.resolveApiBaseUrl();
    return _cachedBaseUrl!;
  }

  Future<void> invalidateBaseUrl() async {
    _cachedBaseUrl = null;
  }

  Future<Uri> _u(String path) async {
    final b = await baseUrl;
    final p = path.startsWith('/') ? path : '/$path';
    return Uri.parse('$b$p');
  }

  Future<Map<String, String>> _headers({bool jsonBody = false}) async {
    final h = <String, String>{
      if (jsonBody) 'Content-Type': 'application/json',
    };
    final token = await _secure.readAccessToken();
    if (token != null) {
      h['Authorization'] = 'Bearer $token';
    }
    final user = await _secure.readUser();
    final bid = user?.branchId;
    if (bid != null && bid.isNotEmpty) {
      h['X-Branch-Id'] = bid;
    }
    return h;
  }

  Future<bool> _refreshIfNeeded() async {
    final access = await _secure.readAccessToken();
    if (access == null) return false;
    try {
      if (!JwtDecoder.isExpired(access)) return true;
    } catch (_) {
      return false;
    }
    return refreshSession();
  }

  Future<bool> refreshSession() async {
    final refresh = await _secure.readRefreshToken();
    if (refresh == null) return false;
    final uri = await _u('/api/auth/refresh');
    final res = await http.post(
      uri,
      headers: const {'Content-Type': 'application/json'},
      body: jsonEncode({'refreshToken': refresh}),
    );
    if (res.statusCode != 200) return false;
    final j = jsonDecode(res.body) as Map<String, dynamic>;
    final at = j['accessToken'] as String?;
    final rt = j['refreshToken'] as String?;
    if (at == null) return false;
    final user = await _secure.readUser();
    if (user == null) return false;
    final previousRt = await _secure.readRefreshToken();
    await _secure.writeSession(
      accessToken: at,
      refreshToken: rt ?? previousRt,
      user: user,
    );
    return true;
  }

  Future<http.Response> _request(
    Future<http.Response> Function(Map<String, String> h) send, {
    bool jsonBody = false,
  }) async {
    await _refreshIfNeeded();
    var headers = await _headers(jsonBody: jsonBody);
    var res = await send(headers);
    if (res.statusCode == 401) {
      final ok = await refreshSession();
      if (ok) {
        headers = await _headers(jsonBody: jsonBody);
        res = await send(headers);
      }
    }
    return res;
  }

  Future<AuthUser> login({required String username, required String password}) async {
    final uri = await _u('/api/auth/login');
    final res = await http.post(
      uri,
      headers: const {'Content-Type': 'application/json'},
      body: jsonEncode({'username': username.trim(), 'password': password}),
    );
    if (res.statusCode != 200) {
      throw RetajApiException(_extractError(res), status: res.statusCode);
    }
    final j = jsonDecode(res.body) as Map<String, dynamic>;
    final access = j['accessToken'] as String?;
    final refresh = j['refreshToken'] as String?;
    final user = AuthUser.fromJson(j['user'] as Map<String, dynamic>);
    if (access == null) {
      throw RetajApiException('Invalid login response', status: res.statusCode);
    }
    await _secure.writeSession(accessToken: access, refreshToken: refresh, user: user);
    return user;
  }

  Future<void> logout() async {
    final refresh = await _secure.readRefreshToken();
    if (refresh != null) {
      try {
        final uri = await _u('/api/auth/logout');
        await http.post(
          uri,
          headers: const {'Content-Type': 'application/json'},
          body: jsonEncode({'refreshToken': refresh}),
        );
      } catch (_) {}
    }
    await _secure.clear();
  }

  Future<List<Product>> fetchProducts({String? warehouseId}) async {
    final q = warehouseId != null ? '?warehouseId=${Uri.encodeQueryComponent(warehouseId)}' : '';
    final uri = await _u('/api/products$q');
    final res = await _request((h) => http.get(uri, headers: h), jsonBody: false);
    if (res.statusCode == 401) throw UnauthorizedException();
    if (res.statusCode != 200) {
      throw RetajApiException(_extractError(res), status: res.statusCode);
    }
    final j = jsonDecode(res.body) as Map<String, dynamic>;
    final list = j['products'] as List<dynamic>? ?? [];
    return list.map((e) => Product.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<Product> lookupProduct(String code, {String? warehouseId}) async {
    final params = <String, String>{'code': code.trim()};
    if (warehouseId != null) params['warehouseId'] = warehouseId;
    final qs = params.entries.map((e) => '${e.key}=${Uri.encodeQueryComponent(e.value)}').join('&');
    final uri = await _u('/api/products/lookup?$qs');
    final res = await _request((h) => http.get(uri, headers: h), jsonBody: false);
    if (res.statusCode == 401) throw UnauthorizedException();
    if (res.statusCode == 404) {
      throw RetajApiException(_extractError(res), status: 404);
    }
    if (res.statusCode != 200) {
      throw RetajApiException(_extractError(res), status: res.statusCode);
    }
    final j = jsonDecode(res.body) as Map<String, dynamic>;
    return Product.fromJson(j['product'] as Map<String, dynamic>);
  }

  Future<List<Warehouse>> fetchWarehouses() async {
    final uri = await _u('/api/warehouses');
    final res = await _request((h) => http.get(uri, headers: h), jsonBody: false);
    if (res.statusCode == 401) throw UnauthorizedException();
    if (res.statusCode != 200) {
      throw RetajApiException(_extractError(res), status: res.statusCode);
    }
    final j = jsonDecode(res.body) as Map<String, dynamic>;
    final list = j['warehouses'] as List<dynamic>? ?? [];
    return list.map((e) => Warehouse.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<SaleTransaction> createSale({
    String? customerId,
    String? warehouseId,
    required double discount,
    required String paymentMethod,
    required List<Map<String, dynamic>> lineItems,
    String? idempotencyKey,
  }) async {
    final uri = await _u('/api/transactions');
    final body = <String, dynamic>{
      'discount': discount,
      'paymentMethod': paymentMethod,
      'lineItems': lineItems,
      if (customerId != null) 'customerId': customerId,
      if (warehouseId != null) 'warehouseId': warehouseId,
      if (idempotencyKey != null) 'idempotencyKey': idempotencyKey,
    };
    final res = await _request(
      (h) => http.post(uri, headers: h, body: jsonEncode(body)),
      jsonBody: true,
    );
    if (res.statusCode == 401) throw UnauthorizedException();
    if (res.statusCode != 200 && res.statusCode != 201) {
      throw RetajApiException(_extractError(res), status: res.statusCode);
    }
    final j = jsonDecode(res.body) as Map<String, dynamic>;
    return SaleTransaction.fromJson(j['transaction'] as Map<String, dynamic>);
  }

  /// Batch idempotent sync for offline-queued sales (same validation as single POST /transactions).
  Future<Map<String, dynamic>> syncOfflineTransactions({
    required List<Map<String, dynamic>> items,
  }) async {
    final uri = await _u('/api/sync/offline-transactions');
    final res = await _request(
      (h) => http.post(uri, headers: h, body: jsonEncode({'items': items})),
      jsonBody: true,
    );
    if (res.statusCode == 401) throw UnauthorizedException();
    if (res.statusCode != 200) {
      throw RetajApiException(_extractError(res), status: res.statusCode);
    }
    return jsonDecode(res.body) as Map<String, dynamic>;
  }

  Future<InvoicePayload> fetchInvoice(String transactionId) async {
    final uri = await _u('/api/transactions/$transactionId');
    final res = await _request((h) => http.get(uri, headers: h), jsonBody: false);
    if (res.statusCode == 401) throw UnauthorizedException();
    if (res.statusCode == 404) {
      throw RetajApiException('Not found', status: 404);
    }
    if (res.statusCode != 200) {
      throw RetajApiException(_extractError(res), status: res.statusCode);
    }
    final j = jsonDecode(res.body) as Map<String, dynamic>;
    return InvoicePayload.fromJson(j);
  }

  static String _extractError(http.Response res) {
    try {
      final j = jsonDecode(res.body) as Map<String, dynamic>;
      return j['error'] as String? ?? res.reasonPhrase ?? 'Request failed';
    } catch (_) {
      return res.reasonPhrase ?? 'Request failed';
    }
  }
}

class RetajApiException implements Exception {
  RetajApiException(this.message, {this.status});
  final String message;
  final int? status;

  @override
  String toString() => message;
}

class UnauthorizedException implements Exception {}
