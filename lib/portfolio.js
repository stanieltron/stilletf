// /lib/portfolio.js  (monthly data version — returns metricsOff & metricsOn)

export async function fetchAssets() {
  let url;
  if (typeof window !== "undefined") {
    url = "/api/prices";
  } else {
    const baseEnv =
      process.env.NEXT_PUBLIC_BASE_URL ||
      process.env.VERCEL_URL ||
      "http://localhost:3000";
    const origin = baseEnv.startsWith("http") ? baseEnv : `https://${baseEnv}`;
    url = new URL("/api/prices", origin).toString();
  }
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch assets");
  return res.json();
}

/* ---------------- helpers ---------------- */

function simpleReturns(series) {
  const rets = [];
  for (let i = 1; i < series.length; i++) {
    const prev = series[i - 1];
    const curr = series[i];
    if (Number.isFinite(prev) && prev !== 0 && Number.isFinite(curr)) {
      rets.push(curr / prev - 1);
    }
  }
  return rets;
}

function stdDev(vals) {
  if (!vals || vals.length === 0) return 0;
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
  const varSum = vals.reduce((a, b) => a + (b - mean) ** 2, 0) / vals.length;
  return Math.sqrt(varSum);
}

function downsideDeviation(vals) {
  if (!vals || vals.length === 0) return 0;
  const downs = vals.filter(v => v < 0);
  if (downs.length === 0) return 0;
  const varSum = downs.reduce((s, r) => s + (Math.min(0, r)) ** 2, 0) / downs.length;
  return Math.sqrt(varSum);
}

function maxDrawdownDecimal(values) {
  if (!values || values.length === 0) return 0;
  let peak = values[0];
  let maxDD = 0;
  for (const v of values) {
    if (v > peak) peak = v;
    const dd = peak > 0 ? (peak - v) / peak : 0;
    if (dd > maxDD) maxDD = dd;
  }
  return maxDD;
}

function averageAbsPairwiseCorrelation(seriesList) {
  const n = seriesList.length;
  if (n < 2) return 1;
  const L = Math.min(...seriesList.map(s => s.length));
  const aligned = seriesList.map(s => s.slice(-L));

  const means = aligned.map(s => s.reduce((a, b) => a + b, 0) / L);
  const stds = aligned.map(s => stdDev(s));

  let totalAbsCorr = 0;
  let pairs = 0;

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const a = aligned[i], b = aligned[j];
      const meanA = means[i], meanB = means[j];
      const stdA = stds[i], stdB = stds[j];

      let cov = 0;
      for (let k = 0; k < L; k++) cov += (a[k] - meanA) * (b[k] - meanB);
      cov /= L;

      const corr = (stdA > 0 && stdB > 0) ? (cov / (stdA * stdB)) : 0;
      totalAbsCorr += Math.abs(corr);
      pairs++;
    }
  }
  return pairs > 0 ? (totalAbsCorr / pairs) : 1;
}

function clamp01(x) {
  if (!Number.isFinite(x)) return 0;
  return Math.min(1, Math.max(0, x));
}

function compoundedSeries(prices, yearlyYield) {
  const out = [prices[0]];
  const rMonthly = Math.pow(1 + (yearlyYield || 0), 1 / 12) - 1;
  for (let t = 1; t < prices.length; t++) {
    const priceFactor = prices[t] / prices[t - 1];
    out.push(Number((out[t - 1] * priceFactor * (1 + rMonthly)).toFixed(6)));
  }
  return out;
}

/* ---------------- metric calculator ---------------- */

function computeMetrics(series, perAssetReturns, opts = {}) {
  const PERIODS_PER_YEAR = 12;
  const rfAnnual = 0;
  const nMonths = Math.max(0, (series?.length || 1) - 1);
  const years = nMonths > 0 ? nMonths / PERIODS_PER_YEAR : 0;

  const start = series?.[0];
  const end = series?.[series.length - 1];
  const rets = simpleReturns(series);

  // CAGR
  let cagr = 0;
  if (Number.isFinite(start) && Number.isFinite(end) && start > 0 && years > 0) {
    cagr = Math.pow(end / start, 1 / years) - 1;
  } else if (rets.length > 0) {
    const avg = rets.reduce((a, b) => a + b, 0) / rets.length;
    cagr = Math.pow(1 + avg, PERIODS_PER_YEAR) - 1;
  }

  const cagrPct = cagr * 100;

  // Volatility
  const volMonthly = stdDev(rets);
  const annualizedVolatilityPct = volMonthly * Math.sqrt(PERIODS_PER_YEAR) * 100;

  // Max Drawdown
  const maxDrawdownPct = -maxDrawdownDecimal(series) * 100;

  // Sharpe
  const volAnn = annualizedVolatilityPct / 100;
  const sharpe = volAnn > 0 ? (cagr - rfAnnual) / volAnn : 0;

  // Sortino
  const ddMonthly = downsideDeviation(rets);
  const ddAnn = ddMonthly * Math.sqrt(PERIODS_PER_YEAR);
  const sortino = ddAnn > 0 ? (cagr - rfAnnual) / ddAnn : (volAnn > 0 ? (cagr - rfAnnual) / volAnn : 0);

  // Diversification
  let diversificationScore = 0;
  if (Array.isArray(perAssetReturns) && perAssetReturns.length >= 2) {
    const avgAbsCorr = averageAbsPairwiseCorrelation(perAssetReturns);
    diversificationScore = clamp01(1 - avgAbsCorr);
  }

  return { cagrPct, annualizedVolatilityPct, maxDrawdownPct, sharpe, sortino, diversificationScore };
}

/* ---------------- main portfolio calculator ---------------- */

export async function portfolioCalculator(assets, amounts, assetMapOverride) {
  if (assets.length !== amounts.length) {
    throw new Error("assets and amounts must have the same length");
  }

  const assetsMap =
    assetMapOverride && Object.keys(assetMapOverride).length
      ? assetMapOverride
      : (await fetchAssets()).assets;

  const perAsset = assets.map((key) => {
    const a = assetsMap[key];
    if (!a) throw new Error(`Unknown asset: ${key}`);
    if (!Array.isArray(a.prices) || a.prices.length === 0) {
      throw new Error(`No prices for asset: ${key}`);
    }
    return {
      key,
      name: a.name,
      color: a.color,
      yearlyYield: a.yearlyYield || 0,
      prices: a.prices,
      compoundedPrices: compoundedSeries(a.prices, a.yearlyYield || 0)
    };
  });

  const len = perAsset[0].prices.length;
  if (!perAsset.every((a) => a.prices.length === len)) {
    throw new Error("All asset price arrays must have same length");
  }

  const sum = amounts.reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0);
  if (sum <= 0) throw new Error("Sum of weights must be > 0");
  const weights = amounts.map((x) => x / sum);

  const initialCapital = 1000;
  const firstPrices = perAsset.map((a) => a.prices[0]);
  const quantities = weights.map((w, i) => (initialCapital * w) / firstPrices[i]);

  // Build series (off)
  const series = [];
  for (let t = 0; t < len; t++) {
    let v = 0;
    for (let i = 0; i < perAsset.length; i++) {
      v += quantities[i] * perAsset[i].prices[t];
    }
    series.push(Number(v.toFixed(2)));
  }

  // Build series with yield
  const seriesWithYield = [];
  for (let t = 0; t < len; t++) {
    let v = 0;
    for (let i = 0; i < perAsset.length; i++) {
      const alloc = initialCapital * weights[i];
      v += alloc * (perAsset[i].compoundedPrices[t] / perAsset[i].prices[0]);
    }
    seriesWithYield.push(Number(v.toFixed(2)));
  }

  // Per-asset returns
  const perAssetReturnsOff = perAsset.map(a => simpleReturns(a.prices));
  const perAssetReturnsOn = perAsset.map(a => simpleReturns(a.compoundedPrices));

  // Compute both metric sets
  const metricsOff = computeMetrics(series, perAssetReturnsOff);
  const metricsOn = computeMetrics(seriesWithYield, perAssetReturnsOn);

  // Gains
  const start = series[0];
  const endOff = series[series.length - 1];
  const endOn = seriesWithYield[seriesWithYield.length - 1];

  metricsOff.gain = endOff - start;
  metricsOff.gainOnYield = 0;

  metricsOn.gain = endOn - start;
  metricsOn.gainOnYield = endOn - endOff;

  return {
    series,
    seriesWithYield,
    metricsOff,
    metricsOn,
    weights,
    quantities,
    assets: assetsMap
  };
}
