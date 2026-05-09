import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import 'screens/cart_checkout_screen.dart';
import 'screens/login_screen.dart';
import 'screens/pos_home_screen.dart';
import 'screens/receipt_screen.dart';
import 'screens/scan_screen.dart';
import 'screens/settings_screen.dart';
import 'state/auth_session.dart';
import 'theme/app_theme.dart';
import 'widgets/sync_listener.dart';

class RetajCashierApp extends StatelessWidget {
  const RetajCashierApp({super.key, required this.auth, required this.router});

  final AuthSession auth;
  final GoRouter router;

  @override
  Widget build(BuildContext context) {
    return MaterialApp.router(
      title: 'RETAJ STORE',
      theme: AppTheme.light(),
      darkTheme: AppTheme.dark(),
      themeMode: ThemeMode.system,
      routerConfig: router,
      builder: (context, child) {
        return SyncListener(
          child: child ?? const SizedBox.shrink(),
        );
      },
    );
  }
}

GoRouter createRouter(AuthSession auth) {
  return GoRouter(
    refreshListenable: auth,
    initialLocation: '/',
    redirect: (context, state) {
      if (!auth.ready) return null;
      final loc = state.matchedLocation;
      final loggedIn = auth.isLoggedIn;
      if (!loggedIn && loc != '/login') return '/login';
      if (loggedIn && loc == '/login') return '/';
      return null;
    },
    routes: [
      GoRoute(
        path: '/login',
        builder: (context, state) => const LoginScreen(),
      ),
      GoRoute(
        path: '/',
        builder: (context, state) => const PosHomeScreen(),
      ),
      GoRoute(
        path: '/scan',
        builder: (context, state) => const ScanScreen(),
      ),
      GoRoute(
        path: '/cart',
        builder: (context, state) => const CartCheckoutScreen(),
      ),
      GoRoute(
        path: '/settings',
        builder: (context, state) => const SettingsScreen(),
      ),
      GoRoute(
        path: '/receipt/:tid',
        builder: (context, state) {
          final tid = state.pathParameters['tid'] ?? '';
          return ReceiptScreen(transactionId: tid);
        },
      ),
    ],
  );
}
