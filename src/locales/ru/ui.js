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
    navigationInitFailed: 'Не удалось загрузить навигацию. Пожалуйста, попробуйте ещё раз.',
    navigationCalculateRouteFailed: 'Произошла ошибка при расчёте маршрута.',
    navigationRouteNotFound: 'Маршрут не найден',
    mapThemeFailed: 'Не удалось применить тем',
    mapPMTilesFetch: 'Не удалось получить PMTiles',
    mapInitFailed: 'Не удалось инициализировать карту. Обновите страницу.',
  },
  buttons: {
    back: 'Назад',
    readMore: 'Читать далее..',
    langSwitcher: 'Язык',
    toMaps: 'Показать на карте',
    popupGetOtherMaps: 'Открыть в Google Maps',
  },
  toasts: {
    exitApp: 'Нажмите назад ещё раз что-бы выйти',
  },
  dialogue: {
    hello: 'Привет, Мир!',
  },
  map: {
    nav: {
      loading: 'Загрузка...',
      exit: 'Выйти из навигации',
      navigate: 'Начать навигацию',
    },
    infoPanel: {
      calc: 'Расчёт маршрута...',
      info: 'Информация о маршруте',
      time: 'мс',
      distance: 'км',
      walk: 'мин пешком',
      waypoints: 'путевые точки',
      iterations: 'итерации',
      clear: 'Очистить маршрут',
      setRoutePoints: 'Задать точки маршрута',
      startProg: 'Нажмите на карту, чтобы задать <strong>точку старта</strong>',
      endProg: 'Нажмите ещё раз, чтобы задать <strong>пункт назначения</strong>',
      footerInfo: 'Маршрут будет рассчитан автоматически',
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
