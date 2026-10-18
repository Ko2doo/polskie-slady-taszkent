/**
 * Save a text file through the browser's download — for the web/dev build, where the native share
 * sheet isn't there. Doesn't work inside the app's WebView on a device: use the share sheet there.
 *
 * @param {string} fileName - Name the browser saves the file under
 * @param {string} text - File content
 * @param {string} [mimeType] - Content type
 * @returns {void}
 *
 * @example
 * if (!Capacitor.isNativePlatform()) downloadTextFile('points.json', text, 'application/json');
 */
export function downloadTextFile(fileName, text, mimeType = 'text/plain') {
  const url = URL.createObjectURL(new Blob([text], { type: mimeType }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  // Released on the next tick: some browsers start the download only after the click returns
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
