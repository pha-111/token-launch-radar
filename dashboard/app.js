// Launch Radar dashboard. Renders window.RADAR (written beside this page by main.ts)
// with no network and no framework. Every view is addressable: ?view=board (default),
// ?view=detail&slug=<slug>, ?view=live, and the board's filters travel in the query
// string (?category=, ?chain=, ?set=, ?min=, ?q=, ?sort=, or one ?filter=a:b,c:d),
// so any screen a reader sees can be linked, screenshotted and reproduced exactly.
'use strict';

const R = window.RADAR;
const app = document.getElementById('app');

/* ---------- formatting ---------- */
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function money(v) {
  if (v === null || v === undefined) return '—';
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(v >= 1e8 ? 0 : 1)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
  return `$${v}`;
}
const pct = (v) => (v === null || v === undefined ? '<span class="mut">—</span>' : `<span class="${v >= 0 ? 'up' : 'down'}">${v >= 0 ? '+' : ''}${v.toFixed(1)}%</span>`);
function ageText(days) {
  if (days === null || days === undefined) return 'unknown';
  if (days >= 730) return `${(days / 365).toFixed(1)}y`;
  if (days >= 60) return `${Math.round(days / 30.4)}mo`;
  return `${days}d`;
}
const qs = (o) => Object.entries(o).filter(([, v]) => v !== '' && v !== null && v !== undefined).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');

/* ---------- view state: the query string is the state ---------- */
const P = new URLSearchParams(location.search);
const S = {
  view: P.get('view') || 'board',
  slug: P.get('slug') || '',
  q: P.get('q') || '',
  category: P.get('category') || '',
  chain: P.get('chain') || '',
  set: P.get('set') || 'all',
  min: Number(P.get('min') || 0),
  sort: P.get('sort') || 'implied',
  dir: P.get('dir') || 'desc',
};
// The same filters as one ?filter=category:Dexs,chain:Ethereum,set:watchlist,min:50000000
if (P.get('filter')) {
  for (const part of P.get('filter').split(',')) {
    const [k, v] = part.split(':');
    if (k === 'category') S.category = v || '';
    else if (k === 'chain') S.chain = v || '';
    else if (k === 'set') S.set = v || 'all';
    else if (k === 'min') S.min = Number(v || 0);
    else if (k === 'q') S.q = v || '';
  }
}
const boardHref = (extra) => `?${qs({ view: 'board', q: S.q, category: S.category, chain: S.chain, set: S.set === 'all' ? '' : S.set, min: S.min || '', sort: S.sort === 'implied' ? '' : S.sort, dir: S.dir === 'desc' ? '' : S.dir, ...extra })}`;
const detailHref = (slug) => `?view=detail&slug=${encodeURIComponent(slug)}`;

/* ---------- filtering and sorting ---------- */
function filteredRows() {
  let rows = R.rows.slice();
  if (S.set === 'watchlist') rows = rows.filter((r) => r.watchlist);
  if (S.set === 'early') rows = rows.filter((r) => !r.watchlist);
  if (S.category) rows = rows.filter((r) => (r.category || 'Uncategorised') === S.category);
  if (S.chain) rows = rows.filter((r) => r.chains.includes(S.chain));
  if (S.min > 0) rows = rows.filter((r) => r.tvl_usd >= S.min);
  if (S.q) {
    const q = S.q.toLowerCase();
    rows = rows.filter((r) => r.name.toLowerCase().includes(q) || r.slug.includes(q));
  }
  const key = { implied: 'implied_value_usd', tvl: 'tvl_usd', change: 'change_7d', age: 'age_days', fdv: 'fdv_tvl', name: 'name' }[S.sort] || 'implied_value_usd';
  const dirn = S.dir === 'asc' ? 1 : -1;
  rows.sort((a, b) => {
    const av = a[key], bv = b[key];
    if (typeof av === 'string') return dirn * av.localeCompare(bv);
    return dirn * ((av ?? -Infinity) - (bv ?? -Infinity)) || a.rank - b.rank;
  });
  return rows;
}
const categories = () => [...new Set(R.rows.map((r) => r.category || 'Uncategorised'))].sort();
const chains = () => [...new Set(R.rows.flatMap((r) => r.chains))].sort();
const median = (xs) => { const s = xs.slice().sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : 0; };

/* ---------- the board ---------- */
function toolbar(rows) {
  const opt = (v, cur, label) => `<option value="${esc(v)}"${v === cur ? ' selected' : ''}>${esc(label ?? v)}</option>`;
  return `<form class="toolbar" method="get" action="">
    <input type="hidden" name="view" value="board">
    <input type="search" name="q" value="${esc(S.q)}" placeholder="Search name or slug" aria-label="Search">
    <label>Category</label><select name="category">${opt('', S.category, 'All categories')}${categories().map((c) => opt(c, S.category)).join('')}</select>
    <label>Chain</label><select name="chain">${opt('', S.chain, 'All chains')}${chains().map((c) => opt(c, S.chain)).join('')}</select>
    <label>Set</label><select name="set">${opt('all', S.set, 'Whole board')}${opt('watchlist', S.set, 'Watchlist only')}${opt('early', S.set, 'Early finds only')}</select>
    <label>Min TVL</label><select name="min">${[[0, 'Any'], [1e7, '$10M'], [2.5e7, '$25M'], [5e7, '$50M floor'], [1e8, '$100M'], [5e8, '$500M']].map(([v, l]) => opt(String(v), String(S.min), l)).join('')}</select>
    <label>Sort</label><select name="sort">${[['implied', 'Implied value'], ['tvl', 'TVL'], ['change', '7d change'], ['age', 'Age'], ['fdv', 'FDV/TVL'], ['name', 'Name']].map(([v, l]) => opt(v, S.sort, l)).join('')}</select>
    <button type="submit">Apply</button>
    <a class="reset" href="?view=board"><button type="button" class="reset">Reset</button></a>
    <span class="count">${rows.length} of ${R.board_size} protocols</span>
  </form>`;
}
function sortHead(label, keyName, cls) {
  const nextDir = S.sort === keyName && S.dir === 'desc' ? 'asc' : 'desc';
  const arrow = S.sort === keyName ? (S.dir === 'desc' ? ' ↓' : ' ↑') : '';
  return `<th class="${cls || ''}"><a href="${boardHref({ sort: keyName === 'implied' ? '' : keyName, dir: nextDir === 'desc' ? '' : nextDir })}" style="color:inherit">${label}${arrow}</a></th>`;
}
function boardView() {
  const rows = filteredRows();
  const tvls = rows.map((r) => Math.log10(Math.max(r.tvl_usd, 1)));
  const lo = Math.min(...tvls, 0), hi = Math.max(...tvls, 1);
  const barW = (v) => Math.max(3, Math.round((100 * (Math.log10(Math.max(v, 1)) - lo)) / (hi - lo || 1)));
  const totalTvl = rows.reduce((a, r) => a + r.tvl_usd, 0);
  const head = `<div class="pagehead"><div>
      <h1>Pre-token protocols, ranked by implied value</h1>
      <p class="sub">Every protocol here records no token in the snapshot. The radar values the token each
      could launch — from its TVL, its week's growth, its tokenless age and its chain footprint — and
      shows the farm plan for each. Click any row for the full breakdown.</p></div></div>
    <div class="stats">
      <div class="stat"><div class="k">Protocols ranked</div><div class="v num">${rows.length}</div><div class="n">of ${R.board_size} on the board</div></div>
      <div class="stat"><div class="k">Watchlist covered</div><div class="v num">${rows.filter((r) => r.watchlist).length} / ${R.watchlist_size}</div><div class="n">the floor, never the ceiling</div></div>
      <div class="stat"><div class="k">TVL under watch</div><div class="v num">${money(totalTvl)}</div><div class="n">across the protocols shown</div></div>
      <div class="stat"><div class="k">Median implied FDV/TVL</div><div class="v num">${median(rows.map((r) => r.fdv_tvl)).toFixed(2)}x</div><div class="n">model ${esc(R.model_version)}, snapshot ${esc(R.as_of)}</div></div>
    </div>`;
  if (!rows.length) return head + toolbar(rows) + `<div class="tablewrap"><p class="empty">No protocol matches these filters. Loosen one and apply again.</p></div>` + methodology();
  const body = rows.map((r) => `<tr data-href="${detailHref(r.slug)}" class="${r.rank <= 3 ? 'top1' : ''}">
    <td class="rank num">${r.rank}</td>
    <td class="l"><a class="pname" href="${detailHref(r.slug)}">${esc(r.name)}</a>${r.watchlist ? '<span class="badge">WATCHLIST</span>' : ''}<br><span class="pslug">${esc(r.slug)}</span></td>
    <td class="l cat">${esc(r.category || 'Uncategorised')}</td>
    <td><span class="chains">${r.chains.slice(0, 3).map((c) => `<span class="chain">${esc(c)}</span>`).join('')}${r.chains.length > 3 ? `<span class="chain">+${r.chains.length - 3}</span>` : ''}</span></td>
    <td class="tvlcell"><span class="num">${money(r.tvl_usd)}</span><span class="bar"><i style="width:${barW(r.tvl_usd)}%"></i></span></td>
    <td class="num">${pct(r.change_7d)}</td>
    <td class="num mut">${ageText(r.age_days)}</td>
    <td class="num implied">${money(r.implied_value_usd)}</td>
    <td class="num mult">${r.fdv_tvl.toFixed(2)}x</td></tr>`).join('');
  return head + toolbar(rows) + `<div class="tablewrap"><table>
    <thead><tr>${sortHead('#', 'implied')}${sortHead('Protocol', 'name', 'l')}<th class="l">Category</th><th>Chains</th>${sortHead('TVL', 'tvl')}${sortHead('7d', 'change')}${sortHead('Age', 'age')}${sortHead('Implied value', 'implied')}${sortHead('FDV/TVL', 'fdv')}</tr></thead>
    <tbody>${body}</tbody></table></div>` + methodology();
}

/* ---------- methodology: the model, stated on the page it drives ---------- */
const MULTIPLES = { 'Chain': 1.6, 'Prediction Market': 2.2, 'Launchpad': 1.8, 'Derivatives': 1.4, 'Payments': 1.3, 'Crypto Card Issuer': 1.3, 'Options': 1.2, 'Dexs': 1.1, 'Synthetics': 1.1, 'RWA': 1.0, 'Lending': 0.9, 'Insurance': 0.9, 'CDP': 0.85, 'Liquid Restaking': 0.85, 'Restaking': 0.85, 'Risk Curators': 0.8, 'Onchain Capital Allocator': 0.8, 'Liquid Staking': 0.75, 'Basis Trading': 0.7, 'Yield': 0.65, 'Yield Aggregator': 0.65, 'Leveraged Farming': 0.65, 'Bridge': 0.55, 'Canonical Bridge': 0.55 };
function methodology() {
  const grid = Object.entries(MULTIPLES).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<div><span>${esc(k)}</span><b class="num">${v.toFixed(2)}x</b></div>`).join('');
  return `<section class="panel" id="methodology">
    <h2>Methodology — how the radar values a token that does not exist yet</h2>
    <p>An implied value is a claim about one number: what a protocol's token would be worth at launch if
    its record in the snapshot stayed as it is. The model (${esc(R.model_version)}) derives it from the
    snapshot's own figures only — no protocol name is special-cased, and every row on the board was
    produced by the same four factors, which each protocol's detail view shows in full:</p>
    <p class="formula">implied value = TVL x category multiple x growth factor x maturity factor x chain factor</p>
    <h3>The four factors</h3>
    <p><b>Category multiple.</b> The FDV/TVL ratio public markets pay for a token of that kind. A chain's own
    token captures the whole network (1.60x); a prediction market's prices future flow over today's TVL
    (2.20x); a bridge's token captures a thin fee stream over a large pass-through TVL (0.55x). A category
    not in the table scores the default 0.80x.</p>
    <p><b>Growth factor.</b> The week's TVL momentum, damped: 1 + clamp(7d change, -50%, +100%) x 0.6, so a
    protocol that shrank 50% in a week is marked to 0.70x and one that doubled to 1.60x. An unreported
    change scores as flat.</p>
    <p><b>Maturity factor.</b> How long the protocol has run with no token is the radar's core signal: years
    of operation without issuing means a real product and a launch still ahead. The factor rises from
    0.80x toward 1.20x over four tokenless years, then saturates. An unreported listing date scores as
    one year.</p>
    <p><b>Chain factor.</b> Deployment breadth: 1 + 3% for each chain beyond the first, up to eight chains —
    a token for a protocol on eight chains addresses more users than the same TVL on one.</p>
    <h3>Who is on the board</h3>
    <p>A protocol is pre-token when the snapshot records no token for it: no market cap, no CoinGecko id, no
    symbol. Protocols whose token already trades are never ranked here — the Already trading view lists
    the largest at the market's own values. The board carries every one of the ${R.watchlist_size}
    watchlist protocols (TVL at or above the ${money(R.floor_usd)} floor, no token recorded, and not a
    wrapped, staked or bridged product of one that trades) plus the radar's own finds beyond it:
    ${R.early_size} of the ${R.board_size} rows sit outside the watchlist. Off the board entirely: the product categories Bridge,
    Canonical Bridge, Liquid Staking, Liquid Restaking, Restaked BTC and CEX, exchange-branded and
    versioned names — a bridged Bitcoin records no token of its own, but it is not a launch still to come.</p>
    <h3>Category multiples (FDV / TVL)</h3>
    <div class="multgrid">${grid}</div>
    <p class="mut" style="margin-top:12px">Data: ${esc(R.source)}. Snapshot as of ${esc(R.as_of)}. An implied value is
    this entry's own claim, stated so a reader can disagree with it factor by factor; it is not a
    prediction that a token will be issued.</p>
  </section>`;
}

/* ---------- one protocol: stats, the model's work, and its farm plan ---------- */
function detailView() {
  const r = R.rows.find((x) => x.slug === S.slug);
  if (!r) return `<p class="empty">No protocol with slug “${esc(S.slug)}” is on the board. <a href="?view=board">Back to the board</a></p>`;
  const m = r.model;
  const base = r.tvl_usd * m.category_multiple;
  const afterGrowth = base * m.growth_factor;
  const afterMaturity = afterGrowth * m.maturity_factor;
  const stat = (k, v, n) => `<div class="stat"><div class="k">${k}</div><div class="v num">${v}</div><div class="n">${n}</div></div>`;
  const brow = (label, factor, running) => `<tr><td>${label}</td><td class="r num">${factor}</td><td class="r num">${money(Math.round(running))}</td></tr>`;
  return `<a class="backlink" href="?view=board">← Back to the board</a>
  <div class="dhead"><h1>${esc(r.name)}</h1><span class="rankchip num">Rank #${r.rank} of ${R.board_size}</span>${r.watchlist ? '<span class="badge" style="margin:0">WATCHLIST</span>' : '<span class="chain">early find</span>'}</div>
  <p class="dsub">${esc(r.category || 'Uncategorised')} · ${r.chains.map(esc).join(', ') || 'no chains recorded'} · records no token in the snapshot of ${esc(R.as_of)} — a launch still to come, if it comes.</p>
  <div class="kv">
    ${stat('TVL', money(r.tvl_usd), `on ${m.chain_count} chain${m.chain_count === 1 ? '' : 's'}`)}
    ${stat('Implied value', money(r.implied_value_usd), `FDV/TVL ${r.fdv_tvl.toFixed(2)}x`)}
    ${stat('7d TVL change', r.change_7d === null ? '—' : `${r.change_7d >= 0 ? '+' : ''}${r.change_7d.toFixed(1)}%`, 'the week to the snapshot')}
    ${stat('Tokenless age', r.age_days === null ? 'unknown' : `${r.age_days} days`, r.listed_at ? `tracked since ${esc(r.listed_at)}` : 'no listing date recorded')}
    ${stat('Implied FDV/TVL', `${r.fdv_tvl.toFixed(2)}x`, `category multiple ${m.category_multiple.toFixed(2)}x`)}
    ${stat('Board position', `#${r.rank}`, r.watchlist ? 'a watchlist protocol' : 'a radar find beyond the watchlist')}
  </div>
  <div class="dgrid">
    <section class="panel" style="margin:0">
      <h2>Why this implied value</h2>
      <p class="mut">Model ${esc(R.model_version)}: the same four factors that score every row, with this protocol's own figures.</p>
      <table class="breakdown"><thead><tr><th>Step</th><th class="r">Factor</th><th class="r">Running value</th></tr></thead><tbody>
      <tr><td>TVL in the snapshot</td><td class="r num">—</td><td class="r num">${money(r.tvl_usd)}</td></tr>
      ${brow(`Category multiple — ${esc(r.category || 'Uncategorised')}`, `${m.category_multiple.toFixed(2)}x`, base)}
      ${brow(`Growth factor — 7d change ${m.growth_pct >= 0 ? '+' : ''}${m.growth_pct.toFixed(1)}%, damped`, `${m.growth_factor.toFixed(2)}x`, afterGrowth)}
      ${brow(`Maturity factor — ${m.age_days === null ? 'age unreported, scored as 365 days' : `${m.age_days} tokenless days`}`, `${m.maturity_factor.toFixed(2)}x`, afterMaturity)}
      ${brow(`Chain factor — ${m.chain_count} chain${m.chain_count === 1 ? '' : 's'}`, `${m.chain_factor.toFixed(2)}x`, afterMaturity * m.chain_factor)}
      <tr class="tot"><td>Implied value</td><td class="r"></td><td class="r num">${money(r.implied_value_usd)}</td></tr>
      </tbody></table>
      <p class="mut">TVL share sparkline against the board's largest protocol:</p>
      <p>${sparkline(r)}</p>
    </section>
    <section class="panel" style="margin:0">
      <h2>Farm plan — ${esc(r.name)}</h2>
      <p class="mut">Concrete steps for this protocol's category and chains, each with what it costs and how long it takes. Farming is positioning for a possible launch, never a promise of one.</p>
      <ol class="steps">${r.farm_steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>
    </section>
  </div>`;
}
/** A pure-SVG bar comparing this protocol's TVL with the board's top five. */
function sparkline(r) {
  const top = R.rows.slice().sort((a, b) => b.tvl_usd - a.tvl_usd).slice(0, 5);
  const all = top.some((x) => x.slug === r.slug) ? top : [...top, r];
  const max = Math.max(...all.map((x) => x.tvl_usd));
  const bars = all.map((x, i) => {
    const h = Math.max(4, Math.round((64 * Math.log10(x.tvl_usd)) / Math.log10(max)));
    const fill = x.slug === r.slug ? '#2dd4bf' : '#2b3449';
    return `<rect x="${i * 44 + 4}" y="${72 - h}" width="30" height="${h}" rx="3" fill="${fill}"><title>${esc(x.name)}: ${money(x.tvl_usd)}</title></rect>`;
  }).join('');
  return `<svg width="${all.length * 44 + 4}" height="76" role="img" aria-label="TVL comparison bars">${bars}</svg>`;
}

/* ---------- protocols whose token already trades: never ranked ---------- */
function liveView() {
  const body = R.live.map((p) => `<tr>
    <td class="l"><span class="pname">${esc(p.name)}</span> <span class="pslug">${esc(p.symbol || '')}</span><br><span class="pslug">${esc(p.slug)}</span></td>
    <td class="l cat">${esc(p.category || 'Uncategorised')}</td>
    <td><span class="chains">${p.chains.slice(0, 3).map((c) => `<span class="chain">${esc(c)}</span>`).join('')}${p.chains.length > 3 ? `<span class="chain">+${p.chains.length - 3}</span>` : ''}</span></td>
    <td class="num">${money(p.tvl_usd)}</td>
    <td class="num">${pct(p.change_7d)}</td>
    <td class="num implied">${money(p.mcap_usd)}</td></tr>`).join('');
  return `<div class="pagehead"><div><h1>Already trading — set aside, not ranked</h1>
  <p class="sub">These protocols record a token in the snapshot, so the market has already priced them and
  the radar has nothing to forecast. They are shown at the market's own values to make the separation
  explicit: the board ranks only protocols whose token does not exist yet.</p></div></div>
  <div class="tablewrap"><table><thead><tr><th class="l">Protocol</th><th class="l">Category</th><th>Chains</th><th>TVL</th><th>7d</th><th>Market cap</th></tr></thead>
  <tbody>${body}</tbody></table></div>`;
}

/* ---------- boot ---------- */
document.getElementById('topmeta').innerHTML = `Snapshot <b>${esc(R.as_of)}</b> · model <b>${esc(R.model_version)}</b><br>${R.board_size} ranked · ${R.watchlist_size} watchlist · ${R.live_size} live set aside`;
document.getElementById('foot').textContent = `Launch Radar · ${R.source} · Board of ${R.board_size} pre-token protocols (${R.watchlist_size} watchlist, ${R.early_size} early finds) · Implied values are this entry's own model claims, not predictions.`;
app.innerHTML = S.view === 'detail' ? detailView() : S.view === 'live' ? liveView() : boardView();
app.setAttribute('aria-busy', 'false');
document.querySelectorAll('tbody tr[data-href]').forEach((tr) => {
  tr.addEventListener('click', (e) => { if (!e.target.closest('a')) location.href = tr.getAttribute('data-href'); });
});
