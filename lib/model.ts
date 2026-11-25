// Launch Radar model, version radar-2: one sealed snapshot in, one ranked board out.
//
// THE VALUE MODEL
// ---------------
// implied_value_usd is what a token would plausibly be worth at launch if the protocol's
// record in the snapshot stayed as it is. It is built only from the snapshot's own figures:
//
//   implied = round( tvl_usd x category_multiple x growth_factor x maturity_factor x chain_factor )
//
// - category_multiple: the fully-diluted-value / TVL ratio public markets actually pay for a
//   token of that kind of protocol. A chain's own token captures the whole network (1.60x), a
//   prediction market's token prices future flow more than today's TVL (2.20x), while a bridge's
//   token captures only a thin fee stream over a large pass-through TVL (0.55x). The full table
//   is CATEGORY_MULTIPLES below; a category the table does not name gets DEFAULT_MULTIPLE.
// - growth_factor: the week's TVL momentum, damped so one hot week cannot double a valuation:
//   1 + clamp(change_7d, -50, +100) / 100 x 0.6, so -50% -> 0.70x and +100% -> 1.60x. A protocol
//   whose change DefiLlama does not report is scored as flat (0%).
// - maturity_factor: how long the protocol has already run with no token is the radar's core
//   signal — a protocol that has operated for years without issuing has a real product and a
//   launch still ahead of it, so the factor rises with age and saturates at four years:
//   0.80 + 0.40 x min(age_days, 1460) / 1460. An unreported listing date is scored as 365 days.
// - chain_factor: breadth of the deployment footprint, 1 + 0.03 x min(chains - 1, 7): each extra
//   chain up to eight adds 3%, because a multi-chain protocol's token addresses more users.
//
// No protocol name is ever special-cased and no value is hardcoded per protocol: the same four
// factors score every row, and the dashboard shows each row's four factors so a reader can
// recompute any implied value on the page.
//
// WHO IS ON THE BOARD
// -------------------
// A protocol is pre-token when the snapshot records no token for it: mcap_usd, gecko_id and
// symbol all null. Protocols whose token already trades are never ranked as opportunities; the
// dashboard lists the largest of them separately, at the market's own values. The board holds
// every watchlist slug (the floor, never the ceiling) plus the highest-implied pre-token
// protocols below it, up to BOARD_TARGET rows. Off the board, by the same definition the
// house's watchlist uses for a wrapped, staked or bridged product of a token that already
// trades: the product categories Bridge, Canonical Bridge, Liquid Staking, Liquid Restaking,
// Restaked BTC and CEX (a bridged Bitcoin or an exchange's staking receipt records no token of
// its own in the snapshot, but it is not a launch that is still to come), names ending in a
// version marker (a pool of another protocol), names opening with an exchange's name, and
// names carrying the whole word wrapped, staked or staking.

/** The snapshot's protocol entry: exactly the ten fields the sealed input carries. */
export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

/** The whole snapshot document. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** The model's version label: the dashboard names it beside every figure it prints. */
export const MODEL_VERSION = 'radar-2';

/** How many rows the board carries: the 40 watchlist protocols plus the radar's early finds. */
export const BOARD_TARGET = 210;

/** FDV/TVL multiples by category: what a launched token of that kind trades at against TVL. */
export const CATEGORY_MULTIPLES: Record<string, number> = {
  'Chain': 1.6,
  'Prediction Market': 2.2,
  'Launchpad': 1.8,
  'Decentralized AI': 1.8,
  'AI Agents': 1.8,
  'Derivatives': 1.4,
  'Interest Rate Derivatives': 1.4,
  'Payments': 1.3,
  'Crypto Card Issuer': 1.3,
  'Privacy': 1.2,
  'Options': 1.2,
  'Options Vault': 1.2,
  'Dexs': 1.1,
  'Synthetics': 1.1,
  'OTC Marketplace': 1.1,
  'RWA': 1.0,
  'NFT Marketplace': 1.0,
  'DOR': 1.0,
  'Lending': 0.9,
  'Uncollateralized Lending': 0.9,
  'Collateral Markets': 0.9,
  'Insurance': 0.9,
  'Token Locker': 0.9,
  'Governance Incentives': 0.9,
  'CDP': 0.85,
  'CDP Manager': 0.85,
  'Liquid Restaking': 0.85,
  'Restaking': 0.85,
  'Risk Curators': 0.8,
  'Onchain Capital Allocator': 0.8,
  'Indexes': 0.8,
  'CeDeFi': 0.8,
  'Liquid Staking': 0.75,
  'Staking Pool': 0.7,
  'Basis Trading': 0.7,
  'Dual-Token Stablecoin': 0.7,
  'Stablecoin Wrapper': 0.7,
  'Algo-Stables': 0.7,
  'Reserve Currency': 0.7,
  'Yield': 0.65,
  'Yield Aggregator': 0.65,
  'Leveraged Farming': 0.65,
  'Farm': 0.65,
  'Liquidity Manager': 0.65,
  'Anchor BTC': 0.6,
  'Decentralized BTC': 0.6,
  'Restaked BTC': 0.6,
  'Bridge': 0.55,
  'Canonical Bridge': 0.55,
  'Cross Chain Bridge': 0.55,
};

/** The multiple a category the table does not name is scored with. */
export const DEFAULT_MULTIPLE = 0.8;

/** Growth is clamped to this band before it moves a valuation. */
export const GROWTH_FLOOR_PCT = -50;
export const GROWTH_CAP_PCT = 100;
export const GROWTH_WEIGHT = 0.6;

/** Maturity saturates at this many tokenless days; an unknown age scores as UNKNOWN_AGE_DAYS. */
export const MATURITY_DAYS = 1460;
export const UNKNOWN_AGE_DAYS = 365;

/** Each extra chain up to this many adds CHAIN_BONUS to the footprint factor. */
export const CHAIN_BONUS = 0.03;
export const CHAIN_BONUS_MAX_EXTRA = 7;

/** The four factors behind one protocol's implied value, kept so the page can show its work. */
export interface ModelBreakdown {
  category_multiple: number;
  growth_pct: number;
  growth_factor: number;
  age_days: number | null;
  maturity_factor: number;
  chain_count: number;
  chain_factor: number;
}

/** One row of board.json: the ranked board's row. */
export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token';
  watchlist: boolean;
  age_days: number | null;
  implied_value_usd: number;
  model: ModelBreakdown;
  farm_steps: string[];
}

/** The dashboard's view of one row: the board row's figures, its breakdown and its farm plan. */
export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  listed_at: string | null;
  age_days: number | null;
  watchlist: boolean;
  implied_value_usd: number;
  fdv_tvl: number;
  model: ModelBreakdown;
  farm_steps: string[];
}

/** A live-token protocol: it already trades, so the page shows the market's value, not a model's. */
export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
  symbol: string | null;
}

/** Everything the dashboard renders, from the snapshot. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model_version: string;
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
  rows: RadarRow[];
  live: LiveRow[];
}

/** Why the snapshot is not one this model can score. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;

const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;

/** A whole day count from `listedAt` to `asOf`, clamped at zero; null when either date is bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

/** The FDV/TVL multiple for a category, or the default when the table does not name it. */
export function categoryMultiple(category: string | null): number {
  if (category === null) return DEFAULT_MULTIPLE;
  return CATEGORY_MULTIPLES[category] ?? DEFAULT_MULTIPLE;
}

/** Score one protocol: its implied value and the four factors that produced it. */
export function scoreProtocol(
  p: SnapshotProtocol,
  asOf: string,
): { implied: number; breakdown: ModelBreakdown } {
  const age = ageDays(asOf, p.listed_at);
  const rawGrowth = typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : 0;
  const growthPct = Math.min(GROWTH_CAP_PCT, Math.max(GROWTH_FLOOR_PCT, rawGrowth));
  const growthFactor = Math.max(0.6, 1 + (growthPct / 100) * GROWTH_WEIGHT);
  const ageForModel = age ?? UNKNOWN_AGE_DAYS;
  const maturityFactor = 0.8 + 0.4 * (Math.min(Math.max(ageForModel, 0), MATURITY_DAYS) / MATURITY_DAYS);
  const extraChains = Math.min(Math.max(p.chains.length - 1, 0), CHAIN_BONUS_MAX_EXTRA);
  const chainFactor = 1 + CHAIN_BONUS * extraChains;
  const multiple = categoryMultiple(p.category);
  const implied = Math.max(1, Math.round(p.tvl_usd * multiple * growthFactor * maturityFactor * chainFactor));
  return {
    implied,
    breakdown: {
      category_multiple: multiple,
      growth_pct: round4(growthPct),
      growth_factor: round4(growthFactor),
      age_days: age,
      maturity_factor: round4(maturityFactor),
      chain_count: p.chains.length,
      chain_factor: round4(chainFactor),
    },
  };
}

/** Whether the snapshot records no token for a protocol: no market cap, no Gecko id, no symbol. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;
const EXCHANGE_PREFIX = /^(Binance|Coinbase|Bybit|Kraken|Bitget|OKX|Bitfinex|Gemini)\b/;
const WRAPPED_WORD = /\b(wrapped|staked|staking)\b/i;

/**
 * Categories that are products of a token that already trades, or an exchange's own page:
 * the house's watchlist definition names exactly these six, and the board holds the whole
 * pre-token pool to the same standard.
 */
const PRODUCT_CATEGORIES = new Set(['Bridge', 'Canonical Bridge', 'Liquid Staking', 'Liquid Restaking', 'Restaked BTC', 'CEX']);

/** Whether a pre-token protocol is a standalone launch candidate the board may rank. */
export function isEligible(p: SnapshotProtocol): boolean {
  return (
    isPreToken(p) &&
    !(p.category !== null && PRODUCT_CATEGORIES.has(p.category)) &&
    !VERSIONED.test(p.name) &&
    !EXCHANGE_PREFIX.test(p.name) &&
    !WRAPPED_WORD.test(p.name)
  );
}

// ---------------------------------------------------------------------------
// Farm plans. Each plan is assembled from the protocol's own record: a playbook for its
// category, its first two chains, a capital tier from its TVL and a holding period from its
// age. Wording variants are picked by a stable hash of the slug, so two protocols in the
// same category with different chains, sizes or ages get visibly different plans, and the
// same protocol gets the same plan on every run. Every step states its cost and its time,
// because a plan without either is a slogan.
// ---------------------------------------------------------------------------

/** A step before it is flattened: the action, what it costs, how long it takes. */
interface StepParts {
  text: string;
  cost: string;
  time: string;
}

/** A step as one string: the action, then its cost and time, kept inside the gate's 20..600. */
function flatten(step: StepParts): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  return s;
}

/** A stable small hash of a slug, for picking wording variants deterministically. */
function hashOf(slug: string): number {
  let h = 7;
  for (let i = 0; i < slug.length; i++) h = (h * 31 + slug.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function pick<T>(variants: readonly T[], seed: number): T {
  return variants[seed % variants.length]!;
}

/** The per-action gas a farmer should expect on a chain, in words. */
function gasWords(chain: string): string {
  if (chain === 'Ethereum') return 'about $6-10 of gas a transaction at ordinary fees';
  if (chain === 'Bitcoin') return 'about $4-8 of network fees a transaction';
  if (chain === 'Solana') return 'well under $0.50 of fees a transaction';
  if (chain === 'Tron') return 'about $1 of fees a transaction';
  return 'about $0.50-2 of gas a transaction';
}

/** How much capital one serious farm position needs, from the protocol's own TVL. */
function capitalFor(tvl: number): number {
  if (tvl >= 1_000_000_000) return 500;
  if (tvl >= 250_000_000) return 250;
  if (tvl >= 50_000_000) return 150;
  if (tvl >= 15_000_000) return 75;
  return 40;
}

/** How long a position should be held: younger protocols get the longer qualifying window. */
function holdDaysFor(age: number | null, seed: number): number {
  const base = age === null ? 45 : age < 365 ? 60 : 30;
  return base + (seed % 3) * 15;
}

/** The playbook family a category farms by. */
function groupOf(category: string | null): string {
  const c = category ?? '';
  if (c === 'Dexs') return 'dex';
  if (c === 'Lending' || c === 'Uncollateralized Lending' || c === 'Collateral Markets') return 'lending';
  if (c === 'CDP' || c === 'CDP Manager') return 'cdp';
  if (c === 'Liquid Staking' || c === 'Staking Pool') return 'staking';
  if (c === 'Restaking' || c === 'Liquid Restaking' || c === 'Restaked BTC' || c === 'Anchor BTC' || c === 'Decentralized BTC') return 'restaking';
  if (c === 'Bridge' || c === 'Canonical Bridge' || c === 'Cross Chain Bridge') return 'bridge';
  if (c === 'Yield' || c === 'Yield Aggregator' || c === 'Farm' || c === 'Leveraged Farming' || c === 'Liquidity Manager') return 'yield';
  if (c === 'Risk Curators' || c === 'Onchain Capital Allocator') return 'curator';
  if (c === 'Derivatives' || c === 'Options' || c === 'Options Vault' || c === 'Interest Rate Derivatives' || c === 'Synthetics') return 'derivatives';
  if (c === 'RWA') return 'rwa';
  if (c === 'Chain') return 'chain';
  if (c === 'Dual-Token Stablecoin' || c === 'Stablecoin Wrapper' || c === 'Algo-Stables' || c === 'Basis Trading') return 'stable';
  if (c === 'Prediction Market') return 'prediction';
  return 'generic';
}

/** The three protocol-specific steps of a plan, from its category's playbook. */
function coreSteps(group: string, p: SnapshotProtocol, capital: number, gas: string): StepParts[] {
  const n = p.name;
  const c1 = p.chains[0] ?? 'its main chain';
  const c2 = p.chains[1] ?? c1;
  const K = `$${capital}`;
  switch (group) {
    case 'dex':
      return [
        { text: `Route at least $2,500 of swaps through ${n} on ${c1}, spread across several pairs and several days, so the wallet builds a genuine volume history rather than one large trade.`, cost: `${gas}, plus the pools' swap fees on the volume`, time: '20 minutes, then 5 minutes a session' },
        { text: `Provide ${K} of liquidity to ${n}'s deepest pool on ${c1} — a stablecoin pair if one is listed — and leave the LP position untouched between weekly checks.`, cost: `${K} of capital and ${gas} to open`, time: '15 minutes to open' },
        { text: `Collect the fees and any incentive the position accrues from inside ${n}'s own interface each week and re-deposit them into the same pool, so the position compounds in place.`, cost: `${gas} a week`, time: '5 minutes a week' },
      ];
    case 'lending':
      return [
        { text: `Supply ${K} of USDC, or the main stablecoin of ${c1}, to ${n} and leave the deposit in place; a deposit that vanishes after a day reads as rented TVL, not loyalty.`, cost: `${K} of capital and ${gas} to supply`, time: '10 minutes' },
        { text: `Borrow no more than 35% against the ${n} deposit, re-supply the borrowed asset once, then repay in full within the month: a complete, healthy borrow cycle is the activity a lending market remembers.`, cost: `${gas} for the borrow and the repay`, time: '15 minutes across the month' },
        { text: `Make one small supply, borrow or repay action on ${n} every week after that, so the account is active in several snapshots instead of a single week.`, cost: `${gas} a week`, time: '5 minutes a week' },
      ];
    case 'cdp':
      return [
        { text: `Open a ${n} vault on ${c1} with ${K} of collateral and mint its stablecoin at a conservative ratio, keeping the health factor above 2 at all times.`, cost: `${K} of collateral and ${gas} to open and mint`, time: '15 minutes' },
        { text: `Put the minted stablecoin to work inside ${n}'s own ecosystem — its stability pool or savings module — rather than selling it, so both sides of the position sit with the protocol.`, cost: `${gas} to deposit`, time: '10 minutes' },
        { text: `Adjust the ${n} position once a week: top up collateral or repay a slice as prices move, and never let the health factor drift anywhere near liquidation.`, cost: `${gas} a week`, time: '5 minutes a week' },
      ];
    case 'staking':
      return [
        { text: `Stake ${K} of ${c1}'s native asset through ${n} and keep the liquid receipt token in the same wallet that staked it.`, cost: `${K} of capital and ${gas} to stake`, time: '10 minutes' },
        { text: `Deploy part of the receipt token into one of the partner markets ${n} lists on ${c1} — a lending market or a liquidity pool — so the position is working in two places at once.`, cost: `${gas} to deposit`, time: '10 minutes' },
        { text: `Add a small top-up stake every two weeks and claim staking rewards only from ${n}'s own page, so the staking history grows steadily instead of in one lump.`, cost: `${gas} a fortnight`, time: '5 minutes a fortnight' },
      ];
    case 'restaking':
      return [
        { text: `Deposit ${K} of the staking asset ${n} accepts on ${c1} and keep the restaking receipt in the depositing wallet.`, cost: `${K} of capital and ${gas} to deposit`, time: '10 minutes' },
        { text: `Choose one operator — and one service where ${n} asks you to pick — and stay with it: churning operators resets most loyalty accounting, while a steady delegation reads as conviction.`, cost: 'nothing to choose; switching later costs gas', time: '5 minutes' },
        { text: `Restake the rewards ${n} pays as they accrue instead of withdrawing them, and hold the position through at least one full rewards epoch before judging it.`, cost: `${gas} a claim`, time: '5 minutes an epoch' },
      ];
    case 'bridge':
      return [
        { text: `Bridge ${K} from ${c1} to ${c2} through ${n}, then use the bridged funds in one application on ${c2} the same day, so the crossing ends in real activity.`, cost: `${K} of capital, the bridge fee and ${gas} on both chains`, time: '20 minutes' },
        { text: `Bridge a smaller amount back through ${n} a week later. Round trips on different days build a cleaner record than one large one-way crossing.`, cost: 'the bridge fee and gas on both chains', time: '15 minutes' },
        { text: `Work through each route ${n} lists from ${c1} once over the month, starting with the routes carrying the least volume, where an early user's activity counts for most.`, cost: 'one bridge fee per route', time: '15 minutes a route' },
      ];
    case 'yield':
      return [
        { text: `Deposit ${K} into ${n}'s main vault on ${c1} and keep the vault shares in the wallet that deposited them.`, cost: `${K} of capital and ${gas} to deposit`, time: '10 minutes' },
        { text: `After two weeks, move a quarter of the position into a second ${n} vault or strategy, so the wallet is recorded in more than one of the protocol's products.`, cost: `${gas} to move`, time: '10 minutes' },
        { text: `Harvest rewards from ${n}'s own interface each week and re-deposit them into the same vault rather than selling the same day; compounding depositors are the ones a vault wants to keep.`, cost: `${gas} a week`, time: '5 minutes a week' },
      ];
    case 'curator':
      return [
        { text: `Deposit ${K} into one of the vaults ${n} curates on ${c1}, choosing a vault whose curator publishes its allocation policy and recent reallocations.`, cost: `${K} of capital and ${gas} to deposit`, time: '10 minutes' },
        { text: `After a fortnight, place a second, smaller deposit in a different vault that ${n} curates, so the wallet appears across the curator's book and not in a single pool.`, cost: `${gas} to deposit`, time: '10 minutes' },
        { text: `Read ${n}'s reallocation notes each week and follow one rebalance with your own position; curators can see exactly which depositors stay through a reallocation.`, cost: 'nothing to read; gas only if you move', time: '10 minutes a week' },
      ];
    case 'derivatives':
      return [
        { text: `Deposit ${K} of margin collateral into ${n} on ${c1} and open one small position at under 2x leverage; idle margin earns nothing and signals nothing.`, cost: `${K} of margin and ${gas} to deposit and open`, time: '15 minutes' },
        { text: `Trade modestly on ${n} every week — one open and one close — to build a steady volume record, sized so a bad week costs a few dollars, not the stake.`, cost: 'trading fees on the volume plus gas', time: '10 minutes a week' },
        { text: `Leave part of the margin on ${n} between sessions instead of withdrawing after every trade; accounts that empty out after each session read as wash volume.`, cost: 'the margin stays at risk only while positions are open', time: 'no extra time' },
      ];
    case 'rwa':
      return [
        { text: `Mint ${K} of ${n}'s tokenised asset on ${c1} through its own onboarding flow and hold the asset in the minting wallet.`, cost: `${K} of capital and ${gas} to mint`, time: '20 minutes including onboarding' },
        { text: `Complete every verification and account-tier step ${n} offers, so the wallet is already eligible for any holder programme or distribution the protocol later runs.`, cost: 'nothing but the forms', time: '15 minutes once' },
        { text: `Make one further mint or a partial redemption with ${n} after a month, and hold through at least one full yield distribution before deciding whether to stay.`, cost: `${gas} a cycle`, time: '10 minutes a month' },
      ];
    case 'chain':
      return [
        { text: `Bridge ${K} to ${c1} and make it this wallet's home chain for a month: swaps, saves and payments happen there instead of the wallet merely passing through.`, cost: `${K} of capital and one bridge fee`, time: '20 minutes to set up' },
        { text: `Use three applications from ${n}'s ecosystem page on ${c1} — a swap venue, a lending market and one other — all with the same wallet, so the chain records a real user, not a tourist.`, cost: `${gas} an application`, time: '30 minutes across the week' },
        { text: `Keep a working balance of the chain's gas asset and vote in any on-chain governance ${n} runs while you are active on it.`, cost: 'a signature, usually free', time: '10 minutes a vote' },
      ];
    case 'stable':
      return [
        { text: `Deposit ${K} into ${n}'s main vault on ${c1}, or mint its stable asset against collateral, and hold the resulting position rather than flipping it.`, cost: `${K} of capital and ${gas} to open`, time: '15 minutes' },
        { text: `Provide the stable asset the ${n} position yields to its deepest liquidity pair on ${c1}, so the wallet is earning from both the strategy and the pool.`, cost: `${gas} to provide`, time: '10 minutes' },
        { text: `Rebalance the ${n} position monthly, not weekly: basis and stability strategies pay for duration, and constant churn only donates fees to the pool.`, cost: `${gas} a rebalance`, time: '10 minutes a month' },
      ];
    case 'prediction':
      return [
        { text: `Fund an account on ${n} with ${K} and take small positions in at least five different markets, so no single result decides the experiment.`, cost: `${K} of capital and ${gas} to fund`, time: '20 minutes' },
        { text: `Trade once a week on ${n} in a market you actually have a view on, and let at least two positions run to settlement instead of closing everything early.`, cost: 'the market spread on each trade', time: '10 minutes a week' },
        { text: `If ${n} rewards liquidity providers, quote both sides of one thin market for a full week; thin books are where a small farmer's presence is most visible.`, cost: 'capital sits in open orders', time: '15 minutes to set, then monitoring' },
      ];
    default:
      return [
        { text: `Deposit ${K} of USDC into ${n} on ${c1} through its main product flow and keep the position open past the first week.`, cost: `${K} of capital and ${gas} to deposit`, time: '10 minutes' },
        { text: `Use a second feature of ${n} with the same wallet — its other product, a partner integration or its referral path — so the record is more than a single deposit.`, cost: `${gas} an action`, time: '10 minutes' },
        { text: `Return to ${n} once a week for one small action — a top-up, a claim or a settings change — so the wallet's activity spans several weekly snapshots.`, cost: `${gas} a week`, time: '5 minutes a week' },
      ];
  }
}

/** A protocol's full farm plan: framing steps around its category playbook, 7 steps in all. */
export function farmSteps(p: SnapshotProtocol, age: number | null): string[] {
  const seed = hashOf(p.slug);
  const capital = capitalFor(p.tvl_usd);
  const gas = gasWords(p.chains[0] ?? '');
  const hold = holdDaysFor(age, seed);
  const n = p.name;
  const open = pick(
    [
      { text: `Start with a fresh wallet funded only with what this plan needs, and keep its seed phrase written down offline; never farm ${n} from the wallet that holds your savings.`, cost: 'nothing but care', time: '10 minutes' },
      { text: `Use one dedicated wallet for ${n} so its activity record is clean and attributable, and fund it from your main wallet in a single transfer.`, cost: 'one transfer fee', time: '10 minutes' },
      { text: `Before depositing anything, read ${n}'s own documentation for withdrawal rules, lock-ups and fees; in farming, the surprises are lock-ups, not headline yields.`, cost: 'nothing', time: '15 minutes of reading' },
    ] as const,
    seed,
  );
  const core = coreSteps(groupOf(p.category), p, capital, gas);
  const engage = pick(
    [
      { text: `Check ${n}'s official announcements once a week for a points programme, a quest or a governance vote, and join the first one that opens while your position is live.`, cost: 'nothing to read; small gas to join', time: '10 minutes a week' },
      { text: `Find ${n}'s governance forum or voting space and vote in at least one proposal while your position is open; a vote costs a signature and marks the wallet as a participant, not a passer-by.`, cost: 'a signature, usually free', time: '10 minutes' },
      { text: `If ${n} runs a testnet, a quest or a Galxe-style campaign, complete it with the same wallet; off-chain and testnet activity is cheap and is often accounted separately from deposits.`, cost: 'testnet funds are free; an hour at most', time: '30 minutes once' },
    ] as const,
    seed >> 3,
  );
  const holdStep: StepParts = {
    text: `Hold the core position for at least ${hold} days without a full withdrawal, so the wallet appears in several weekly snapshots of ${n}'s TVL instead of one.`,
    cost: `the $${capital} stays deployed for the period`,
    time: `${hold} days`,
  };
  const close = pick(
    [
      { text: `Keep a farm log for ${n} — wallet, dates, amounts and transaction hashes — so you can prove the history, repeat the position or unwind it in minutes.`, cost: 'nothing', time: '5 minutes after each action' },
      { text: `When you do withdraw, claim any reward only from a link on ${n}'s own site or verified account; a page asking you to pay to 'unlock' a claim is a scam, every time.`, cost: 'nothing to check', time: '10 minutes' },
    ] as const,
    seed >> 5,
  );
  return [open, ...core, engage, holdStep, close].map(flatten);
}

// ---------------------------------------------------------------------------
// Board assembly, the live set, snapshot parsing and the board's self-check.
// ---------------------------------------------------------------------------

/** The protocols the board ranks, strongest first, with ranks 1..n. */
export function buildBoard(snapshot: Snapshot): BoardRow[] {
  const index = new Map(snapshot.protocols.map((p) => [p.slug, p]));
  const watch = new Set(snapshot.watchlist);
  const chosen = new Map<string, SnapshotProtocol>();
  // The watchlist is the floor: every slug on it is on the board, whatever the model says.
  for (const slug of snapshot.watchlist) {
    const p = index.get(slug);
    if (p !== undefined) chosen.set(slug, p);
  }
  // The radar's own finds: every other eligible pre-token protocol, scored, strongest first,
  // until the board reaches its target size. A chosen protocol is never displaced.
  const rest = snapshot.protocols
    .filter((p) => !chosen.has(p.slug) && isEligible(p))
    .map((p) => ({ p, s: scoreProtocol(p, snapshot.as_of) }))
    .sort((a, b) => b.s.implied - a.s.implied || b.p.tvl_usd - a.p.tvl_usd || (a.p.slug < b.p.slug ? -1 : 1));
  for (const { p } of rest) {
    if (chosen.size >= BOARD_TARGET) break;
    chosen.set(p.slug, p);
  }
  const scored = [...chosen.values()].map((p) => ({ p, s: scoreProtocol(p, snapshot.as_of) }));
  scored.sort((a, b) => b.s.implied - a.s.implied || b.p.tvl_usd - a.p.tvl_usd || (a.p.slug < b.p.slug ? -1 : 1));
  return scored.map(({ p, s }, i) => ({
    rank: i + 1,
    slug: p.slug,
    name: p.name,
    category: p.category,
    chains: p.chains,
    tvl_usd: p.tvl_usd,
    change_7d: p.change_7d,
    mcap_usd: p.mcap_usd,
    listed_at: p.listed_at,
    gecko_id: p.gecko_id,
    symbol: p.symbol,
    token_status: 'pre-token',
    watchlist: watch.has(p.slug),
    age_days: s.breakdown.age_days,
    implied_value_usd: s.implied,
    model: s.breakdown,
    farm_steps: farmSteps(p, s.breakdown.age_days),
  }));
}

/** How many live-token protocols the dashboard's Already trading strip carries, by market cap. */
export const LIVE_ROWS = 16;

/** The largest live-token protocols: already trading, so never ranked, shown at market value. */
export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p))
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd || (a.slug < b.slug ? -1 : 1))
    .slice(0, LIVE_ROWS)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
      change_7d: p.change_7d,
      symbol: p.symbol,
    }));
}

/** A board row's form for data.js: its figures, its model's work and its farm plan. */
export function radarRow(row: BoardRow): RadarRow {
  return {
    rank: row.rank,
    slug: row.slug,
    name: row.name,
    category: row.category,
    chains: row.chains,
    tvl_usd: row.tvl_usd,
    change_7d: row.change_7d,
    listed_at: row.listed_at,
    age_days: row.age_days,
    watchlist: row.watchlist,
    implied_value_usd: row.implied_value_usd,
    fdv_tvl: row.tvl_usd > 0 ? round4(row.implied_value_usd / row.tvl_usd) : 0,
    model: row.model,
    farm_steps: row.farm_steps,
  };
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(snapshot: Snapshot): { board: BoardRow[]; radar: RadarData } {
  const board = buildBoard(snapshot);
  const live = liveRows(snapshot);
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model_version: MODEL_VERSION,
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    early_size: board.filter((r) => !r.watchlist).length,
    live_size: live.length,
    rows: board.map(radarRow),
    live,
  };
  return { board, radar };
}

/** The snapshot out of a file's text, refused unless it is the shape the model scores. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });
  return {
    as_of: o.as_of,
    source: o.source,
    floor_usd: o.floor_usd,
    protocols,
    watchlist: o.watchlist as string[],
  };
}

/**
 * Why a board is not one the gate will take, or null. Mirrors the gate's seven rows as they
 * touch the board itself, plus this entry's own standard: 150 to 250 rows, every row a
 * protocol the snapshot records no token for.
 */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  if (board.length < 150 || board.length > 250) return `the board holds ${board.length} rows: this entry's standard is 150 to 250`;
  const index = new Map(snapshot.protocols.map((p) => [p.slug, p]));
  const seen = new Set<string>();
  for (const r of board) {
    const p = index.get(r.slug);
    if (p === undefined) return `${r.slug} is not one of the snapshot's protocols`;
    if (seen.has(r.slug)) return `${r.slug} appears twice`;
    seen.add(r.slug);
    if (!isPreToken(p)) return `${r.slug} records a token in the snapshot and cannot be ranked as pre-token`;
    if (r.name.trim() === '') return `${r.slug} has an empty name`;
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0 || r.implied_value_usd > 100_000_000_000_000) {
      return `${r.slug} has implied value ${r.implied_value_usd}`;
    }
    if (r.farm_steps.length < 3 || r.farm_steps.length > 12) return `${r.slug} has ${r.farm_steps.length} farm steps`;
    for (const s of r.farm_steps) {
      const t = s.trim();
      if (t.length < 20 || t.length > 600) return `${r.slug} has a farm step of ${t.length} characters`;
    }
  }
  const missing = snapshot.watchlist.filter((s) => !seen.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slugs: ${missing.slice(0, 5).join(', ')}`;
  const byRank = [...board].sort((a, b) => a.rank - b.rank);
  for (let i = 0; i < byRank.length; i++) if (byRank[i]!.rank !== i + 1) return `rank ${i + 1} is ${byRank[i]!.rank}`;
  for (let i = 1; i < byRank.length; i++) {
    if (byRank[i]!.implied_value_usd > byRank[i - 1]!.implied_value_usd) return `rank ${byRank[i]!.rank} outranks rank ${byRank[i - 1]!.rank} on implied value`;
  }
  if (board.length >= 2 && byRank[0]!.implied_value_usd === byRank[byRank.length - 1]!.implied_value_usd) {
    return 'every row shares one implied value: a board that ranks nothing by value is not a ranking';
  }
  return null;
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
