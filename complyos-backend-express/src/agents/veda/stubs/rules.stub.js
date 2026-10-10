import { getStatutoryDeadlines } from '../../../rules/deadlines.js';
import {
  gstLateFee as realGstLateFee,
  computeHealthScore as realComputeHealthScore,
} from '../../../rules/index.js';

export { getStatutoryDeadlines };

export function calculateLateFee(params) {
  return realGstLateFee(params);
}

export function computeHealthScore(profile, deadlines = []) {
  return realComputeHealthScore(profile, deadlines);
}

export default {
  getStatutoryDeadlines,
  calculateLateFee,
  computeHealthScore,
};
