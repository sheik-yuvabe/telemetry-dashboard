import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'mentor_app.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final preferences = await SharedPreferences.getInstance();
  runApp(MentorApp(preferences: preferences));
}
