class Warehouse {
  const Warehouse({
    required this.id,
    required this.name,
    this.location,
    this.branchId,
    required this.isDefault,
    required this.createdAt,
  });

  final String id;
  final String name;
  final String? location;
  final String? branchId;
  final bool isDefault;
  final String createdAt;

  factory Warehouse.fromJson(Map<String, dynamic> j) => Warehouse(
        id: j['id'] as String,
        name: j['name'] as String,
        location: j['location'] as String?,
        branchId: j['branchId'] as String?,
        isDefault: j['isDefault'] as bool? ?? false,
        createdAt: j['createdAt'] as String? ?? '',
      );
}
