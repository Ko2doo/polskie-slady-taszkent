// UI locales collection

export default {
  app: {
    name: 'Toshkentdagi Polsha izlari',
  },
  sidePanel: {
    handbook: {
      title: 'Filtrlar',
      filters: {
        layoutTitle: 'Ko‘inish uslubi',
        layoutGrid: 'Plitkalar',
        layoutRows: 'Ro‘yxat',
        categoryTitle: 'Kategoriyalar',
        category: {
          all: 'Barchasi',
          places: 'Joylar',
          heroes: 'Qahramonlar',
        },
      },
    },
  },
  navbar: {
    home: {
      title: 'Bosh sahifa',
    },
    handbook: {
      title: 'Ma‘lumotnoma',
    },
    map: {
      title: 'Xarita',
    },
    about: {
      title: 'Biz haqimizda',
    },
    settings: {
      title: 'Sozlamalar',
    },
  },
  searchbar: {
    cancel: 'Bekor qilish',
    placeholder: 'Qidirish',
  },
  errors: {
    noArticleId: 'Marshrutta maqola ID si yo‘q.',
    articleNotFound: 'Maqola topilmadi!',
    notFound: 'Hech narsa topilmadi',
    toastBtn: 'Yopish',
    gpsInitFailed: 'GPS ishga tushirilmadi',
    gpsError: 'GPS xatosi',
    gpsPositionNotAvailable: 'GPS joylashuvi mavjud emas',
    gpsPermissionDenied: 'GPS ruxsati berilmagan. Ilova sozlamalarida ruxsat bering.',
    gpsOutOfBounds: 'Siz xarita hududidan tashqaridasiz. Oflayn navigatsiya mavjud emas.',
    gpsOutOfBoundsNavigation: 'Navigatsiya imkonsiz - siz xarita hududidan tashqaridasiz',
    navigationInitFailed: 'Navigatsiya ishga tushirilmadi',
    navigationCalculateRouteFailed: "Yo'nalish hisoblanmadi",
    navigationRouteNotFound: "Yo'nalish topilmadi",
    mapInitFailed: 'Xarita ishga tushirilmadi',
    mapThemeFailed: "Mavzu qo'llanilmadi",
    mapPMTilesFetch: 'Xarita yuklanmadi',
  },
  buttons: {
    back: 'Orqaga',
    readMore: 'Ko‘proq o‘qish..',
    langSwitcher: 'Til',
    toMaps: 'Xaritada ko‘rsatish',
    popupGetOtherMaps: 'Google Xaritalarda ochish',
    openSettings: 'Sozlamalarni ochish',
  },
  hints: {
    enableGPSManually: 'Qurilma sozlamalari > Ilovalar > Polskie Slady > Ruxsatlar > Joylashuv',
  },
  toasts: {
    exitApp: 'Chiqish uchun yana bir marta Orqaga bosing',
  },
  dialogue: {
    hello: 'Salom, Dunyo!',
  },
  modalSheet: {
    nav: {
      title: 'Navigatsiya rejimini tanlang',
      subtitle: 'Ushbu oynani yopsangiz ham navigatsiya tugamaydi.',
    },
  },
  map: {
    nav: {
      pointToPoint: "Yo'nalish A>B",
      navigate: 'Navigatsiya',
      loading: 'Yuklanmoqda...',
      cancel: 'Bekor qilish',
      exit: 'Chiqish',
    },
    gps: {
      navigate: 'GPS Navigatsiya',
      instruction: 'Manzilni tanlash uchun xaritaga bosing',
      routing: "Joriy joydan yo'nalish",
      arrived: 'Siz yetib keldingiz!',
      newRoute: "Yangi yo'nalish",
      backInBounds: '✅ Siz yana xarita hududidasiz. Navigatsiya mavjud.',
    },
    infoPanel: {
      setRoutePoints: "Yo'nalish nuqtalarini belgilang",
      startProg: "Birinchi bosish - boshlang'ich nuqta",
      endProg: 'Ikkinchi bosish - manzil',
      info: "Yo'nalish haqida ma'lumot",
      calc: "Yo'nalish hisoblanmoqda...",
      routeCalculated: 'Marshrut hisoblash vaqti:',
      distance: 'km',
      walk: 'daqiqa piyoda',
      waypoints: 'nuqtalar',
      iterations: 'iteratsiyalar',
      time: 'ms',
      clear: 'Tozalash',
      footerInfo: "Yangi yo'nalish yaratish uchun yana bosing",
    },
  },
  settings: {
    translations: {
      title: 'Tarjimalar',
      hint: 'Afzal ko‘rgan tilingizni tanlang. Bu sozlama saqlanadi.',
    },
    appearance: {
      title: 'Ko‘rinish',
      hint: "Ilova ko'\rinishini sozlang. Avtomatik rejim tizim mavzusiga amal qiladi.",
      darkMode: 'Qorong‘i mavzu',
      followSystem: 'Tizimga ergashish',
    },
  },
};
