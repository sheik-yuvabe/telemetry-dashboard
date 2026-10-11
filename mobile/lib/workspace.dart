import 'dart:convert';
import 'package:flutter/services.dart';
import 'package:http/http.dart' as http;

typedef Record = Map<String, dynamic>;
List<Record> records(dynamic value) => (value as List? ?? [])
    .map((item) => Map<String, dynamic>.from(item as Map))
    .toList();
int tokenTotal(Iterable<Record> events) => events.fold(
  0,
  (sum, event) =>
      sum +
      (event['inputTokens'] as num).toInt() +
      (event['outputTokens'] as num).toInt(),
);
String compact(int value) => value >= 1000000
    ? '${(value / 1000000).toStringAsFixed(1)}M'
    : value >= 1000
    ? '${(value / 1000).toStringAsFixed(1)}K'
    : '$value';
String courseDate(DateTime time) => time
    .toUtc()
    .add(const Duration(hours: 5, minutes: 30))
    .toIso8601String()
    .substring(0, 10);

class Workspace {
  final List<Record> batches, students, accounts, projects, usage, reports;
  final bool sample, setupRequired;
  Workspace(Record payload)
    : batches = records(payload['workspace']['batches']),
      students = records(payload['workspace']['students']),
      accounts = records(payload['workspace']['accounts']),
      projects = records(payload['workspace']['projects']),
      usage = records(payload['workspace']['usage']),
      reports = records(payload['reports']),
      sample = payload['workspace']['mode'] == 'demo',
      setupRequired = payload['workspace']['setupRequired'] == true;
  List<Record> studentsIn(String batch) =>
      students.where((s) => s['batchId'] == batch).toList();
  List<Record> projectsIn(String batch) =>
      projects.where((p) => p['batchId'] == batch).toList();
  List<Record> eventsIn(String batch, {String? through, int? days}) {
    final cutoff = through == null
        ? null
        : DateTime.parse('${through}T00:00:00Z');
    final start = days == null || cutoff == null
        ? null
        : cutoff
              .subtract(Duration(days: days - 1))
              .toIso8601String()
              .substring(0, 10);
    return usage.where((e) {
      final date = courseDate(DateTime.parse(e['occurredAt']));
      return e['batchId'] == batch &&
          (through == null || date.compareTo(through) <= 0) &&
          (start == null || date.compareTo(start) >= 0);
    }).toList();
  }

  Map<String, Record> latestIn(
    String batch, {
    required String through,
    int? days,
  }) {
    final start = days == null
        ? '0000-00-00'
        : DateTime.parse('${through}T00:00:00Z')
              .subtract(Duration(days: days - 1))
              .toIso8601String()
              .substring(0, 10);
    final sorted =
        reports
            .where(
              (r) =>
                  (r['batchId'] ?? 'batch-1') == batch &&
                  r['reportDate'].toString().compareTo(through) <= 0 &&
                  r['reportDate'].toString().compareTo(start) >= 0,
            )
            .toList()
          ..sort((a, b) {
            final date = b['reportDate'].toString().compareTo(a['reportDate']);
            return date != 0
                ? date
                : b['createdAt'].toString().compareTo(a['createdAt']);
          });
    final result = <String, Record>{};
    for (final report in sorted) {
      result.putIfAbsent(report['studentId'], () => report);
    }
    return result;
  }
}

class WorkspaceRepository {
  Workspace? _sample;
  Future<Workspace> load(
    String batch, {
    String? endpoint,
    String? token,
  }) async {
    if (endpoint == null || endpoint.isEmpty) {
      return _sample ??= Workspace(
        jsonDecode(await rootBundle.loadString('assets/sample-workspace.json')),
      );
    }
    final base = Uri.parse(endpoint);
    if (!['https', 'http'].contains(base.scheme) ||
        base.host.isEmpty ||
        base.userInfo.isNotEmpty ||
        base.hasQuery ||
        base.hasFragment) {
      throw Exception(
        'Use a valid backend URL without credentials or query parameters.',
      );
    }
    if (base.scheme != 'https' &&
        !['localhost', '127.0.0.1', '10.0.2.2'].contains(base.host)) {
      throw Exception('Use HTTPS for a live backend.');
    }
    final uri = base
        .resolve('/api/workspace')
        .replace(queryParameters: {'batch': batch});
    final response = await http
        .get(uri, headers: {'Authorization': 'Bearer ${token ?? ''}'})
        .timeout(const Duration(seconds: 20));
    final body = jsonDecode(response.body) as Record;
    if (response.statusCode != 200 || body['ok'] != true) {
      throw Exception(body['message'] ?? 'Workspace request failed.');
    }
    return Workspace(body);
  }
}
