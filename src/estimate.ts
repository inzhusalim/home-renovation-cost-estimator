export const ROOMS = [
  { id: 'kitchen', name: 'Kitchen', materialRate: 55, laborRate: 38, description: 'Cabinets, surfaces, flooring & fixtures' },
  { id: 'bath', name: 'Master Bath', materialRate: 72, laborRate: 54, description: 'Tile, plumbing fixtures & finishes' },
  { id: 'living', name: 'Living Room', materialRate: 22, laborRate: 20, description: 'Flooring, paint, lighting & finishes' },
  { id: 'basement', name: 'Basement', materialRate: 30, laborRate: 32, description: 'Insulation, drywall, flooring & lighting' },
  { id: 'home', name: 'Full Home', materialRate: 45, laborRate: 38, description: 'Interior finishes across the entire home' },
] as const;

export const TIERS = [
  { id: 'economy', name: 'Economy', label: 'Builder grade', factor: 0.72, detail: 'Practical materials, simple finishes, and everyday fixtures.' },
  { id: 'standard', name: 'Mid-tier', label: 'Standard finishes', factor: 1, detail: 'Standard finishes, durable surfaces, and upgraded fixtures.' },
  { id: 'luxury', name: 'Luxury', label: 'High-end custom', factor: 1.65, detail: 'Premium surfaces, designer fixtures, and custom finishes.' },
] as const;

export const REGIONS = [
  { id: 'national', name: 'National Average', factor: 1 },
  { id: 'coastal', name: 'New York / San Francisco', factor: 1.35 },
  { id: 'growth', name: 'Austin / Denver', factor: 1.1 },
  { id: 'midwest', name: 'Midwest', factor: 0.9 },
] as const;

export const ADDONS = [
  { id: 'permits', name: 'Permit handling', description: 'Paperwork, taken care of', cost: 850, kind: 'permits' },
  { id: 'cabinetry', name: 'Custom cabinetry', description: 'Made for your space', cost: 4500, kind: 'materials' },
  { id: 'demolition', name: 'Demolition & haul-away', description: 'A clean slate to build on', cost: 1200, kind: 'labor' },
  { id: 'smart', name: 'Smart home wiring', description: 'A more connected home', cost: 950, kind: 'labor' },
] as const;

export type RoomId = typeof ROOMS[number]['id'];
export type TierId = typeof TIERS[number]['id'];
export type RegionId = typeof REGIONS[number]['id'];
export type AddonId = typeof ADDONS[number]['id'];
export type Config = { room: RoomId; sqft: number; tier: TierId; region: RegionId; addons: Record<AddonId, boolean> };
export type BreakdownItem = { id: string; label: string; description: string; value: number; color: string };
export type SavedEstimate = { id: string; name: string; createdAt: string; config: Config; total: number; low: number; high: number; modelVersion: number };

export const MODEL_VERSION = 1;
export const OVERHEAD_RATE = 0.18;
export const CONTINGENCY_RATE = 0.1;
export const DEFAULT_CONFIG: Config = { room: 'kitchen', sqft: 200, tier: 'standard', region: 'national', addons: { permits: true, cabinetry: false, demolition: true, smart: false } };
export const money = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
export const number = (value: number) => new Intl.NumberFormat('en-US').format(value);
export const factorLabel = (value: number) => `${Number.isInteger(value) ? value.toFixed(1) : value}×`;
export const clampArea = (value: number) => Math.min(3000, Math.max(100, Math.round(Number.isFinite(value) ? value : 200)));

export function calculate(config: Config) {
  const room = ROOMS.find(x => x.id === config.room)!;
  const tier = TIERS.find(x => x.id === config.tier)!;
  const region = REGIONS.find(x => x.id === config.region)!;
  const area = clampArea(config.sqft);
  const selectedAddons = ADDONS.filter(x => config.addons[x.id]);
  const materials = Math.round(area * room.materialRate * tier.factor + selectedAddons.filter(x => x.kind === 'materials').reduce((sum, x) => sum + x.cost, 0));
  const labor = Math.round(area * room.laborRate * tier.factor * region.factor + selectedAddons.filter(x => x.kind === 'labor').reduce((sum, x) => sum + x.cost, 0));
  const permits = selectedAddons.filter(x => x.kind === 'permits').reduce((sum, x) => sum + x.cost, 0);
  const direct = materials + labor + permits;
  const overhead = Math.round(direct * OVERHEAD_RATE);
  const contingency = Math.round((direct + overhead) * CONTINGENCY_RATE);
  const total = direct + overhead + contingency;
  const low = Math.floor(total * 0.9 / 100) * 100;
  const high = Math.ceil(total * 1.08 / 100) * 100;
  const items: BreakdownItem[] = [
    { id: 'materials', label: 'Materials', description: `${tier.name} finishes${config.addons.cabinetry ? ' + custom cabinetry' : ''}`, value: materials, color: '#14775b' },
    { id: 'labor', label: 'Estimated labor', description: `Regional labor index · ${factorLabel(region.factor)}`, value: labor, color: '#79a994' },
    { id: 'permits', label: 'Permit handling', description: config.addons.permits ? 'Selected project add-on' : 'Not selected', value: permits, color: '#d6bc7a' },
    { id: 'overhead', label: 'Overhead & profit', description: '18% of direct project costs', value: overhead, color: '#a2afb7' },
    { id: 'contingency', label: 'Contingency reserve', description: '10% for the unexpected', value: contingency, color: '#dce2dd' },
  ];
  return { materials, labor, permits, direct, overhead, contingency, total, low, high, items, room, tier, region, selectedAddons };
}

export function parseConfig(value: unknown): Config | null {
  if (!value || typeof value !== 'object') return null;
  const config = value as Partial<Config>;
  if (!ROOMS.some(x => x.id === config.room) || !TIERS.some(x => x.id === config.tier) || !REGIONS.some(x => x.id === config.region) || typeof config.sqft !== 'number' || !Number.isFinite(config.sqft) || !config.addons || typeof config.addons !== 'object' || !ADDONS.every(x => typeof config.addons?.[x.id] === 'boolean')) return null;
  return { room: config.room!, tier: config.tier!, region: config.region!, sqft: clampArea(config.sqft), addons: Object.fromEntries(ADDONS.map(x => [x.id, config.addons![x.id]])) as Config['addons'] };
}

export function readConfig(): Config {
  try { return parseConfig(JSON.parse(localStorage.getItem('reno.current.v1') ?? 'null')) ?? structuredClone(DEFAULT_CONFIG); }
  catch { return structuredClone(DEFAULT_CONFIG); }
}

export function readHistory(): SavedEstimate[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem('reno.history.v1') ?? '[]');
    if (!Array.isArray(value)) return [];
    return value.filter((x): x is SavedEstimate => !!x && typeof x === 'object' && typeof x.id === 'string' && typeof x.name === 'string' && typeof x.createdAt === 'string' && !Number.isNaN(Date.parse(x.createdAt)) && !!parseConfig(x.config) && x.modelVersion === MODEL_VERSION && ['total', 'low', 'high'].every(key => typeof x[key] === 'number' && Number.isFinite(x[key]) && x[key] >= 0)).slice(0, 50).map(x => ({ ...x, config: parseConfig(x.config)! }));
  } catch { return []; }
}

export function summaryText(config: Config, contact?: { name: string; zip: string; email: string }) {
  const result = calculate(config);
  return [
    'RENO — HOME RENOVATION ESTIMATE',
    `Prepared: ${new Date().toLocaleDateString('en-US')}`,
    ...(contact ? [`Prepared for: ${contact.name}`, `ZIP code: ${contact.zip}`, `Email: ${contact.email}`] : []),
    '', `Project: ${result.room.name}`, `Area: ${number(config.sqft)} sq ft`, `Finish: ${result.tier.name} (${result.tier.label})`, `Region: ${result.region.name} (${factorLabel(result.region.factor)} labor index)`, '',
    `ESTIMATED RANGE: ${money(result.low)} – ${money(result.high)}`, `Planning total: ${money(result.total)}`, '', 'ITEMIZED COST BREAKDOWN',
    ...result.items.map(item => `${item.label}: ${money(item.value)} — ${item.description}`), '', 'INCLUDED ADD-ONS',
    ...(result.selectedAddons.length ? result.selectedAddons.map(x => `${x.name}: ${money(x.cost)} (included above)`) : ['None selected']), '',
    'Planning assumptions: room-specific material and labor rates per sq ft; finish tier adjusts base material and labor rates; regional index adjusts base labor only. Add-ons are fixed national allowances. Overhead and profit is 18% of direct costs. Contingency is 10% of direct costs plus overhead. Range is 90–108% of the planning total, rounded outward to $100.', '',
    'This is a preliminary planning estimate, not a contractor quote. Illustrative rates are not live market pricing. Site conditions, structural work, sales taxes, appliances, and local permit fees may change the final cost. Confirm scope and pricing with your contractor.',
  ].join('\n');
}
