import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../core/api/retaj_api_client.dart';
import '../services/checkout_service.dart';
import '../state/auth_session.dart';
import '../state/pos_state.dart';

class CartCheckoutScreen extends StatefulWidget {
  const CartCheckoutScreen({super.key});

  @override
  State<CartCheckoutScreen> createState() => _CartCheckoutScreenState();
}

class _CartCheckoutScreenState extends State<CartCheckoutScreen> {
  final _discountCtrl = TextEditingController(text: '0');
  String _payment = 'cash';
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _discountCtrl.dispose();
    super.dispose();
  }

  Future<void> _checkout() async {
    final pos = context.read<PosState>();
    if (pos.lines.isEmpty) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    final discount = double.tryParse(_discountCtrl.text.replaceAll(',', '.')) ?? 0;
    pos.setDiscount(discount);

    final payload = <String, dynamic>{
      'discount': discount,
      'paymentMethod': _payment,
      'lineItems': pos.lines
          .map(
            (l) => {
              'productId': l.productId,
              'quantity': l.quantity,
            },
          )
          .toList(),
      if (pos.warehouseId != null) 'warehouseId': pos.warehouseId,
    };

    try {
      final checkout = context.read<CheckoutService>();
      final result = await checkout.submit(payload);
      if (!mounted) return;
      if (result.queuedId != null) {
        pos.clearCart();
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Saved offline (queue #${result.queuedId!.substring(0, 8)})'),
          ),
        );
        context.go('/');
        return;
      }
      final tx = result.transaction!;
      pos.clearCart();
      context.go('/receipt/${tx.id}');
    } on RetajApiException catch (e) {
      setState(() => _error = e.message);
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final pos = context.watch<PosState>();
    final auth = context.watch<AuthSession>();

    return Scaffold(
      appBar: AppBar(
        title: const Text('Cart & checkout'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.pop(),
        ),
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text('Cashier: ${auth.user?.name ?? ""}', style: Theme.of(context).textTheme.titleSmall),
          const SizedBox(height: 16),
          ...pos.lines.map(
            (l) => Card(
              child: ListTile(
                title: Text(l.name),
                subtitle: Text('${l.unitPrice.toStringAsFixed(2)} × ${l.quantity}'),
                trailing: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    IconButton(
                      icon: const Icon(Icons.remove_circle_outline),
                      onPressed: () {
                        pos.setLineQuantity(l.productId, l.quantity - 1);
                      },
                    ),
                    Text('${l.quantity}'),
                    IconButton(
                      icon: const Icon(Icons.add_circle_outline),
                      onPressed: () {
                        pos.setLineQuantity(l.productId, l.quantity + 1);
                      },
                    ),
                  ],
                ),
              ),
            ),
          ),
          const SizedBox(height: 16),
          TextField(
            controller: _discountCtrl,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            decoration: const InputDecoration(
              labelText: 'Discount (SAR)',
              border: OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 16),
          Text('Payment', style: Theme.of(context).textTheme.titleSmall),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            children: ['cash', 'card', 'wallet', 'split'].map((m) {
              final sel = _payment == m;
              return ChoiceChip(
                label: Text(m),
                selected: sel,
                onSelected: (_) => setState(() => _payment = m),
              );
            }).toList(),
          ),
          const SizedBox(height: 24),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  _row('Subtotal', pos.subtotal),
                  _row('Discount', pos.discount),
                  _row('Tax (15%)', pos.tax),
                  const Divider(),
                  _row('Total', pos.total, bold: true),
                ],
              ),
            ),
          ),
          if (_error != null) ...[
            const SizedBox(height: 12),
            Text(_error!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
          ],
          const SizedBox(height: 24),
          FilledButton(
            onPressed: pos.lines.isEmpty || _busy ? null : _checkout,
            child: _busy
                ? const SizedBox(
                    height: 22,
                    width: 22,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Text('Complete sale'),
          ),
        ],
      ),
    );
  }

  Widget _row(String label, double v, {bool bold = false}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label),
          Text(
            '${v.toStringAsFixed(2)} SAR',
            style: bold ? const TextStyle(fontWeight: FontWeight.bold, fontSize: 18) : null,
          ),
        ],
      ),
    );
  }
}
