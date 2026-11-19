import React, {useEffect, useMemo, useRef, useState} from 'react';
import {requestKey} from '../services/cloudSelection.js';
import {
  CLOUD_REQUEST_INITIAL_ROWS,
  filterCloudRequests,
  nextCloudRequestCount,
  visibleCloudRequestCount,
} from '../services/cloudRenderBudget.js';

// Large branches mount progressively. The already-mounted rows remain in the DOM,
// preserving Ctrl/Shift selection, browser focus, drag/drop and example disclosure.
export function CloudRequestRows({requests, search, sortByName, depth, renderRequest, selection, choose, onContextMenu}) {
  const rows = useMemo(() => filterCloudRequests(requests, search, sortByName), [requests, search, sortByName]);
  const [requested, setRequested] = useState(CLOUD_REQUEST_INITIAL_ROWS);
  const sentinelRef = useRef(null);
  const count = visibleCloudRequestCount(rows.length, requested);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || count >= rows.length || typeof IntersectionObserver === 'undefined') return;
    const scrollRoot = sentinel.closest('.pp-side-scroll');
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) {
        setRequested(current => nextCloudRequestCount(rows.length, current));
      }
    }, {root: scrollRoot || null, rootMargin: '240px 0px'});
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [count, rows.length]);

  return <>
    {rows.slice(0, count).map(request => {
      const key = requestKey(request.id);
      const selected = selection.includes(key);
      return <React.Fragment key={request.id}>{renderRequest(request, depth, {
        'data-cloud-select-key': key,
        'aria-pressed': selected,
        className: selected ? 'pp-cloud-selected' : '',
        onClick: event => choose(event, key),
        onContextMenu: event => onContextMenu(event, key),
      })}</React.Fragment>;
    })}
    {count < rows.length && <div ref={sentinelRef} className="pp-cloud-more-requests">
      <button type="button" onClick={() => setRequested(current => nextCloudRequestCount(rows.length, current))}
        aria-label={`Show more requests, ${rows.length - count} remaining`}>
        Show more requests ({count} of {rows.length})
      </button>
    </div>}
  </>;
}
