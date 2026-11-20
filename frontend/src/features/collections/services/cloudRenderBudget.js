export const CLOUD_REQUEST_INITIAL_ROWS = 120;
export const CLOUD_REQUEST_PAGE_ROWS = 120;

export function visibleCloudRequestCount(total, requested) {
  if (!Number.isFinite(total) || total <= 0) return 0;
  return Math.min(Math.floor(total), Math.max(0, Math.floor(requested) || 0));
}

export function nextCloudRequestCount(total, current, pageSize = CLOUD_REQUEST_PAGE_ROWS) {
  return visibleCloudRequestCount(total, current + Math.max(1, Math.floor(pageSize) || 1));
}

export function filterCloudRequests(requests, search, sortByName = false) {
  const term = String(search || '').trim().toLowerCase();
  const matching = term
    ? requests.filter(request => `${request.name || ''} ${request.url || ''}`.toLowerCase().includes(term))
    : requests;
  return sortByName
    ? [...matching].sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')))
    : matching;
}

// Large-workspace browse uses bounded server pages instead of downloading every
// encrypted index record when the collection is expanded.
export const CLOUD_SERVER_PAGING_THRESHOLD = 800;
export const CLOUD_SERVER_PAGE_SIZE = 120;
export const CLOUD_VIRTUAL_ROW_HEIGHT = 28;
export const CLOUD_VIRTUAL_OVERSCAN = 10;

export function cloudVirtualWindow(total,scrollOffset,viewportHeight,
  rowHeight=CLOUD_VIRTUAL_ROW_HEIGHT,overscan=CLOUD_VIRTUAL_OVERSCAN) {
  const count=Math.max(0,Math.floor(total)||0);
  const start=Math.min(count,Math.max(0,Math.floor(Math.max(0,scrollOffset)/rowHeight)-overscan));
  const end=Math.min(count,Math.max(start,Math.ceil((Math.max(0,scrollOffset)+Math.max(1,viewportHeight))/rowHeight)+overscan));
  return {start,end,top:start*rowHeight,bottom:(count-end)*rowHeight};
}
