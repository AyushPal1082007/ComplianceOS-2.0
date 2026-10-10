import { gstLateFee as calculate } from '../utils/complianceCalculators.js';

export function gstLateFee(params) {
  const result = calculate(params);
  return {
    ...result,
    sourceUrl: result.source.url,
    lastVerified: result.source.lastChecked,
  };
}

export default gstLateFee;
