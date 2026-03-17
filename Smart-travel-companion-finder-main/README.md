# Smart Travel Companion Finder Frontend

React + TypeScript + Vite client for the Smart Travel Companion Finder project.

The full project overview, architecture, matching logic, realtime chat flow, and exact demo steps are documented in the repository root:

- [Project README](../README.md)

## Frontend Quick Start

```powershell
cd Smart-travel-companion-finder-main
npm install
npm run dev
```

## Production Build

```powershell
npm run build
npm run preview
```

## Windows Repair Command

If a locked-down Windows machine reports `spawn EPERM` during the build:

```powershell
npm run repair:windows
npm run doctor:windows-build
npm run build
```

The build wrapper already uses Vite's native config loader and skips the Windows `net use` probe to reduce demo-machine failures.
