/**
 * ComplianceOS — Automated Verification Test Suite
 * Validates deterministic compliance calculators, SCOUT rules engine,
 * PATHWAY checklists, ARIA validators, and Express API routing.
 */
import assert from 'node:assert/strict';
import {
  gstLateFee,
  calculateHealthScore,
  calculatePenaltyAtRisk,
  getGSTDueDates,
} from '../src/utils/complianceCalculators.js';
import { scoutSchemes } from '../src/agents/scout.js';
import { getPathway, listPathways, OFFICIAL_LINKS } from '../src/agents/pathway.js';
import { PROFILE_SLOTS } from '../src/agents/aria.js';

async function runTests() {
  console.log('====================================================');
  console.log('🇮🇳 ComplianceOS (भारत) — Test Suite Execution');
  console.log('====================================================\n');

  let passed = 0;
  let total = 0;

  function test(name, fn) {
    total++;
    try {
      fn();
      console.log(`✅ [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`❌ [FAIL] ${name}`);
      console.error(err);
    }
  }

  // ── Test 1: S.47 CGST Act Late Fee Deterministic Calculation ────────────────
  test('S.47 GST Late Fee: Micro trader (< ₹1.5 Cr), 30 days late', () => {
    const fee = gstLateFee({
      annualTurnoverLakhs: 50, // 0.5 Cr
      isNilReturn: false,
      daysLate: 30,
      returnCount: 1,
    });
    // ₹50/day * 30 days = ₹1,500. Capped at ₹2,000 for < 1.5 Cr
    assert.strictEqual(fee.dailyFee, 50);
    assert.strictEqual(fee.totalFee, 1500);
    assert.strictEqual(fee.maxPerReturn, 2000);
  });

  test('S.47 GST Late Fee: Capped at ₹2,000 max for < ₹1.5 Cr', () => {
    const fee = gstLateFee({
      annualTurnoverLakhs: 50,
      isNilReturn: false,
      daysLate: 100, // 100 * 50 = 5000, but cap is 2000
      returnCount: 1,
    });
    assert.strictEqual(fee.totalFee, 2000);
  });

  test('S.47 GST Late Fee: Nil return rate is ₹20/day, capped at ₹500', () => {
    const fee = gstLateFee({
      annualTurnoverLakhs: 30,
      isNilReturn: true,
      daysLate: 40, // 40 * 20 = 800, cap is 500
      returnCount: 1,
    });
    assert.strictEqual(fee.dailyFee, 20);
    assert.strictEqual(fee.totalFee, 500);
  });

  // ── Test 2: Health Score Engine ─────────────────────────────────────────────
  test('Health Score Engine: Perfect profile with no overdue items', () => {
    const profile = {
      businessName: 'Sharma Leather Works',
      gstin: '09AAACH7409R1ZZ',
      pan: 'AAACH7409R',
      udyamNumber: 'UDYAM-UP-28-0012345',
      annualTurnover: 45,
    };
    const deadlines = [];
    const score = calculateHealthScore(profile, deadlines);
    assert.strictEqual(score, 100);
  });

  test('Health Score Engine: Deductions for overdue deadlines', () => {
    const profile = {
      businessName: 'Sharma Leather Works',
      gstin: '09AAACH7409R1ZZ',
      pan: 'AAACH7409R',
      udyamNumber: 'UDYAM-UP-28-0012345',
      annualTurnover: 45,
    };
    const deadlines = [
      { status: 'overdue', complianceType: 'gst_return' }, // -15
      { status: 'overdue', complianceType: 'gst_return' }, // -15
    ];
    const score = calculateHealthScore(profile, deadlines);
    assert.strictEqual(score, 70); // 100 - 30
  });

  // ── Test 3: SCOUT Scheme Matching Engine ────────────────────────────────────
  await (async () => {
    total++;
    try {
      const upArtisanProfile = {
        state: 'Uttar Pradesh',
        district: 'Kanpur',
        businessType: 'manufacturer',
        sector: 'leather',
        annualTurnover: 35, // ₹35 lakh
        isWomenLed: true,
        udyamNumber: 'UDYAM-UP-28-0012345',
      };

      const result = await scoutSchemes(upArtisanProfile, {
        includeExplanations: false,
        limit: 5,
      });

      assert(result.eligibleSchemesFound > 0, 'Should find eligible schemes for UP MSME');
      // Verify CM YUVA or ODOP or Mudra is present
      const hasUpScheme = result.topMatches.some(
        (m) => m.schemeId.includes('yuva') || m.schemeId.includes('odop') || m.schemeId.includes('mudra')
      );
      assert(hasUpScheme, 'Should match UP specific schemes');
      console.log(`✅ [PASS] SCOUT Rules Engine: Matched ${result.eligibleSchemesFound} schemes for UP artisan`);
      passed++;
    } catch (err) {
      console.error('❌ [FAIL] SCOUT Rules Engine');
      console.error(err);
    }
  })();

  // ── Test 4: PATHWAY Checklists & Official Deep Links ────────────────────────
  test('PATHWAY: GST Return Checklist has official portal links and zero auto-filing', () => {
    const pathway = getPathway('gst_return', { gstin: '09AAACH7409R1ZZ' });
    assert(pathway.steps.length > 0, 'Should have checklist steps');
    assert.strictEqual(pathway.trustLayer.noAutoFiling, true);
    assert.strictEqual(pathway.trustLayer.noLoginRequired, true);
    assert(pathway.steps[0].officialUrl.includes('gst.gov.in'));
  });

  test('PATHWAY: Available pathways list', () => {
    const list = listPathways();
    assert(list.length >= 3, 'Should have at least 3 verified pathways');
  });

  // ── Test 5: ARIA Validators ─────────────────────────────────────────────────
  test('ARIA Profile Slots and Validation Definitions', () => {
    assert(PROFILE_SLOTS.length >= 10, 'Should define at least 10 slots');
    const gstinSlot = PROFILE_SLOTS.find((s) => s.key === 'gstin');
    assert.strictEqual(gstinSlot.type, 'gstin');
  });

  console.log(`\n====================================================`);
  console.log(`Results: ${passed}/${total} Tests Passed`);
  console.log(`====================================================\n`);

  if (passed === total) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
