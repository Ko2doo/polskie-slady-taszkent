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
    navigationInitFailed: 'Nie udało się wczytać nawigacji. Spróbuj ponownie.',
    navigationCalculateRouteFailed: 'Wystąpił błąd podczas obliczania trasy.',
    navigationRouteNotFound: 'Nie znaleziono trasy',
    mapThemeFailed: 'Nie udało się zastosować motywu',
    mapPMTilesFetch: 'Nie udało się pobrać PMTiles',
    mapInitFailed: 'Nie udało się zainicjować mapy. Odśwież stronę.',
  },
  buttons: {
    back: 'Powrót',
    readMore: 'Przeczytaj więcej..',
    langSwitcher: 'Język',
    toMaps: 'Pokaż na mapie',
    popupGetOtherMaps: 'Otwórz w Mapach Google',
  },
  toasts: {
    exitApp: 'Naciśnij „Wstecz” jeszcze raz, aby wyjść',
  },
  dialogue: {
    hello: 'Halo, Świat!',
  },
  map: {
    nav: {
      loading: 'Ładowanie...',
      exit: 'Zakończ nawigację',
      navigate: 'Nawiguj',
    },
    infoPanel: {
      calc: 'Obliczanie trasy...',
      info: 'Informacje o trasie',
      time: 'ms',
      distance: 'km',
      walk: 'min pieszo',
      waypoints: 'punkty pośrednie',
      iterations: 'iteracje',
      clear: 'Wyczyść trasę',
      setRoutePoints: 'Ustaw punkty trasy',
      startProg: 'Stuknij w mapę, aby ustawić <strong>punkt startu</strong>',
      endProg: 'Stuknij ponownie, aby <strong>ustawić cel</strong>',
      footerInfo: 'Trasa zostanie obliczona automatycznie',
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
