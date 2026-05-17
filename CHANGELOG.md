# Changelog

## v1.1.2 — 2026-05-17

### 🆕 Updates
- Dependencies and security alerts updates.

### 🐛 Fixes
- Fixed safe-areas from Samsung.

## v1.1.1 — 2026-04-30

## v1.1.0 — 2026-04-27

### 🆕 Updates
- Dependencies upgrades.
- Improved popup appearance on the 'Map' view. Added a 'testers' section to translations.
- Logging system enabled only in development mode (applied across the project). Minor fix in NavigationEngine (optimized graph insertion). Fixed unwanted behavior in MapLoadTracker.js (continuous update() on any map interaction) -> now unsubscribes from all events; tracker is used only during initial load. Improved animation in DarkModeToggler.svelte component.
- Updated graph scripts; Added instruction: scripts/navigationGraph/instructions.txt; Building new graph data
- updated
- release - script updated, rewriting logic, added guard question.
- added versionCode with android/app/build.gradle

### 📝 Other Changes
- Merge pull request #17 from Ko2doo/v1.0.2

## v1.0.2 — 2026-04-22

### 🆕 Updates
- UPD:2026-04-22: Updates package; Added new icons; Edited default variables & added tailwind config; And other micro fixes
- Updates dependencies
- Deleted @capacitor/assets package.
- Added full build command + full author name; Renaming repo links.

### 📝 Other Changes
- fix
- Merge pull request #14 from Ko2doo/v1.0.1
- Merge branch 'master' into v1.0.1
- Merge pull request #13 from Ko2doo/master
- Merge pull request #12 from Ko2doo/v1.0.1

## v1.0.1 — 2026-03-24

### 🆕 Updates
- micro fix
- backButton extended + added overlayController
- Added new Article popup logic; Created global state with Article Popup.
- micro fixes
- First Google Play release
- Updates. Map View is Root.
- Update dependencies.
- License update
- Added new icon component; Set new icon with More.svelte and Settings.svelte views.
- Dependencies updates.
- Locales updated; Micro fixes and more.
- Added new View; About view micro fixes.
- AppSplash - Added new delay and duration; LangSwitcher.svelte - added dark theme color; AboutProject.svelte, locales and data/about.js - full complite; Added new icon component.
- Big updates;
- Added release script; Added New brand accent color and etc...
- micro updates and fixes, added new style with ScreeSplash
- Big updates, added custom SplashScreen, added App icon; Updates: locales, components, and etc...
- added tabbar store
- Added animation
- Dependencies update.
- Code refactoring & created new component
- About View refactoring; TODO: Starting About refactoring, use no routing component
- Transition effects refactoring
- Code refactoring, added transition effect
- Refactoring code and locales.
- navigation updates
- A-B navigation updates
- GPS navigation fixes and updates.
- Fixes LangSwitcher popover; Added focus in Searchbar component
- Fixes and new features.
- Component updated.
- Update searchbar UI/UX logic, added onscroll listener with visibility on scroll.
- Updated dependencies.
- Remove localStorage themes initialization.
- Dependencies update
- UPD:FIX::2026-02-16 => Updated build script command in package.json file; Theme manager updated; MapNavigationGPS click to new destination fixes.
- Fixed Dialog height
- WelcomeDigalog complited; Added new locationPermission services and update ErrorHandler, gpsTracker, MapNavigationGPS;
- Added customizible component
- Set English locales default; Complited WelcomeDialog.svelte and appStart.js store.
- Created new component, complited in 50%
- Locales update and error messages update
- Fixed error handling; Fixed NavigationSheet button and behavior
- GPS error messages fixed.
- Created and updated errors locales; Added Capacitor geolocation errors code; handleGPSError enhanced; Updated gpsTracker service.
- UPD:FIX:2026-02-03 Fixed Dialog and mapFly
- Added new dialog.
- Improved interaction with the NavigationSheet component: now a single “Close” button handles three scenarios—(1) closes the NavigationSheet window; (2) if a mode has been chosen, returns to mode selection; (3) if a route has been built, opens a Dialog component with a warning. Added a Dialog component that warns about turning off navigation and lets the user choose whether to finish or not.
- UPD:FIX:2026-02-01: Added global store from LayoutSwitcher filter; Updated styles all Navigation components.
- UPD:2026-01-31 GPS navigation updated.
- UPD:FIX:2026-01-31 Updated Map; Updated NavigationSheet.
- UPD:FIX:2026-01-30 Deleted unused store and updated Map view.
- UPD:FIX:2026-01-30 Icons default className updated; Updated Map view and created new component.
- UPD:2026-01-29 deleted file.
- UPD:2026-01-29 Added En locales.
- UPD:2026-01-29 Dependencies updated.
- UPD:FIX:2026-01-16 Toasts fixed
- UPD:FIX:2026-01-16 Fixed A->B navigation; Added new Toast messages and locales.
- UPD:2026-01-16 android permission added and vite config updated
- UPD:2026-01-16 Added GPS navigation; Added locales; Added new dependencies & updated Svelte.js
- UPD:FIX:2026-01-16 => Updated;
- UPD:FIX:2026-01-16 Updated i18n service; Updated Settings view; Added new locales;
- UPD:2026-01-16 => MapPointsBuilder class rewritten; Map.svelte rewritten;
- UPD:FIX:2026-01-15 Added a global store (errorToast.js) for displaying error messages, working together with ErrorHandlerToast.svelte; added error codes; added error translations; added translations for NavigationControl.svelte; initialized the global ErrorHandlerToast.svelte component in App.svelte; connected errorToast in Map.svelte to display errors.
- UPD:FIX:2026-01-14 => Updated and fixed
- UPD:2026-01-14 Deleted
- UPD:FIX:2026-01-14 => Map update
- UPD:2026-01-14 delete large files;
- UPD:FIX:2026-01-14 => Added offline navigation; Added navigation graph geojson; Fixed small visual bugs
- UPD:2026-01-13 => Map updated, added theme state
- UPD:FIX:2026-01-13 deleted unused variables
- UPD:FIX:2026-01-13 => Added Settings page; Added new component DarkModeToggler; Updated all locales; Updated LangSwitcher component;
- UPD:FIX:2026-01-12 => Comment upd.
- UPD:FIX:2026-01-13 => Added map.setMaxBounds
- UPD:FIX:2026-01-13 => Updated button style and ExitToast bottom coordinates;
- UPD:FIX:2026-01-12 i18n service moved to src/capacitor/services and updated logic; Added new dependencies; Updated appStorage.js utils;
- UPD:2026-01-12 => Dependencies updates.
- UPD:DEP:2025-12-26 Dependency updates;
- UPD:FIX:2025-12-04 Comments updated;
- UPD:FIX:2025-12-04 Coordinats updated; Added to handbook articles navigation with map; Added locales.
- UPD:2025-12-04 New dependencies added; Migration in localStorage to Capacitor Preferences storage API;
- UPD:2025-12-03 Dep updated; Added capacitor backButton native routable logic; Added new services toastController.js; Added locales from Toast component; Added Toast component and logic;
- UPD:FIX:2025-11-30 Map updated;
- UPD:2025-11-30 => Locales full updated.
- UPD:2025-11-30 duration style updated;
- UPD:FIX:2025-11-30 NavigationPostHook updated and fixed.
- UPD:FIX:2025-11-29 Added router-friendly back button logic hook; Map component updated.
- UPD:FIX:2025-11-29 Added new class MapPointsBuilder, encapsulates all logic for rendering point-based data (markers) and optional city boundaries on a MapLibre map.
- UPD:FIX:2025-11-28 Map.svelte new version; Deleted styles.json, added runtime-style generator; Added points with map; Created custom popup with map;
- UPD:FIX:2025-11-28 Fixed
- UPD:FIX:2025-11-28 First enabled version of map
- UPD:FIX:2025-11-27 Added new dev dependencies; Added script generator base style with MapLibre;
- UPD:2025-11-27 Delete dependencies
- UPD:2025-11-26 Map correctly working
- UPD:2025-11-25 TODO:For next time...
- UPD:FIX:2025-11-25 Added new style rules with LayoutSwitcher.svelte; Single i18n import and initial in App.svelte, and passed as props to components;
- UPD:2025-11-22 => Added uz translation;
- UPD:FIX:2025-11-20 Errors update; dependencies update;
- UPD:2025-11-20 New pmtiles and geo.json files added; New Dependencies; src/data/articles.js coordinates added.
- UPD:FIX:2025-11-20 -> Added new empty component; Reorganization icon files and stylesheets;
- UPD:FIX:2025-11-07 Added new filter component; Edited store navbar & panel logic; Edited rendering items;
- UPD:2025-11-06 Move i18nextSvelte in src/services to src/store;
- UPD:2025-11-06 Added commentaries;
- UPD:FIX:2025-11-04-05 Search system and component added; Handbook page updated;
- UPD:FIX:2025-11-04 Store modules updated; Added JSDoc and comments;
- UPD:FIX:2025-11-04 Added new dynamic component Panel; Updated filter LayoutSwitcher.svelte; Update locales.
- UPD:2025-11-03 Locales updated;
- UPD:2025-11-03 DEV Dependencies updated.
- UPD:2025-11-03 Deleted tailwind.config.js
- UPD:FIX:2025-11-03 The Card component updated;
- UPD:FIX:2025-11-02 Added first Handbook filter - LayoutSwitcher;
- UPD:2025-11-02 New icon added;
- UPD:FIX:2025-10-31 Added new icon; Delete Home component, fixed Router and other route paths;
- UPD:FIX:2025-10-31 Added icons from svelte component, and delete in assets_collection/Icons
- UPD:FIX:2025-10-31 Icon Fixes
- UPD:FIX:2025-10-31 Updates; Added collections; Fixed legacy runes; Created custom BottomTabbarNav.svelte
- UPD:FIX:2025-10-29 Visual bug fixes
- UPD:FIX:2025-10-29 Formating document;
- UPD:FIX:2025-10-29 Fixed rendering navigation links;
- UPD:FIX:2025-10-28 fixed
- UPD:FIX:2025-10-28 Added Routable component; Handbook - new style;
- UPD:2025-10-28 Added full pl articles localization;
- UPD:2025-10-28 fixed
- UPD:FIX:2025-10-28 Updated;
- UPD:FIX:2025-10-28 A state store for the Navbar component has been added; The Navbar is now global, and its state is provided by the store; When navigating between pages, the title in the Navbar changes; And added locales.
- UPD:FIX:2025-10-27 updated components
- UPD:2025-10-27 Starting localization
- UPD:2025-10-27 Updated
- UPD:2025-10-27 Ru localization added in articles;
- UPD:FIX:2025-10-27 => Starting added localization in articles to handbook;
- UPD:2025-10-26 Updates descriptions;
- UPD:2025-10-26 Readme updates; .vscode/extension.json updates; And Toolbar component updated;
- UPD:FIX:2025-10-26 => Created navigation component; Fixed use <Page /> component
- UPD:FIX:2025-10-25 => Added minimal routing
- UPD:FIX:2025-10-24 Micro fixes
- UPD:2025-10-24 import @ aliases added
- UPD:2025-10-24 Testing tailwindcss
- UPD:FIX:2025-10-23 => обновление
- UPD:FIX:2025-10-23 => Created locales store and locales; Created locale switcher component and logic; Added font and minimal rules; Added tailwindcss,@tailwindcss/vite dependencies; Added rules from .editorconfig
- UPD:2025-10-16 => Init project

### 🐛 Fixes
- hot fix
- Added new Article popup logic; Created global state with Article Popup.
- microfix
- release script update
- micro fixes
- First Google Play release
- Updates
- Added transition params to TabbarNav store; Micro fixes.
- Readme fixes.
- Locales updated; Micro fixes and more.
- Added new View; About view micro fixes.
- Removed and renaming About.
- Added release script; Added New brand accent color and etc...
- micro updates and fixes, added new style with ScreeSplash
- fixes
- Big updates, added custom SplashScreen, added App icon; Updates: locales, components, and etc...
- added tabbar store
- FIX:UPD:2026-02-27:: Micro fixes and update via component AboutProject
- Fixed visual bug
- navigation updates
- A-B navigation updates
- GPS navigation fixes and updates.
- Fixes LangSwitcher popover; Added focus in Searchbar component
- Fixes and new features.
- Dependencies update
- UPD:FIX::2026-02-16 => Updated build script command in package.json file; Theme manager updated; MapNavigationGPS click to new destination fixes.
- Micro fixes
- Fixed Dialog height
- Fixed error handling; Fixed NavigationSheet button and behavior
- GPS error messages fixed.
- UPD:FIX:2026-02-03 Fixed Dialog and mapFly
- Added new dialog.
- Improved interaction with the NavigationSheet component: now a single “Close” button handles three scenarios—(1) closes the NavigationSheet window; (2) if a mode has been chosen, returns to mode selection; (3) if a route has been built, opens a Dialog component with a warning. Added a Dialog component that warns about turning off navigation and lets the user choose whether to finish or not.
- UPD:FIX:2026-02-01: Added global store from LayoutSwitcher filter; Updated styles all Navigation components.
- UPD:FIX:2026-01-31 Updated Map; Updated NavigationSheet.
- UPD:FIX:2026-01-30 Deleted unused store and updated Map view.
- UPD:FIX:2026-01-30 Icons default className updated; Updated Map view and created new component.
- UPD:FIX:2026-01-16 Toasts fixed
- FIX:2026-01-16 Small fixes
- UPD:FIX:2026-01-16 Fixed A->B navigation; Added new Toast messages and locales.
- UPD:FIX:2026-01-16 => Updated;
- UPD:FIX:2026-01-16 Updated i18n service; Updated Settings view; Added new locales;
- UPD:FIX:2026-01-15 Added a global store (errorToast.js) for displaying error messages, working together with ErrorHandlerToast.svelte; added error codes; added error translations; added translations for NavigationControl.svelte; initialized the global ErrorHandlerToast.svelte component in App.svelte; connected errorToast in Map.svelte to display errors.
- UPD:FIX:2026-01-14 => Updated and fixed
- FIX:2026-01-14 Updated name
- UPD:FIX:2026-01-14 => Map update
- UPD:FIX:2026-01-14 => Added offline navigation; Added navigation graph geojson; Fixed small visual bugs
- UPD:FIX:2026-01-13 deleted unused variables
- FIX:2026-01-13 => Fixed initialization themeManager;
- UPD:FIX:2026-01-13 => Added Settings page; Added new component DarkModeToggler; Updated all locales; Updated LangSwitcher component;
- UPD:FIX:2026-01-12 => Comment upd.
- UPD:FIX:2026-01-13 => Added map.setMaxBounds
- UPD:FIX:2026-01-13 => Updated button style and ExitToast bottom coordinates;
- UPD:FIX:2026-01-12 i18n service moved to src/capacitor/services and updated logic; Added new dependencies; Updated appStorage.js utils;
- UPD:FIX:2025-12-04 Comments updated;
- UPD:FIX:2025-12-04 Coordinats updated; Added to handbook articles navigation with map; Added locales.
- FIX:2025-12-04 Svelte compiller warn disable
- FIX:2025-12-03 text size fixes
- UPD:FIX:2025-11-30 Map updated;
- UPD:FIX:2025-11-30 NavigationPostHook updated and fixed.
- UPD:FIX:2025-11-29 Added router-friendly back button logic hook; Map component updated.
- UPD:FIX:2025-11-29 Added new class MapPointsBuilder, encapsulates all logic for rendering point-based data (markers) and optional city boundaries on a MapLibre map.
- UPD:FIX:2025-11-28 Map.svelte new version; Deleted styles.json, added runtime-style generator; Added points with map; Created custom popup with map;
- UPD:FIX:2025-11-28 Fixed
- UPD:FIX:2025-11-28 First enabled version of map
- UPD:FIX:2025-11-27 Added new dev dependencies; Added script generator base style with MapLibre;
- UPD:FIX:2025-11-25 Added new style rules with LayoutSwitcher.svelte; Single i18n import and initial in App.svelte, and passed as props to components;
- UPD:FIX:2025-11-20 Errors update; dependencies update;
- UPD:FIX:2025-11-20 -> Added new empty component; Reorganization icon files and stylesheets;
- UPD:FIX:2025-11-07 Added new filter component; Edited store navbar & panel logic; Edited rendering items;
- UPD:FIX:2025-11-04-05 Search system and component added; Handbook page updated;
- UPD:FIX:2025-11-04 Store modules updated; Added JSDoc and comments;
- UPD:FIX:2025-11-04 Added new dynamic component Panel; Updated filter LayoutSwitcher.svelte; Update locales.
- UPD:FIX:2025-11-03 The Card component updated;
- UPD:FIX:2025-11-02 Added first Handbook filter - LayoutSwitcher;
- UPD:FIX:2025-10-31 Added new icon; Delete Home component, fixed Router and other route paths;
- UPD:FIX:2025-10-31 Added icons from svelte component, and delete in assets_collection/Icons
- UPD:FIX:2025-10-31 Icon Fixes
- UPD:FIX:2025-10-31 Updates; Added collections; Fixed legacy runes; Created custom BottomTabbarNav.svelte
- UPD:FIX:2025-10-29 Visual bug fixes
- UPD:FIX:2025-10-29 Formating document;
- UPD:FIX:2025-10-29 Fixed rendering navigation links;
- UPD:FIX:2025-10-28 fixed
- UPD:FIX:2025-10-28 Added Routable component; Handbook - new style;
- UPD:FIX:2025-10-28 Updated;
- UPD:FIX:2025-10-28 A state store for the Navbar component has been added; The Navbar is now global, and its state is provided by the store; When navigating between pages, the title in the Navbar changes; And added locales.
- UPD:FIX:2025-10-27 updated components
- UPD:FIX:2025-10-27 => Starting added localization in articles to handbook;
- UPD:FIX:2025-10-26 => Created navigation component; Fixed use <Page /> component
- UPD:FIX:2025-10-25 => Added minimal routing
- UPD:FIX:2025-10-24 Micro fixes
- UPD:FIX:2025-10-23 => обновление
- UPD:FIX:2025-10-23 => Created locales store and locales; Created locale switcher component and logic; Added font and minimal rules; Added tailwindcss,@tailwindcss/vite dependencies; Added rules from .editorconfig

### 🚀 Releases
- All finish. v1.0.0
- Visual bug fixes from RC.
- v1.0.0 Complite. Please check all info with: CHANGELOG.md
- Release candidate v1.0.0; Added new localizations; Rewrite PopupArticle.svelte component; Added new icon; Added dynamic appName.

### 📝 Other Changes
- Update README.md
- Add MIT License to the project
- Update project title to 'Polskie Ślady Taszkent'
- Merge pull request #10 from Ko2doo/dependabot/npm_and_yarn/npm_and_yarn-b2936519f3
- Build(deps-dev): Bump rollup
- Added new View More.svelte, Settings, About refactoring.
- Merge pull request #8 from Ko2doo/dependabot/npm_and_yarn/npm_and_yarn-d8a92739f9
- Build(deps): Bump the npm_and_yarn group across 1 directory with 3 updates
- Merge pull request #7 from Ko2doo/dependabot/npm_and_yarn/npm_and_yarn-01f5ad5e18
- Build(deps-dev): Bump tar in the npm_and_yarn group across 1 directory
- Merge pull request #6 from Ko2doo/dependabot/npm_and_yarn/npm_and_yarn-86c0509402
- Build(deps-dev): Bump @isaacs/brace-expansion
- TESTING
- Build(deps): Bump tar in the npm_and_yarn group across 1 directory
- Merge remote-tracking branch 'origin/dependabot/npm_and_yarn/npm_and_yarn-1b92d517bd'
- Build(deps): Bump devalue in the npm_and_yarn group across 1 directory
- Build(deps-dev): Bump glob in the npm_and_yarn group across 1 directory
- 2025-10-27 Updated pl translations;
- Merge pull request #1 from Ko2doo/dependabot/npm_and_yarn/npm_and_yarn-fd296dbd23
- Bump vite in the npm_and_yarn group across 1 directory

