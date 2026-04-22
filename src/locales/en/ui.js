// UI locales collection

export default {
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
      title: 'About the project',
    },
    technicalInfo: {
      title: 'Technical Information',
    },
    more: {
      title: 'More...',
    },
    settings: {
      title: 'Settings',
    },
  },
  searchbar: {
    cancel: 'Cancel',
    placeholder: 'Search',
  },
  buttons: {
    back: 'Back',
    skip: 'Skip',
    continue: 'Continue',
    enableNav: 'Enable navigation',
    allow: 'Allow',
    waiting: 'Waiting...',
    readMore: 'Details',
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
    onboarding: {
      step1Title: 'Welcome',
      step2Title: 'Location access',
      welcomeDialog:
        'Discover the Polish heritage in Uzbekistan: biographies, memorial sites, and convenient offline navigation around Tashkent.',
      welcomeDialogSubtitle: 'Choose your preferred language and theme.',
      step1Locales: 'Interface language',
      step1Appearance: 'Appearance',
      step2Info: 'Enable navigation',
      step2Msg: 'To build routes to historical places, the app needs access to your location.',
      step2Warning: 'Your location data are used only for navigation and are not shared with third parties.',
      step2Alert: 'Permission was denied. You can enable it later in the app settings.',
      step: 'Step',
      stepOf: 'of',
    },
  },
  map: {
    nav: {
      pointToPoint: 'Ruler',
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
    permissions: {
      title: 'Permissions',
      hint: 'Opens the settings of permissions granted to the application.',
    },
  },
  more: {
    menuListItem: {
      settingsTitle: 'Settings',
      aboutTitle: 'About the project',
      technicalInfoTitle: 'Technical Information',
    },
  },
};
