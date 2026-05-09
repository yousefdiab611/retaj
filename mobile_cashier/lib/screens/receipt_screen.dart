import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../core/api/retaj_api_client.dart';
import '../models/sale_transaction.dart' show InvoicePayload;

class ReceiptScreen extends StatefulWidget {
  const ReceiptScreen({super.key, required this.transactionId});

  final String transactionId;

  @override
  State<ReceiptScreen> createState() => _ReceiptScreenState();
}

class _ReceiptScreenState extends State<ReceiptScreen> {
  InvoicePayload? _data;
  String? _error;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load() async {
    try {
      final api = context.read<RetajApiClient>();
      final inv = await api.fetchInvoice(widget.transactionId);
      if (mounted) setState(() => _data = inv);
    } catch (e) {
      if (mounted) setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Receipt'),
        leading: IconButton(
          icon: const Icon(Icons.close),
          onPressed: () => context.go('/'),
        ),
      ),
      body: SafeArea(
        child: _loading
            ? const Center(child: CircularProgressIndicator())
            : _error != null
                ? Center(child: Text(_error!))
                : _data == null
                    ? const Center(child: Text('No data'))
                    : _buildReceipt(_data!),
      ),
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: FilledButton(
            onPressed: () => context.go('/'),
            child: const Text('New sale'),
          ),
        ),
      ),
    );
  }

  Widget _buildReceipt(InvoicePayload d) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          SvgPicture.asset(
            'assets/brand/retaj-logo.svg',
            height: 48,
            fit: BoxFit.contain,
          ),
          const SizedBox(height: 8),
          Text(
            d.storeName ?? 'RETAJ STORE',
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.headlineSmall,
          ),
          if (d.branchName != null)
            Text(d.branchName!, textAlign: TextAlign.center),
          if (d.warehouseName != null)
            Text('Warehouse: ${d.warehouseName}', textAlign: TextAlign.center),
          const SizedBox(height: 8),
          Text('Ref: ${d.reference}', textAlign: TextAlign.center),
          Text(
            d.createdAt,
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.bodySmall,
          ),
          const Divider(height: 32),
          ...d.lines.map(
            (l) => Padding(
              padding: const EdgeInsets.symmetric(vertical: 6),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: Text('${l.quantity}× ${l.name}'),
                  ),
                  Text('${l.lineTotal.toStringAsFixed(2)} ${d.currency ?? "SAR"}'),
                ],
              ),
            ),
          ),
          const Divider(height: 24),
          _r('Subtotal', d.subtotal, d.currency),
          _r('Discount', d.discount, d.currency),
          _r(d.taxLabel ?? 'Tax', d.tax, d.currency),
          const SizedBox(height: 8),
          _r('Total', d.total, d.currency, bold: true),
          if (d.thankYou != null) ...[
            const SizedBox(height: 24),
            Text(d.thankYou!, textAlign: TextAlign.center),
          ],
        ],
      ),
    );
  }

  Widget _r(String label, double v, String? cur, {bool bold = false}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label),
          Text(
            '${v.toStringAsFixed(2)} ${cur ?? "SAR"}',
            style: bold ? const TextStyle(fontWeight: FontWeight.bold, fontSize: 18) : null,
          ),
        ],
      ),
    );
  }
}
