# Changelog

All notable changes to Zavz will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed
- Read compressed JAR manifests so downloaded FDPClient Inject and Julia builds are recognized.
- Preserve selected JAR locations when saving, reopening and injecting, without copying to a required folder.
- Select the project by JAR contents and ignore stale inspection results that could restore Julia.
- Allow manual path editing and validate the current selection before saving.

### Added
- **Current FDPClient Inject startup loading**
  - A separate FDPClient Inject project with a manual JAR picker and an embedded x64 DLL
  - A watcher that loads the current Lunar bundle before Minecraft initializes, without a `-javaagent` argument
  - Native loader sources, startup diagnostics, and rebuild instructions in `docs/FDP-LUNAR.md`

- **Infrastructure Improvements**
  - ESLint and Prettier configuration for TypeScript/React
  - Clippy and Rustfmt configuration for Rust
  - GitHub Actions CI/CD workflows (lint, build, release)
  - Comprehensive code formatting across the entire codebase

- **UI/UX Enhancements**
  - React Hot Toast integration for beautiful notifications
  - Framer Motion for smooth animations
  - Reusable UI component library:
    - `Button` - Animated button with variants and loading states
    - `Card` - Glass-effect cards with hover animations
    - `Input` - Styled input fields with label and error support
    - `ProgressBar` - Animated progress indicator
    - `Spinner` - Loading spinner component
    - `DragDropZone` - Drag and drop area for DLL files

- **State Management**
  - Custom hooks library:
    - `useTheme` - Theme management with 10 presets
    - `useLogger` - Centralized logging with toast integration
    - `useLocalStorage` - Type-safe localStorage wrapper
    - `useDebounce` - Debounce utility hook
  - `AppContext` - Global application state provider

- **Documentation**
  - `ARCHITECTURE.md` - Complete architectural documentation
  - `CONTRIBUTING.md` - Contribution guidelines
  - `CHANGELOG.md` - Version history tracking

### Changed
- Refactored project structure with better organization
- Improved type safety across TypeScript codebase
- Enhanced error handling patterns

### Developer Experience
- Automated code formatting on save
- Lint checks in CI/CD pipeline
- Consistent code style enforcement
- Better development tooling

## [2.0.0] - 2024

### Added
- Initial release of Zavz 2.0
- Tauri v2 migration
- Modern UI with glassmorphism design
- Multiple injection techniques
- Theme customization
- Settings persistence

---

## Version Guidelines

### Types of Changes
- `Added` for new features
- `Changed` for changes in existing functionality
- `Deprecated` for soon-to-be removed features
- `Removed` for now removed features
- `Fixed` for any bug fixes
- `Security` for vulnerability fixes

### Version Numbers
- **Major** (X.0.0): Breaking changes
- **Minor** (0.X.0): New features, backward compatible
- **Patch** (0.0.X): Bug fixes, backward compatible
