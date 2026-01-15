// UI locales collection

export default {
  app: {
    name: 'Polish Traces in Tashkent',
  },
  sidePanel: {
    handbook: {
      title: 'Filters',
      filters: {
        layoutTitle: 'Display style',
        layoutGrid: 'Grid',
        layoutRows: 'List',
        categoryTitle: 'Categories',
        category: {
          all: 'All',
          places: 'Places',
          heroes: 'Heroes',
        },
      },
    },
  },
  navbar: {
    home: {
      title: 'Home',
    },
    handbook: {
      title: 'Handbook',
    },
    map: {
      title: 'Map',
    },
    about: {
      title: 'About us',
    },
    settings: {
      title: 'Settings',
    },
  },
  searchbar: {
    cancel: 'Cancel',
    placeholder: 'Search',
  },
  errors: {
    noArticleId: 'No article ID in the route.',
    articleNotFound: 'Article not found!',
    notFound: 'Nothing found',
    toastBtn: 'Close',
    navigationInitFailed: 'Failed to load navigation. Please try again.',
    navigationCalculateRouteFailed: 'An error occurred while calculating the route.',
    navigationRouteNotFound: 'Route not found',
    mapThemeFailed: 'Failed to apply theme',
    mapPMTilesFetch: 'Failed to fetch PMTiles',
    mapInitFailed: 'Failed to initialize map. Please refresh the page.',
  },
  buttons: {
    back: 'Back',
    readMore: 'Read more..',
    langSwitcher: 'Language',
    toMaps: 'Show on map',
    popupGetOtherMaps: 'Open in Google Maps',
  },
  toasts: {
    exitApp: 'Press Back again to exit',
  },
  dialogue: {
    hello: 'Hello, World!',
  },
  map: {
    nav: {
      loading: 'Loading...',
      exit: 'Exit Navigation',
      navigate: 'Navigate',
    },
    infoPanel: {
      calc: 'Calculating route...',
      info: 'Route Info',
      time: 'ms',
      distance: 'km',
      walk: 'min walking',
      waypoints: 'waypoints',
      iterations: 'iterations',
      clear: 'Clear Route',
      setRoutePoints: 'Set Route Points',
      startProg: 'Tap on the map to set <strong>start point</strong>',
      endProg: 'Tap again to set <strong>destination</strong>',
      footerInfo: 'The route will be calculated automatically',
    },
  },
  settings: {
    translations: {
      title: 'Translations',
    },
    appearance: {
      title: 'Appearance',
      darkMode: 'Dark theme',
      followSystem: 'Follow system',
    },
  },
};
