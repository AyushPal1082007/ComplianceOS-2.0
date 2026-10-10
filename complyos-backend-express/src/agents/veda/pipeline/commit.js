/**
 * ComplianceOS — VEDA Pipeline: Commit
 * Pure function: commits document verification results to profile, calendar, penalty, claims.
 */

import { commitDocumentResults } from '../commit.js';

export function runCommit(params) {
  return commitDocumentResults(params);
}

export default runCommit;
