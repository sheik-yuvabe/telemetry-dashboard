# Yuvabe Mentor

Flutter mentor dashboard for Android, iOS, and web. Includes purple/yellow branding, persistent light/dark/system themes, separate batch workspaces, student projects, and attributed token usage.

The app opens with clearly labelled sample data. Live data uses the existing Next.js backend and a session-only mentor read token.

```powershell
flutter pub get
flutter run -d chrome
flutter analyze
flutter test
flutter build apk --debug
flutter build web --release
```

See [client setup](../docs/FLUTTER-CLIENT.md) and [student identity and token collection](../docs/IDENTITY-AND-TOKEN-TRACKING.md).

The iOS target requires macOS/Xcode to build and test. Android production signing and mentor authentication remain deployment work. The mentor app does not collect desktop usage itself.

The supplied SVG in `../public/yuvabe-education-logo.svg` is the canonical brand asset. Regenerate Flutter PNG assets and platform icons from the repository root with `node tools/generate-brand-assets.mjs` (uses Sharp from the web project's installed dependencies).
