import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:yuvabe_mentor/mentor_session.dart';
import 'package:yuvabe_mentor/mentor_sign_in.dart';

class MemoryVault implements SessionVault {
  String? value;
  @override
  Future<String?> read() async => value;
  @override
  Future<void> write(String v) async {
    value = v;
  }

  @override
  Future<void> delete() async {
    value = null;
  }
}

Map<String, dynamic> session(String token) => {
  'access_token': token,
  'refresh_token': 'refresh',
  'expires_in': 3600,
  'user': {'email': 'mentor@example.com'},
};
http.Response json(Map<String, dynamic> body, [int status = 200]) =>
    http.Response(
      jsonEncode(body),
      status,
      headers: {'content-type': 'application/json'},
    );
void main() {
  test(
    'Restores and refreshes expired sessions without storing passwords',
    () async {
      final vault = MemoryVault();
      var refreshes = 0;
      final client = MockClient((r) async {
        if (r.url.path.endsWith('sign-in')) {
          return json({'ok': true, 'session': session('old')});
        }
        if (r.url.path.endsWith('refresh')) {
          refreshes++;
          return json({'ok': true, 'session': session('new')});
        }
        if (r.headers['Authorization'] == 'Bearer old') return json({}, 401);
        return json({
          'ok': true,
          'user': {'email': 'mentor@example.com'},
        });
      });
      final first = MentorSession(vault: vault, client: client);
      await first.signIn('mentor@example.com', 'private-password');
      expect(vault.value, isNot(contains('private-password')));
      final reopened = MentorSession(vault: vault, client: client);
      await reopened.restore();
      expect(reopened.signedIn, true);
      expect(refreshes, 1);
      expect(reopened.email, 'mentor@example.com');
    },
  );
  test('Concurrent expired requests share one refresh', () async {
    final vault = MemoryVault();
    vault.value = jsonEncode({
      ...session('old'),
      'expires_at': DateTime.now().millisecondsSinceEpoch + 3600000,
    });
    var refreshes = 0;
    final client = MockClient((r) async {
      if (r.url.path.endsWith('refresh')) {
        refreshes++;
        await Future<void>.delayed(const Duration(milliseconds: 10));
        return json({'ok': true, 'session': session('new')});
      }
      if (r.url.path != '/api/auth/session' &&
          r.headers['Authorization'] == 'Bearer old') {
        return json({}, 401);
      }
      return json({'ok': true});
    });
    final auth = MentorSession(vault: vault, client: client);
    await auth.restore();
    await Future.wait([
      auth.request('/api/workspace'),
      auth.request('/api/students/x/history'),
    ]);
    expect(refreshes, 1);
  });
  test('Revoked account clears persisted credentials', () async {
    final vault = MemoryVault();
    vault.value = jsonEncode({
      ...session('old'),
      'expires_at': DateTime.now().millisecondsSinceEpoch + 3600000,
    });
    final auth = MentorSession(
      vault: vault,
      client: MockClient((r) async => json({}, 403)),
    );
    await auth.restore();
    expect(auth.signedIn, false);
    expect(vault.value, null);
    expect(auth.ready, true);
  });
  test(
    'Network failure preserves saved session for retry; logout clears it',
    () async {
      final vault = MemoryVault();
      vault.value = jsonEncode({
        ...session('old'),
        'expires_at': DateTime.now().millisecondsSinceEpoch + 3600000,
      });
      final auth = MentorSession(
        vault: vault,
        client: MockClient((r) async => throw http.ClientException('offline')),
      );
      await auth.restore();
      expect(auth.restoreError, isNotNull);
      expect(vault.value, isNotNull);
      expect(auth.signedIn, false);
      await auth.signOut();
      expect(vault.value, null);
    },
  );
  testWidgets(
    'Phone sign-in has email and password, no address or shared token',
    (tester) async {
      tester.view.physicalSize = const Size(390, 844);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      await tester.pumpWidget(const MaterialApp(home: MentorSignIn()));
      await tester.pumpAndSettle();
      expect(find.text('Email'), findsOneWidget);
      expect(find.text('Password'), findsOneWidget);
      expect(find.text('Workspace address'), findsNothing);
      expect(find.text('Mentor access code'), findsNothing);
      await tester.tap(find.text('Sign in'));
      await tester.pumpAndSettle();
      expect(find.text('Enter your email.'), findsOneWidget);
      expect(tester.takeException(), isNull);
    },
  );
}
