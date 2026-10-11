import 'package:flutter/material.dart';

const brandPrimary = Color.fromRGBO(89, 42, 199, 1);
// CSS Lab D50 -> D65 -> sRGB, rounded to 8 bits.
// Source: lab(89.7033 -0.480294 84.4917).
const brandSecondary = Color(0xFFFFDF20);

ThemeData brandTheme(Brightness brightness) {
  final dark = brightness == Brightness.dark;
  final scheme =
      ColorScheme.fromSeed(
        seedColor: brandPrimary,
        brightness: brightness,
      ).copyWith(
        primary: brandPrimary,
        onPrimary: Colors.white,
        secondary: brandSecondary,
        onSecondary: const Color(0xFF251441),
        surface: dark ? const Color(0xFF211A2C) : Colors.white,
      );
  return ThemeData(
    fontFamily: 'Roboto',
    useMaterial3: true,
    colorScheme: scheme,
    brightness: brightness,
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(
        foregroundColor: dark ? const Color(0xFFC9B3FF) : brandPrimary,
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: dark ? const Color(0xFFC9B3FF) : brandPrimary,
      ),
    ),
    scaffoldBackgroundColor: dark
        ? const Color(0xFF141019)
        : const Color(0xFFF6F4FB),
    appBarTheme: AppBarTheme(
      backgroundColor: scheme.surface,
      foregroundColor: scheme.onSurface,
      elevation: 0,
      scrolledUnderElevation: 0,
    ),
    cardTheme: CardThemeData(
      color: scheme.surface,
      elevation: 0,
      margin: EdgeInsets.zero,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(18),
        side: BorderSide(color: scheme.outlineVariant.withValues(alpha: .45)),
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: scheme.surface,
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: BorderSide(color: scheme.outlineVariant),
      ),
    ),
    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: scheme.surface,
      indicatorColor: brandSecondary,
    ),
    navigationRailTheme: NavigationRailThemeData(
      backgroundColor: scheme.surface,
      indicatorColor: brandSecondary,
      selectedIconTheme: const IconThemeData(color: Color(0xFF251441)),
    ),
    progressIndicatorTheme: const ProgressIndicatorThemeData(
      color: brandPrimary,
      linearTrackColor: Color(0xFFE5DDF3),
    ),
  );
}
