// UI locales collection

export default {
  app: {
    name: 'Польские Следы в Ташкенте',
  },
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
      title: 'О нас',
    },
    settings: {
      title: 'Настройки',
    },
  },
  searchbar: {
    cancel: 'Отмена',
    placeholder: 'Поиск',
  },
  errors: {
    noArticleId: 'Нет ID статьи в маршруте.',
    articleNotFound: 'Статья не найдена!',
    notFound: 'Ничего не найдено',
    toastBtn: 'Закрыть',
    gpsInitFailed: 'Не удалось инициализировать GPS',
    gpsError: 'Ошибка GPS',
    gpsPositionNotAvailable: 'GPS позиция недоступна',
    gpsWaitingForSignal: 'Ждём сигнала GPS...',
    gpsPermissionDenied: 'Доступ к GPS запрещён. Разрешите доступ в настройках приложения.',
    gpsOutOfBounds: 'Вы находитесь за пределами карты. Оффлайн навигация недоступна.',
    gpsOutOfBoundsNavigation: 'Навигация невозможна - вы за пределами карты',
    navigationInitFailed: 'Не удалось инициализировать навигацию',
    navigationCalculateRouteFailed: 'Не удалось рассчитать маршрут',
    navigationRouteNotFound: 'Маршрут не найден',
    mapInitFailed: 'Не удалось инициализировать карту',
    mapThemeFailed: 'Не удалось применить тему',
    mapPMTilesFetch: 'Не удалось загрузить карту',
  },
  buttons: {
    back: 'Назад',
    readMore: 'Читать далее..',
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
  },
  map: {
    nav: {
      pointToPoint: 'Маршрут А>Б',
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
  },
};
