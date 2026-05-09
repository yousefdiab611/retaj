import 'package:flutter/foundation.dart';

import '../core/cart/cart_line.dart';
import '../models/product.dart';
import '../models/warehouse.dart';

/// Cart, discount, and warehouse selection for the active sale.
class PosState extends ChangeNotifier {
  final List<CartLine> _lines = [];
  List<Warehouse> _warehouses = [];
  String? _warehouseId;
  double _discount = 0;
  List<Product> _products = [];
  bool _catalogLoading = false;

  List<CartLine> get lines => List.unmodifiable(_lines);
  List<Warehouse> get warehouses => _warehouses;
  String? get warehouseId => _warehouseId;
  double get discount => _discount;
  List<Product> get products => _products;
  bool get catalogLoading => _catalogLoading;

  int get lineCount => _lines.fold(0, (a, l) => a + l.quantity);

  void setWarehouses(List<Warehouse> w, {String? selectId}) {
    _warehouses = w;
    if (w.isEmpty) {
      _warehouseId = null;
    } else {
      String preferred;
      if (selectId != null && w.any((x) => x.id == selectId)) {
        preferred = selectId;
      } else {
        Warehouse? def;
        for (final x in w) {
          if (x.isDefault) {
            def = x;
            break;
          }
        }
        preferred = (def ?? w.first).id;
      }
      _warehouseId = preferred;
    }
    notifyListeners();
  }

  void setWarehouseId(String? id) {
    _warehouseId = id;
    notifyListeners();
  }

  void setDiscount(double v) {
    _discount = v < 0 ? 0 : v;
    notifyListeners();
  }

  void setCatalogLoading(bool v) {
    _catalogLoading = v;
    notifyListeners();
  }

  void setProducts(List<Product> p) {
    _products = p;
    notifyListeners();
  }

  void addProduct(Product p) {
    final max = p.stockQty;
    if (max <= 0) return;
    final i = _lines.indexWhere((l) => l.productId == p.id);
    if (i == -1) {
      if (max < 1) return;
      _lines.add(CartLine.fromProduct(p, quantity: 1));
    } else {
      final line = _lines[i];
      if (line.quantity >= max) return;
      _lines[i] = line.copyWith(quantity: line.quantity + 1);
    }
    notifyListeners();
  }

  void setLineQuantity(String productId, int qty) {
    final i = _lines.indexWhere((l) => l.productId == productId);
    if (i == -1) return;
    final line = _lines[i];
    final max = line.maxStock ?? 999999;
    if (qty <= 0) {
      _lines.removeAt(i);
    } else {
      _lines[i] = line.copyWith(quantity: qty > max ? max : qty);
    }
    notifyListeners();
  }

  void removeLine(String productId) {
    _lines.removeWhere((l) => l.productId == productId);
    notifyListeners();
  }

  void clearCart() {
    _lines.clear();
    _discount = 0;
    notifyListeners();
  }

  double get subtotal =>
      _lines.fold(0.0, (s, l) => s + l.unitPrice * l.quantity);

  /// Matches web POS tax constant (15%) — display only; server is source of truth.
  static const double taxRate = 0.15;

  double get taxable => (subtotal - _discount).clamp(0.0, double.infinity);
  double get tax => taxable * taxRate;
  double get total => taxable + tax;
}
