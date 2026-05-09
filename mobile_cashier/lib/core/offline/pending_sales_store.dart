import 'dart:convert';

import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';
import 'package:sqflite/sqflite.dart';
import 'package:uuid/uuid.dart';

/// Persists checkout payloads when the device is offline; synced when connectivity returns.
class PendingSalesStore {
  PendingSalesStore._();
  static final PendingSalesStore instance = PendingSalesStore._();

  Database? _db;
  static const _uuid = Uuid();

  Future<Database> get database async {
    if (_db != null) return _db!;
    final dir = await getApplicationDocumentsDirectory();
    final path = p.join(dir.path, 'retaj_pending_sales.db');
    _db = await openDatabase(
      path,
      version: 1,
      onCreate: (db, v) async {
        await db.execute('''
          CREATE TABLE pending_sales (
            id TEXT PRIMARY KEY NOT NULL,
            payload TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            last_error TEXT
          )
        ''');
      },
    );
    return _db!;
  }

  Future<String> enqueue(Map<String, dynamic> salePayload) async {
    final db = await database;
    final id = _uuid.v4();
    await db.insert('pending_sales', {
      'id': id,
      'payload': jsonEncode(salePayload),
      'created_at': DateTime.now().millisecondsSinceEpoch,
      'last_error': null,
    });
    return id;
  }

  Future<List<PendingSaleRow>> listAll() async {
    final db = await database;
    final rows = await db.query('pending_sales', orderBy: 'created_at ASC');
    return rows
        .map(
          (r) => PendingSaleRow(
            id: r['id'] as String,
            payload: jsonDecode(r['payload'] as String) as Map<String, dynamic>,
            createdAt: DateTime.fromMillisecondsSinceEpoch(r['created_at'] as int),
            lastError: r['last_error'] as String?,
          ),
        )
        .toList();
  }

  Future<void> delete(String id) async {
    final db = await database;
    await db.delete('pending_sales', where: 'id = ?', whereArgs: [id]);
  }

  Future<void> setError(String id, String? error) async {
    final db = await database;
    await db.update(
      'pending_sales',
      {'last_error': error},
      where: 'id = ?',
      whereArgs: [id],
    );
  }

  Future<void> replacePayload(String id, Map<String, dynamic> payload) async {
    final db = await database;
    await db.update(
      'pending_sales',
      {'payload': jsonEncode(payload)},
      where: 'id = ?',
      whereArgs: [id],
    );
  }

  Future<int> count() async {
    final db = await database;
    final r = await db.rawQuery('SELECT COUNT(*) as c FROM pending_sales');
    return Sqflite.firstIntValue(r) ?? 0;
  }
}

class PendingSaleRow {
  PendingSaleRow({
    required this.id,
    required this.payload,
    required this.createdAt,
    this.lastError,
  });

  final String id;
  final Map<String, dynamic> payload;
  final DateTime createdAt;
  final String? lastError;
}
