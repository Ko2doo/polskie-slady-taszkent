/**
 * Locale resources import
 * Please, use alphabet sort
 */

import localesCollectionEN from './en';
import localesCollectionPL from './pl';
import localesCollectionRU from './ru';
import localesCollectionUZ from './uz';

const resources = {
  en: { ...localesCollectionEN },
  pl: { ...localesCollectionPL },
  ru: { ...localesCollectionRU },
  uz: { ...localesCollectionUZ },
};

export default resources;
