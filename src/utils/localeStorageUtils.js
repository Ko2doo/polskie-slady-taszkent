// Local Storage helpers
export function setLocalStorage(key, value) {
  try {
    window.localStorage.setItem(key, value);
  } catch (error) {
    console.warn('localStorage set failed', error);
  }
}

export function getLocalStorage(key) {
  try {
    return window.localStorage.getItem(key);
  } catch (error) {
    console.warn('localStorage get failed', error);
    return null;
  }
}
