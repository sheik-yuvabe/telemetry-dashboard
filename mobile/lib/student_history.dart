import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'workspace.dart';

String reportLesson(Record r) =>
    r['lessonPath'] ??
    'Month ${r['month']} / Week ${r['week']} / Day ${r['day']}';
List<Record> sortedReports(Iterable<Record> rows) =>
    rows.toList()..sort((a, b) {
      final date = b['reportDate'].toString().compareTo(a['reportDate']);
      if (date != 0) return date;
      final created = b['createdAt'].toString().compareTo(a['createdAt']);
      return created != 0 ? created : b['id'].toString().compareTo(a['id']);
    });
Record localStudentHistory(
  Workspace workspace,
  String batch,
  String student,
  Map<String, String> filters,
) {
  final all = sortedReports(
    workspace.reports.where(
      (r) => (r['batchId'] ?? 'batch-1') == batch && r['studentId'] == student,
    ),
  );
  final rows = all
      .where(
        (r) =>
            (filters['from']!.isEmpty ||
                r['reportDate'].compareTo(filters['from']) >= 0) &&
            (filters['through']!.isEmpty ||
                r['reportDate'].compareTo(filters['through']) <= 0) &&
            (filters['project']!.isEmpty ||
                (filters['project'] == 'unassigned'
                    ? r['projectId'] == null
                    : r['projectId'] == filters['project'])) &&
            (filters['lesson']!.isEmpty ||
                reportLesson(r) == filters['lesson']) &&
            (filters['status']!.isEmpty ||
                r['understandingStatus'] == filters['status']),
      )
      .toList();
  final daily = <String, Record>{}, groups = <String, Map<String, Record>>{};
  for (final r in rows) {
    daily.putIfAbsent(r['reportDate'], () => r);
    final key = jsonEncode([r['projectId'], reportLesson(r)]);
    groups.putIfAbsent(key, () => {}).putIfAbsent(r['reportDate'], () => r);
  }
  final gaps = <String, int>{};
  for (final r in daily.values) {
    for (final gap in (r['gapCategories'] as List).toSet()) {
      gaps[gap] = (gaps[gap] ?? 0) + 1;
    }
  }
  final usage = workspace.eventsIn(batch).where((e) {
    final date = courseDate(DateTime.parse(e['occurredAt']));
    return e['studentId'] == student &&
        (filters['from']!.isEmpty || date.compareTo(filters['from']!) >= 0) &&
        (filters['through']!.isEmpty ||
            date.compareTo(filters['through']!) <= 0) &&
        (filters['project']!.isEmpty ||
            (filters['project'] == 'unassigned'
                ? e['projectId'] == null
                : e['projectId'] == filters['project']));
  }).toList();
  return {
    'context': {
      'student': workspace
          .studentsIn(batch)
          .firstWhere((s) => s['studentId'] == student),
      'batch': workspace.batches.firstWhere((b) => b['id'] == batch),
      'projects': workspace
          .projectsIn(batch)
          .where((p) => p['studentId'] == student)
          .toList(),
      'demo': workspace.sample,
    },
    'reports': rows,
    'nextCursor': null,
    'lessons': (all.map(reportLesson).toSet().toList()..sort()),
    'overview': {
      'reportCount': rows.length,
      'reportDays': daily.length,
      'firstDate': rows.lastOrNull?['reportDate'],
      'lastDate': rows.firstOrNull?['reportDate'],
      'latestStatus': rows.firstOrNull?['understandingStatus'],
      'tokenTotal': usage.isEmpty ? null : tokenTotal(usage),
      'usage': usage,
      'gaps': gaps.entries
          .map((e) => {'name': e.key, 'days': e.value})
          .toList(),
      'trends': groups.values.map((group) {
        final points = group.values.toList().reversed.toList();
        return {
          'lesson': reportLesson(points.first),
          'projectId': points.first['projectId'],
          'points': points
              .map(
                (r) => {
                  'date': r['reportDate'],
                  'score': r['progressScore'],
                  'reportId': r['id'],
                },
              )
              .toList(),
        };
      }).toList(),
    },
  };
}

class StudentHistoryPage extends StatefulWidget {
  final Workspace workspace;
  final String batch, studentId, endpoint, token;
  const StudentHistoryPage({
    super.key,
    required this.workspace,
    required this.batch,
    required this.studentId,
    required this.endpoint,
    required this.token,
  });
  @override
  State<StudentHistoryPage> createState() => StudentHistoryPageState();
}

// Reopens a named student route after a browser refresh. Live credentials stay
// session-only and are requested again; a live route never falls back to samples.
class StudentHistoryEntry extends StatefulWidget {
  final String batch, studentId;
  final bool sample;
  const StudentHistoryEntry({
    super.key,
    required this.batch,
    required this.studentId,
    required this.sample,
  });
  @override
  State<StudentHistoryEntry> createState() => _StudentHistoryEntryState();
}

class _StudentHistoryEntryState extends State<StudentHistoryEntry> {
  final endpoint = TextEditingController(
    text: const String.fromEnvironment('API_BASE_URL'),
  );
  final token = TextEditingController();
  Workspace? data;
  bool busy = false;
  String? error;
  @override
  void initState() {
    super.initState();
    if (widget.sample) load();
  }

  @override
  void dispose() {
    endpoint.dispose();
    token.dispose();
    super.dispose();
  }

  Future<void> load() async {
    setState(() {
      busy = true;
      error = null;
    });
    try {
      if (!widget.sample && endpoint.text.trim().isEmpty) {
        throw Exception('Enter your backend URL.');
      }
      final result = await WorkspaceRepository().load(
        widget.batch,
        endpoint: widget.sample ? null : endpoint.text.trim(),
        token: token.text.trim(),
      );
      if (!result
          .studentsIn(widget.batch)
          .any((s) => s['studentId'] == widget.studentId)) {
        throw Exception('Student not found in this batch.');
      }
      if (mounted) {
        setState(() {
          data = result;
          busy = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          error = e.toString().replaceFirst('Exception: ', '');
          busy = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    if (data != null) {
      return StudentHistoryPage(
        workspace: data!,
        batch: widget.batch,
        studentId: widget.studentId,
        endpoint: endpoint.text.trim(),
        token: token.text.trim(),
      );
    }
    return Scaffold(
      appBar: AppBar(title: const Text('Student history')),
      body: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 500),
          child: ListView(
            shrinkWrap: true,
            padding: const EdgeInsets.all(24),
            children: [
              if (!widget.sample) ...[
                const Text(
                  'Reconnect to open this student’s live history. Credentials stay in memory.',
                ),
                const SizedBox(height: 16),
                TextField(
                  controller: endpoint,
                  decoration: const InputDecoration(labelText: 'Backend URL'),
                ),
                const SizedBox(height: 16),
                TextField(
                  controller: token,
                  obscureText: true,
                  decoration: const InputDecoration(
                    labelText: 'Mentor access token',
                  ),
                ),
                const SizedBox(height: 16),
                FilledButton(
                  onPressed: busy ? null : load,
                  child: const Text('Connect'),
                ),
              ],
              if (busy) const LinearProgressIndicator(),
              if (error != null) Text(error!),
              if (widget.sample && error != null)
                TextButton(onPressed: load, child: const Text('Retry')),
            ],
          ),
        ),
      ),
    );
  }
}

class StudentHistoryPageState extends State<StudentHistoryPage> {
  Map<String, String> filters = {
    'from': '',
    'through': '',
    'project': '',
    'lesson': '',
    'status': '',
  };
  Record? data, summary;
  String? error, summaryError;
  bool loading = true, generating = false, evidenceLoading = false;
  int tab = 0, epoch = 0;
  bool get sample => widget.workspace.sample;
  @override
  void initState() {
    super.initState();
    load();
  }

  Future<Record> request(
    String kind, {
    Map<String, String> extra = const {},
    bool post = false,
  }) async {
    final base = Uri.parse(widget.endpoint);
    if (base.host.isEmpty ||
        base.userInfo.isNotEmpty ||
        base.hasQuery ||
        base.hasFragment ||
        (base.scheme != 'https' &&
            !(base.scheme == 'http' &&
                ['localhost', '127.0.0.1', '10.0.2.2'].contains(base.host)))) {
      throw Exception('Connect a valid HTTPS backend in workspace settings.');
    }
    final uri = base
        .resolve('/api/students/${Uri.encodeComponent(widget.studentId)}/$kind')
        .replace(
          queryParameters: {'batch': widget.batch, ...filters, ...extra},
        );
    final headers = {'Authorization': 'Bearer ${widget.token}'};
    final response =
        await (post
                ? http.post(uri, headers: headers)
                : http.get(uri, headers: headers))
            .timeout(Duration(seconds: post ? 150 : 30));
    final body = jsonDecode(response.body) as Record;
    if (response.statusCode != 200 || body['ok'] != true) {
      throw Exception(body['message'] ?? 'Student request failed.');
    }
    return body;
  }

  Future<void> load() async {
    final id = ++epoch;
    setState(() {
      loading = true;
      error = null;
      summaryError = null;
      summary = null;
      data = null;
      generating = false;
    });
    try {
      if (filters['from']!.isNotEmpty &&
          filters['through']!.isNotEmpty &&
          filters['from']!.compareTo(filters['through']!) > 0) {
        throw Exception('Start date must be before the end date.');
      }
      final result = sample
          ? localStudentHistory(
              widget.workspace,
              widget.batch,
              widget.studentId,
              filters,
            )
          : await request('history');
      if (!mounted || id != epoch) return;
      setState(() {
        data = result;
        loading = false;
      });
    } catch (e) {
      if (mounted && id == epoch) {
        setState(() {
          error = e.toString().replaceFirst('Exception: ', '');
          loading = false;
        });
      }
      return;
    }
    try {
      final result = sample
          ? <String, dynamic>{
              'saved': null,
              'available': false,
              'stale': false,
              'message':
                  'Connect live data to generate AI summaries. Sample mode makes no Gemini requests.',
            }
          : await request('summary');
      if (mounted && id == epoch) setState(() => summary = result);
    } catch (e) {
      if (mounted && id == epoch) {
        setState(
          () => summaryError = e.toString().replaceFirst('Exception: ', ''),
        );
      }
    }
  }

  void filter(String key, String value) {
    filters = {...filters, key: value};
    load();
  }

  Future<void> pickDate(String key) async {
    final picked = await showDatePicker(
      context: context,
      initialDate: DateTime.tryParse(filters[key]!) ?? DateTime.now(),
      firstDate: DateTime(2020),
      lastDate: DateTime(2100),
    );
    if (picked != null && mounted) {
      filter(key, picked.toIso8601String().substring(0, 10));
    }
  }

  Future<void> more() async {
    if (data?['nextCursor'] == null) return;
    final id = epoch, previous = records(data!['reports']);
    setState(() {
      loading = true;
      error = null;
    });
    try {
      final next = await request(
        'history',
        extra: {'cursor': data!['nextCursor']},
      );
      if (mounted && id == epoch) {
        setState(() {
          data = {
            ...next,
            'reports': [
              ...previous,
              ...records(
                next['reports'],
              ).where((r) => !previous.any((p) => p['id'] == r['id'])),
            ],
          };
          loading = false;
        });
      }
    } catch (e) {
      if (mounted && id == epoch) {
        setState(() {
          error = e.toString();
          loading = false;
        });
      }
    }
  }

  Future<void> generate({bool review = false}) async {
    final id = epoch;
    setState(() {
      generating = true;
      summaryError = null;
    });
    try {
      await request(
        'summary',
        post: true,
        extra: review ? {'action': 'review'} : {},
      );
      final result = await request('summary');
      if (mounted && id == epoch) setState(() => summary = result);
    } catch (e) {
      if (mounted && id == epoch) {
        setState(
          () => summaryError = e.toString().replaceFirst('Exception: ', ''),
        );
      }
    } finally {
      if (mounted && id == epoch) setState(() => generating = false);
    }
  }

  Future<void> evidence(String reportId) async {
    final id = epoch;
    setState(() => evidenceLoading = true);
    try {
      final report = sample
          ? widget.workspace.reports.firstWhere(
              (r) =>
                  (r['batchId'] ?? 'batch-1') == widget.batch &&
                  r['studentId'] == widget.studentId &&
                  r['id'] == reportId,
            )
          : records(
              (await request(
                'history',
                extra: {'report': reportId},
              ))['reports'],
            ).first;
      if (!mounted || id != epoch) return;
      await showDialog<void>(
        context: context,
        builder: (ctx) => AlertDialog(
          title: const Text('Source report'),
          content: SingleChildScrollView(
            child: SizedBox(width: 560, child: ReportBody(report: report)),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Close report'),
            ),
          ],
        ),
      );
    } catch (e) {
      if (mounted && id == epoch) {
        setState(
          () => summaryError =
              'This source report is unavailable. Refresh the summary after checking the history.',
        );
      }
    } finally {
      if (mounted && id == epoch) setState(() => evidenceLoading = false);
    }
  }

  Widget card(String title, List<Widget> children) {
    if (title == 'Report scope' && MediaQuery.sizeOf(context).width < 700) {
      final active = filters.values.where((v) => v.isNotEmpty).length;
      return Card(
        margin: const EdgeInsets.only(bottom: 16),
        child: ExpansionTile(
          key: const PageStorageKey('student-history-filters'),
          title: const Text('Report filters'),
          subtitle: Text(
            active == 0 ? 'All recorded history' : '$active active filters',
          ),
          childrenPadding: const EdgeInsets.fromLTRB(18, 0, 18, 18),
          children: children,
        ),
      );
    }
    return Card(
      margin: const EdgeInsets.only(bottom: 16),
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title, style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 14),
            ...children,
          ],
        ),
      ),
    );
  }

  Widget dropdown(String label, String key, Map<String, String> options) =>
      SizedBox(
        width: 240,
        child: DropdownButtonFormField<String>(
          key: ValueKey('$key-${filters[key]}'),
          initialValue: options.containsKey(filters[key]) ? filters[key] : '',
          isExpanded: true,
          decoration: InputDecoration(labelText: label),
          items: options.entries
              .map(
                (e) => DropdownMenuItem(
                  value: e.key,
                  child: Text(e.value, overflow: TextOverflow.ellipsis),
                ),
              )
              .toList(),
          onChanged: (v) {
            if (v != null) filter(key, v);
          },
        ),
      );
  String projectName(dynamic id) =>
      records(
        data?['context']?['projects'],
      ).where((p) => p['id'] == id).firstOrNull?['name'] ??
      'Project not recorded';
  @override
  Widget build(BuildContext context) {
    final student = widget.workspace
        .studentsIn(widget.batch)
        .firstWhere((s) => s['studentId'] == widget.studentId);
    final batch = widget.workspace.batches.firstWhere(
      (b) => b['id'] == widget.batch,
    );
    final overview = data?['overview'] as Record?;
    final projects = widget.workspace
        .projectsIn(widget.batch)
        .where((p) => p['studentId'] == widget.studentId);
    final tabs = SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: List.generate(
          4,
          (i) => Padding(
            padding: const EdgeInsets.symmetric(horizontal: 4),
            child: TextButton(
              onPressed: () => setState(() => tab = i),
              style: TextButton.styleFrom(
                backgroundColor: tab == i
                    ? Theme.of(
                        context,
                      ).colorScheme.secondary.withValues(alpha: .2)
                    : null,
              ),
              child: Text(['Overview', 'Reports', 'Projects', 'Usage'][i]),
            ),
          ),
        ),
      ),
    );
    return Scaffold(
      appBar: AppBar(
        title: Text(student['name']),
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(48),
          child: tabs,
        ),
      ),
      body: RefreshIndicator(
        onRefresh: load,
        child: ListView(
          padding: const EdgeInsets.all(18),
          children: [
            Center(
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 1100),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Text(
                      '${batch['name']} / Student history',
                      style: Theme.of(context).textTheme.labelLarge,
                    ),
                    const SizedBox(height: 12),
                    if (sample)
                      const Padding(
                        padding: EdgeInsets.only(bottom: 14),
                        child: Text(
                          'Sample reports • Fictional history for demonstration.',
                        ),
                      ),
                    card('Report scope', [
                      Wrap(
                        spacing: 10,
                        runSpacing: 12,
                        children: [
                          OutlinedButton(
                            onPressed: () => pickDate('from'),
                            child: Text(
                              'From: ${filters['from']!.isEmpty ? 'first report' : filters['from']}',
                            ),
                          ),
                          OutlinedButton(
                            onPressed: () => pickDate('through'),
                            child: Text(
                              'Through: ${filters['through']!.isEmpty ? 'latest report' : filters['through']}',
                            ),
                          ),
                          TextButton(
                            onPressed: () {
                              filters = {for (final k in filters.keys) k: ''};
                              load();
                            },
                            child: const Text('All history'),
                          ),
                          dropdown('Project', 'project', {
                            '': 'All projects',
                            'unassigned': 'Project not recorded',
                            for (final p in projects) p['id']: p['name'],
                          }),
                          dropdown('Lesson', 'lesson', {
                            '': 'All lessons',
                            for (final l in (data?['lessons'] as List? ?? []))
                              l: l,
                          }),
                          dropdown('Reported status', 'status', {
                            '': 'All statuses',
                            'clear': 'Clear',
                            'partial': 'Partial',
                            'stuck': 'Stuck',
                          }),
                        ],
                      ),
                      if (filters['from']!.isNotEmpty &&
                          filters['through']!.isNotEmpty &&
                          filters['from']!.compareTo(filters['through']!) > 0)
                        const Text('Start date must be before the end date.'),
                    ]),
                    if (error != null)
                      card('Could not load history', [
                        Text(error!),
                        TextButton(onPressed: load, child: const Text('Retry')),
                      ]),
                    if (loading) const LinearProgressIndicator(),
                    if (overview != null) ...[
                      if (tab == 0) ...[
                        card('Recorded overview', [
                          Wrap(
                            spacing: 24,
                            runSpacing: 18,
                            children: [
                              metric('${overview['reportCount']}', 'Reports'),
                              metric(
                                '${overview['reportDays']}',
                                'Days with reports',
                              ),
                              metric(
                                overview['latestStatus'] ?? 'Not assessed',
                                'Latest reported status',
                              ),
                              metric(
                                overview['tokenTotal']?.toString() ??
                                    'Not recorded',
                                'Measured tokens',
                              ),
                            ],
                          ),
                          const SizedBox(height: 18),
                          Text(
                            overview['firstDate'] == null
                                ? 'No reports in this scope.'
                                : '${overview['firstDate']} through ${overview['lastDate']}',
                          ),
                          const Text(
                            'Missing reports do not establish attendance. Token totals use date/project filters, independent of lesson/status filters.',
                          ),
                        ]),
                        card('Recorded learning gaps', [
                          const Text(
                            'Counts use the latest matching report per day.',
                          ),
                          if (records(overview['gaps']).isEmpty)
                            const Text('No gaps recorded.'),
                          ...records(overview['gaps']).map(
                            (g) => Padding(
                              padding: const EdgeInsets.only(top: 10),
                              child: Text(
                                '${g['name']}: ${g['days']} report day(s)',
                              ),
                            ),
                          ),
                        ]),
                        card('Learning progress by lesson', [
                          const Text(
                            'Reported assessments grouped by lesson and project; different lessons are not combined.',
                          ),
                          ...records(overview['trends']).map(
                            (trend) => Padding(
                              padding: const EdgeInsets.only(top: 16),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    trend['lesson'],
                                    style: const TextStyle(
                                      fontWeight: FontWeight.bold,
                                    ),
                                  ),
                                  Text(projectName(trend['projectId'])),
                                  Wrap(
                                    spacing: 8,
                                    children: records(trend['points'])
                                        .map(
                                          (point) => TextButton(
                                            onPressed: evidenceLoading
                                                ? null
                                                : () => evidence(
                                                    point['reportId'],
                                                  ),
                                            child: Text(
                                              '${point['date']}: ${point['score']}%',
                                            ),
                                          ),
                                        )
                                        .toList(),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ]),
                        summaryCard(overview),
                      ],
                      if (tab == 1)
                        card('All reports · ${overview['reportCount']}', [
                          const Text(
                            'Expand any report to read the original assessment. Times are IST.',
                          ),
                          if (records(data!['reports']).isEmpty)
                            const Text('No reports match these filters.'),
                          ...reportRows(records(data!['reports'])),
                          if (data!['nextCursor'] != null)
                            OutlinedButton(
                              onPressed: loading ? null : more,
                              child: const Text('Load more reports'),
                            ),
                        ]),
                      if (tab == 2) ...[
                        if (projects.isEmpty)
                          const Text('No projects assigned.'),
                        ...projects.map(
                          (p) => card(p['name'], [
                            Text(p['description']),
                            Text(
                              '${p['status']} · Project progress ${p['progress']}%',
                            ),
                            TextButton(
                              onPressed: () {
                                tab = 1;
                                filters = {
                                  for (final k in filters.keys) k: '',
                                  'project': p['id'],
                                };
                                load();
                              },
                              child: const Text('View project reports'),
                            ),
                          ]),
                        ),
                      ],
                      if (tab == 3)
                        card('Individual measured usage', [
                          const Text(
                            'Input + output; cached input is already included. Date/project filters apply, independently of lesson/status filters.',
                          ),
                          if (records(overview['usage']).isEmpty)
                            const Text('Not recorded in this scope.'),
                          ...records(overview['usage']).map(
                            (e) => ListTile(
                              contentPadding: EdgeInsets.zero,
                              title: Text(
                                '${courseDate(DateTime.parse(e['occurredAt']))} · ${tokenTotal([e])} tokens',
                              ),
                              subtitle: Text(
                                '${projectName(e['projectId'])}\nInput ${e['inputTokens']} · Output ${e['outputTokens']} · Cached ${e['cachedInputTokens']}',
                              ),
                            ),
                          ),
                        ]),
                    ],
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget metric(String value, String label) => SizedBox(
    width: MediaQuery.sizeOf(context).width < 700 ? 136 : 180,
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(value, style: Theme.of(context).textTheme.headlineSmall),
        Text(label),
      ],
    ),
  );
  List<Widget> reportRows(List<Record> rows) {
    final result = <Widget>[];
    for (var i = 0; i < rows.length; i++) {
      final r = rows[i];
      if (i == 0 || rows[i - 1]['reportDate'] != r['reportDate']) {
        result.add(
          Padding(
            padding: const EdgeInsets.only(top: 20),
            child: Text(
              r['reportDate'],
              style: const TextStyle(fontWeight: FontWeight.bold),
            ),
          ),
        );
      }
      result.add(
        ExpansionTile(
          key: ValueKey<String>(r['id'] as String),
          tilePadding: EdgeInsets.zero,
          title: Text(
            '${reportTime(r['createdAt'])} · ${r['understandingStatus']}',
          ),
          subtitle: Text(
            r['summary'],
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
          ),
          children: [
            Padding(
              padding: const EdgeInsets.only(bottom: 16),
              child: ReportBody(report: r),
            ),
          ],
        ),
      );
    }
    return result;
  }

  Widget summaryCard(Record overview) {
    final saved = summary?['saved'] as Record?;
    const labels = {
      'overview': 'Learning overview',
      'strengths': 'Strengths',
      'difficulties': 'Recurring difficulties',
      'progress': 'Changes over time',
      'nextSteps': 'Suggested mentor actions',
    };
    return card('AI learning summary', [
      const Text(
        'AI-generated draft for mentor review. Every claim links to its source reports.',
      ),
      const SizedBox(height: 12),
      FilledButton(
        onPressed:
            generating ||
                summary?['available'] != true ||
                overview['reportCount'] == 0
            ? null
            : generate,
        child: Text(
          generating
              ? 'Generating…'
              : saved == null
              ? 'Generate summary'
              : 'Refresh summary',
        ),
      ),
      if (summary?['message'] != null)
        Padding(
          padding: const EdgeInsets.only(top: 12),
          child: Text(summary!['message']),
        ),
      if (summaryError != null)
        Padding(
          padding: const EdgeInsets.only(top: 12),
          child: Text(summaryError!),
        ),
      if (saved != null) ...[
        const SizedBox(height: 12),
        Text(
          saved['review'] == 'reviewed'
              ? 'Reviewed by mentor'
              : 'AI-generated draft',
        ),
        if (saved['review'] != 'reviewed')
          OutlinedButton(
            onPressed: generating || summary?['stale'] == true
                ? null
                : () => generate(review: true),
            child: const Text('Mark reviewed'),
          ),
        const SizedBox(height: 16),
        Text(
          '${saved['reportCount']} reports · Generated ${reportTime(saved['generatedAt'])} IST · ${saved['model']}',
        ),
        if (summary?['stale'] == true)
          const Text(
            'OUT OF DATE — source reports or summary settings changed.',
          ),
        ...labels.entries.map(
          (section) => Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Padding(
                padding: const EdgeInsets.only(top: 16, bottom: 8),
                child: Text(
                  section.value,
                  style: const TextStyle(fontWeight: FontWeight.bold),
                ),
              ),
              ...records(saved['content'][section.key]).map(
                (claim) => Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(claim['text']),
                    Wrap(
                      spacing: 8,
                      children: (claim['reportIds'] as List)
                          .asMap()
                          .entries
                          .map(
                            (e) => TextButton(
                              onPressed: evidenceLoading
                                  ? null
                                  : () => evidence(e.value),
                              child: Text('Source report ${e.key + 1}'),
                            ),
                          )
                          .toList(),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 12),
        const Text(
          'Evidence limitations',
          style: TextStyle(fontWeight: FontWeight.bold),
        ),
        ...(saved['content']['limitations'] as List).map((x) => Text('• $x')),
        const SizedBox(height: 12),
        Text(
          'Summary API tokens: ${saved['apiUsage']['totalTokens']}. Separate from student usage.',
        ),
      ],
    ]);
  }
}

String reportTime(String value) => DateTime.parse(value)
    .toUtc()
    .add(const Duration(hours: 5, minutes: 30))
    .toIso8601String()
    .substring(0, 16)
    .replaceFirst('T', ' ');

class ReportBody extends StatelessWidget {
  final Record report;
  const ReportBody({super.key, required this.report});
  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Text(
        reportLesson(report),
        style: const TextStyle(fontWeight: FontWeight.bold),
      ),
      const SizedBox(height: 12),
      Text(report['summary']),
      ...{
        'Report date': report['reportDate'],
        'Created (IST)': reportTime(report['createdAt']),
        'Reported progress': '${report['progressScore']}%',
        'Reported confidence': '${report['confidenceScore']}%',
        'Lesson detection confidence': report['lessonConfidence'],
        'Recorded gaps': (report['gapCategories'] as List).join(', '),
        'Likely causes reported': (report['likelyCauses'] as List).join('; '),
        'Suggested tutor action': report['recommendedTutorAction'],
        'Trigger': report['triggerReason'],
        'Project': report['projectId'] ?? 'Project not recorded',
        'Report ID': report['id'],
      }.entries.map(
        (e) => Padding(
          padding: const EdgeInsets.only(top: 12),
          child: Text(
            '${e.key}\n${e.value.toString().isEmpty ? 'None recorded' : e.value}',
          ),
        ),
      ),
    ],
  );
}
