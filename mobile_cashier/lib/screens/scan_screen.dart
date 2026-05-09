import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'package:provider/provider.dart';

import '../core/api/retaj_api_client.dart';
import '../state/pos_state.dart';

class ScanScreen extends StatefulWidget {
  const ScanScreen({super.key});

  @override
  State<ScanScreen> createState() => _ScanScreenState();
}

class _ScanScreenState extends State<ScanScreen> {
  final MobileScannerController _controller = MobileScannerController(
    detectionSpeed: DetectionSpeed.unrestricted,
    formats: const [
      BarcodeFormat.ean13,
      BarcodeFormat.ean8,
      BarcodeFormat.qrCode,
      BarcodeFormat.code128,
    ],
  );

  String? _lastCode;
  DateTime? _lastAt;
  static const _debounceMs = 350;

  String? _message;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _onDetect(BarcodeCapture cap) async {
    final bars = cap.barcodes;
    if (bars.isEmpty) return;
    final raw = bars.first.rawValue;
    if (raw == null || raw.isEmpty) return;
    final code = raw.trim();
    final now = DateTime.now();
    if (_lastCode == code &&
        _lastAt != null &&
        now.difference(_lastAt!).inMilliseconds < _debounceMs) {
      return;
    }
    _lastCode = code;
    _lastAt = now;

    if (!mounted) return;
    final api = context.read<RetajApiClient>();
    final pos = context.read<PosState>();
    setState(() => _message = null);
    try {
      final p = await api.lookupProduct(code, warehouseId: pos.warehouseId);
      if (p.stockQty <= 0) {
        setState(() => _message = 'Out of stock');
        return;
      }
      pos.addProduct(p);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Added ${p.name}')),
      );
    } catch (e) {
      setState(() => _message = e.toString());
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Scan barcode'),
        leading: IconButton(
          icon: const Icon(Icons.close),
          onPressed: () => context.pop(),
        ),
      ),
      body: SafeArea(
        child: Column(
          children: [
            Expanded(
              child: ClipRRect(
                borderRadius: BorderRadius.circular(12),
                child: MobileScanner(
                  controller: _controller,
                  onDetect: _onDetect,
                ),
              ),
            ),
            if (_message != null)
              Padding(
                padding: const EdgeInsets.all(12),
                child: Text(
                  _message!,
                  style: TextStyle(color: Theme.of(context).colorScheme.error),
                ),
              ),
            Padding(
              padding: const EdgeInsets.all(16),
              child: Text(
                'Point at EAN / UPC / QR. Items are debounced to avoid duplicates.',
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.bodySmall,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
