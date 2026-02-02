// UI locales collection

export default {
  app: {
    name: 'Polskie Ślady w Taszkiencie',
  },
  sidePanel: {
    handbook: {
      title: 'Filtry',
      filters: {
        layoutTitle: 'Styl wyświetlania',
        layoutGrid: 'Kafelki',
        layoutRows: 'Lista',
        categoryTitle: 'Kategorie',
        category: {
          all: 'Wszystkie',
          places: 'Miejsca',
          heroes: 'Bohaterowie',
        },
      },
    },
  },
  navbar: {
    home: {
      title: 'Strona główna',
    },
    handbook: {
      title: 'Informator',
    },
    map: {
      title: 'Mapa',
    },
    about: {
      title: 'O nas',
    },
    settings: {
      title: 'Ustawienia',
    },
  },
  searchbar: {
    cancel: 'Anuluj',
    placeholder: 'Szukaj',
  },
  errors: {
    noArticleId: 'Brak ID artykułu w trasie.',
    articleNotFound: 'Artykuł nie został znaleziony!',
    notFound: 'Nic nie znaleziono',
    toastBtn: 'Zamknij',
    gpsInitFailed: 'Nie udało się zainicjować GPS',
    gpsError: 'Błąd GPS',
    gpsPositionNotAvailable: 'Pozycja GPS niedostępna',
    gpsWaitingForSignal: 'Czekamy na sygnał GPS…',
    gpsPermissionDenied: 'Odmowa dostępu do GPS. Zezwól na dostęp w ustawieniach aplikacji.',
    gpsOutOfBounds: 'Jesteś poza obszarem mapy. Nawigacja offline niedostępna.',
    gpsOutOfBoundsNavigation: 'Nawigacja niemożliwa - jesteś poza obszarem mapy',
    navigationInitFailed: 'Nie udało się zainicjować nawigacji',
    navigationCalculateRouteFailed: 'Nie udało się obliczyć trasy',
    navigationRouteNotFound: 'Nie znaleziono trasy',
    mapInitFailed: 'Nie udało się zainicjować mapy',
    mapThemeFailed: 'Nie udało się zastosować motywu',
    mapPMTilesFetch: 'Nie udało się załadować mapy',
  },
  buttons: {
    back: 'Powrót',
    readMore: 'Przeczytaj więcej..',
    langSwitcher: 'Język',
    toMaps: 'Pokaż na mapie',
    popupGetOtherMaps: 'Otwórz w Mapach Google',
    openSettings: 'Otwórz ustawienia',
  },
  hints: {
    enableGPSManually: 'Otwórz ustawienia urządzenia > Aplikacje > Polskie Slady > Uprawnienia > Lokalizacja',
  },
  toasts: {
    exitApp: 'Naciśnij „Wstecz” jeszcze raz, aby wyjść',
  },
  dialogue: {
    hello: 'Halo, Świat!',
  },
  modalSheet: {
    nav: {
      title: 'Wybierz tryb nawigacji',
    },
  },
  dialog: {
    nav: {
      title: 'Zakończyć nawigację?',
      yes: 'Tak',
      no: 'Nie',
    },
    map: {
      newRoute: {
        title: 'Wyznaczyć nową trasę?',
        yes: 'Tak',
        no: 'Nie',
      },
    },
  },
  map: {
    nav: {
      pointToPoint: 'Trasa A>B',
      navigate: 'Nawigacja',
      loading: 'Ładowanie...',
      cancel: 'Anuluj',
      exit: 'Wyjście',
    },
    gps: {
      navigate: 'Nawigacja GPS',
      instruction: 'Dotknij mapy, aby wybrać cel',
      routing: 'Trasa z bieżącej lokalizacji',
      arrived: 'Dotarłeś!',
      newRoute: 'Nowa trasa',
      backInBounds: '✅ Wróciłeś do obszaru mapy. Nawigacja dostępna.',
    },
    infoPanel: {
      setRoutePoints: 'Ustaw punkty trasy',
      startProg: 'Pierwsze dotknięcie - punkt startowy',
      endProg: 'Drugie dotknięcie - cel',
      info: 'Informacje o trasie',
      calc: 'Obliczanie trasy...',
      routeCalculated: 'Czas obliczania trasy:',
      distance: 'km',
      walk: 'min pieszo',
      waypoints: 'punktów',
      iterations: 'iteracji',
      time: 'ms',
      clear: 'Wyczyść',
      footerInfo: 'Dotknij ponownie, aby utworzyć nową trasę',
    },
  },
  settings: {
    translations: {
      title: 'Tłumaczenia',
      hint: 'Wybierz preferowany język. To ustawienie zostanie zapisane.',
    },
    appearance: {
      title: 'Wygląd',
      hint: 'Dostosuj wygląd aplikacji. Tryb automatyczny podąża za motywem systemowym.',
      darkMode: 'Ciemny motyw',
      followSystem: 'Zgodnie z systemem',
    },
  },
};
