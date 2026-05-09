import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../core/api/retaj_api_client.dart';
import '../core/config/app_config.dart';
import '../state/auth_session.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  late final TextEditingController _apiCtrl;
  bool _loading = true;
  String? _saved;

  @override
  void initState() {
    super.initState();
    _apiCtrl = TextEditingController();
    _load();
  }

  Future<void> _load() async {
    final url = await AppConfig.resolveApiBaseUrl();
    _apiCtrl.text = url;
    if (mounted) {
      setState(() {
        _saved = url;
        _loading = false;
      });
    }
  }

  @override
  void dispose() {
    _apiCtrl.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final v = _apiCtrl.text.trim();
    await AppConfig.setApiBaseUrl(v.isEmpty ? null : v);
    if (!mounted) return;
    await context.read<RetajApiClient>().invalidateBaseUrl();
    final resolved = await AppConfig.resolveApiBaseUrl();
    setState(() => _saved = resolved);
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('API base: $resolved')),
    );
  }

  Future<void> _logout() async {
    await context.read<AuthSession>().logout();
    if (!mounted) return;
    context.go('/login');
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Settings'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.pop(),
        ),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.all(20),
              children: [
                Text(
                  'API server',
                  style: Theme.of(context).textTheme.titleMedium,
                ),
                const SizedBox(height: 8),
                Text(
                  'Default uses emulator-friendly host. Override for device testing (same Wi‑Fi as server).',
                  style: Theme.of(context).textTheme.bodySmall,
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _apiCtrl,
                  decoration: const InputDecoration(
                    labelText: 'Base URL (no trailing slash)',
                    hintText: 'https://api.example.com',
                    border: OutlineInputBorder(),
                  ),
                  keyboardType: TextInputType.url,
                  autocorrect: false,
                ),
                if (_saved != null)
                  Padding(
                    padding: const EdgeInsets.only(top: 8),
                    child: Text('Active: $_saved', style: Theme.of(context).textTheme.bodySmall),
                  ),
                const SizedBox(height: 16),
                FilledButton.tonal(
                  onPressed: _save,
                  child: const Text('Save API URL'),
                ),
                const SizedBox(height: 32),
                const Divider(),
                ListTile(
                  title: const Text('Sign out'),
                  leading: const Icon(Icons.logout),
                  onTap: _logout,
                ),
              ],
            ),
    );
  }
}
