import 'dart:async';
import 'dart:io';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:uuid/uuid.dart';

import '../core/api/retaj_api_client.dart';
import '../core/offline/pending_sales_store.dart';
import '../models/sale_transaction.dart';

class CheckoutResult {
  CheckoutResult._({this.transaction, this.queuedId});

  factory CheckoutResult.success(SaleTransaction tx) =>
      CheckoutResult._(transaction: tx);

  factory CheckoutResult.queued(String id) => CheckoutResult._(queuedId: id);

  final SaleTransaction? transaction;
  final String? queuedId;

  bool get isQueued => queuedId != null;
}

class CheckoutService {
  CheckoutService({required RetajApiClient api}) : _api = api;

  final RetajApiClient _api;
  static const _uuid = Uuid();
  int _backoffMs = 2000;
  DateTime? _nextSyncAfter;

  Future<bool> isOnline() async {
    final list = await Connectivity().checkConnectivity();
    if (list.isEmpty) return true;
    return !list.contains(ConnectivityResult.none);
  }

  Map<String, dynamic> _withIdempotency(Map<String, dynamic> payload) {
    final copy = Map<String, dynamic>.from(payload);
    copy['idempotencyKey'] ??= _uuid.v4();
    return copy;
  }

  /// Submits sale; on connection failure enqueues for later sync (RetajApiException is rethrown — business errors).
  Future<CheckoutResult> submit(Map<String, dynamic> payload) async {
    final body = _withIdempotency(payload);
    if (!await isOnline()) {
      final id = await PendingSalesStore.instance.enqueue(body);
      return CheckoutResult.queued(id);
    }
    try {
      final tx = await _api.createSale(
        customerId: body['customerId'] as String?,
        warehouseId: body['warehouseId'] as String?,
        discount: (body['discount'] as num).toDouble(),
        paymentMethod: body['paymentMethod'] as String,
        lineItems: (body['lineItems'] as List<dynamic>)
            .map((e) => Map<String, dynamic>.from(e as Map))
            .toList(),
        idempotencyKey: body['idempotencyKey'] as String?,
      );
      _backoffMs = 2000;
      return CheckoutResult.success(tx);
    } on SocketException {
      final id = await PendingSalesStore.instance.enqueue(body);
      return CheckoutResult.queued(id);
    } on HttpException {
      final id = await PendingSalesStore.instance.enqueue(body);
      return CheckoutResult.queued(id);
    } on HandshakeException {
      final id = await PendingSalesStore.instance.enqueue(body);
      return CheckoutResult.queued(id);
    } on TimeoutException {
      final id = await PendingSalesStore.instance.enqueue(body);
      return CheckoutResult.queued(id);
    } on RetajApiException {
      rethrow;
    } catch (_) {
      final id = await PendingSalesStore.instance.enqueue(body);
      return CheckoutResult.queued(id);
    }
  }

  Future<void> syncPendingQueue() async {
    if (!await isOnline()) return;
    if (_nextSyncAfter != null && DateTime.now().isBefore(_nextSyncAfter!)) {
      return;
    }
    final rows = await PendingSalesStore.instance.listAll();
    if (rows.isEmpty) return;

    final byKey = <String, String>{}; // idempotencyKey -> sqlite row id
    final items = <Map<String, dynamic>>[];

    for (final row in rows) {
      var p = Map<String, dynamic>.from(row.payload);
      if (p['idempotencyKey'] == null) {
        p['idempotencyKey'] = _uuid.v4();
        await PendingSalesStore.instance.replacePayload(row.id, p);
      }
      final key = p['idempotencyKey'] as String;
      byKey[key] = row.id;
      items.add(p);
    }

    try {
      final res = await _api.syncOfflineTransactions(items: items);
      final list = res['results'] as List<dynamic>? ?? [];
      for (final raw in list) {
        final m = raw as Map<String, dynamic>;
        final key = m['idempotencyKey'] as String?;
        if (key == null) continue;
        final rowId = byKey[key];
        if (rowId == null) continue;
        if (m['ok'] == true) {
          await PendingSalesStore.instance.delete(rowId);
        } else {
          await PendingSalesStore.instance.setError(
            rowId,
            m['message'] as String? ?? 'Sync failed',
          );
        }
      }
      _backoffMs = 2000;
      _nextSyncAfter = null;
    } catch (_) {
      _nextSyncAfter = DateTime.now().add(Duration(milliseconds: _backoffMs));
      _backoffMs = (_backoffMs * 2).clamp(2000, 120000);
    }
  }
}
