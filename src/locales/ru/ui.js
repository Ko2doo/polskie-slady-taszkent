// UI locales collection

export default {
  sidePanel: {
    handbook: {
      title: 'Фильтры',
      filters: {
        layoutTitle: 'Стиль отображения',
        layoutGrid: 'Плиткой',
        layoutRows: 'Списком',
        categoryTitle: 'Категории',
        category: {
          all: 'Все',
          places: 'Места',
          heroes: 'Герои',
        },
      },
    },
  },
  navbar: {
    home: {
      title: 'Главная',
    },
    handbook: {
      title: 'Справочник',
    },
    map: {
      title: 'Карта',
    },
    about: {
      title: 'О проекте',
    },
    technicalInfo: {
      title: 'Техническая информация',
    },
    more: {
      title: 'Ещё...',
    },
    settings: {
      title: 'Настройки',
    },
  },
  searchbar: {
    cancel: 'Отмена',
    placeholder: 'Поиск',
  },
  buttons: {
    back: 'Назад',
    skip: 'Пропустить',
    continue: 'Продолжить',
    enableNav: 'Включить навигацию',
    allow: 'Разрешить',
    waiting: 'Ожидание...',
    readMore: 'Подробнее',
    langSwitcher: 'Язык',
    toMaps: 'Показать на карте',
    popupGetOtherMaps: 'Открыть в Google Maps',
    openSettings: 'Открыть настройки',
  },
  hints: {
    enableGPSManually: 'Откройте настройки устройства > Приложения > Polskie Slady > Разрешения > Местоположение',
  },
  toasts: {
    exitApp: 'Нажмите назад ещё раз что-бы выйти',
  },
  dialogue: {
    hello: 'Привет, Мир!',
  },
  modalSheet: {
    nav: {
      title: 'Выберите режим навигации',
    },
  },
  dialog: {
    nav: {
      title: 'Завершить навигацию?',
      yes: 'Да',
      no: 'Нет',
    },
    map: {
      newRoute: {
        title: 'Построить новый маршрут?',
        yes: 'Да',
        no: 'Нет',
      },
    },
    onboarding: {
      step1Title: 'Добро пожаловать',
      step2Title: 'Доступ к местоположению',
      welcomeDialog:
        'Откройте польское наследие в Узбекистане: биографии, памятные места и удобная оффлайн-навигация по Ташкенту.',
      welcomeDialogSubtitle: 'Выберите удобный язык и тему оформления.',
      step1Locales: 'Язык интерфейса',
      step1Appearance: 'Оформление',
      step2Info: 'Включите навигацию',
      step2Msg: 'Для построения маршрутов к историческим местам приложению необходим доступ к вашему местоположению.',
      step2Warning: 'Ваши геоданные используются только для навигации и не передаются третьим лицам.',
      step2Alert: 'Разрешение отклонено. Вы можете включить его позже в настройках приложения.',
      step: 'Шаг',
      stepOf: 'из',
    },
  },
  map: {
    nav: {
      pointToPoint: 'Линейка',
      navigate: 'Навигация',
      loading: 'Загрузка...',
      cancel: 'Отмена',
      exit: 'Выйти',
    },
    gps: {
      navigate: 'Навигация с GPS',
      instruction: 'Нажмите на карту, чтобы выбрать пункт назначения',
      routing: 'Маршрут от текущего местоположения',
      arrived: 'Вы прибыли!',
      newRoute: 'Новый маршрут',
      backInBounds: '✅ Вы снова в зоне карты. Навигация доступна.',
    },
    infoPanel: {
      setRoutePoints: 'Установите точки маршрута',
      startProg: 'Первый клик - начальная точка',
      endProg: 'Второй клик - конечная точка',
      info: 'Информация о маршруте',
      calc: 'Расчёт маршрута...',
      routeCalculated: 'Маршрут рассчитан за:',
      distance: 'км',
      walk: 'мин пешком',
      waypoints: 'точек',
      iterations: 'итераций',
      time: 'мс',
      clear: 'Очистить',
      footerInfo: 'Нажмите снова, чтобы построить новый маршрут',
    },
  },
  settings: {
    translations: {
      title: 'Переводы',
      hint: 'Выберите предпочитаемый язык. Этот параметр будет сохранён.',
    },
    appearance: {
      title: 'Внешний вид',
      hint: 'Настройте внешний вид приложения. Автоматический режим следует за системной темой.',
      darkMode: 'Тёмная тема',
      followSystem: 'Следовать системе',
    },
    permissions: {
      title: 'Разрешения',
      hint: 'Открывает настройки разрешений выданных приложению.',
    },
  },
  more: {
    menuListItem: {
      settingsTitle: 'Настройки',
      aboutTitle: 'О проекте',
      technicalInfoTitle: 'Техническая информация',
    },
  },
};
