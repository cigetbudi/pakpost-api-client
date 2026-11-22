/** Stable action facade for the Request Revision panel. */
import {createRequestConflictActions} from './createRequestConflictActions.js';
import {createRequestRevisionActions} from './createRequestRevisionActions.js';

export function createRequestHistoryActions(dependencies) {
  return {
    ...createRequestConflictActions(dependencies),
    ...createRequestRevisionActions(dependencies),
  };
}
