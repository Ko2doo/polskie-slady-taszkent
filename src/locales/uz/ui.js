// UI locales collection

export default {
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
    map: {
      title: 'Filtrlar',
      filters: {
        markersTitle: 'Xaritadagi belgilar',
        all: 'Barchasi',
        custom: 'Shaxsiy',
        historical: 'Tarixiy',
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
      editMode: 'Xaritani tahrirlash rejimi',
    },
    about: {
      title: 'Loyiha haqida',
    },
    technicalInfo: {
      title: 'Texnik ma’lumotlar',
    },
    more: {
      title: 'Ko‘proq...',
    },
    settings: {
      title: 'Sozlamalar',
    },
  },
  searchbar: {
    cancel: 'Bekor qilish',
    placeholder: 'Qidirish',
  },
  buttons: {
    back: 'Orqaga',
    skip: 'O‘tkazib yuborish',
    continue: 'Davom etish',
    enableNav: 'Navigatsiyani yoqish',
    allow: 'Ruxsat berish',
    waiting: 'Kutilmoqda...',
    readMore: 'Batafsil',
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
    },
  },
  dialog: {
    nav: {
      title: 'Navigatsiyani tugatilsinmi?',
      yes: 'Ha',
      no: 'Yo‘q',
    },
    map: {
      newRoute: {
        title: 'Yangi marshrut tuzilsinmi?',
        yes: 'Ha',
        no: 'Yo‘q',
      },
    },
    onboarding: {
      step1Title: 'Xush kelibsiz',
      step2Title: 'Joylashuvga kirish',
      welcomeDialog:
        'O‘zbekistondagi polyak merosini kashf eting: tarjimai hollar, xotira maskanlari va Toshkent bo‘ylab qulay oflayn navigatsiya.',
      welcomeDialogSubtitle: 'Qulay til va mavzuni tanlang.',
      step1Locales: 'Interfeys tili',
      step1Appearance: 'Ko‘rinish',
      step2Info: 'Navigatsiyani yoqish',
      step2Msg: 'Tarixiy joylarga marshrut tuzish uchun ilova sizning joylashuvingizga kirish huquqini talab qiladi.',
      step2Warning:
        'Sizning joylashuv ma’lumotlaringiz faqat navigatsiya uchun ishlatiladi va uchinchi shaxslarga uzatilmaydi.',
      step2Alert: 'Ruxsat rad etildi. Uni keyinroq ilova sozlamalarida yoqishingiz mumkin.',
      step: 'Bosqich',
      stepOf: 'dan',
    },
  },
  map: {
    nav: {
      pointToPoint: 'Chizg‘ich',
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
    userCustomPoints: {
      message: 'Xaritani tahrirlash rejimiga xush kelibsiz!',
      instruction:
        'Bu rejimda xaritada o‘zingizning belgilaringizni yaratishingiz mumkin. Belgi qo‘shish uchun xaritani shunchaki bosing.',
      dialogButton: 'Tushunarli',
    },
    mapEditor: {
      coords: 'Koordinatalar: {{coords}}',
      modalTitleCreate: 'Belgi yaratish',
      modalTitleUpdates: "Ma'lumotlarni yangilash",
      title: 'Joy nomi',
      titlePlaceholder: 'Joy nomini kiriting',
      preview: 'Joy surati (kamera ochiladi)',
      description: 'Batafsil tavsif',
      descriptionPlaceholder: 'Tavsifni kiriting',
      charCount: 'Simvollar: {{count}} / {{max}}',
      photosTitle: 'Suratlar',
      photosHint: 'Ko‘pi bilan {{max}} ta surat. Birinchi surat belgining muqovasi bo‘ladi.',
      photosCount: 'Suratlar: {{count}} / {{max}}',
      photosAdd: 'Surat qo‘shish',
      photosTake: 'Suratga olish',
      photosChoose: 'Galereyadan tanlash',
      photosCover: 'Muqova',
      photosRemove: 'Suratni o‘chirish',
      save: 'Saqlash',
      cancel: 'Bekor qilish',
      update: 'Yangilash',
      deleteTitle: 'Belgi o‘chirilsinmi?',
      deleteMessage: 'Belgi va uning tavsifi butunlay o‘chiriladi.',
      delete: 'O‘chirish',
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
    permissions: {
      title: 'Ruxsatlar',
      hint: 'Ilovaga berilgan ruxsatlar sozlamalarini ochadi.',
    },
  },
  more: {
    menuListItem: {
      settingsTitle: 'Sozlamalar',
      aboutTitle: 'Loyiha haqida',
      technicalInfoTitle: 'Texnik ma’lumotlar',
    },
  },
};
