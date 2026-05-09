import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../services/checkout_service.dart';

/// Syncs queued offline sales when connectivity returns or app resumes.
class SyncListener extends StatefulWidget {
  const SyncListener({super.key, required this.child});

  final Widget child;

  @override
  State<SyncListener> createState() => _SyncListenerState();
}

class _SyncListenerState extends State<SyncListener> with WidgetsBindingObserver {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    Connectivity().onConnectivityChanged.listen((_) {
      WidgetsBinding.instance.addPostFrameCallback((_) => _sync());
    });
    WidgetsBinding.instance.addPostFrameCallback((_) => _sync());
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      _sync();
    }
  }

  void _sync() {
    if (!mounted) return;
    final checkout = context.read<CheckoutService>();
    checkout.syncPendingQueue();
  }

  @override
  Widget build(BuildContext context) => widget.child;
}
