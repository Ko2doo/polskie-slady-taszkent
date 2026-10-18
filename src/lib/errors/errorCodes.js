// Error codes collection

export const ERROR_CODES = {
  // Navigation
  NAV_INIT: 'NAV_INIT',
  NAV_ROUTE_CALC: 'NAV_ROUTE_CALC',
  NAV_ROUTE_NOT_FOUND: 'NAV_ROUTE_NOT_FOUND',

  // GPS navigation (views/Map/Navigation/GPS/MapGPSMessages.js)
  GPS_ERROR: 'GPS_ERROR', // a tracker error without a known geolocation code
  GPS_WAITING_FOR_FIX: 'GPS_WAITING_FOR_FIX',
  GPS_OUT_OF_BOUNDS: 'GPS_OUT_OF_BOUNDS',
  GPS_OUT_OF_BOUNDS_NAVIGATION: 'GPS_OUT_OF_BOUNDS_NAVIGATION',

  // Custom points export/import (components/CustomPoints/CustomPointsTransfer.svelte)
  POINTS_EXPORT_FAILED: 'POINTS_EXPORT_FAILED',
  POINTS_IMPORT_REFUSED: 'POINTS_IMPORT_REFUSED', // the file was not imported; the text says why

  // Map
  MAP_THEME_FAILED: 'MAP_THEME_FAILED',
  MAP_INIT_FAILED: 'MAP_INIT_FAILED',
  PMTILES_FETCH: 'PMTILES_FETCH',

  WEB_PLATFORM_NOT_SUPPORTED: 'WEB_PLATFORM_NOT_SUPPORTED',

  // Capacitor geolocation API code
  // https://capacitorjs.com/docs/apis/geolocation#errors
  // The plugin reports them hyphenated (OS-PLUG-GLOC-0007); the app keeps them underscored —
  // mapGeolocationError (capacitor/services/locationPermission.js) normalizes one to the other.
  OS_PLUG_GLOC_0002: 'OS_PLUG_GLOC_0002',
  OS_PLUG_GLOC_0003: 'OS_PLUG_GLOC_0003',
  OS_PLUG_GLOC_0004: 'OS_PLUG_GLOC_0004',
  OS_PLUG_GLOC_0005: 'OS_PLUG_GLOC_0005',
  OS_PLUG_GLOC_0006: 'OS_PLUG_GLOC_0006',
  OS_PLUG_GLOC_0007: 'OS_PLUG_GLOC_0007',
  OS_PLUG_GLOC_0008: 'OS_PLUG_GLOC_0008',
  OS_PLUG_GLOC_0009: 'OS_PLUG_GLOC_0009',
  OS_PLUG_GLOC_0010: 'OS_PLUG_GLOC_0010',
  OS_PLUG_GLOC_0011: 'OS_PLUG_GLOC_0011',
  OS_PLUG_GLOC_0012: 'OS_PLUG_GLOC_0012',
  OS_PLUG_GLOC_0013: 'OS_PLUG_GLOC_0013',
  OS_PLUG_GLOC_0014: 'OS_PLUG_GLOC_0014',
  OS_PLUG_GLOC_0015: 'OS_PLUG_GLOC_0015',
  OS_PLUG_GLOC_0016: 'OS_PLUG_GLOC_0016',
  OS_PLUG_GLOC_0017: 'OS_PLUG_GLOC_0017',

  // Capacitor filesystem API codes
  // https://capacitorjs.com/docs/apis/filesystem#errors
  OS_PLUG_FILE_0008: 'OS-PLUG-FILE-0008', // Operation failed because file does not exist
  OS_PLUG_FILE_0010: 'OS-PLUG-FILE-0010', // Directory already exists, cannot be overwritten

  // Capacitor camera API codes
  // https://capacitorjs.com/docs/apis/camera#errors
  OS_PLUG_CAMR_0003: 'OS-PLUG-CAMR-0003', // Couldn't access camera (permission)
  OS_PLUG_CAMR_0005: 'OS-PLUG-CAMR-0005', // Couldn't access the photo gallery (permission)
  OS_PLUG_CAMR_0006: 'OS-PLUG-CAMR-0006', // Take photo was canceled
  OS_PLUG_CAMR_0020: 'OS-PLUG-CAMR-0020', // Choose from gallery was canceled
};

// Prefix of every app-side (normalized) geolocation code in ERROR_CODES
export const GEOLOCATION_CODE_PREFIX = 'OS_PLUG_GLOC_';
