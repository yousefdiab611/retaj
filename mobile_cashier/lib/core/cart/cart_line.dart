import '../../models/product.dart';

class CartLine {
  CartLine({
    required this.productId,
    required this.name,
    required this.unitPrice,
    required this.quantity,
    this.maxStock,
  });

  final String productId;
  final String name;
  final double unitPrice;
  int quantity;
  final int? maxStock;

  double get lineTotal => unitPrice * quantity;

  factory CartLine.fromProduct(Product p, {int quantity = 1}) => CartLine(
        productId: p.id,
        name: p.name,
        unitPrice: p.price,
        quantity: quantity,
        maxStock: p.stockQty,
      );

  CartLine copyWith({int? quantity}) => CartLine(
        productId: productId,
        name: name,
        unitPrice: unitPrice,
        quantity: quantity ?? this.quantity,
        maxStock: maxStock,
      );
}
