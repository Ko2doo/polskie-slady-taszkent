# Быстрый старт

## Окружение

- Node.js ≥ 24 (точная версия в `.nvmrc`), npm ≥ 11.
- Для Android-сборки: JDK 21 (`java-21-openjdk`) и Android SDK.
- iOS собирает отдельный мейнтейнер (`README.md` → Maintainers). Если ваше изменение
  трогает нативную часть, опишите в PR, что нужно сделать на iOS.

```bash
nvm use
npm install
npm run dev
```

`npm run dev` запускает Vite с `--host`: приложение доступно в браузере на компьютере и с
телефона в той же сети. В браузере работает всё, кроме нативных функций. Вместо них
используются веб-реализации плагинов Capacitor: Filesystem поверх IndexedDB, геолокация
браузера, скачивание файла вместо системного меню «Поделиться».

## Команды

| Команда | Что делает |
| --- | --- |
| `npm run dev` | Dev-сервер Vite |
| `npm test` | Весь набор тестов один раз (Vitest) |
| `npm run test:watch` | Тесты в watch-режиме |
| `npm run test:coverage` | Тесты + отчёт покрытия в `coverage/` |
| `npm run lint` / `npm run lint:fix` | ESLint / с автоисправлением |
| `npm run format` / `npm run format:check` | Prettier: отформатировать / только проверить |
| `npm run build` | Сборка в `dist/`; перед ней `prebuild` запускает lint и format:check |
| `npm run build:sync:android` | `npx cap sync android`: копирует `dist/` и плагины в Android-проект |
| `npm run build:debugApp:android` | Debug APK через Gradle |
| `npm run build:all` | Сборка веба + sync + debug APK + release AAB |

`npm run release` и скрипты в `appstore/` запускает только мейнтейнер.

## Сборка на Android-устройство

```bash
npm run build
npm run build:sync:android
npx cap open android
```

Дальше в Android Studio выберите устройство и нажмите Run. После добавления
Capacitor-плагина или нового разрешения обязательно выполните `sync`: без него нативный
проект не узнает о плагине.

## Ветки и pull request

- `master` — релизная ветка, напрямую в неё не пишут.
- `features` — основная ветка разработки. Ваша ветка `feature/<имя>` или `fix/<имя>`
  создаётся от неё, PR открывается **в `features`**.
- Префикс заголовка коммита попадает в `CHANGELOG.md`: `UPD:` (новое или изменённое),
  `FIX:` (исправление), `UPD:FIX:` (и то и другое).

```bash
git fetch origin
git checkout -b feature/my-change origin/features
git commit -m "UPD: Add marker sorting"
git push -u origin feature/my-change
```

Без прав на запись работайте через форк, пошагово это описано в `CONTRIBUTING.md` →
«Opening a pull request».

## Перед PR

Чек-лист в `.github/pull_request_template.md`. Обязательно:

1. `npm test` зелёный целиком, а не только новые тесты.
2. `npm run lint` без ошибок, `npm run format:check` проходит, `npm run build` чистый.
3. Новая логика покрыта тестами. У исправления бага есть тест, который падает без исправления.
4. Новые строки интерфейса есть во всех четырёх локалях (`ru`, `en`, `pl`, `uz`).
5. Новых зависимостей нет, либо их согласовал мейнтейнер.
6. Документация в `docs/ru` и `docs/en` обновлена, если поменялось поведение модуля.

CI (`.github/workflows/ci.yml`, job `test-and-build`) прогоняет пункты 1–2 на каждый push и PR.
