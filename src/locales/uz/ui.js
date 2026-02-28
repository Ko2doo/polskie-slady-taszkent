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
  more: {
    about: {
      popupTitle: 'Loyiha haqida',
      info: '<b>Oflayn GPS navigatsiyaga ega ma’lumotnoma ilovasi.</b> <p class="mt-4">U hozirgi O‘zbekiston hududida yashab, mintaqa tarixida muhim iz qoldirgan polyaklar bilan bog‘liq joylarni topish va o‘rganishga yordam beradi.<p class="mt-2">2025 yilda Agnieszka Mikulec tomonidan tashkil etilgan va O‘zbekistondagi polyaklar tarixiga bag‘ishlangan tadbir hamda ishtirokchilarga tarqatilgan qog‘oz marshrut xaritalari ushbu loyihaning raqamli shaklini yaratishga ilhom bo‘ldi — internetga ulanmasdan foydalanish mumkin bo‘lgan mobil ilova aynan shu g‘oya asosida yaratilgan.</p></p>',
    },
  },
};
