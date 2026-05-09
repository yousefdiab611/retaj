import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

/// Lightweight JSON cache of `/api/products` per branch + warehouse.
class ProductCatalogCache {
  static const _prefix = 'retaj_products_';

  static Future<void> save({
    required String branchId,
    String? warehouseId,
    required List<Map<String, dynamic>> productsJson,
  }) async {
    final p = await SharedPreferences.getInstance();
    final key = _key(branchId, warehouseId);
    await p.setString(key, jsonEncode(productsJson));
    await p.setInt('${key}_ts', DateTime.now().millisecondsSinceEpoch);
  }

  static Future<List<Map<String, dynamic>>?> load({
    required String branchId,
    String? warehouseId,
  }) async {
    final p = await SharedPreferences.getInstance();
    final raw = p.getString(_key(branchId, warehouseId));
    if (raw == null || raw.isEmpty) return null;
    try {
      final list = jsonDecode(raw) as List<dynamic>;
      return list.map((e) => Map<String, dynamic>.from(e as Map)).toList();
    } catch (_) {
      return null;
    }
  }

  static String _key(String branchId, String? warehouseId) =>
      '$_prefix${branchId}_${warehouseId ?? "all"}';
}
