import test from 'node:test';
import assert from 'node:assert/strict';
import { bandFromAmount, parseIndianNumber, ageBandFromAge, employeesBandFromCount, yearsBandFromYears } from '../engine/bands.js';

test('turnover bands assign exact boundaries deterministically', () => {
  assert.equal(bandFromAmount(1_999_999), 'lt20L');
  assert.equal(bandFromAmount(2_000_000), '20L_40L');
  assert.equal(bandFromAmount(3_999_999), '20L_40L');
  assert.equal(bandFromAmount(4_000_000), '40L_1_5Cr');
  assert.equal(bandFromAmount(14_999_999), '40L_1_5Cr');
  assert.equal(bandFromAmount(15_000_000), '1_5_5Cr');
  assert.equal(bandFromAmount(50_000_000), '1_5_5Cr');
  assert.equal(bandFromAmount(50_000_001), 'gt5Cr');
});

test('parses explicit Hindi, Hinglish, currency and Indian grouped amounts', () => {
  assert.equal(parseIndianNumber('40 lakh').rupees, 4_000_000);
  assert.equal(parseIndianNumber('1.2 crore').rupees, 12_000_000);
  assert.equal(parseIndianNumber('साठ लाख').rupees, 6_000_000);
  assert.equal(parseIndianNumber('pachaas hazaar').rupees, 50_000);
  assert.equal(parseIndianNumber('एक करोड़').rupees, 10_000_000);
  assert.equal(parseIndianNumber('₹1,25,000.00').rupees, 125_000);
  assert.equal(parseIndianNumber('Rs. 1,25,000').rupees, 125_000);
  assert.equal(parseIndianNumber('निन्यानवे लाख').rupees, 9_900_000);
  assert.equal(parseIndianNumber('ek lakh pachaas hazaar').rupees, 150_000);
  assert.equal(parseIndianNumber('0 lakh').rupees, 0);
  assert.equal(parseIndianNumber('turnover lakh'), null);
});

test('does not infer units for ambiguous numbers', () => {
  assert.equal(parseIndianNumber('40'), null);
  assert.equal(parseIndianNumber('turnover around'), null);
});

test('age, employee and tenure helpers validate and classify boundaries', () => {
  assert.equal(ageBandFromAge(20), 'lt21');
  assert.equal(ageBandFromAge(21), '21_40');
  assert.equal(ageBandFromAge(41), '41_60');
  assert.equal(ageBandFromAge(61), 'gt60');
  assert.equal(employeesBandFromCount(0), '0');
  assert.equal(employeesBandFromCount(9), '1_9');
  assert.equal(employeesBandFromCount(10), '10_19');
  assert.equal(employeesBandFromCount(20), '20plus');
  assert.equal(yearsBandFromYears(0.5), 'lt1');
  assert.equal(yearsBandFromYears(2), '1_3');
  assert.equal(yearsBandFromYears(10), '3_10');
  assert.equal(yearsBandFromYears(11), 'gt10');
  assert.equal(ageBandFromAge(-1), null);
});