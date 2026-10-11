import 'dart:convert';
import 'dart:io';
import 'dart:ui' as ui;
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:yuvabe_mentor/mentor_app.dart';
import 'package:yuvabe_mentor/workspace.dart';
import 'package:yuvabe_mentor/student_history.dart';

Future<void> boot(
  WidgetTester tester,
  Size size, {
  String theme = 'light',
}) async {
  tester.view.devicePixelRatio = 1;
  tester.view.physicalSize = size;
  SharedPreferences.setMockInitialValues({'theme': theme});
  final prefs = await SharedPreferences.getInstance();
  await tester.runAsync(
    () => rootBundle.loadString('assets/sample-workspace.json'),
  );
  await tester.pumpWidget(
    RepaintBoundary(
      key: const Key('preview'),
      child: MentorApp(preferences: prefs),
    ),
  );
  // Asset decoding may use an isolate; await the same refresh path in a real
  // async zone so the fake test clock cannot starve the completion.
  final dynamic home = tester.state(find.byType(MentorHome));
  await tester.runAsync(() async {
    await home.load(resetDate: true);
  });
  await tester.pumpAndSettle();
}

Future<void> capture(WidgetTester tester, String name) async {
  if (!const bool.fromEnvironment('CAPTURE_PREVIEWS')) return;
  final boundary = tester.renderObject<RenderRepaintBoundary>(
    find.byKey(const Key('preview')),
  );
  await tester.runAsync(() async {
    final image = await boundary.toImage(pixelRatio: 1);
    final bytes = await image.toByteData(format: ui.ImageByteFormat.png);
    final folder = Directory('../artifacts/flutter');
    await folder.create(recursive: true);
    await File(
      '${folder.path}/$name.png',
    ).writeAsBytes(bytes!.buffer.asUint8List());
    image.dispose();
  });
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  setUpAll(() async {
    // Optional captures use the SDK fonts. Normal assertions need no local font paths.
    if (const bool.fromEnvironment('CAPTURE_PREVIEWS')) {
      for (final entry in {
        'Roboto': [
          'roboto-regular.ttf',
          'roboto-medium.ttf',
          'roboto-bold.ttf',
        ],
        'MaterialIcons': ['materialicons-regular.otf'],
      }.entries) {
        final loader = FontLoader(entry.key);
        for (final name in entry.value) {
          final file = File(
            'C:/flutter/bin/cache/artifacts/material_fonts/$name',
          );
          if (await file.exists()) {
            loader.addFont(
              Future.value(ByteData.sublistView(await file.readAsBytes())),
            );
          }
        }
        await loader.load();
      }
    }
  });

  test('Batch filters and cached input avoid incorrect attribution', () async {
    final raw =
        jsonDecode(await rootBundle.loadString('assets/sample-workspace.json'))
            as Record;
    final workspace = Workspace(raw);
    expect(workspace.studentsIn('batch-2').length, 8);
    expect(workspace.studentsIn('batch-1').length, 3);
    expect(workspace.eventsIn('batch-1'), isEmpty);
    expect(
      tokenTotal([
        {'inputTokens': 1500, 'outputTokens': 400, 'cachedInputTokens': 500},
      ]),
      1900,
    );
    expect(workspace.eventsIn('batch-2', through: '2026-10-04'), isEmpty);
    expect(workspace.latestIn('batch-2', through: '2026-10-10').length, 7);
    expect(courseDate(DateTime.parse('2026-10-09T20:00:00Z')), '2026-10-10');
    final usage = workspace.eventsIn('batch-2');
    expect(usage.where((e) => e['studentId'] == 'b2-8'), isEmpty);
    expect(tokenTotal(usage.where((e) => e['studentId'] == null)), 22200);
  });

  testWidgets('Desktop and dark layouts render without overflow', (
    tester,
  ) async {
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    await boot(tester, const Size(1440, 1100));
    expect(find.byType(NavigationRail), findsOneWidget);
    expect(find.text('Sample workspace'), findsOneWidget);
    expect(tester.takeException(), isNull);
    await capture(tester, 'desktop-light');
    await tester.tap(find.byTooltip('Color theme'));
    await tester.pumpAndSettle();
    await tester.tap(
      find.widgetWithText(CheckedPopupMenuItem<ThemeMode>, 'Dark theme'),
    );
    await tester.pumpAndSettle();
    final app = tester.widget<MaterialApp>(find.byType(MaterialApp));
    expect(app.themeMode, ThemeMode.dark);
    expect((await SharedPreferences.getInstance()).getString('theme'), 'dark');
    expect(tester.takeException(), isNull);
    await capture(tester, 'desktop-dark');
  });

  testWidgets('Phone navigation, student search, profile, batch separation', (
    tester,
  ) async {
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    await boot(tester, const Size(390, 844));
    expect(find.byType(NavigationBar), findsOneWidget);
    expect(tester.takeException(), isNull);
    await capture(tester, 'phone-light');
    await tester.tap(find.text('Students').last);
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField).first, 'Aarav');
    await tester.pumpAndSettle();
    expect(find.text('Aarav Kumar'), findsOneWidget);
    expect(find.text('Diya Raman'), findsNothing);
    await tester.ensureVisible(find.text('Aarav Kumar'));
    await tester.tap(find.text('Aarav Kumar'));
    await tester.pumpAndSettle();
    expect(find.text('Batch 2 / Student profile'), findsOneWidget);
    expect(tester.takeException(), isNull);
    await tester.tap(find.byTooltip('Close profile'));
    await tester.pumpAndSettle();
    await tester.ensureVisible(find.byKey(const Key('batch-selector')));
    await tester.tap(find.byKey(const Key('batch-selector')));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Batch 1 · Archived').last);
    await tester.pumpAndSettle();
    expect(find.text('Aarav Kumar'), findsNothing);
    expect(find.text('Noor'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('Phone usage, projects and shared accounts support dark mode', (
    tester,
  ) async {
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    await boot(tester, const Size(390, 844), theme: 'dark');
    await capture(tester, 'phone-dark');
    for (final label in ['Projects', 'Usage', 'Accounts']) {
      await tester.tap(find.text(label).last);
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull, reason: label);
      await capture(tester, 'phone-${label.toLowerCase()}');
    }
  });

  testWidgets(
    'Full student history preserves same-day reports, filters and evidence on phone',
    (tester) async {
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      await boot(tester, const Size(390, 844), theme: 'dark');
      await tester.tap(find.text('Students').last);
      await tester.pumpAndSettle();
      await tester.enterText(find.byType(TextField).first, 'Aarav');
      await tester.pumpAndSettle();
      await tester.ensureVisible(find.text('Aarav Kumar'));
      await tester.tap(find.text('Aarav Kumar'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Open full history'));
      await tester.pumpAndSettle();
      final state = tester.state<StudentHistoryPageState>(
        find.byType(StudentHistoryPage),
      );
      expect(state.data!['overview']['reportCount'], 7);
      expect(state.data!['overview']['reportDays'], 6);
      expect(
        records(
          state.data!['reports'],
        ).where((r) => r['reportDate'] == '2026-10-10').length,
        2,
      );
      expect(tester.takeException(), isNull);
      await capture(tester, 'student-history-phone');
      await tester.tap(find.widgetWithText(TextButton, 'Reports'));
      await tester.pumpAndSettle();
      expect(state.tab, 1);
      await capture(tester, 'student-reports-before-expand');
      await tester.ensureVisible(find.byKey(const ValueKey('sample-report-0')));
      await tester.tap(find.byKey(const ValueKey('sample-report-0')));
      await tester.pumpAndSettle();
      expect(find.byType(ReportBody), findsWidgets);
      expect(tester.takeException(), isNull);
      await capture(tester, 'student-reports-phone');
      state.filter('from', '2026-10-10');
      await tester.pumpAndSettle();
      expect(state.data!['overview']['reportCount'], 2);
      state.filter('project', 'someone-elses-project');
      await tester.pumpAndSettle();
      expect(state.data!['overview']['reportCount'], 0);
      state.filters = {
        'from': '',
        'through': '',
        'project': '',
        'lesson': '',
        'status': '',
      };
      await state.load();
      await tester.pumpAndSettle();
      state.evidence('sample-report-0-history-5');
      await tester.pumpAndSettle();
      expect(find.text('Source report'), findsOneWidget);
      await tester.tap(find.text('Close report'));
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets('Full student overview and project navigation fit desktop', (
    tester,
  ) async {
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    await boot(tester, const Size(1440, 1100));
    final dynamic home = tester.state(find.byType(MentorHome));
    home.openStudent(home.data.studentsIn('batch-2').first);
    await tester.pumpAndSettle();
    await tester.tap(find.text('Open full history'));
    await tester.pumpAndSettle();
    expect(find.byType(StudentHistoryPage), findsOneWidget);
    await capture(tester, 'student-history-desktop');
    await tester.tap(find.text('Projects').first);
    await tester.pumpAndSettle();
    await tester.ensureVisible(find.text('View project reports').first);
    await tester.tap(find.text('View project reports').first);
    await tester.pumpAndSettle();
    final state = tester.state<StudentHistoryPageState>(
      find.byType(StudentHistoryPage),
    );
    expect(state.filters['project'], 'project-1');
    expect(state.tab, 1);
    expect(tester.takeException(), isNull);
  });
}
