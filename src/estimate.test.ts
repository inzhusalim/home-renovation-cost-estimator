import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ADDONS, DEFAULT_CONFIG, REGIONS, ROOMS, TIERS, calculate, parseConfig, summaryText } from './estimate';

test('default kitchen budget includes every allowance and reconciles to the total', () => {
  const result = calculate(DEFAULT_CONFIG);
  assert.equal(result.materials, 11000);
  assert.equal(result.labor, 8800);
  assert.equal(result.permits, 850);
  assert.equal(result.overhead, 3717);
  assert.equal(result.contingency, 2437);
  assert.equal(result.total, 26804);
  assert.equal(result.low, 24100);
  assert.equal(result.high, 29000);
  assert.equal(result.items.reduce((sum, item) => sum + item.value, 0), result.total);
});

test('regional index changes base labor, while fixed add-ons and materials stay fixed', () => {
  const national = calculate(DEFAULT_CONFIG);
  const coastal = calculate({ ...DEFAULT_CONFIG, region: 'coastal' });
  assert.equal(coastal.labor - national.labor, 2660);
  assert.equal(coastal.materials, national.materials);
  assert.equal(coastal.permits, national.permits);
});

test('add-ons appear once in their assigned category and are included in overhead and contingency', () => {
  const bare = { ...DEFAULT_CONFIG, addons: { permits: false, cabinetry: false, demolition: false, smart: false } };
  const base = calculate(bare);
  for (const addon of ADDONS) {
    const result = calculate({ ...bare, addons: { ...bare.addons, [addon.id]: true } });
    assert.equal(result.direct - base.direct, addon.cost);
    assert.equal(result[addon.kind] - base[addon.kind], addon.cost);
    assert.ok(result.total - base.total > addon.cost);
  }
});

test('all rooms, finish tiers, regions, and size extremes produce finite, reconciled ranges', () => {
  for (const room of ROOMS) for (const tier of TIERS) for (const region of REGIONS) for (const sqft of [100, 3000]) {
    const result = calculate({ ...DEFAULT_CONFIG, room: room.id, tier: tier.id, region: region.id, sqft });
    assert.ok(result.low > 0 && result.low <= result.total && result.high >= result.total);
    assert.equal(result.items.reduce((sum, item) => sum + item.value, 0), result.total);
    assert.equal(result.low % 100, 0);
    assert.equal(result.high % 100, 0);
  }
});

test('persisted configuration validates identifiers and numeric input, and bounds area', () => {
  assert.equal(parseConfig({ ...DEFAULT_CONFIG, room: 'unknown' }), null);
  assert.equal(parseConfig({ ...DEFAULT_CONFIG, sqft: NaN }), null);
  assert.equal(parseConfig({ ...DEFAULT_CONFIG, addons: {} }), null);
  assert.equal(parseConfig({ ...DEFAULT_CONFIG, sqft: 999999 })?.sqft, 3000);
  assert.equal(parseConfig({ ...DEFAULT_CONFIG, sqft: -10 })?.sqft, 100);
  assert.deepEqual(parseConfig(DEFAULT_CONFIG), DEFAULT_CONFIG);
});

test('contractor summary preserves identity, includes line items, and identifies included add-ons', () => {
  const summary = summaryText(DEFAULT_CONFIG, { name: 'Alex Johnson', zip: '10001', email: 'alex@example.com' });
  assert.ok(summary.includes('Prepared for: Alex Johnson'));
  assert.ok(summary.includes('ZIP code: 10001'));
  assert.ok(summary.includes('Materials: $11,000'));
  assert.ok(summary.includes('Permit handling: $850 (included above)'));
  assert.ok(summary.includes('ESTIMATED RANGE: $24,100 – $29,000'));
});
