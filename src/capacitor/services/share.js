/**
 * System share sheet (Capacitor Share plugin): hands a file to whatever app the user picks —
 * Google Drive, Files, a messenger. API: https://capacitorjs.com/docs/apis/share
 */

import { Share } from '@capacitor/share';
import { createLogger, IS_DEBUG } from '@/utils/debugMode';

const shareLogger = createLogger('Share');

// The plugin has no error code for a sheet closed without a choice, only this message
// (SharePlugin.java activityResult, SharePlugin.swift completionWithItemsHandler)
const SHARE_CANCELED_MESSAGE = 'Share canceled';

/**
 * Open the share sheet for one file.
 *
 * @param {Object} options - What to share
 * @param {string} options.uri - file:// uri of the file (see appFiles.writeShareableTextFile)
 * @param {string} options.title - Subject line, for apps that use one (mail); already translated
 * @param {string} options.dialogTitle - Title of the share sheet (Android); already translated
 * @returns {Promise<'shared'|'cancelled'>} 'cancelled' when the user closed the sheet
 * @throws {Error} when the sheet could not be shown or the sharing failed
 *
 * @example
 * const uri = await writeShareableTextFile('exports/points.json', text);
 * const outcome = await shareFile({ uri, title: i18n.t('...'), dialogTitle: i18n.t('...') });
 */
export async function shareFile({ uri, title, dialogTitle }) {
  try {
    await Share.share({ title, dialogTitle, files: [uri] });
    return 'shared';
  } catch (error) {
    if (error?.message === SHARE_CANCELED_MESSAGE) {
      IS_DEBUG && shareLogger.log('Share sheet closed without a choice');
      return 'cancelled';
    }

    IS_DEBUG && shareLogger.error('Share.share failed:', error);
    throw error;
  }
}
