import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/material.dart';

class OfflineBannerHost extends StatefulWidget {
  const OfflineBannerHost({super.key, required this.child});

  final Widget child;

  @override
  State<OfflineBannerHost> createState() => _OfflineBannerHostState();
}

class _OfflineBannerHostState extends State<OfflineBannerHost> {
  bool _offline = false;

  @override
  void initState() {
    super.initState();
    _check();
    Connectivity().onConnectivityChanged.listen((_) => _check());
  }

  Future<void> _check() async {
    final list = await Connectivity().checkConnectivity();
    final off = list.contains(ConnectivityResult.none);
    if (mounted) setState(() => _offline = off);
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (_offline)
          Material(
            color: Theme.of(context).colorScheme.errorContainer,
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              child: Row(
                children: [
                  Icon(Icons.wifi_off_rounded, color: Theme.of(context).colorScheme.onErrorContainer),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'Offline mode active — sales queue locally and sync automatically when online.',
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: Theme.of(context).colorScheme.onErrorContainer,
                          ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        Expanded(child: widget.child),
      ],
    );
  }
}
