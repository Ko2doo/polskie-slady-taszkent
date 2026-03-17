/**
 * Safely extract the string path from route.result.
 * The router may return result.path either as a string or as an object of the form { before, after, original }.
 * We carefully try all options.
 */
export function getRawPathFromRoute(result) {
  if (!result) '';

  // 1 variant if path type string
  if (typeof result.path === 'string') {
    return result.path;
  }

  // 2 variant if path type object
  if (result.path && typeof result.path === 'object') {
    if (typeof result.path.after === 'string') return result.path.after;
    if (typeof result.path.original === 'string') return result.path.original;
    if (typeof result.path.before === 'string') return result.path.before;
  }

  return '';
}

/**
 * Mapping raw paths to a "page key".
 * We then use this key for:
 *    localization (pages:<key>:title)
 *    Navbar logic (what to show)
 */
export function resolvePageKeyFromRouteResult(result) {
  const rawPath = getRawPathFromRoute(result);

  switch (rawPath) {
    case '/':
      return 'map';

    case '/handbook':
      return 'handbook';

    case '/more':
      return 'more';

    case '/settings':
      return 'settings';

    case '/about':
      return 'about';

    default:
      // fallback
      return 'map';
  }
}
