import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'app.dart';
import 'core/api/retaj_api_client.dart';
import 'core/storage/secure_session_store.dart';
import 'services/checkout_service.dart';
import 'state/auth_session.dart';
import 'state/pos_state.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  final secure = SecureSessionStore();
  final api = RetajApiClient(secureStore: secure);
  final auth = AuthSession(api: api, secure: secure);
  await auth.restore();

  final router = createRouter(auth);

  runApp(
    MultiProvider(
      providers: [
        Provider<SecureSessionStore>.value(value: secure),
        Provider<RetajApiClient>.value(value: api),
        ChangeNotifierProvider<AuthSession>.value(value: auth),
        ChangeNotifierProvider<PosState>(create: (_) => PosState()),
        Provider<CheckoutService>(
          create: (c) => CheckoutService(api: c.read<RetajApiClient>()),
        ),
      ],
      child: RetajCashierApp(auth: auth, router: router),
    ),
  );
}
