# Polskie Ślady Taszkent

![License](https://img.shields.io/badge/license-MIT-green)
![Node](https://img.shields.io/badge/node-%3E%3D22-brightgreen)
![Svelte](https://img.shields.io/badge/Svelte-5.53-orange)
![Capacitor](https://img.shields.io/badge/Capacitor-8-blue)
![MapLibre](https://img.shields.io/badge/MapLibre%20GL-5.x-3b82f6)
![Made with Svelte](https://img.shields.io/badge/Made%20with-Svelte-ff3e00)
![HybridApp](https://img.shields.io/badge/Hybrid%20App-Capacitor-119eff)

An offline-friendly hybrid mobile application and web SPA dedicated to
the history of Poles in Uzbekistan.

The app helps users discover historical places connected with Poles who
lived in the region and left a meaningful mark on its history. It
includes a reference guide and offline GPS navigation that allows users
to explore these locations even without an internet connection.

The idea for this project was inspired by a cultural event organized in
2025 by Agnieszka Mikulec, where participants received printed route
maps highlighting historical places connected with Polish heritage. This
application is a digital continuation of that initiative.

## Features

- 📚 Reference guide about Polish historical figures and places
- 🗺 Offline map with GPS navigation
- 📍 Historical routes across Tashkent
- 🌍 Multilingual interface
- 📱 Works offline without internet connection

## Technologies

This project is a hybrid cross-platform SPA built with modern web
technologies.

Core technologies used in the project:

- **JavaScript**
- **Svelte** -- user interface framework
- **Capacitor** -- hybrid mobile runtime
- **Vite** -- development and build tooling
- **Tailwind CSS** -- styling
- **MapLibre GL** -- map rendering
- **PMTiles + Protomaps** -- offline vector map tiles
- **i18next** -- internationalization

---

# Installation

### Requirements

- **Node.js v22 or later**
- **npm v10 or later**
- **Java Runtime:** `java-21-openjdk`
- **Android SDK** (for Android builds)

Using **NVM** to manage Node versions is recommended:
https://github.com/nvm-sh/nvm

### Install dependencies

```bash
npm install
```

---

# Development

Start the development server:

```bash
npm run dev
```

The application will be available at:

    http://localhost:5050

Preview the production build locally:

```bash
npm run preview
```

---

# Build

Build the web application:

```bash
npm run build
```

Sync web assets with the Android project:

```bash
npm run build:sync:android
```

Copy web assets to the Android project:

```bash
npm run build:copy:android
```

Build Android debug APK:

```bash
npm run build:debugApp:android
```

Run the full Android build pipeline:

```bash
npm run build:all
```

---

# Recommended IDE Setup

[VS Code](https://code.visualstudio.com/)

- [Svelte Extension](https://marketplace.visualstudio.com/items?itemName=svelte.svelte-vscode)
- [Gradle for Java](https://marketplace.visualstudio.com/items?itemName=vscjava.vscode-gradle)
- [Language Support for Java by Red Hat](https://marketplace.visualstudio.com/items?itemName=redhat.java)

For a more comfortable development experience, check recommended
extensions in:

**VS Code>Extensions>Recommended**

---

# Recommended Runtime Setup

- **Node.js v22 or later**
  (Using [NVM](https://github.com/nvm-sh/nvm) is recommended)

- **Java Runtime Environment:**
  `java-21-openjdk` (required for Android builds)

---

# Why include `.vscode/extensions.json`?

This file allows VS Code to automatically recommend useful extensions
when the project is opened.

While many projects only list extensions in the README, using
`.vscode/extensions.json` enables VS Code to prompt developers to
install the recommended extensions directly.

---

# Open Source

This project is open source and released under the **MIT License**.

Contributions, ideas, and improvements are welcome.

---

# Map Data Attribution

Map data © OpenStreetMap contributors
Map rendering powered by MapLibre GL
Offline tiles generated using Protomaps and PMTiles
