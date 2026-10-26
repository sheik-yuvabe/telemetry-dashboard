import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'brand.dart';
import 'workspace.dart';
import 'student_history.dart';
import 'mentor_session.dart';
import 'mentor_sign_in.dart';

class MentorApp extends StatefulWidget {
  final SharedPreferences preferences;
  final bool sampleMode;
  const MentorApp({
    super.key,
    required this.preferences,
    this.sampleMode = false,
  });
  @override
  State<MentorApp> createState() => _MentorAppState();
}

class _MentorAppState extends State<MentorApp> {
  late ThemeMode mode;
  late bool sample;
  @override
  void initState() {
    super.initState();
    sample = widget.sampleMode;
    if (!sample) mentorSession.restore();
    final saved = widget.preferences.getString('theme') ?? 'system';
    mode = ThemeMode.values.firstWhere(
      (m) => m.name == saved,
      orElse: () => ThemeMode.system,
    );
  }

  void changeTheme(ThemeMode next) {
    setState(() => mode = next);
    widget.preferences.setString('theme', next.name);
  }

  @override
  Widget build(BuildContext context) => AnimatedBuilder(
    animation: mentorSession,
    builder: (context, _) => MaterialApp(
      key: ValueKey(
        sample
            ? 'sample'
            : mentorSession.signedIn
            ? 'mentor'
            : 'signed-out',
      ),
      title: 'Yuvabe Mentor',
      debugShowCheckedModeBanner: false,
      theme: brandTheme(Brightness.light),
      darkTheme: brandTheme(Brightness.dark),
      themeMode: mode,
      onGenerateRoute: (settings) {
        final uri = Uri.tryParse(settings.name ?? '');
        if (uri != null &&
            uri.pathSegments.length == 2 &&
            uri.pathSegments.first == 'students') {
          return MaterialPageRoute<void>(
            settings: settings,
            builder: (_) => accessGate(
              StudentHistoryEntry(
                batch: uri.queryParameters['batch'] ?? 'batch-1',
                studentId: uri.pathSegments[1],
                sample: uri.queryParameters['demo'] == '1',
              ),
            ),
          );
        }
        return null;
      },
      home: accessGate(
        MentorHome(
          themeMode: mode,
          onTheme: changeTheme,
          sample: sample,
          onLeaveSample: () {
            setState(() => sample = false);
            mentorSession.restore();
          },
        ),
      ),
    ),
  );

  Widget accessGate(Widget child) {
    if (sample) return child;
    if (!mentorSession.ready) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }
    if (mentorSession.restoreError != null) {
      return Scaffold(
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(mentorSession.restoreError!),
                FilledButton(
                  onPressed: mentorSession.restore,
                  child: const Text('Try again'),
                ),
              ],
            ),
          ),
        ),
      );
    }
    if (!mentorSession.signedIn) {
      return MentorSignIn(onSample: () => setState(() => sample = true));
    }
    return child;
  }
}

const destinations = [
  'Overview',
  'Students',
  'Projects',
  'Token usage',
  'Accounts',
];
const destinationIcons = [
  Icons.dashboard_outlined,
  Icons.people_outline,
  Icons.folder_outlined,
  Icons.insights_outlined,
  Icons.layers_outlined,
];

class MentorHome extends StatefulWidget {
  final ThemeMode themeMode;
  final ValueChanged<ThemeMode> onTheme;
  final bool sample;
  final VoidCallback onLeaveSample;
  const MentorHome({
    super.key,
    required this.themeMode,
    required this.onTheme,
    required this.sample,
    required this.onLeaveSample,
  });
  @override
  State<MentorHome> createState() => _MentorHomeState();
}

class _MentorHomeState extends State<MentorHome> {
  final repository = WorkspaceRepository();
  final searchController = TextEditingController();
  Workspace? data;
  String batch = 'batch-2', through = '2026-10-10', query = '', status = 'all';
  String get endpoint => widget.sample ? '' : mentorSession.baseUrl;
  String? error;
  int tab = 0, requestId = 0;
  int? days;
  bool loading = true;
  @override
  void initState() {
    super.initState();
    load(resetDate: true);
  }

  @override
  void dispose() {
    searchController.dispose();
    super.dispose();
  }

  Future<void> load({bool resetDate = false}) async {
    final id = ++requestId;
    setState(() {
      loading = true;
      error = null;
      data = null;
    });
    try {
      final result = await repository.load(batch, endpoint: endpoint);
      if (!mounted || id != requestId) return;
      setState(() {
        data = result;
        loading = false;
        if (resetDate) {
          through = result.sample
              ? batch == 'batch-1'
                    ? '2026-03-18'
                    : '2026-10-10'
              : courseDate(DateTime.now());
        }
      });
    } catch (e) {
      if (mounted && id == requestId) {
        setState(() {
          loading = false;
          error = e.toString().replaceFirst('Exception: ', '');
        });
      }
    }
  }

  void switchBatch(String? value) {
    if (value == null || value == batch) return;
    setState(() {
      batch = value;
      query = '';
      status = 'all';
      days = null;
      searchController.clear();
    });
    load(resetDate: true);
  }

  List<Record> get students => data?.studentsIn(batch) ?? [];
  List<Record> get projects => data?.projectsIn(batch) ?? [];
  List<Record> get events =>
      data?.eventsIn(batch, through: through, days: days) ?? [];
  Map<String, Record> get latest =>
      data?.latestIn(batch, through: through, days: days) ?? {};
  List<Record> studentProjects(String id) =>
      projects.where((p) => p['studentId'] == id).toList();
  List<Record> studentEvents(String id) =>
      events.where((e) => e['studentId'] == id).toList();
  String usageLabel(List<Record> usage) =>
      usage.isEmpty ? 'Not recorded' : compact(tokenTotal(usage));
  String accountName(String? id) =>
      data?.accounts.where((a) => a['id'] == id).firstOrNull?['name'] ??
      'Unassigned account';
  String studentName(String id) =>
      students.where((s) => s['studentId'] == id).firstOrNull?['name'] ?? id;
  String get batchName =>
      data?.batches.where((b) => b['id'] == batch).firstOrNull?['name'] ??
      (batch == 'batch-2' ? 'Batch 2' : 'Batch 1');

  Future<void> connection() async {
    if (widget.sample) {
      widget.onLeaveSample();
      return;
    }
    await Navigator.of(
      context,
    ).push<void>(MaterialPageRoute(builder: (_) => const MentorAccountPage()));
  }

  Future<void> chooseDate() async {
    final date = await showDatePicker(
      context: context,
      initialDate: DateTime.parse(through),
      firstDate: DateTime(2020),
      lastDate: DateTime(2100),
    );
    if (date != null && mounted) {
      setState(
        () => through =
            '${date.year}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')}',
      );
    }
  }

  Future<void> exportUsage() async {
    String cell(dynamic value) {
      var text = '${value ?? ''}';
      if (RegExp(r'^\s*[=+@-]').hasMatch(text)) text = "'$text";
      return '"${text.replaceAll('"', '""')}"';
    }

    final rows = <List<dynamic>>[
      [
        'Batch',
        'Student',
        'Project',
        'Account',
        'Session',
        'Event',
        'Observed at',
        'Input',
        'Output',
        'Cached input',
        'Source',
        'Data mode',
      ],
      ...events.map(
        (e) => [
          e['batchId'],
          e['studentId'],
          e['projectId'],
          e['accountId'],
          e['sessionId'],
          e['eventId'],
          e['occurredAt'],
          e['inputTokens'],
          e['outputTokens'],
          e['cachedInputTokens'],
          e['source'],
          data!.sample ? 'sample' : 'live',
        ],
      ),
    ];
    await Clipboard.setData(
      ClipboardData(text: rows.map((r) => r.map(cell).join(',')).join('\r\n')),
    );
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'Usage CSV copied. Paste it into a spreadsheet or file.',
          ),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final wide = MediaQuery.sizeOf(context).width >= 1000;
    return Scaffold(
      appBar: AppBar(
        title: Row(
          children: [
            const BrandMark(),
            const SizedBox(width: 10),
            Flexible(
              child: Text(
                wide ? 'yuvabe / Mentor workspace' : 'yuvabe',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  fontWeight: FontWeight.w700,
                  fontSize: 19,
                ),
              ),
            ),
          ],
        ),
        actions: [
          PopupMenuButton<ThemeMode>(
            tooltip: 'Color theme',
            initialValue: widget.themeMode,
            icon: Icon(
              widget.themeMode == ThemeMode.dark
                  ? Icons.dark_mode_outlined
                  : Icons.brightness_6_outlined,
            ),
            onSelected: widget.onTheme,
            itemBuilder: (_) => ThemeMode.values
                .map(
                  (m) => CheckedPopupMenuItem(
                    value: m,
                    checked: m == widget.themeMode,
                    child: Text(
                      '${m.name[0].toUpperCase()}${m.name.substring(1)} theme',
                    ),
                  ),
                )
                .toList(),
          ),
          TextButton(
            onPressed: connection,
            child: Text(widget.sample ? 'Sign in' : 'Account'),
          ),
          const SizedBox(width: 8),
        ],
      ),
      bottomNavigationBar: wide
          ? null
          : NavigationBar(
              selectedIndex: tab,
              onDestinationSelected: (value) => setState(() {
                tab = value;
                query = '';
                status = 'all';
                searchController.clear();
              }),
              destinations: List.generate(
                5,
                (i) => NavigationDestination(
                  icon: Icon(destinationIcons[i]),
                  selectedIcon: Icon(
                    destinationIcons[i],
                    color: const Color(0xFF251441),
                  ),
                  label: i == 3 ? 'Usage' : destinations[i],
                ),
              ),
            ),
      body: Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (wide)
            NavigationRail(
              extended: true,
              selectedIndex: tab,
              minExtendedWidth: 220,
              groupAlignment: -.85,
              onDestinationSelected: (value) => setState(() {
                tab = value;
                query = '';
                status = 'all';
                searchController.clear();
              }),
              destinations: List.generate(
                5,
                (i) => NavigationRailDestination(
                  icon: Icon(destinationIcons[i]),
                  label: Text(destinations[i]),
                ),
              ),
            ),
          Expanded(
            child: loading
                ? const Center(child: CircularProgressIndicator())
                : error != null
                ? Center(
                    child: ConstrainedBox(
                      constraints: const BoxConstraints(maxWidth: 440),
                      child: Padding(
                        padding: const EdgeInsets.all(24),
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const Icon(Icons.cloud_off_outlined, size: 42),
                            const SizedBox(height: 20),
                            Text(error!, textAlign: TextAlign.center),
                            const SizedBox(height: 20),
                            FilledButton(
                              onPressed: load,
                              child: const Text('Try again'),
                            ),
                            TextButton(
                              onPressed: connection,
                              child: Text(
                                widget.sample ? 'Sign in' : 'Account',
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  )
                : RefreshIndicator(
                    onRefresh: load,
                    child: SingleChildScrollView(
                      physics: const AlwaysScrollableScrollPhysics(),
                      padding: EdgeInsets.all(wide ? 32 : 18),
                      child: Center(
                        child: ConstrainedBox(
                          constraints: const BoxConstraints(maxWidth: 1320),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              header(wide),
                              const SizedBox(height: 22),
                              if (tab == 0)
                                overview(wide)
                              else if (tab == 1)
                                studentView(wide)
                              else if (tab == 2)
                                projectView()
                              else if (tab == 3)
                                usageView(wide)
                              else
                                accountsView(),
                              const SizedBox(height: 32),
                              Text(
                                'Yuvabe Education · $batchName only · Dates in Asia/Kolkata',
                                style: Theme.of(context).textTheme.bodySmall,
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ),
          ),
        ],
      ),
    );
  }

  Widget header(bool wide) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Wrap(
        spacing: 16,
        runSpacing: 12,
        crossAxisAlignment: WrapCrossAlignment.center,
        children: [
          DropdownButton<String>(
            key: const Key('batch-selector'),
            value: batch,
            underline: const SizedBox(),
            items: data!.batches
                .map(
                  (b) => DropdownMenuItem<String>(
                    value: b['id'],
                    child: Text(
                      '${b['name']}${b['status'] == 'archived' ? ' · Archived' : ''}',
                      style: const TextStyle(fontWeight: FontWeight.w600),
                    ),
                  ),
                )
                .toList(),
            onChanged: switchBatch,
          ),
          Chip(
            avatar: Icon(
              data!.sample ? Icons.science_outlined : Icons.circle,
              size: 15,
            ),
            label: Text(data!.sample ? 'Sample workspace' : 'Live workspace'),
          ),
        ],
      ),
      const SizedBox(height: 14),
      Text(
        [
          'A little clarity.\nA better learning day.',
          'Every learner, in focus.',
          'Ideas becoming real products.',
          'Understand where the tokens go.',
          'Shared access.\nIndividual visibility.',
        ][tab],
        style: Theme.of(context).textTheme.headlineMedium?.copyWith(
          fontWeight: FontWeight.w600,
          letterSpacing: -.8,
          height: 1.15,
        ),
      ),
      const SizedBox(height: 12),
      Text(
        '$batchName · ${students.length} enrolled students · AI Product Builder',
        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
          color: Theme.of(context).colorScheme.onSurfaceVariant,
        ),
      ),
      const SizedBox(height: 20),
      if (data!.sample)
        const Notice(
          text:
              'Sample data: these names, projects, and token counts demonstrate the workspace. They are not real student usage.',
        ),
      if (data!.eventsIn(batch, through: through, days: days).any(
        (event) => event['source'] == 'codex-vscode-primary-local-v1',
      ))
        const Notice(
          text: 'Partial token coverage: primary VS Code sessions only. Initial baselines, ambiguous project intervals and separate child sessions are excluded. Recorded totals are not complete account consumption.',
        ),
      if (data!.setupRequired)
        const Notice(
          text:
              'The live workspace needs the Batch 2 database migration and your real roster. No sample records are being mixed into it.',
        ),
      Wrap(
        spacing: 12,
        runSpacing: 8,
        crossAxisAlignment: WrapCrossAlignment.center,
        children: [
          OutlinedButton.icon(
            onPressed: chooseDate,
            icon: const Icon(Icons.calendar_today_outlined, size: 16),
            label: Text('Through $through'),
          ),
          DropdownButton<int>(
            value: days ?? 0,
            underline: const SizedBox(),
            items: const [
              DropdownMenuItem(value: 0, child: Text('All recorded time')),
              DropdownMenuItem(value: 7, child: Text('Last 7 days')),
              DropdownMenuItem(value: 30, child: Text('Last 30 days')),
            ],
            onChanged: (value) =>
                setState(() => days = value == 0 ? null : value),
          ),
          if (tab == 3)
            OutlinedButton.icon(
              onPressed: events.isEmpty ? null : exportUsage,
              icon: const Icon(Icons.copy_outlined, size: 16),
              label: const Text('Copy usage CSV'),
            ),
        ],
      ),
    ],
  );

  Widget overview(bool wide) {
    final attention = students
        .where((s) => latest[s['studentId']]?['understandingStatus'] == 'stuck')
        .toList();
    final tracked = events
        .where((e) => e['studentId'] != null)
        .map((e) => e['studentId'])
        .toSet()
        .length;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        TileGrid(
          minWidth: 165,
          children: [
            MetricTile(
              label: 'Enrolled students',
              value: '${students.length}',
              detail: '${latest.length} with learning reports',
              icon: Icons.people_outline,
            ),
            MetricTile(
              label: 'Projects in motion',
              value:
                  '${projects.where((p) => p['status'] != 'shipped').length}',
              detail:
                  '${projects.where((p) => p['status'] == 'shipped').length} shipped',
              icon: Icons.folder_outlined,
            ),
            MetricTile(
              label: 'Recorded tokens',
              value: events.isEmpty ? '—' : compact(tokenTotal(events)),
              detail: '$tracked students with usage',
              icon: Icons.insights_outlined,
            ),
            MetricTile(
              label: 'Need attention',
              value: '${attention.length}',
              detail:
                  '${students.where((s) => !latest.containsKey(s['studentId'])).length} without reports',
              icon: Icons.flag_outlined,
              highlight: true,
            ),
          ],
        ),
        const SizedBox(height: 22),
        TileGrid(
          minWidth: wide ? 420 : 600,
          children: [
            Panel(
              title: 'Building momentum',
              subtitle: 'Recorded tokens · seven days through $through',
              child: tokenChart(),
            ),
            Panel(
              title: 'A good place to step in',
              subtitle: 'Latest reports that need mentor support',
              child: attention.isEmpty
                  ? const EmptyState(
                      title: 'No students marked as stuck',
                      detail: 'Missing reports are not evidence of progress.',
                    )
                  : Column(
                      children: attention
                          .take(3)
                          .map(
                            (s) => ListTile(
                              contentPadding: EdgeInsets.zero,
                              leading: StudentAvatar(name: s['name']),
                              title: Text(s['name']),
                              subtitle: Padding(
                                padding: const EdgeInsets.only(top: 5),
                                child: Text(
                                  latest[s['studentId']]?['recommendedTutorAction'] ??
                                      'Review this student’s progress.',
                                ),
                              ),
                              trailing: const Icon(
                                Icons.arrow_forward,
                                size: 18,
                              ),
                              onTap: () => openStudent(s),
                            ),
                          )
                          .toList(),
                    ),
            ),
          ],
        ),
        const SizedBox(height: 22),
        Panel(
          title: 'The people behind the projects',
          subtitle: 'Current projects and latest learning signals',
          action: TextButton(
            onPressed: () => setState(() => tab = 1),
            child: const Text('View all'),
          ),
          child: students.isEmpty
              ? const EmptyState(
                  title: 'Your batch starts here',
                  detail:
                      'Add enrolled students and their projects to the backend.',
                )
              : Column(children: students.take(5).map(studentCard).toList()),
        ),
      ],
    );
  }

  Widget tokenChart() {
    final dates = List.generate(
      7,
      (i) => DateTime.parse(
        '${through}T00:00:00Z',
      ).subtract(Duration(days: 6 - i)).toIso8601String().substring(0, 10),
    );
    final values = dates
        .map(
          (date) => tokenTotal(
            events.where(
              (e) => courseDate(DateTime.parse(e['occurredAt'])) == date,
            ),
          ),
        )
        .toList();
    final max = values.fold<int>(1, (a, b) => a > b ? a : b);
    return SizedBox(
      height: 218,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: List.generate(
          7,
          (i) => Expanded(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 5),
              child: Semantics(
                label: '${dates[i]}: ${values[i]} tokens',
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.end,
                  children: [
                    Text(
                      values[i] == 0 ? '—' : compact(values[i]),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.labelSmall,
                    ),
                    const SizedBox(height: 8),
                    Container(
                      height: values[i] == 0 ? 2 : 145 * values[i] / max,
                      decoration: BoxDecoration(
                        color: i == 6
                            ? brandPrimary
                            : Theme.of(context).brightness == Brightness.dark
                            ? const Color(0xFF7852BF)
                            : const Color(0xFFC5AFF0),
                        borderRadius: const BorderRadius.vertical(
                          top: Radius.circular(7),
                        ),
                      ),
                    ),
                    const SizedBox(height: 10),
                    Text(
                      dates[i].substring(5),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.labelSmall,
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget search({required String hint}) => TextField(
    controller: searchController,
    onChanged: (value) => setState(() => query = value.toLowerCase()),
    decoration: InputDecoration(
      prefixIcon: const Icon(Icons.search),
      hintText: hint,
      isDense: true,
    ),
  );

  Widget studentView(bool wide) {
    final visible = students
        .where(
          (s) =>
              '${s['name']} ${s['studentId']} ${studentProjects(s['studentId']).map((p) => p['name']).join(' ')}'
                  .toLowerCase()
                  .contains(query) &&
              (status == 'all' ||
                  (latest[s['studentId']]?['understandingStatus'] ??
                          'missing') ==
                      status),
        )
        .toList();
    return Column(
      children: [
        search(hint: 'Search students or projects'),
        const SizedBox(height: 12),
        Align(
          alignment: Alignment.centerLeft,
          child: DropdownButton<String>(
            value: status,
            isExpanded: !wide,
            items: const [
              DropdownMenuItem(
                value: 'all',
                child: Text(
                  'All learning statuses',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              DropdownMenuItem(value: 'clear', child: Text('On track')),
              DropdownMenuItem(value: 'partial', child: Text('Check in')),
              DropdownMenuItem(value: 'stuck', child: Text('Needs support')),
              DropdownMenuItem(value: 'missing', child: Text('No report')),
            ],
            onChanged: (value) => setState(() => status = value!),
          ),
        ),
        const SizedBox(height: 12),
        Panel(
          title: 'Students · ${visible.length}',
          subtitle:
              'Project completion and learning progress are separate measures.',
          child: visible.isEmpty
              ? const EmptyState(
                  title: 'No matching students',
                  detail: 'Try a different search or add the batch roster.',
                )
              : Column(children: visible.map(studentCard).toList()),
        ),
      ],
    );
  }

  Widget studentCard(Record student) {
    final id = student['studentId'] as String;
    final ownProjects = studentProjects(id);
    final project =
        ownProjects.where((p) => p['status'] != 'shipped').firstOrNull ??
        ownProjects.firstOrNull;
    return InkWell(
      borderRadius: BorderRadius.circular(12),
      onTap: () => openStudent(student),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 14),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            StudentAvatar(name: student['name']),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    student['name'],
                    style: const TextStyle(fontWeight: FontWeight.w600),
                  ),
                  const SizedBox(height: 5),
                  Text(
                    project?['name'] ?? 'No project assigned',
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                  const SizedBox(height: 10),
                  Wrap(
                    spacing: 10,
                    runSpacing: 6,
                    crossAxisAlignment: WrapCrossAlignment.center,
                    children: [
                      StatusBadge(
                        status: latest[id]?['understandingStatus'] ?? 'missing',
                      ),
                      Text(
                        '${usageLabel(studentEvents(id))}${studentEvents(id).isEmpty ? '' : ' tokens'}',
                        style: Theme.of(context).textTheme.labelSmall,
                      ),
                    ],
                  ),
                ],
              ),
            ),
            const Icon(Icons.chevron_right, size: 20),
          ],
        ),
      ),
    );
  }

  Widget projectView() {
    final visible = projects
        .where(
          (p) => '${p['name']} ${studentName(p['studentId'])}'
              .toLowerCase()
              .contains(query),
        )
        .toList();
    return Column(
      children: [
        search(hint: 'Find a project or student'),
        const SizedBox(height: 20),
        visible.isEmpty
            ? const EmptyState(
                title: 'No matching projects',
                detail: 'Projects belong to a specific student and batch.',
              )
            : TileGrid(
                minWidth: 290,
                children: visible.map(projectCard).toList(),
              ),
      ],
    );
  }

  Widget projectCard(Record project) {
    final usage = events.where((e) => e['projectId'] == project['id']).toList();
    return Panel(
      title: project['name'],
      subtitle: project['description'] ?? '',
      action: StatusBadge(status: project['status']),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            studentName(project['studentId']),
            style: const TextStyle(fontWeight: FontWeight.w600),
          ),
          const SizedBox(height: 20),
          Row(
            children: [
              const Expanded(child: Text('Project progress')),
              Text('${project['progress']}%'),
            ],
          ),
          const SizedBox(height: 10),
          LinearProgressIndicator(
            value: (project['progress'] as num) / 100,
            minHeight: 6,
            borderRadius: BorderRadius.circular(8),
          ),
          const SizedBox(height: 20),
          Row(
            children: [
              const Icon(Icons.insights_outlined, size: 18),
              const SizedBox(width: 8),
              Text('${usageLabel(usage)}${usage.isEmpty ? '' : ' tokens'}'),
            ],
          ),
          if (project['repositoryUrl'] != null)
            Padding(
              padding: const EdgeInsets.only(top: 12),
              child: SelectableText(
                project['repositoryUrl'],
                style: Theme.of(context).textTheme.bodySmall,
              ),
            ),
        ],
      ),
    );
  }

  Widget usageView(bool wide) {
    final unassigned = events.where((e) => e['studentId'] == null).toList();
    int sum(String field) =>
        events.fold(0, (total, e) => total + (e[field] as num).toInt());
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        TileGrid(
          minWidth: 165,
          children: [
            MetricTile(
              label: 'Total recorded',
              value: usageLabel(events),
              detail: 'Input + output tokens',
              icon: Icons.insights_outlined,
            ),
            MetricTile(
              label: 'Input tokens',
              value: events.isEmpty ? '—' : compact(sum('inputTokens')),
              detail: 'Cached input included',
              icon: Icons.input_outlined,
            ),
            MetricTile(
              label: 'Output tokens',
              value: events.isEmpty ? '—' : compact(sum('outputTokens')),
              detail: 'Recorded model output',
              icon: Icons.output_outlined,
            ),
            MetricTile(
              label: 'Unattributed',
              value: events.isEmpty ? '—' : compact(tokenTotal(unassigned)),
              detail: 'Account level only',
              icon: Icons.person_search_outlined,
              highlight: true,
            ),
          ],
        ),
        const SizedBox(height: 20),
        const Notice(
          text:
              'Individual usage comes from each student’s identified sessions. Shared-account totals are never split equally. Cached input is included in input tokens.',
        ),
        Panel(
          title: 'Usage by student',
          subtitle: 'No measurement means “Not recorded”, not zero.',
          child: students.isEmpty
              ? const EmptyState(
                  title: 'No students yet',
                  detail: 'Connect the batch roster to begin.',
                )
              : wide
              ? SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: DataTable(
                    columns: const [
                      DataColumn(label: Text('Student')),
                      DataColumn(label: Text('Input')),
                      DataColumn(label: Text('Output')),
                      DataColumn(label: Text('Cached input')),
                      DataColumn(label: Text('Total')),
                      DataColumn(label: Text('Sessions')),
                    ],
                    rows: students.map((s) {
                      final own = studentEvents(s['studentId']);
                      String count(String field) => own.isEmpty
                          ? '—'
                          : '${own.fold<int>(0, (a, e) => a + (e[field] as num).toInt())}';
                      return DataRow(
                        cells: [
                          DataCell(
                            Text(s['name']),
                            onTap: () => openStudent(s),
                          ),
                          DataCell(Text(count('inputTokens'))),
                          DataCell(Text(count('outputTokens'))),
                          DataCell(Text(count('cachedInputTokens'))),
                          DataCell(
                            Text(
                              own.isEmpty
                                  ? 'Not recorded'
                                  : '${tokenTotal(own)}',
                            ),
                          ),
                          DataCell(
                            Text(
                              '${own.map((e) => '${e['accountId']}:${e['sessionId']}').toSet().length}',
                            ),
                          ),
                        ],
                      );
                    }).toList(),
                  ),
                )
              : Column(
                  children: students.map((s) {
                    final own = studentEvents(s['studentId']);
                    return ListTile(
                      contentPadding: EdgeInsets.zero,
                      leading: StudentAvatar(name: s['name']),
                      title: Text(s['name']),
                      subtitle: Text(
                        '${accountName(s['accountId'])}\n${own.isEmpty ? 'No measured sessions' : '${own.fold<int>(0, (a, e) => a + (e['inputTokens'] as num).toInt())} input · ${own.fold<int>(0, (a, e) => a + (e['outputTokens'] as num).toInt())} output'}',
                      ),
                      isThreeLine: true,
                      trailing: Text(
                        usageLabel(own),
                        style: const TextStyle(fontWeight: FontWeight.w600),
                      ),
                      onTap: () => openStudent(s),
                    );
                  }).toList(),
                ),
        ),
        if (unassigned.isNotEmpty)
          Padding(
            padding: const EdgeInsets.only(top: 18),
            child: Notice(
              text:
                  '${tokenTotal(unassigned)} tokens stay at account level because their student is unknown.',
            ),
          ),
      ],
    );
  }

  Widget accountsView() {
    final ids = {
      ...students.map((s) => s['accountId']),
      ...events.map((e) => e['accountId']),
    };
    final accounts = data!.accounts
        .where((a) => ids.contains(a['id']))
        .toList();
    return Column(
      children: [
        const Notice(
          text:
              'One shared account can have 2 or 4 student seats. Each student uses a separate computer and their own telemetry identity.',
        ),
        accounts.isEmpty
            ? const EmptyState(
                title: 'No shared accounts assigned',
                detail: 'Connect students to accounts in the batch roster.',
              )
            : TileGrid(
                minWidth: 300,
                children: accounts.map((account) {
                  final members = students
                      .where((s) => s['accountId'] == account['id'])
                      .toList();
                  final usage = events
                      .where((e) => e['accountId'] == account['id'])
                      .toList();
                  final unknown = usage
                      .where((e) => e['studentId'] == null)
                      .toList();
                  return Panel(
                    title: account['name'],
                    subtitle:
                        '${members.length}/${account['capacity']} seats in $batchName',
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        if (members.length > (account['capacity'] as num))
                          const Notice(
                            text:
                                'This account has more assigned students than available seats.',
                          ),
                        ...members.map(
                          (s) => ListTile(
                            contentPadding: EdgeInsets.zero,
                            leading: StudentAvatar(name: s['name']),
                            title: Text(s['name']),
                            subtitle: Text(
                              usageLabel(
                                usage
                                    .where(
                                      (e) => e['studentId'] == s['studentId'],
                                    )
                                    .toList(),
                              ),
                            ),
                            onTap: () => openStudent(s),
                          ),
                        ),
                        const Divider(height: 28),
                        Text(
                          'Recorded account tokens: ${usageLabel(usage)}',
                          style: const TextStyle(fontWeight: FontWeight.w600),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          usage.isEmpty
                              ? 'No usage recorded in this period.'
                              : unknown.isEmpty
                              ? 'All recorded usage here is attributed.'
                              : '${tokenTotal(unknown)} tokens need student attribution.',
                          style: Theme.of(context).textTheme.bodySmall,
                        ),
                      ],
                    ),
                  );
                }).toList(),
              ),
      ],
    );
  }

  void openStudent(Record student) {
    final id = student['studentId'] as String;
    final report = latest[id];
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      showDragHandle: true,
      constraints: const BoxConstraints(maxWidth: 680),
      builder: (ctx) => DraggableScrollableSheet(
        initialChildSize: .8,
        maxChildSize: .95,
        minChildSize: .4,
        expand: false,
        builder: (_, scroll) => ListView(
          controller: scroll,
          padding: const EdgeInsets.fromLTRB(24, 0, 24, 30),
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    '$batchName / Student profile',
                    style: Theme.of(ctx).textTheme.bodySmall,
                  ),
                ),
                IconButton(
                  tooltip: 'Close profile',
                  onPressed: () => Navigator.pop(ctx),
                  icon: const Icon(Icons.close),
                ),
              ],
            ),
            const SizedBox(height: 12),
            StudentAvatar(name: student['name']),
            const SizedBox(height: 16),
            Text(student['name'], style: Theme.of(ctx).textTheme.headlineSmall),
            const SizedBox(height: 16),
            FilledButton.icon(
              icon: const Icon(Icons.history),
              label: const Text('Open full history'),
              onPressed: () {
                Navigator.pop(ctx);
                Navigator.of(context).push(
                  MaterialPageRoute<void>(
                    settings: RouteSettings(
                      name:
                          '/students/${Uri.encodeComponent(id)}?batch=${Uri.encodeComponent(batch)}${data!.sample ? '&demo=1' : ''}',
                    ),
                    builder: (_) => StudentHistoryPage(
                      workspace: data!,
                      batch: batch,
                      studentId: id,
                      endpoint: endpoint,
                    ),
                  ),
                );
              },
            ),
            const SizedBox(height: 8),
            Text(
              '${student['studentId']} · ${accountName(student['accountId'])}',
            ),
            const SizedBox(height: 14),
            Align(
              alignment: Alignment.centerLeft,
              child: StatusBadge(
                status: report?['understandingStatus'] ?? 'missing',
              ),
            ),
            const SizedBox(height: 24),
            TileGrid(
              minWidth: 150,
              children: [
                MetricTile(
                  label: 'Recorded tokens',
                  value: usageLabel(studentEvents(id)),
                  detail: 'Identified sessions only',
                  icon: Icons.insights_outlined,
                ),
                MetricTile(
                  label: 'Learning progress',
                  value: report == null
                      ? 'Not assessed'
                      : '${report['progressScore']}%',
                  detail: report == null
                      ? 'No report in this period'
                      : '${report['confidenceScore']}% confidence',
                  icon: Icons.school_outlined,
                ),
              ],
            ),
            const SizedBox(height: 24),
            Text('Projects', style: Theme.of(ctx).textTheme.titleMedium),
            const SizedBox(height: 12),
            if (studentProjects(id).isEmpty) const Text('No project assigned.'),
            ...studentProjects(id).map(
              (p) => Padding(
                padding: const EdgeInsets.only(bottom: 14),
                child: projectCard(p),
              ),
            ),
            const SizedBox(height: 12),
            Panel(
              title: 'Latest learning report',
              subtitle:
                  report?['reportDate'] ?? 'No report in the selected period',
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    report?['summary'] ??
                        'A learning assessment has not been recorded.',
                  ),
                  if (report != null) ...[
                    const SizedBox(height: 18),
                    const Text(
                      'Suggested next step',
                      style: TextStyle(fontWeight: FontWeight.w600),
                    ),
                    const SizedBox(height: 8),
                    Text(report['recommendedTutorAction']),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class BrandMark extends StatelessWidget {
  const BrandMark({super.key});
  @override
  Widget build(BuildContext context) => Image.asset(
    'assets/yuvabe-education-logo.png',
    width: 38,
    height: 38,
    fit: BoxFit.contain,
    semanticLabel: 'Yuvabe Education logo',
  );
}

class TileGrid extends StatelessWidget {
  final double minWidth;
  final List<Widget> children;
  const TileGrid({super.key, required this.children, this.minWidth = 260});
  @override
  Widget build(BuildContext context) => LayoutBuilder(
    builder: (_, bounds) {
      final count = ((bounds.maxWidth + 16) / (minWidth + 16)).floor().clamp(
        1,
        4,
      );
      final width = (bounds.maxWidth - (count - 1) * 16) / count;
      return Wrap(
        spacing: 16,
        runSpacing: 16,
        children: children
            .map((child) => SizedBox(width: width, child: child))
            .toList(),
      );
    },
  );
}

class Panel extends StatelessWidget {
  final String title, subtitle;
  final Widget child;
  final Widget? action;
  const Panel({
    super.key,
    required this.title,
    required this.child,
    this.subtitle = '',
    this.action,
  });
  @override
  Widget build(BuildContext context) => Card(
    child: Padding(
      padding: const EdgeInsets.all(22),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Text(
                  title,
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
              if (action != null) ...[const SizedBox(width: 10), action!],
            ],
          ),
          if (subtitle.isNotEmpty) ...[
            const SizedBox(height: 8),
            Text(
              subtitle,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: Theme.of(context).colorScheme.onSurfaceVariant,
              ),
            ),
          ],
          const SizedBox(height: 22),
          child,
        ],
      ),
    ),
  );
}

class MetricTile extends StatelessWidget {
  final String label, value, detail;
  final IconData icon;
  final bool highlight;
  const MetricTile({
    super.key,
    required this.label,
    required this.value,
    required this.detail,
    required this.icon,
    this.highlight = false,
  });
  @override
  Widget build(BuildContext context) => Card(
    color: highlight
        ? Theme.of(context).brightness == Brightness.dark
              ? const Color(0xFF393219)
              : const Color(0xFFFFF8D4)
        : null,
    child: Padding(
      padding: const EdgeInsets.all(19),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  label,
                  style: Theme.of(context).textTheme.labelMedium,
                ),
              ),
              Icon(icon, size: 18),
            ],
          ),
          const SizedBox(height: 20),
          Text(
            value,
            style: Theme.of(context).textTheme.headlineMedium?.copyWith(
              fontWeight: FontWeight.w600,
              letterSpacing: -.8,
            ),
          ),
          const SizedBox(height: 10),
          Text(detail, style: Theme.of(context).textTheme.bodySmall),
        ],
      ),
    ),
  );
}

class StudentAvatar extends StatelessWidget {
  final String name;
  const StudentAvatar({super.key, required this.name});
  @override
  Widget build(BuildContext context) => CircleAvatar(
    radius: 19,
    backgroundColor: Theme.of(context).colorScheme.secondaryContainer,
    child: Text(
      name
          .split(' ')
          .where((s) => s.isNotEmpty)
          .take(2)
          .map((s) => s[0])
          .join(),
      style: TextStyle(
        color: Theme.of(context).colorScheme.onSecondaryContainer,
        fontSize: 12,
        fontWeight: FontWeight.w600,
      ),
    ),
  );
}

class StatusBadge extends StatelessWidget {
  final String status;
  const StatusBadge({super.key, required this.status});
  @override
  Widget build(BuildContext context) {
    final labels = {
      'clear': 'On track',
      'partial': 'Check in',
      'stuck': 'Needs support',
      'missing': 'No report',
      'building': 'Building',
      'review': 'In review',
      'planning': 'Planning',
      'shipped': 'Shipped',
    };
    final dark = Theme.of(context).brightness == Brightness.dark;
    final warning = ['stuck', 'partial', 'review'].contains(status);
    final good = ['clear', 'shipped'].contains(status);
    final bg = warning
        ? dark
              ? const Color(0xFF393219)
              : const Color(0xFFFFF8D4)
        : good
        ? dark
              ? const Color(0xFF20392B)
              : const Color(0xFFEAF5EE)
        : Theme.of(context).colorScheme.surfaceContainerHighest;
    final fg = warning
        ? dark
              ? const Color(0xFFF3DA70)
              : const Color(0xFF75600A)
        : good
        ? dark
              ? const Color(0xFFA0D9B1)
              : const Color(0xFF356A48)
        : Theme.of(context).colorScheme.onSurface;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(7),
      ),
      child: Text(
        labels[status] ?? status,
        style: TextStyle(fontSize: 11, color: fg),
      ),
    );
  }
}

class Notice extends StatelessWidget {
  final String text;
  const Notice({super.key, required this.text});
  @override
  Widget build(BuildContext context) => Container(
    margin: const EdgeInsets.only(bottom: 18),
    padding: const EdgeInsets.all(15),
    decoration: BoxDecoration(
      color: Theme.of(context).brightness == Brightness.dark
          ? const Color(0xFF393219)
          : const Color(0xFFFFF8D4),
      borderRadius: BorderRadius.circular(12),
    ),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Icon(Icons.info_outline, size: 18),
        const SizedBox(width: 10),
        Expanded(
          child: Text(text, style: Theme.of(context).textTheme.bodySmall),
        ),
      ],
    ),
  );
}

class EmptyState extends StatelessWidget {
  final String title, detail;
  const EmptyState({super.key, required this.title, required this.detail});
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 25),
    child: Center(
      child: Column(
        children: [
          const Icon(Icons.folder_open_outlined, size: 36),
          const SizedBox(height: 16),
          Text(
            title,
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.titleMedium,
          ),
          const SizedBox(height: 10),
          Text(detail, textAlign: TextAlign.center),
        ],
      ),
    ),
  );
}
