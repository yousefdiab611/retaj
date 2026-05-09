/// Response from POST /api/transactions
class SaleTransaction {
  const SaleTransaction({
    required this.id,
    required this.reference,
    required this.subtotal,
    required this.discount,
    required this.tax,
    required this.total,
    this.paymentMethod,
    required this.createdAt,
  });

  final String id;
  final String reference;
  final double subtotal;
  final double discount;
  final double tax;
  final double total;
  final String? paymentMethod;
  final String createdAt;

  factory SaleTransaction.fromJson(Map<String, dynamic> j) => SaleTransaction(
        id: j['id'] as String,
        reference: j['reference'] as String,
        subtotal: (j['subtotal'] as num).toDouble(),
        discount: (j['discount'] as num).toDouble(),
        tax: (j['tax'] as num).toDouble(),
        total: (j['total'] as num).toDouble(),
        paymentMethod: j['paymentMethod'] as String?,
        createdAt: j['createdAt'] as String,
      );
}

/// Invoice payload from GET /api/transactions/:id — body is `{ transaction: { ... } }`.
class InvoicePayload {
  const InvoicePayload({
    required this.id,
    required this.reference,
    required this.subtotal,
    required this.discount,
    required this.tax,
    required this.total,
    this.paymentMethod,
    required this.createdAt,
    this.branchName,
    this.warehouseName,
    this.storeName,
    this.currency,
    this.taxLabel,
    this.thankYou,
    this.lines = const [],
  });

  final String id;
  final String reference;
  final double subtotal;
  final double discount;
  final double tax;
  final double total;
  final String? paymentMethod;
  final String createdAt;
  final String? branchName;
  final String? warehouseName;
  final String? storeName;
  final String? currency;
  final String? taxLabel;
  final String? thankYou;
  final List<InvoiceLine> lines;

  factory InvoicePayload.fromJson(Map<String, dynamic> j) {
    final tx = j['transaction'] as Map<String, dynamic>;
    final branch = tx['branch'] as Map<String, dynamic>?;
    final wh = tx['warehouse'] as Map<String, dynamic>?;
    final store = tx['store'] as Map<String, dynamic>?;
    final rawLines = tx['lines'] as List<dynamic>? ?? [];
    return InvoicePayload(
      id: tx['id'] as String,
      reference: tx['reference'] as String,
      subtotal: (tx['subtotal'] as num).toDouble(),
      discount: (tx['discount'] as num).toDouble(),
      tax: (tx['tax'] as num).toDouble(),
      total: (tx['total'] as num).toDouble(),
      paymentMethod: tx['paymentMethod'] as String?,
      createdAt: tx['createdAt'] as String,
      branchName: branch?['name'] as String?,
      warehouseName: wh?['name'] as String?,
      storeName: store?['name'] as String?,
      currency: store?['currency'] as String?,
      taxLabel: store?['taxLabel'] as String?,
      thankYou: store?['thankYou'] as String?,
      lines: rawLines
          .map((e) => InvoiceLine.fromJson(e as Map<String, dynamic>))
          .toList(),
    );
  }
}

class InvoiceLine {
  const InvoiceLine({
    required this.name,
    required this.sku,
    required this.quantity,
    required this.unitPrice,
    required this.lineTotal,
  });

  final String name;
  final String sku;
  final int quantity;
  final double unitPrice;
  final double lineTotal;

  factory InvoiceLine.fromJson(Map<String, dynamic> j) => InvoiceLine(
        name: j['name'] as String,
        sku: j['sku'] as String? ?? '',
        quantity: (j['quantity'] as num).toInt(),
        unitPrice: (j['unitPrice'] as num).toDouble(),
        lineTotal: (j['lineTotal'] as num).toDouble(),
      );
}
