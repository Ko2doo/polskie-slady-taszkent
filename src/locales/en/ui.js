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
    gpsInitFailed: 'Failed to initialize GPS',
    gpsError: 'GPS error',
    gpsPositionNotAvailable: 'GPS position not available',
    gpsWaitingForSignal: 'Waiting for GPS signal…',
    gpsPermissionDenied: 'GPS permission denied. Please allow access in app settings.',
    gpsOutOfBounds: 'You are outside the map area. Offline navigation unavailable.',
    gpsOutOfBoundsNavigation: 'Navigation impossible - you are outside the map',
    navigationInitFailed: 'Failed to initialize navigation',
    navigationCalculateRouteFailed: 'Failed to calculate route',
    navigationRouteNotFound: 'Route not found',
    mapInitFailed: 'Failed to initialize map',
    mapThemeFailed: 'Failed to apply theme',
    mapPMTilesFetch: 'Failed to load map',
  },
  buttons: {
    back: 'Back',
    readMore: 'Read more..',
    langSwitcher: 'Language',
    toMaps: 'Show on map',
    popupGetOtherMaps: 'Open in Google Maps',
    openSettings: 'Open settings',
  },
  hints: {
    enableGPSManually: 'Open device settings > Apps > Polskie Slady > Permissions > Location',
  },
  toasts: {
    exitApp: 'Press Back again to exit',
  },
  dialogue: {
    hello: 'Hello, World!',
  },
  modalSheet: {
    nav: {
      title: 'Choose a navigation mode',
    },
  },
  dialog: {
    nav: {
      title: 'End navigation?',
      yes: 'Yes',
      no: 'No',
    },
    map: {
      newRoute: {
        title: 'Build a new route?',
        yes: 'Yes',
        no: 'No',
      },
    },
  },
  map: {
    nav: {
      pointToPoint: 'Route A>B',
      navigate: 'Navigate',
      loading: 'Loading...',
      cancel: 'Cancel',
      exit: 'Exit',
    },
    gps: {
      navigate: 'GPS Navigation',
      instruction: 'Tap on the map to select destination',
      routing: 'Route from current location',
      arrived: 'You have arrived!',
      newRoute: 'New route',
      backInBounds: "✅ You're back in map area. Navigation available.",
    },
    infoPanel: {
      setRoutePoints: 'Set route points',
      startProg: 'First tap - starting point',
      endProg: 'Second tap - destination',
      info: 'Route information',
      calc: 'Calculating route...',
      routeCalculated: 'Route calculated in:',
      distance: 'km',
      walk: 'min walk',
      waypoints: 'waypoints',
      iterations: 'iterations',
      time: 'ms',
      clear: 'Clear',
      footerInfo: 'Tap again to build a new route',
    },
  },
  settings: {
    translations: {
      title: 'Translations',
      hint: 'Select your preferred language. This setting will be saved.',
    },
    appearance: {
      title: 'Appearance',
      hint: "Customize the app's look. Auto mode follows your system theme.",
      darkMode: 'Dark theme',
      followSystem: 'Follow system',
    },
  },
};
