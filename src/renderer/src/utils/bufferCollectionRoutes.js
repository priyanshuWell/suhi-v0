/**
 * Routes where video buffer collection runs (max 1 minute per page visit).
 * BIA routes are handled inside BIACalcuate because they share useBIARecording.
 */
export const BUFFER_COLLECTION_MAX_MS = 60000;

const ROUTE_BUFFER_TYPES = [
  { prefix: '/bia/', exclude: ['/bia/result'], bufferType: 'BIA' },
  { prefix: '/voice', bufferType: 'VOICE' },
  { prefix: '/colorblindness', bufferType: 'COLOR_BLINDNESS' },
  { prefix: '/space-convoy-main', bufferType: 'SPACE_CONVOY' },
  { prefix: '/divide-attention', bufferType: 'SPACE_CONVOY' },
  { prefix: '/space-convoy-complete', bufferType: 'SPACE_CONVOY' },
];

export function getBufferCollectionConfig(pathname) {
  for (const route of ROUTE_BUFFER_TYPES) {
    const matchesPrefix = route.prefix.endsWith('/')
      ? pathname.startsWith(route.prefix)
      : pathname === route.prefix || pathname.startsWith(`${route.prefix}/`);

    if (!matchesPrefix) continue;

    if (route.exclude?.some((excluded) => pathname.startsWith(excluded))) {
      return null;
    }

    return {
      bufferType: route.bufferType,
    };
  }

  return null;
}

export function shouldCollectBufferOnRoute(pathname) {
  return !!getBufferCollectionConfig(pathname);
}
