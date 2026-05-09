import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../core/api/retaj_api_client.dart';
import '../core/cache/product_catalog_cache.dart';
import '../models/product.dart';
import '../state/auth_session.dart';
import '../state/pos_state.dart';
import '../widgets/offline_banner.dart';

class PosHomeScreen extends StatefulWidget {
  const PosHomeScreen({super.key});

  @override
  State<PosHomeScreen> createState() => _PosHomeScreenState();
}

class _PosHomeScreenState extends State<PosHomeScreen> {
  final _search = TextEditingController();
  String _query = '';

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    final auth = context.read<AuthSession>();
    final pos = context.read<PosState>();
    final api = context.read<RetajApiClient>();
    final bid = auth.user?.branchId;
    if (bid == null) return;

    pos.setCatalogLoading(true);
    try {
      final wh = await api.fetchWarehouses();
      pos.setWarehouses(wh);
      final wid = pos.warehouseId;
      List<Product> list = [];
      try {
        list = await api.fetchProducts(warehouseId: wid);
      } catch (_) {
        final cached = await ProductCatalogCache.load(branchId: bid, warehouseId: wid);
        if (cached != null) {
          list = cached.map((e) => Product.fromJson(e)).toList();
        }
      }
      pos.setProducts(list);
      if (list.isNotEmpty) {
        await ProductCatalogCache.save(
          branchId: bid,
          warehouseId: wid,
          productsJson: list.map((p) => _productToJson(p)).toList(),
        );
      }
    } finally {
      if (mounted) pos.setCatalogLoading(false);
    }
  }

  Map<String, dynamic> _productToJson(Product p) => {
        'id': p.id,
        'sku': p.sku,
        'barcode': p.barcode,
        'name': p.name,
        'category': p.category,
        'price': p.price,
        'stockQty': p.stockQty,
      };

  List<Product> _filtered(List<Product> all) {
    final q = _query.trim().toLowerCase();
    if (q.isEmpty) return all;
    return all.where((p) {
      return p.name.toLowerCase().contains(q) ||
          p.sku.toLowerCase().contains(q) ||
          (p.barcode?.toLowerCase().contains(q) ?? false);
    }).toList();
  }

  @override
  Widget build(BuildContext context) {
    final pos = context.watch<PosState>();
    final auth = context.watch<AuthSession>();
    final filtered = _filtered(pos.products);

    return Scaffold(
      appBar: AppBar(
        leadingWidth: 48,
        leading: Padding(
          padding: const EdgeInsets.all(8),
          child: SvgPicture.asset(
            'assets/brand/retaj-logo.svg',
            fit: BoxFit.contain,
          ),
        ),
        title: const Text('POS'),
        actions: [
          IconButton(
            tooltip: 'Settings',
            onPressed: () => context.push('/settings'),
            icon: const Icon(Icons.settings_outlined),
          ),
          IconButton(
            tooltip: 'Cart',
            onPressed: () => context.push('/cart'),
            icon: Badge(
              isLabelVisible: pos.lineCount > 0,
              label: Text('${pos.lineCount}'),
              child: const Icon(Icons.shopping_cart_outlined),
            ),
          ),
        ],
      ),
      body: OfflineBannerHost(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      auth.user?.name ?? '',
                      style: Theme.of(context).textTheme.titleSmall,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  if (pos.warehouses.isNotEmpty)
                    DropdownButton<String>(
                      value: pos.warehouseId,
                      items: pos.warehouses
                          .map(
                            (w) => DropdownMenuItem(
                              value: w.id,
                              child: Text(
                                w.isDefault ? '${w.name} ★' : w.name,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                          )
                          .toList(),
                      onChanged: (v) async {
                        if (v == null) return;
                        pos.setWarehouseId(v);
                        await _load();
                      },
                    ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(16),
              child: TextField(
                controller: _search,
                decoration: const InputDecoration(
                  hintText: 'Search products',
                  prefixIcon: Icon(Icons.search),
                  border: OutlineInputBorder(),
                ),
                onChanged: (v) => setState(() => _query = v),
              ),
            ),
            Expanded(
              child: pos.catalogLoading && pos.products.isEmpty
                  ? const Center(child: CircularProgressIndicator())
                  : ListView.builder(
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      itemCount: filtered.length,
                      itemBuilder: (context, i) {
                        final p = filtered[i];
                        final disabled = p.stockQty <= 0;
                        return Card(
                          child: ListTile(
                            title: Text(p.name),
                            subtitle: Text(
                              '${p.sku} · ${p.stockQty} in stock · ${p.price.toStringAsFixed(2)} SAR',
                              maxLines: 2,
                            ),
                            trailing: FilledButton.tonal(
                              onPressed: disabled
                                  ? null
                                  : () {
                                      context.read<PosState>().addProduct(p);
                                      ScaffoldMessenger.of(context).showSnackBar(
                                        SnackBar(
                                          content: Text('Added ${p.name}'),
                                          duration: const Duration(milliseconds: 900),
                                        ),
                                      );
                                    },
                              child: const Text('Add'),
                            ),
                            onTap: disabled
                                ? null
                                : () {
                                    context.read<PosState>().addProduct(p);
                                  },
                          ),
                        );
                      },
                    ),
            ),
          ],
        ),
      ),
      floatingActionButton: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          FloatingActionButton.extended(
            heroTag: 'scan',
            onPressed: () => context.push('/scan'),
            icon: const Icon(Icons.qr_code_scanner_rounded),
            label: const Text('Scan'),
          ),
          const SizedBox(height: 12),
          FloatingActionButton.extended(
            heroTag: 'cart2',
            onPressed: () => context.push('/cart'),
            icon: const Icon(Icons.payment_rounded),
            label: const Text('Checkout'),
          ),
        ],
      ),
    );
  }
}
