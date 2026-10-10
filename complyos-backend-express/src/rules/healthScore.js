import {
  calculateHealthScore,
  calculatePenaltyAtRisk,
} from '../utils/complianceCalculators.js';

export const computeHealthScore = calculateHealthScore;
export { calculatePenaltyAtRisk };

export default { computeHealthScore, calculatePenaltyAtRisk };
