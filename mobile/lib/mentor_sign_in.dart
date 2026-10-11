import 'package:flutter/material.dart';
import 'mentor_session.dart';

class MentorSignIn extends StatefulWidget {
  final VoidCallback? onSample;
  const MentorSignIn({super.key, this.onSample});
  @override
  State<MentorSignIn> createState() => _MentorSignInState();
}

class _MentorSignInState extends State<MentorSignIn> {
  final form = GlobalKey<FormState>();
  final email = TextEditingController(), password = TextEditingController();
  bool busy = false;
  String? error;
  @override
  void dispose() {
    email.dispose();
    password.dispose();
    super.dispose();
  }

  Future<void> signIn() async {
    if (!form.currentState!.validate()) return;
    setState(() {
      busy = true;
      error = null;
    });
    try {
      await mentorSession.signIn(email.text, password.text);
    } catch (e) {
      if (mounted) {
        setState(() => error = e.toString().replaceFirst('Exception: ', ''));
      }
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    body: SafeArea(
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 480),
          child: ListView(
            shrinkWrap: true,
            padding: const EdgeInsets.all(28),
            children: [
              Align(
                alignment: Alignment.centerLeft,
                child: Image.asset(
                  'assets/yuvabe-education-logo.png',
                  height: 64,
                ),
              ),
              const SizedBox(height: 28),
              Text(
                'A clearer view of every learner.',
                style: Theme.of(context).textTheme.headlineMedium,
              ),
              const SizedBox(height: 14),
              const Text(
                'Sign in to see your batches, student reports, and projects.',
              ),
              const SizedBox(height: 28),
              Form(
                key: form,
                child: AutofillGroup(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      TextFormField(
                        controller: email,
                        enabled: !busy,
                        keyboardType: TextInputType.emailAddress,
                        autofillHints: const [AutofillHints.username],
                        autocorrect: false,
                        decoration: const InputDecoration(labelText: 'Email'),
                        validator: (v) => (v ?? '').contains('@')
                            ? null
                            : 'Enter your email.',
                      ),
                      const SizedBox(height: 18),
                      TextFormField(
                        controller: password,
                        enabled: !busy,
                        obscureText: true,
                        autofillHints: const [AutofillHints.password],
                        autocorrect: false,
                        enableSuggestions: false,
                        decoration: const InputDecoration(
                          labelText: 'Password',
                        ),
                        validator: (v) =>
                            (v ?? '').isEmpty ? 'Enter your password.' : null,
                        onFieldSubmitted: (_) => busy ? null : signIn(),
                      ),
                      const SizedBox(height: 22),
                      if (error != null)
                        Padding(
                          padding: const EdgeInsets.only(bottom: 16),
                          child: Text(error!, semanticsLabel: error),
                        ),
                      FilledButton(
                        onPressed: busy ? null : signIn,
                        child: Text(busy ? 'Signing in…' : 'Sign in'),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 16),
              const Text(
                'Your session is remembered on this device. Need an account or password reset? Contact your course administrator.',
                style: TextStyle(fontSize: 13),
              ),
              if (widget.onSample != null)
                TextButton(
                  onPressed: busy ? null : widget.onSample,
                  child: const Text('Explore sample data'),
                ),
            ],
          ),
        ),
      ),
    ),
  );
}

class MentorAccountPage extends StatefulWidget {
  const MentorAccountPage({super.key});
  @override
  State<MentorAccountPage> createState() => _MentorAccountPageState();
}

class _MentorAccountPageState extends State<MentorAccountPage> {
  final current = TextEditingController(),
      next = TextEditingController(),
      confirm = TextEditingController();
  bool busy = false;
  String? message;
  @override
  void dispose() {
    current.dispose();
    next.dispose();
    confirm.dispose();
    super.dispose();
  }

  Future<void> change() async {
    if (next.text.length < 12 || next.text != confirm.text) {
      setState(
        () =>
            message = 'Use at least 12 characters and matching new passwords.',
      );
      return;
    }
    setState(() {
      busy = true;
      message = null;
    });
    try {
      await mentorSession.changePassword(current.text, next.text);
      current.clear();
      next.clear();
      confirm.clear();
      if (mounted) setState(() => message = 'Your password has been updated.');
    } catch (e) {
      if (mounted) {
        setState(() => message = e.toString().replaceFirst('Exception: ', ''));
      }
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Your account')),
    body: Center(
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 500),
        child: ListView(
          padding: const EdgeInsets.all(24),
          children: [
            Text(
              mentorSession.email,
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: 24),
            Text(
              'Change password',
              style: Theme.of(context).textTheme.titleLarge,
            ),
            const SizedBox(height: 20),
            for (final field in [
              (current, 'Current password'),
              (next, 'New password'),
              (confirm, 'Confirm new password'),
            ])
              Padding(
                padding: const EdgeInsets.only(bottom: 16),
                child: TextField(
                  controller: field.$1,
                  obscureText: true,
                  enableSuggestions: false,
                  autocorrect: false,
                  decoration: InputDecoration(labelText: field.$2),
                ),
              ),
            FilledButton(
              onPressed: busy ? null : change,
              child: const Text('Update password'),
            ),
            if (message != null)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 16),
                child: Text(message!),
              ),
            const SizedBox(height: 24),
            OutlinedButton(
              onPressed: busy
                  ? null
                  : () async {
                      try {
                        await mentorSession.signOut();
                      } catch (_) {
                        /* Local session is always cleared. */
                      }
                    },
              child: const Text('Sign out'),
            ),
          ],
        ),
      ),
    ),
  );
}
