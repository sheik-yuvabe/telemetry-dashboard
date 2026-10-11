import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;

const mentorBackend = String.fromEnvironment(
  'API_BASE_URL',
  defaultValue: 'https://aipbc.vercel.app',
);
final mentorSession = MentorSession();

abstract class SessionVault {
  Future<String?> read();
  Future<void> write(String value);
  Future<void> delete();
}

class SecureSessionVault implements SessionVault {
  final storage = const FlutterSecureStorage();
  String get key => 'mentor-session:$mentorBackend';
  @override
  Future<String?> read() => storage.read(key: key);
  @override
  Future<void> write(String value) => storage.write(key: key, value: value);
  @override
  Future<void> delete() => storage.delete(key: key);
}

class SignInRequired implements Exception {
  @override
  String toString() => 'Please sign in to continue.';
}

class MentorSession extends ChangeNotifier {
  final SessionVault vault;
  final http.Client client;
  final String baseUrl;
  Map<String, dynamic>? _session;
  Future<void>? _refreshing;
  bool ready = false;
  String? restoreError;
  int _generation = 0;
  MentorSession({
    SessionVault? vault,
    http.Client? client,
    this.baseUrl = mentorBackend,
  }) : vault = vault ?? SecureSessionVault(),
       client = client ?? http.Client();
  bool get signedIn => _session != null;
  String get email => _session?['user']?['email'] ?? '';

  Uri _uri(String path) {
    final base = Uri.parse(baseUrl);
    if (base.scheme != 'https' &&
        !(base.scheme == 'http' &&
            ['127.0.0.1', 'localhost', '10.0.2.2'].contains(base.host))) {
      throw Exception('The app needs a secure server configuration.');
    }
    return base.resolve(path);
  }

  Map<String, dynamic> _body(http.Response response) {
    if (!(response.headers['content-type'] ?? '').contains(
      'application/json',
    )) {
      throw Exception(
        'The server needs the latest update. Please try again later.',
      );
    }
    return jsonDecode(response.body) as Map<String, dynamic>;
  }

  Future<http.Response> _post(
    String action,
    Map<String, dynamic> body, {
    String? access,
  }) => client
      .post(
        _uri('/api/auth/$action'),
        headers: {
          'Content-Type': 'application/json',
          'X-Mentor-Client': 'flutter',
          if (access != null) 'Authorization': 'Bearer $access',
        },
        body: jsonEncode(body),
      )
      .timeout(const Duration(seconds: 25));
  Future<void> _save(Map<String, dynamic> value, int generation) async {
    if (generation != _generation) return;
    final next = {
      ...value,
      'expires_at':
          DateTime.now().millisecondsSinceEpoch +
          ((value['expires_in'] as num).toInt() * 1000),
    };
    await vault.write(jsonEncode(next));
    if (generation != _generation) {
      await vault.delete();
      return;
    }
    _session = next;
  }

  Future<void> restore() async {
    ready = false;
    restoreError = null;
    notifyListeners();
    try {
      final saved = await vault.read();
      if (saved != null) {
        try {
          _session = jsonDecode(saved) as Map<String, dynamic>;
        } catch (_) {
          await clear();
        }
        if (_session != null) {
          final response = await request('/api/auth/session');
          if (response.statusCode != 200) {
            throw Exception('Could not restore your session.');
          }
        }
      }
    } on SignInRequired {
      /* Return to sign-in when expired or revoked. */
    } catch (_) {
      _session = null;
      restoreError =
          'Could not connect. Check your internet connection and try again.';
    }
    ready = true;
    notifyListeners();
  }

  Future<void> signIn(String email, String password) async {
    final generation = ++_generation;
    final response = await _post('sign-in', {
      'email': email.trim(),
      'password': password,
    });
    final body = _body(response);
    if (response.statusCode != 200) {
      throw Exception(body['message'] ?? 'Could not sign in.');
    }
    await _save(Map<String, dynamic>.from(body['session']), generation);
    ready = true;
    restoreError = null;
    notifyListeners();
  }

  Future<void> refresh() =>
      _refreshing ??= _refresh().whenComplete(() => _refreshing = null);
  Future<void> _refresh() async {
    final generation = _generation;
    final token = _session?['refresh_token'];
    if (token == null) throw SignInRequired();
    final response = await _post('refresh', {'refresh_token': token});
    final body = _body(response);
    if ([401, 403].contains(response.statusCode)) {
      await clear();
      throw SignInRequired();
    }
    if (response.statusCode != 200) {
      throw Exception(body['message'] ?? 'Could not refresh your session.');
    }
    await _save(Map<String, dynamic>.from(body['session']), generation);
  }

  Future<http.Response> request(
    String path, {
    bool post = false,
    Map<String, dynamic>? body,
    Duration timeout = const Duration(seconds: 30),
  }) async {
    if (_session == null) throw SignInRequired();
    if ((_session?['expires_at'] as num? ?? 0) <
        DateTime.now().millisecondsSinceEpoch + 30000) {
      await refresh();
    }
    Future<http.Response> send() {
      if (_session == null) throw SignInRequired();
      final headers = {
        'Authorization': 'Bearer ${_session!['access_token']}',
        'Content-Type': 'application/json',
        'X-Mentor-Client': 'flutter',
      };
      return (post
              ? client.post(
                  _uri(path),
                  headers: headers,
                  body: jsonEncode(body ?? {}),
                )
              : client.get(_uri(path), headers: headers))
          .timeout(timeout);
    }

    var response = await send();
    if (response.statusCode == 401) {
      await refresh();
      if (_session == null) throw SignInRequired();
      response = await send();
    }
    if ([401, 403].contains(response.statusCode)) {
      await clear();
      throw SignInRequired();
    }
    return response;
  }

  Future<void> changePassword(String current, String next) async {
    final response = await request(
      '/api/auth/password',
      post: true,
      body: {'currentPassword': current, 'password': next},
    );
    if (response.statusCode != 200) {
      throw Exception(
        _body(response)['message'] ?? 'Could not update password.',
      );
    }
  }

  Future<void> signOut() async {
    try {
      await request('/api/auth/sign-out', post: true);
    } on SignInRequired {
      /* Already signed out. */
    } finally {
      await clear();
    }
  }

  Future<void> clear() async {
    _generation++;
    _session = null;
    await vault.delete();
    notifyListeners();
  }
}
