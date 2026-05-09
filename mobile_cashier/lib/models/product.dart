class Product {
  const Product({
    required this.id,
    required this.sku,
    required this.name,
    required this.price,
    required this.stockQty,
    this.barcode,
    this.category,
  });

  final String id;
  final String sku;
  final String? barcode;
  final String name;
  final String category;
  final double price;
  final int stockQty;

  factory Product.fromJson(Map<String, dynamic> j) {
    final cat = j['category'];
    return Product(
      id: j['id'] as String,
      sku: j['sku'] as String,
      barcode: j['barcode'] as String?,
      name: j['name'] as String,
      category: cat is String ? cat : 'Uncategorized',
      price: (j['price'] as num).toDouble(),
      stockQty: (j['stockQty'] as num).toInt(),
    );
  }
}
