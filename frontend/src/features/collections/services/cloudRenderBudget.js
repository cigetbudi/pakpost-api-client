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
