import 'package:flutter/material.dart';

/// Connection details are entered only during setup and stay in this session.
class WorkspaceConnectionPage extends StatefulWidget {
  final String endpoint;
  const WorkspaceConnectionPage({super.key, required this.endpoint});

  @override
  State<WorkspaceConnectionPage> createState() =>
      _WorkspaceConnectionPageState();
}

class _WorkspaceConnectionPageState extends State<WorkspaceConnectionPage> {
  final form = GlobalKey<FormState>();
  late final address = TextEditingController(text: widget.endpoint);
  final access = TextEditingController();

  @override
  void dispose() {
    address.dispose();
    access.dispose();
    super.dispose();
  }

  void connect() {
    if (!form.currentState!.validate()) return;
    Navigator.pop(context, {
      'endpoint': address.text.trim(),
      'token': access.text.trim(),
    });
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Workspace')),
    body: SafeArea(
      child: Align(
        alignment: Alignment.topCenter,
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 640),
          child: ListView(
            padding: const EdgeInsets.all(24),
            children: [
              Text(
                'Your student reports',
                style: Theme.of(context).textTheme.headlineSmall,
              ),
              const SizedBox(height: 12),
              const Text(
                'A live workspace brings your batches, student reports, projects, '
                'and recorded usage together on your phone and the web.',
              ),
              const SizedBox(height: 24),
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(20),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        widget.endpoint.isEmpty
                            ? 'You are exploring sample data'
                            : 'Live connection selected',
                        style: Theme.of(context).textTheme.titleMedium,
                      ),
                      const SizedBox(height: 8),
                      Text(
                        widget.endpoint.isEmpty
                            ? 'The students and reports in this preview are fictional. '
                                  'Connect your workspace below to see real records.'
                            : 'Return to the dashboard to view your connection status and reports.',
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 16),
              ExpansionTile(
                tilePadding: EdgeInsets.zero,
                title: const Text('Advanced connection setup'),
                subtitle: const Text('Connect to your live workspace'),
                children: [
                  Form(
                    key: form,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        const Text(
                          'Use the workspace address and mentor access code supplied '
                          'during setup. The code is kept only for this app session.',
                        ),
                        const SizedBox(height: 20),
                        TextFormField(
                          controller: address,
                          keyboardType: TextInputType.url,
                          autocorrect: false,
                          decoration: const InputDecoration(
                            labelText: 'Workspace address',
                            hintText: 'https://your-workspace.example',
                          ),
                          validator: (value) => (value ?? '').trim().isEmpty
                              ? 'Enter your workspace address.'
                              : null,
                        ),
                        const SizedBox(height: 16),
                        TextFormField(
                          controller: access,
                          obscureText: true,
                          enableSuggestions: false,
                          autocorrect: false,
                          decoration: const InputDecoration(
                            labelText: 'Mentor access code',
                          ),
                          validator: (value) => (value ?? '').trim().isEmpty
                              ? 'Enter your mentor access code.'
                              : null,
                          onFieldSubmitted: (_) => connect(),
                        ),
                        const SizedBox(height: 20),
                        FilledButton(
                          onPressed: connect,
                          child: const Text('Connect to live reports'),
                        ),
                        const SizedBox(height: 16),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 24),
              OutlinedButton(
                onPressed: () => Navigator.pop(context, <String, String>{}),
                child: Text(
                  widget.endpoint.isEmpty
                      ? 'Continue exploring sample data'
                      : 'Switch to sample data',
                ),
              ),
            ],
          ),
        ),
      ),
    ),
  );
}
