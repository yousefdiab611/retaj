class BranchBrief {
  const BranchBrief({
    required this.id,
    required this.name,
    this.address,
    this.phone,
  });

  final String id;
  final String name;
  final String? address;
  final String? phone;

  factory BranchBrief.fromJson(Map<String, dynamic> j) => BranchBrief(
        id: j['id'] as String,
        name: j['name'] as String,
        address: j['address'] as String?,
        phone: j['phone'] as String?,
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        'address': address,
        'phone': phone,
      };
}

class AuthUser {
  const AuthUser({
    required this.id,
    this.username,
    this.email,
    required this.name,
    required this.role,
    this.branchId,
    this.branches = const [],
  });

  final String id;
  final String? username;
  final String? email;
  final String name;
  final String role;
  final String? branchId;
  final List<BranchBrief> branches;

  bool get isCashier => role == 'CASHIER';

  factory AuthUser.fromJson(Map<String, dynamic> j) {
    final br = j['branches'];
    final list = <BranchBrief>[];
    if (br is List) {
      for (final e in br) {
        if (e is Map<String, dynamic>) {
          list.add(BranchBrief.fromJson(e));
        }
      }
    }
    return AuthUser(
      id: j['id'] as String,
      username: j['username'] as String?,
      email: j['email'] as String?,
      name: j['name'] as String,
      role: j['role'] as String,
      branchId: j['branchId'] as String?,
      branches: list,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'username': username,
        'email': email,
        'name': name,
        'role': role,
        'branchId': branchId,
        'branches': branches.map((b) => b.toJson()).toList(),
      };
}
