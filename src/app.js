// src/app.js
// Spatial Scroll-Scrubbed MOCHI Controller, Bonding Curve Integer Simulator & Studionet Lifecycle Engine

import { finalizedExecutionSucceeded } from "./finality.js";

import {
  APP_CONFIG,
  INITIAL_SEED_STATE,
  calcCurveIntegralReserve,
  calcSpotPrice,
  fmtGen,
  unitsToWei,
  sha256HexBrowser,
  getOrCreateEphemeralTestAccount,
  connectInjectedEvmWallet,
  publicClient, getTestSigningClient, verifyStableNetwork
} from "./config.js";

import {
  I18N_DICT,
  applyTranslations,
  verifyI18nParity,
  injectMochiStyles,
  playUiSound
} from "./i18n_and_styles.js";

const appState = {
  lang: "en",
  activeCurveId: "curve-mochi-prime",
  connectedWallet: null,
  ephemeralSigner: null,
  activeTraderAddress: "0xDEMO_TRADER",
  balances: structuredClone(INITIAL_SEED_STATE.balances),
  curves: structuredClone(INITIAL_SEED_STATE.curves),
  mochiOverridePose: null, // null = follow scroll scrub & curve state; string = transient action pose
  reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  audioEnabled: false,
  audioManuallyDisabled: false,
  firstInteractionDone: false
};

// ==============================================================================
// 1. STUDIONET RPC ADAPTER (Real RPC path when CONTRACT_ADDRESS is set; honest rehearsal otherwise)
// ==============================================================================
async function rpcRequest(method, params = []) {
  const res = await fetch(APP_CONFIG.RPC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: Date.now(),
      method,
      params
    })
  });
  const data = await res.json();
  if (data.error) {
    throw new Error(data.error.message || JSON.stringify(data.error));
  }
  return data.result;
}

let activeTransaction = null;
let writeInFlight = false;
const pendingKey = "mochicurve-pending-61999";

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
}

async function refreshCurvesFromChainIfConfigured() {
  if (!APP_CONFIG.CONTRACT_ADDRESS) return false;
  const rawCurves = await publicClient.readContract({ address: APP_CONFIG.CONTRACT_ADDRESS,
    functionName: "get_all_curves", args: [], transactionHashVariant: "latest-final" });
  appState.curves = typeof rawCurves === "string" ? JSON.parse(rawCurves) : rawCurves;
  const ids = Object.keys(appState.curves);
  if (!appState.curves[appState.activeCurveId]) appState.activeCurveId = ids[0] || null;
  if (/^0x[0-9a-fA-F]{40}$/.test(appState.activeTraderAddress || "")) {
    // get_user_balance is the pull-payment credit owed (units), not a wallet balance.
    const withdrawable = await publicClient.readContract({ address: APP_CONFIG.CONTRACT_ADDRESS,
      functionName: "get_user_balance", args: [appState.activeTraderAddress], transactionHashVariant: "latest-final" });
    appState.balances[appState.activeTraderAddress] = Number(withdrawable);
    try {
      const walletWei = await publicClient.getBalance({ address: appState.activeTraderAddress });
      appState.walletGenWei = walletWei;
    } catch { appState.walletGenWei = null; }
  }
  document.getElementById("trust-timestamp").textContent = new Date().toISOString();
  return true;
}

function transactionSucceeded(tx) {
  return finalizedExecutionSucceeded(tx);
}

async function pollExistingTransaction(pending) {
  activeTransaction = pending;
  writeInFlight = true;
  const hash = pending.hash;
  try {
    while (activeTransaction?.hash === hash) {
      let tx;
      try { tx = await publicClient.getTransaction({ hash }); }
      catch { updateTrustSurface("POLL_RETRY", hash, "Connection interrupted. Tracking the same transaction; no new request is sent.");
        await new Promise(r => setTimeout(r, 5000)); continue; }
      const status = tx.statusName || String(tx.status);
      updateTrustSurface(status, hash, "Tracking Studionet consensus. Keep this transaction hash to resume.");
      if (status === "FINALIZED") {
        if (!transactionSucceeded(tx)) {
          updateTrustSurface("FINALIZED_EXECUTION_ERROR", hash, "The transaction finalized with an execution error. Inspect its receipt before retrying.");
          localStorage.removeItem(pendingKey); activeTransaction = null; break;
        }
        try { await refreshCurvesFromChainIfConfigured(); }
        catch { updateTrustSurface("FINALIZED_READBACK_RETRY", hash, "Finalized successfully; retrying the finalized state read. No new transaction will be sent.");
          await new Promise(r => setTimeout(r, 5000)); continue; }
        localStorage.removeItem(pendingKey); activeTransaction = null;
        setMochiPoseOverride("mochi-celebrate-jump.png", "FINALIZED_AND_READ_BACK");
        updateTrustSurface("FINALIZED", hash, I18N_DICT[appState.lang].msg_tx_finalized_ok);
        if (appState.audioEnabled) playUiSound("finalized");
        renderAll(); break;
      }
      if (["CANCELED", "UNDETERMINED"].includes(status)) {
        updateTrustSurface(status, hash, "Consensus did not produce a successful result. Inspect the receipt before sending another request.");
        localStorage.removeItem(pendingKey); activeTransaction = null; break;
      }
      await new Promise(r => setTimeout(r, 4000));
    }
  } finally { writeInFlight = Boolean(activeTransaction); if (!writeInFlight) setMochiPoseOverride("mochi-point.png", "READY"); }
}

async function submitStudionetWriteOrRehearsal(methodName, args, rehearsalCallback, value = 0n) {
  if (writeInFlight) { updateTrustSurface("TRANSACTION_IN_PROGRESS", activeTransaction?.hash || "", "Wait for the existing transaction to finish."); return; }
  setMochiPoseOverride("mochi-thinking.png", "THINKING_CONSENSUS");
  if (!APP_CONFIG.CONTRACT_ADDRESS) {
    try {
      const pose = await rehearsalCallback();
      setMochiPoseOverride(pose || "mochi-celebrate-expr.png", "LOCAL_REHEARSAL");
      updateTrustSurface("LOCAL_REHEARSAL_NON_ONCHAIN", "", I18N_DICT[appState.lang].msg_rehearsal_done);
      renderAll();
    } catch (err) { updateTrustSurface("LOCAL_REHEARSAL_ERROR", "", String(err.message).slice(0,180)); }
    return;
  }
  try {
    if (!appState.ephemeralSigner) throw new Error("Enable the labeled temporary test account before writing.");
    writeInFlight = true;
    await verifyStableNetwork();
    // Signer attribution is explicit; never submit another wallet's address as owner.
    // v2: evaluate/execute/reveal take the creator as their actor argument.
    const actorSlots = { launch_curve: 3, buy_tokens: 2, sell_tokens: 2, reveal_secret_catalyst: 3,
      evaluate_graduation_gate: 3, execute_verdict: 1, challenge_pending_verdict: 1, record_contradiction_claim: 1 };
    if (Object.hasOwn(actorSlots, methodName)) args[actorSlots[methodName]] = appState.ephemeralSigner.address;
    appState.activeTraderAddress = appState.ephemeralSigner.address;
    updateTrustSurface("SUBMITTING", "", `Temporary test account ${appState.ephemeralSigner.address} is signing ${methodName}${value > 0n ? ` with ${(Number(value) / 1e18).toFixed(3)} GEN` : ""}.`);
    const signer = getTestSigningClient(signedHash => {
      if (activeTransaction && activeTransaction.hash !== signedHash) throw new Error("Unresolved broadcast must be inspected first.");
      activeTransaction = { hash: signedHash, methodName, contract: APP_CONFIG.CONTRACT_ADDRESS, chainId: 61999 };
      localStorage.setItem(pendingKey, JSON.stringify(activeTransaction));
      updateTrustSurface("BROADCASTING", signedHash, "A signed request is being sent. Its public hash has been retained for recovery.");
    });
    const hash = await signer.writeContract({ address: APP_CONFIG.CONTRACT_ADDRESS,
      functionName: methodName, args, value, consensusMaxRotations: 3 });
    const pending = { hash, methodName, contract: APP_CONFIG.CONTRACT_ADDRESS, chainId: 61999 };
    // Only public transaction metadata is persisted. Secrets and signing material stay in memory.
    localStorage.setItem(pendingKey, JSON.stringify(pending));
    await pollExistingTransaction(pending);
  } catch (err) {
    updateTrustSurface("REQUEST_ERROR", activeTransaction?.hash || "", activeTransaction
      ? "Tracking continues for the existing transaction. Do not submit again."
      : "Request failed. Check network connectivity and the temporary test account before retrying.");
    setMochiPoseOverride("mochi-point.png", "REQUEST_ERROR");
    if (activeTransaction) await pollExistingTransaction(activeTransaction);
  } finally { writeInFlight = Boolean(activeTransaction); }
}

// ==============================================================================
// 2. CONTINUOUS MOCHI CAMERA, SINGLE-TEXTURE TURN AND SCENE LIGHTING
// ==============================================================================
let requestMochiFrame = () => {};
function setupContinuousScrollScrub() {
  const rig = document.getElementById("mochi-actor-rig");
  const stage = document.getElementById("mochi-persistent-stage");
  const halo = document.getElementById("mochi-halo-ring");
  const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  const mobileQuery = window.matchMedia("(max-width: 860px)");
  const turntable = document.createElement("div");
  turntable.className = "mochi-turntable";
  rig.insertBefore(turntable, document.getElementById("mochi-layer-front"));
  const stateSprite = document.getElementById("mochi-layer-state");
  // Reuse the three orientation views from the original nine-image character set.
  const views = ["front", "side", "back"].map((name, index) => {
    const sprite = document.getElementById(`mochi-layer-${name}`);
    const angle = index * 90;
    sprite.className = "mochi-sprite";
    sprite.dataset.angle = String(angle);
    turntable.appendChild(sprite);
    const view = { angle, sprite, ready: false };
    sprite.decode().then(() => { view.ready = true; requestMochiFrame(); }).catch(() => {});
    return view;
  });
  turntable.appendChild(stateSprite);

  // Three distinct palette lights interpolate across the entire scroll range.
  const atmosphere = document.createElement("div");
  atmosphere.className = "mochi-atmosphere";
  atmosphere.setAttribute("aria-hidden", "true");
  const lightLayers = ["cyan", "violet", "magenta"].map(tone => {
    const light = document.createElement("div");
    light.className = `scene-light scene-light-${tone}`;
    atmosphere.appendChild(light);
    const rim = document.createElement("span");
    rim.className = `halo-light halo-light-${tone}`;
    halo.appendChild(rim);
    return [light, rim];
  });
  const shade = document.createElement("div");
  shade.className = "scene-shade";
  atmosphere.appendChild(shade);
  document.body.prepend(atmosphere);

  const clamp = value => Math.max(0, Math.min(1, value));
  const smooth = value => { const t = clamp(value); return t * t * (3 - 2 * t); };
  const mix = (a, b, t) => a + (b - a) * t;
  let current = 0, target = 0, frame = 0, previousTime = 0;
  const content = document.getElementById("spatial-scroll-world");
  let maxScroll = 1;
  const scrollPosition = () => mobileQuery.matches ? content.scrollTop : window.scrollY;

  function measureScene() {
    maxScroll = Math.max(1, mobileQuery.matches
      ? content.scrollHeight - content.clientHeight
      : document.documentElement.scrollHeight - innerHeight);
    target = clamp(scrollPosition() / maxScroll);
    requestMochiFrame();
  }

  function renderFrame(time) {
    frame = 0;
    const reduced = motionQuery.matches, mobile = mobileQuery.matches;
    appState.reducedMotion = reduced;
    const dt = previousTime ? Math.max(0, time - previousTime) : 16.67;
    previousTime = time;
    // 300ms exponential response keeps the same inertia at different frame rates.
    current = reduced ? target : current + (target - current) * (1 - Math.exp(-dt / 300));
    if (Math.abs(target - current) < 0.00002) current = target;
    const p = reduced ? 0 : current;
    const yaw = p * 180;
    const pitch = mobile || reduced ? 0 : p <= 0.5
      ? mix(0, -12, smooth(p * 2)) : mix(-12, 8, smooth((p - 0.5) * 2));
    const scale = reduced ? (mobile ? 0.85 : 1) : p <= 0.5
      ? mix(0.85, mobile ? 1 : 1.5, smooth(p * 2))
      : mix(mobile ? 1 : 1.5, mobile ? 0.9 : 1.15, smooth((p - 0.5) * 2));
    // The stage stays centered; idle motion has no horizontal or scroll-driven offset.
    const float = reduced ? 0 : Math.sin(time / 900) * (mobile ? 4 : 8);
    rig.style.transform = `translate3d(0, ${float.toFixed(2)}px, 0) scale(${scale.toFixed(4)})`;

    const readyViews = views.filter(view => view.ready);
    const view = reduced ? views[0] : readyViews.reduce((nearest, candidate) =>
      Math.abs(candidate.angle - yaw) < Math.abs(nearest.angle - yaw) ? candidate : nearest,
      readyViews[0] || views[0]);
    // A bounded facet turn suggests depth without ever making the sprite edge-on.
    // The logical orbit runs from front to back while each real view stays readable.
    const residual = reduced ? 0 : Math.max(-22.5, Math.min(22.5, (yaw - view.angle) * 0.5));
    turntable.style.transform = `rotateX(${pitch.toFixed(3)}deg) rotateY(${residual.toFixed(3)}deg)`;
    const showState = !reduced && view.angle === 0 && Boolean(appState.mochiOverridePose)
      && stateSprite.complete && stateSprite.naturalWidth > 0;
    views.forEach(candidate => {
      candidate.sprite.style.opacity = !showState && candidate === view ? "1" : "0";
    });
    stateSprite.style.opacity = showState ? "1" : "0";

    const t = smooth(p <= 0.5 ? p * 2 : (p - 0.5) * 2);
    const weights = p <= 0.5 ? [1 - t, t, 0] : [0, 1 - t, t];
    lightLayers.forEach(([light, rim], index) => {
      light.style.opacity = String(weights[index]); rim.style.opacity = String(weights[index]);
      light.style.transform = `translate3d(0, ${(-float).toFixed(1)}px, 0) scale(${(1 + p * 0.18).toFixed(3)})`;
    });
    shade.style.opacity = String(reduced ? 0.18 : mix(0.28, 0.06, Math.sin(p * Math.PI)));
    halo.style.transform = `scale(${(0.92 + Math.sin(p * Math.PI) * 0.18).toFixed(3)})`;
    stage.dataset.yaw = yaw.toFixed(2); stage.dataset.pitch = pitch.toFixed(2);
    stage.dataset.scale = scale.toFixed(3); stage.dataset.progress = p.toFixed(5);
    stage.dataset.frameAngle = String(view.angle); stage.dataset.residual = residual.toFixed(3);
    stage.dataset.x = "0"; stage.dataset.float = float.toFixed(2);
    stage.dataset.target = target.toFixed(5); stage.dataset.readyFrames = String(readyViews.length);
    stage.dataset.motion = reduced ? "reduced" : mobile ? "mobile" : "desktop";
    if (!reduced && !document.hidden) requestMochiFrame();
    else previousTime = 0;
  }
  requestMochiFrame = () => { if (!frame) frame = requestAnimationFrame(renderFrame); };
  const onScroll = () => { target = clamp(scrollPosition() / maxScroll); requestMochiFrame(); };
  window.addEventListener("scroll", onScroll, { passive: true });
  content.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", measureScene);
  motionQuery.addEventListener("change", measureScene);
  mobileQuery.addEventListener("change", measureScene);
  document.addEventListener("visibilitychange", () => { previousTime = 0; requestMochiFrame(); });
  const resizeObserver = new ResizeObserver(measureScene);
  resizeObserver.observe(document.body);
  resizeObserver.observe(content);
  document.querySelectorAll(".spatial-station").forEach(station => resizeObserver.observe(station));
  measureScene();
}

function setMochiPoseOverride(assetFilename) {
  appState.mochiOverridePose = assetFilename;
  requestMochiFrame();
  const stateImg = document.getElementById("mochi-layer-state");
  if (stateImg && assetFilename) {
    stateImg.src = `./assets/${assetFilename}`;
  }
  // Automatically release transient pose back to curve state after 4.5s unless still thinking
  if (assetFilename && assetFilename !== "mochi-thinking.png") {
    setTimeout(() => {
      if (appState.mochiOverridePose === assetFilename) {
        appState.mochiOverridePose = null;
        syncMochiWithActiveCurve();
      }
    }, 4500);
  }
}

function syncMochiWithActiveCurve() {
  const c = appState.curves[appState.activeCurveId];
  const stateImg = document.getElementById("mochi-layer-state");
  const halo = document.getElementById("mochi-halo-ring");
  if (!c || !stateImg) return;

  const targetFile = appState.mochiOverridePose || c.mochi_state || "mochi-float.png";
  stateImg.src = `./assets/${targetFile}`;

  requestMochiFrame();
  // Curve state can tint the halo independently of the orientation views.
  if (c.gate_status === "CATALYST_BOOST" || c.gate_status === "GRADUATE_APPROVED") {
    halo.dataset.tone = "cyan";
  } else if (c.gate_status === "RUG_SLASHED") {
    halo.dataset.tone = "purple-alert";
  } else {
    halo.dataset.tone = "default";
  }
}

// ==============================================================================
// 3. RENDERING & INTEGER BONDING CURVE SIMULATOR
// ==============================================================================
function renderCurveSelector() {
  const listEl = document.getElementById("curve-selector-list");
  listEl.innerHTML = "";
  const curves = Object.values(appState.curves);
  if (curves.length === 0) {
    listEl.innerHTML = `<p class="empty-state">${I18N_DICT[appState.lang].curves_empty}</p>`;
    return;
  }
  curves.forEach((curve) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `orbit-curve-card ${curve.curve_id === appState.activeCurveId ? "is-selected" : ""}`;
    btn.setAttribute("role", "option");
    btn.setAttribute("aria-selected", curve.curve_id === appState.activeCurveId ? "true" : "false");
    const pct = Math.min(100, Math.floor((curve.cumulative_buy_volume * 100) / curve.graduation_threshold));
    btn.innerHTML = `
      <div class="orbit-card-top">
        <strong>${escapeHtml(curve.name)} (${escapeHtml(curve.ticker)})</strong>
        <span class="status-pill status-${escapeHtml(curve.gate_status.toLowerCase())}">${escapeHtml(curve.gate_status)}</span>
      </div>
      ${curve.origin === "seed_demo" ? `<p class="seed-demo-badge">Seed demo data — not consensus evidence</p>` : ""}
      <div class="orbit-card-metrics">
        <span>S: ${curve.Supply}</span>
        <span>R: ${fmtGen(curve.curve_reserve)} | Net buys: ${fmtGen(curve.cumulative_buy_volume)} (${pct}%)</span>
        <span>k: ${curve.slope_k}</span>
      </div>
    `;
    btn.addEventListener("click", () => {
      appState.activeCurveId = curve.curve_id;
      setMochiPoseOverride("mochi-point.png", "INSPECTING_CURVE");
      if (appState.audioEnabled) playUiSound("click");
      renderAll();
    });
    listEl.appendChild(btn);
  });
}

function renderActiveCurveTelemetryAndChart() {
  const c = appState.curves[appState.activeCurveId];
  if (!c) {
    document.getElementById("active-curve-ticker").textContent = "—";
    document.getElementById("active-curve-status").textContent = "NO_CURVE";
    document.getElementById("active-curve-name").textContent = I18N_DICT[appState.lang].curves_empty;
    document.getElementById("active-curve-manifesto").textContent = "";
    document.getElementById("meter-reserve-text").textContent = "";
    document.getElementById("meter-reserve-fill").style.transform = "scaleX(0)";
    updateTradeSimulation();
    renderGraduationGateAndWitnesses(null);
    return;
  }

  document.getElementById("active-curve-ticker").textContent = c.ticker;
  document.getElementById("active-curve-status").textContent = c.gate_status;
  document.getElementById("active-curve-name").textContent = c.name;
  document.getElementById("active-curve-manifesto").textContent = c.manifesto_text;

  const pct = Math.min(100, Math.floor((c.cumulative_buy_volume * 100) / c.graduation_threshold));
  document.getElementById("meter-reserve-text").textContent =
    `${fmtGen(c.cumulative_buy_volume)} / ${fmtGen(c.graduation_threshold)} (${pct}%)`;
  document.getElementById("meter-reserve-fill").style.transform = `scaleX(${(pct / 100).toFixed(3)})`;

  const rEff = calcCurveIntegralReserve(c.Supply, c.base_price, c.slope_k, c.virtual_slope_offset);
  const invariantOk = rEff === Number(c.curve_reserve);
  const floorMult = (Number(c.floor_multiplier_bps) / 10000).toFixed(4);

  document.getElementById("metric-val-supply").textContent = String(c.Supply);
  document.getElementById("metric-val-spot").textContent = fmtGen(c.spot_price);
  document.getElementById("metric-val-slope").textContent = `k=${c.slope_k} / off=${c.virtual_slope_offset.toLocaleString()}`;
  document.getElementById("metric-val-floor").textContent = `${fmtGen(c.redemption_floor_pool)} (${floorMult}x)`;
  document.getElementById("metric-val-collateral").textContent =
    fmtGen(Number(c.creator_collateral) + Number(c.fee_escrow_pool));
  document.getElementById("metric-val-invariant").textContent =
    invariantOk ? `VERIFIED (${fmtGen(rEff)})` : `MISMATCH (${fmtGen(rEff)})`;

  // Commit-Reveal status
  document.getElementById("cr-commitment-code").textContent = `${c.secret_catalyst_commitment.slice(0, 22)}...`;
  document.getElementById("cr-revealed-val").textContent =
    c.revealed_secret_catalyst || I18N_DICT[appState.lang].cr_unrevealed;

  // Render SVG curve path (S from 0 to 100)
  const maxS = 100;
  const maxR = calcCurveIntegralReserve(maxS, c.base_price, c.slope_k, c.virtual_slope_offset);
  const pts = [];
  for (let s = 0; s <= maxS; s += 4) {
    const r = calcCurveIntegralReserve(s, c.base_price, c.slope_k, c.virtual_slope_offset);
    const x = (s / maxS) * 460 + 10;
    const y = 195 - (r / Math.max(1, maxR)) * 170;
    pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  }
  document.getElementById("svg-curve-path").setAttribute("d", `M ${pts.join(" L ")}`);
  document.getElementById("svg-curve-area").setAttribute("d", `M 10,195 L ${pts.join(" L ")} L 470,195 Z`);

  const curX = (Math.min(maxS, c.Supply) / maxS) * 460 + 10;
  const curY = 195 - (c.curve_reserve / Math.max(1, maxR)) * 170;
  const dot = document.getElementById("svg-current-dot");
  dot.setAttribute("cx", curX.toFixed(1));
  dot.setAttribute("cy", curY.toFixed(1));
  document.getElementById("chart-cursor-readout").textContent =
    `S=${c.Supply} | R=${fmtGen(c.curve_reserve)}`;

  updateTradeSimulation();
  renderGraduationGateAndWitnesses(c);
  syncMochiWithActiveCurve();
}

function updateTradeSimulation() {
  const c = appState.curves[appState.activeCurveId];
  const delta = Number(document.getElementById("input-trade-amount").value || 1);
  document.getElementById("trade-amount-display").textContent = `${delta} Tokens`;
  const withdrawableEl = document.getElementById("user-withdrawable");
  const withdrawBtn = document.getElementById("btn-withdraw");
  const userBal = appState.balances[appState.activeTraderAddress] ?? 0;
  if (withdrawableEl) withdrawableEl.textContent = fmtGen(userBal);
  if (withdrawBtn) withdrawBtn.disabled = userBal <= 0;
  const walletEl = document.getElementById("user-wallet-gen");
  if (walletEl) {
    walletEl.textContent = appState.walletGenWei == null ? "—" : `${(Number(appState.walletGenWei) / 1e18).toFixed(3)} GEN`;
  }
  if (!c) {
    document.getElementById("sim-buy-val").textContent = "—";
    document.getElementById("sim-sell-val").textContent = "—";
    document.getElementById("user-token-position").textContent = "0 Tokens";
    document.getElementById("btn-buy-tokens").disabled = true;
    document.getElementById("btn-sell-tokens").disabled = true;
    return;
  }

  const s0 = Number(c.Supply);
  const b = Number(c.base_price);
  const k = Number(c.slope_k);
  const vOff = Number(c.virtual_slope_offset);
  const r0 = calcCurveIntegralReserve(s0, b, k, vOff);

  // Buy simulation (units; the real call attaches the same amount in GEN)
  const rBuy = calcCurveIntegralReserve(s0 + delta, b, k, vOff);
  const buyDeltaR = rBuy - r0;
  const buyFee = Math.floor((buyDeltaR * APP_CONFIG.TRADE_FEE_BPS) / APP_CONFIG.BPS_SCALE);
  const totalBuyCost = buyDeltaR + buyFee;
  document.getElementById("sim-buy-val").textContent = fmtGen(totalBuyCost);

  // Sell simulation
  const sellAmt = Math.min(delta, s0);
  const rSell = calcCurveIntegralReserve(s0 - sellAmt, b, k, vOff);
  const sellRefund = r0 - rSell;
  const floorBonus = s0 > 0 ? Math.floor((Number(c.redemption_floor_pool) * sellAmt) / s0) : 0;
  const totalSellPayout = sellRefund + floorBonus;
  document.getElementById("sim-sell-val").textContent =
    `${fmtGen(totalSellPayout)} (Floor Bonus: +${fmtGen(floorBonus)})`;

  const held = c.positions[appState.activeTraderAddress] ?? 0;
  document.getElementById("user-token-position").textContent = `${held} Tokens`;

  const buyBtn = document.getElementById("btn-buy-tokens");
  buyBtn.disabled = c.gate_status === "RUG_SLASHED";
  document.getElementById("btn-sell-tokens").disabled = held < delta;
}

function renderGraduationGateAndWitnesses(c) {
  const auditBody = document.getElementById("audit-verdict-body");
  const pendingBox = document.getElementById("pending-verdict-box");
  const execBtn = document.getElementById("btn-execute-verdict");
  const challengeBtn = document.getElementById("btn-challenge-verdict");
  if (!c) {
    if (auditBody) auditBody.innerHTML = `<p class="empty-state">${I18N_DICT[appState.lang].audit_empty}</p>`;
    if (pendingBox) pendingBox.hidden = true;
    const witList = document.getElementById("witness-list-container");
    if (witList) witList.innerHTML = `<p class="empty-state">${I18N_DICT[appState.lang].wit_empty}</p>`;
    return;
  }
  const pUrl = c.evaluation_primary_url || `https://raw.githubusercontent.com/${c.expected_repo_slug}/main/release_manifest.json`;
  const bUrl = c.evaluation_backup_url || `https://cdn.jsdelivr.net/gh/${c.expected_repo_slug}@main/release_manifest.json`;
  if (document.getElementById("input-primary-url").dataset.curve !== c.curve_id) {
    document.getElementById("input-primary-url").value = pUrl;
    document.getElementById("input-backup-url").value = bUrl;
    document.getElementById("input-primary-url").dataset.curve = c.curve_id;
  }

  const evaluateBtn = document.getElementById("btn-evaluate-gate");
  const initialAllowed = appState.activeTraderAddress.toLowerCase() === c.creator.toLowerCase()
    && c.cumulative_buy_volume >= c.graduation_threshold
    && !["RUG_SLASHED", "GRADUATE_APPROVED", "CATALYST_BOOST"].includes(c.gate_status);
  if (evaluateBtn) { evaluateBtn.disabled = !initialAllowed; evaluateBtn.textContent = I18N_DICT[appState.lang].btn_trigger_gate; }
  for (const id of ["input-primary-url", "input-backup-url"]) {
    document.getElementById(id).readOnly = Boolean(c.pending_verdict);
  }

  // Pending verdict (step 1 of 2): shown with Execute / Challenge actions.
  if (c.pending_verdict) {
    const p = c.pending_verdict;
    const challenges = c.pending_challenges || [];
    const expired = Date.now() >= Number(c.verdict_deadline) * 1000;
    pendingBox.hidden = false;
    document.getElementById("pending-verdict-text").innerHTML =
      `<strong>${escapeHtml(p.verdict)}</strong> — ${I18N_DICT[appState.lang].pending_note} ` +
      `Tag ${escapeHtml(p.tag_name)} / SHA ${escapeHtml((p.commit_sha || "").slice(0, 10))}… / ` +
      `API commits ${escapeHtml(p.api_commit_count)} / code files ${escapeHtml(p.code_file_count)} (${escapeHtml(p.code_bytes)} bytes) / ` +
      `Scores ${escapeHtml(p.completeness_score)}/${escapeHtml(p.authenticity_score)}/${escapeHtml(p.overdelivery_bonus)}` +
      `<br/>Deadline (UTC): ${escapeHtml(c.verdict_deadline ? new Date(c.verdict_deadline * 1000).toISOString() : "legacy v2")}` +
      (challenges.length ? `<br/>${I18N_DICT[appState.lang].pending_challenges}: ${challenges.length} — ${c.review_used ? I18N_DICT[appState.lang].review_completed : I18N_DICT[appState.lang].pending_blocked}` : "");
    const isCreator = appState.activeTraderAddress.toLowerCase() === c.creator.toLowerCase();
    if (evaluateBtn) {
      evaluateBtn.disabled = expired || !challenges.length || Boolean(c.review_used);
      evaluateBtn.textContent = I18N_DICT[appState.lang].btn_review_verdict;
      document.getElementById("input-primary-url").value = pUrl;
      document.getElementById("input-backup-url").value = bUrl;
    }
    if (execBtn) execBtn.disabled = !expired;
    if (challengeBtn) challengeBtn.disabled = isCreator || expired || c.challenge_used;
  } else if (pendingBox) {
    pendingBox.hidden = true;
  }

  if (!c.last_audit) {
    auditBody.innerHTML = `<p class="empty-state">${I18N_DICT[appState.lang].audit_empty}</p>`;
  } else {
    const a = c.last_audit;
    auditBody.innerHTML = `
      <div class="verdict-banner verdict-${escapeHtml(a.verdict.toLowerCase())}">
        <strong>${escapeHtml(a.verdict)}</strong>
        <span>Source: ${escapeHtml((a.source_used || "").toUpperCase())}</span>
      </div>
      <div class="audit-detail-grid">
        <div><span>Tag / API Commits / Code Files:</span> <strong>${escapeHtml(a.tag_name || "v1.0")} / ${escapeHtml(a.api_commit_count || a.commit_count || "0")} / ${escapeHtml(a.code_file_count || "0")}</strong></div>
        <div><span>Anchors (SHA / Count / Code):</span> <strong>${escapeHtml(a.sha_match || "?")} / ${escapeHtml(a.count_ok || "?")} / ${escapeHtml(a.code_ok || "?")}</strong></div>
        <div><span>Scores (Comp/Auth/Bonus):</span> <strong>${escapeHtml(a.completeness_score)} / ${escapeHtml(a.authenticity_score)} / ${escapeHtml(a.overdelivery_bonus)}</strong></div>
        <div><span>Slashed to Floor:</span> <strong>${fmtGen(Number(a.slashed_amount || 0))}</strong></div>
        <div><span>New Slope k:</span> <strong>${Number(a.new_slope_k)}</strong></div>
        <div class="full-span"><span>Canonical Evidence SHA-256:</span> <code>${escapeHtml(a.evidence_hash)}</code></div>
      </div>
    `;
  }

  const witList = document.getElementById("witness-list-container");
  if (!c.contradiction_witnesses || c.contradiction_witnesses.length === 0) {
    witList.innerHTML = `<p class="empty-state">${I18N_DICT[appState.lang].wit_empty}</p>`;
  } else {
    witList.innerHTML = c.contradiction_witnesses
      .map(
        (w) => `
        <div class="witness-item">
          <div class="wit-head">
            <strong>${escapeHtml(w.witness_id)}</strong>
            <span>Active: ${escapeHtml(w.active_finalized_verdict)} vs. Claim: ${escapeHtml(w.claimed_verdict)}</span>
          </div>
          <p>${escapeHtml(w.contradiction_cycle)}</p>
          <code>SHA-256: ${escapeHtml(w.witness_hash)}</code>
        </div>
      `
      )
      .join("");
  }
}

function updateTrustSurface(statusText, txHash, feedbackMessage) {
  document.getElementById("trust-tx-status").textContent = statusText;
  document.getElementById("trust-timestamp").textContent = new Date().toISOString();
  const linkEl = document.getElementById("trust-tx-link");
  if (txHash) {
    linkEl.href = `${APP_CONFIG.EXPLORER_URL}/tx/${txHash}`;
    linkEl.textContent = txHash;
  } else {
    linkEl.href = APP_CONFIG.EXPLORER_URL;
    linkEl.textContent = APP_CONFIG.EXPLORER_URL;
  }
  if (feedbackMessage) {
    document.getElementById("trust-feedback-banner").textContent = feedbackMessage;
  }
}

function renderAll() {
  const isLive = Boolean(APP_CONFIG.CONTRACT_ADDRESS);
  document.getElementById("select-mock-scenario")?.closest(".rehearsal-preset-row")?.toggleAttribute("hidden", isLive);
  document.getElementById("hud-chain-mode").textContent = isLive
    ? "LIVE_STUDIONET_61999"
    : "LOCAL_REHEARSAL_SEED";
  document.getElementById("trust-contract-addr").textContent = isLive
    ? APP_CONFIG.CONTRACT_ADDRESS
    : I18N_DICT[appState.lang].unconfigured_contract_note;

  const current = appState.curves[appState.activeCurveId];
  document.getElementById("seed-demo-notice").textContent = current?.origin === "seed_demo" ? "Seed demo data — not consensus evidence" : "";
  renderCurveSelector();
  renderActiveCurveTelemetryAndChart();
}

// ==============================================================================
// 4. EVENT HANDLERS & INITIALIZATION
// ==============================================================================
function bindInteractions() {
  // First-click audio auto-enable rule (never autoplays on load; respects manual off)
  document.addEventListener("click", () => {
    if (!appState.firstInteractionDone) {
      appState.firstInteractionDone = true;
      if (!appState.audioManuallyDisabled) {
        appState.audioEnabled = true;
        syncAudioButton();
      }
    }
  });

  document.getElementById("btn-audio-toggle").addEventListener("click", (e) => {
    e.stopPropagation();
    appState.firstInteractionDone = true;
    appState.audioEnabled = !appState.audioEnabled;
    appState.audioManuallyDisabled = !appState.audioEnabled;
    syncAudioButton();
    if (appState.audioEnabled) playUiSound("click");
  });

  document.getElementById("btn-lang-toggle").addEventListener("click", () => {
    appState.lang = appState.lang === "en" ? "zh" : "en";
    document.documentElement.lang = appState.lang;
    document.documentElement.dataset.lang = appState.lang;
    applyTranslations(appState.lang);
    syncAudioButton();
    renderAll();
  });

  document.getElementById("input-trade-amount").addEventListener("input", updateTradeSimulation);

  document.getElementById("btn-enable-test-account").addEventListener("click", async () => {
    appState.ephemeralSigner = getOrCreateEphemeralTestAccount();
    appState.activeTraderAddress = appState.ephemeralSigner.address;
    document.getElementById("ephemeral-Account-badge").textContent = appState.ephemeralSigner.label;
    await refreshCurvesFromChainIfConfigured().catch(() => false);
    renderAll();
  });

  document.getElementById("btn-connect-wallet").addEventListener("click", async () => {
    try {
      const info = await connectInjectedEvmWallet();
      appState.connectedWallet = info;
      if (!appState.ephemeralSigner) appState.activeTraderAddress = info.address.toLowerCase();
      await refreshCurvesFromChainIfConfigured();
      renderAll();
      document.getElementById("connected-wallet-addr").textContent =
        `${info.providerName}: ${info.address.slice(0, 6)}...${info.address.slice(-4)} (Chain ${info.chainId})`;
      updateTrustSurface("WALLET_READ_CONNECTED", "", `Connected ${info.providerName} for state reading.`);
    } catch (err) {
      updateTrustSurface("WALLET_CONNECT_INFO", "", appState.lang === "zh" ? "未检测到可用的注入式钱包，或连接请求未完成。可在 OKX 钱包浏览器中打开，或启用临时测试账号继续体验。" : "No injected wallet is available or the connection request was interrupted. Open in an EVM wallet browser, or enable the temporary test account.");
    }
  });

  document.getElementById("btn-buy-tokens").addEventListener("click", () => {
    const c = appState.curves[appState.activeCurveId];
    if (!c) return;
    const amt = Number(document.getElementById("input-trade-amount").value || 1);
    const s0 = Number(c.Supply);
    const r0 = calcCurveIntegralReserve(s0, c.base_price, c.slope_k, c.virtual_slope_offset);
    const r1 = calcCurveIntegralReserve(s0 + amt, c.base_price, c.slope_k, c.virtual_slope_offset);
    const deltaR = r1 - r0;
    const fee = Math.floor((deltaR * APP_CONFIG.TRADE_FEE_BPS) / APP_CONFIG.BPS_SCALE);
    const costUnits = deltaR + fee;
    submitStudionetWriteOrRehearsal("buy_tokens", [c.curve_id, amt, appState.activeTraderAddress], async () => {
      if (c.gate_status === "RUG_SLASHED") throw new Error("CURVE_SLASHED_BUY_DISABLED");
      const s1 = s0 + amt;
      c.Supply = s1;
      c.curve_reserve = r1;
      c.cumulative_buy_volume += deltaR;
      c.fee_escrow_pool += fee;
      c.spot_price = calcSpotPrice(s1, c.base_price, c.slope_k);
      c.positions[appState.activeTraderAddress] = (c.positions[appState.activeTraderAddress] || 0) + amt;
      if (c.gate_status === "TRADING_OPEN" && c.cumulative_buy_volume >= c.graduation_threshold) {
        c.gate_status = "GATE_UNLOCKED";
        c.mochi_state = "mochi-point.png";
      }
      return "mochi-celebrate-expr.png";
    }, unitsToWei(costUnits));
  });

  document.getElementById("btn-sell-tokens").addEventListener("click", () => {
    const c = appState.curves[appState.activeCurveId];
    if (!c) return;
    const amt = Number(document.getElementById("input-trade-amount").value || 1);
    submitStudionetWriteOrRehearsal("sell_tokens", [c.curve_id, amt, appState.activeTraderAddress], async () => {
      const held = c.positions[appState.activeTraderAddress] || 0;
      if (held < amt) throw new Error("INSUFFICIENT_TOKEN_POSITION");
      const s0 = Number(c.Supply);
      const s1 = s0 - amt;
      const r0 = calcCurveIntegralReserve(s0, c.base_price, c.slope_k, c.virtual_slope_offset);
      const r1 = calcCurveIntegralReserve(s1, c.base_price, c.slope_k, c.virtual_slope_offset);
      const refund = r0 - r1;
      const bonus = s0 > 0 ? Math.floor((c.redemption_floor_pool * amt) / s0) : 0;
      c.Supply = s1;
      c.curve_reserve = r1;
      c.redemption_floor_pool -= bonus;
      c.spot_price = calcSpotPrice(s1, c.base_price, c.slope_k);
      c.positions[appState.activeTraderAddress] = held - amt;
      if (c.positions[appState.activeTraderAddress] === 0) delete c.positions[appState.activeTraderAddress];
      // v2: sell proceeds become a withdrawable credit; pull them with Withdraw.
      appState.balances[appState.activeTraderAddress] =
        (appState.balances[appState.activeTraderAddress] || 0) + refund + bonus;
      c.floor_multiplier_bps = 10000 + Math.floor((c.redemption_floor_pool * 10000) / Math.max(1, r1));
      return "mochi-celebrate-expr.png";
    });
  });

  document.getElementById("btn-withdraw").addEventListener("click", () => {
    submitStudionetWriteOrRehearsal("withdraw", [], async () => {
      const owed = appState.balances[appState.activeTraderAddress] || 0;
      if (owed <= 0) throw new Error("NO_WITHDRAWABLE_BALANCE");
      appState.balances[appState.activeTraderAddress] = 0;
      return "mochi-celebrate-jump.png";
    });
  });

  document.getElementById("btn-reveal-catalyst").addEventListener("click", () => {
    const c = appState.curves[appState.activeCurveId];
    if (!c) return;
    const salt = document.getElementById("input-reveal-salt").value.trim();
    const secret = document.getElementById("input-reveal-secret").value.trim();
    submitStudionetWriteOrRehearsal("reveal_secret_catalyst", [c.curve_id, salt, secret, appState.activeTraderAddress], async () => {
      const digest = await sha256HexBrowser(`${salt}|${secret}`);
      if (digest !== c.secret_catalyst_commitment) {
        throw new Error("COMMITMENT_MISMATCH_BEFORE_WRITE");
      }
      c.revealed_secret_catalyst = secret;
      return "mochi-celebrate-jump.png";
    });
  });

  // v2 two-step graduation: evaluate writes a PENDING verdict; execute applies it.
  async function applyPendingVerdictRehearsal(c, pUrl, bUrl) {
    const p = c.pending_verdict;
    if (!p) throw new Error("NO_PENDING_VERDICT");
    if (Date.now() < Number(c.verdict_deadline) * 1000) throw new Error("VERDICT_WINDOW_OPEN");
    if (p.verdict === "RUG_SLASHED") {
      const slashed = Number(c.creator_collateral) + Number(c.fee_escrow_pool);
      c.creator_collateral = 0;
      c.fee_escrow_pool = 0;
      c.redemption_floor_pool += slashed;
      c.gate_status = "RUG_SLASHED";
      c.mochi_state = "mochi-point.png";
      c.last_audit = { ...p, challenges: c.pending_challenges.map(ch => ({...ch, resolution: ch.resolution || "EXPIRED"})), slashed_amount: String(slashed), boost_subsidy_added: "0", new_slope_k: String(c.slope_k) };
      c.pending_verdict = null;
      c.pending_challenges = [];
      c.floor_multiplier_bps = 10000 + Math.floor((c.redemption_floor_pool * 10000) / Math.max(1, c.curve_reserve));
      return "mochi-point.png";
    }
    const creatorReward = Number(c.creator_collateral) + Number(c.fee_escrow_pool);
    c.creator_collateral = 0;
    c.fee_escrow_pool = 0;
    appState.balances[c.creator] = (Number(appState.balances[c.creator]) || 0) + creatorReward;
    if (p.verdict === "CATALYST_BOOST") {
      const kNew = Math.floor((c.slope_k * 125) / 100);
      const rawNew = c.base_price * c.Supply + Math.floor((kNew * c.Supply * c.Supply) / 2);
      c.virtual_slope_offset = rawNew - c.curve_reserve;
      c.slope_k = kNew;
      c.spot_price = calcSpotPrice(c.Supply, c.base_price, kNew);
      c.gate_status = "CATALYST_BOOST";
      c.mochi_state = "mochi-celebrate-jump.png";
      c.last_audit = { ...p, challenges: c.pending_challenges.map(ch => ({...ch, resolution: ch.resolution || "EXPIRED"})), slashed_amount: "0", boost_subsidy_added: "0", new_slope_k: String(kNew) };
      c.pending_verdict = null;
      c.pending_challenges = [];
      c.floor_multiplier_bps = 10000 + Math.floor((c.redemption_floor_pool * 10000) / Math.max(1, c.curve_reserve));
      return "mochi-celebrate-jump.png";
    }
    c.gate_status = "GRADUATE_APPROVED";
    c.mochi_state = "mochi-celebrate-expr.png";
    c.last_audit = { ...p, challenges: c.pending_challenges.map(ch => ({...ch, resolution: ch.resolution || "EXPIRED"})), slashed_amount: "0", boost_subsidy_added: "0", new_slope_k: String(c.slope_k) };
    c.pending_verdict = null;
    c.pending_challenges = [];
    c.floor_multiplier_bps = 10000 + Math.floor((c.redemption_floor_pool * 10000) / Math.max(1, c.curve_reserve));
    return "mochi-celebrate-expr.png";
  }

  document.getElementById("btn-evaluate-gate").addEventListener("click", () => {
    const c = appState.curves[appState.activeCurveId];
    if (!c) return;
    const pUrl = document.getElementById("input-primary-url").value;
    const bUrl = document.getElementById("input-backup-url").value;
    const scenario = document.getElementById("select-mock-scenario")?.value ?? "PRIMARY_BOOST";

    submitStudionetWriteOrRehearsal("evaluate_graduation_gate", [c.curve_id, pUrl, bUrl, appState.activeTraderAddress], async () => {
      if (["GRADUATE_APPROVED", "CATALYST_BOOST", "RUG_SLASHED"].includes(c.gate_status)) {
        throw new Error("FINALIZED_VERDICT_IMMUTABLE");
      }
      const reviewing = Boolean(c.pending_verdict);
      if (reviewing) {
        if (Date.now() >= c.verdict_deadline * 1000) throw new Error("VERDICT_WINDOW_CLOSED");
        if (!(c.pending_challenges || []).length || c.review_used) throw new Error("NO_REVIEW_AVAILABLE");
        if (pUrl !== c.evaluation_primary_url || bUrl !== c.evaluation_backup_url) throw new Error("REVIEW_EVIDENCE_PATH_CHANGED");
      } else if (appState.activeTraderAddress !== c.creator) throw new Error("EVALUATOR_NOT_CREATOR");
      if (c.cumulative_buy_volume < c.graduation_threshold) {
        throw new Error("GRADUATION_THRESHOLD_NOT_REACHED: cumulative net buys < 100000");
      }
      if (scenario === "BOTH_FAIL") {
        throw new Error("EXTERNAL_FETCH_FAILED_BOTH_SOURCES_PENDING_RETRY");
      }
      const base = {
        status: "OK", source_used: "primary", primary_url: pUrl, backup_url: bUrl,
        tag_name: "v1.0.0", commit_sha: "c6430a1a8d380cf4384e7c516b45ec28b50bd410",
        tag_exists: "true", api_commit_count: "3", manifest_commit_count: "3",
        code_file_count: "12", code_bytes: "806935", sha_match: "true", count_ok: "true", code_ok: "true",
      };
      if (scenario === "BACKUP_SLASH") {
        const evHash = await sha256HexBrowser(`${c.expected_repo_slug}|none|1|false|placeholder readme`);
        c.pending_verdict = { ...base, verdict: "RUG_SLASHED", source_used: "backup", tag_name: "none",
          commit_sha: "", tag_exists: "false", api_commit_count: "0", manifest_commit_count: "1",
          code_file_count: "0", code_bytes: "0", sha_match: "false", count_ok: "false", code_ok: "false",
          evidence_hash: evHash, completeness_score: "20", authenticity_score: "20", overdelivery_bonus: "0" };
      } else if (scenario === "GRADUATE_APPROVED") {
        const evHash = await sha256HexBrowser(`${c.expected_repo_slug}|v1.0.0|3|12|806935|tree`);
        c.pending_verdict = { ...base, verdict: "GRADUATE_APPROVED",
          evidence_hash: evHash, completeness_score: "70", authenticity_score: "70", overdelivery_bonus: "50" };
      } else {
        const evHash = await sha256HexBrowser(`${c.expected_repo_slug}|v1.2.0|3|12|806935|tree`);
        c.pending_verdict = { ...base, verdict: "CATALYST_BOOST", tag_name: "v1.2.0",
          evidence_hash: evHash, completeness_score: "95", authenticity_score: "90", overdelivery_bonus: "90" };
      }
      if (reviewing) {
        c.review_used = true;
        for (const ch of c.pending_challenges) { ch.resolution = "REVIEWED"; ch.resolved_verdict = c.pending_verdict.verdict; }
      } else {
        c.verdict_deadline = Math.floor(Date.now() / 1000) + 86400;
        c.evaluation_primary_url = pUrl;
        c.evaluation_backup_url = bUrl;
      }
      c.gate_status = "VERDICT_PENDING";
      return "mochi-thinking.png";
    });
  });

  document.getElementById("btn-execute-verdict").addEventListener("click", () => {
    const c = appState.curves[appState.activeCurveId];
    if (!c) return;
    const pUrl = document.getElementById("input-primary-url").value;
    const bUrl = document.getElementById("input-backup-url").value;
    submitStudionetWriteOrRehearsal("execute_verdict", [c.curve_id, appState.activeTraderAddress], async () => {
      return applyPendingVerdictRehearsal(c, pUrl, bUrl);
    });
  });

  document.getElementById("btn-challenge-verdict").addEventListener("click", () => {
    const c = appState.curves[appState.activeCurveId];
    if (!c) return;
    const reason = document.getElementById("input-challenge-reason").value.trim() || "Pending verdict disputed; re-check before execution.";
    const claimed = document.getElementById("input-challenge-verdict").value;
    submitStudionetWriteOrRehearsal("challenge_pending_verdict", [c.curve_id, appState.activeTraderAddress, claimed, reason], async () => {
      if (!c.pending_verdict) throw new Error("NO_PENDING_VERDICT");
      if (appState.activeTraderAddress === c.creator) throw new Error("CREATOR_CANNOT_CHALLENGE_OWN_VERDICT");
      if (Date.now() >= c.verdict_deadline * 1000) throw new Error("VERDICT_WINDOW_CLOSED");
      if (c.challenge_used) throw new Error("CHALLENGE_LIMIT_REACHED");
      if (!["RUG_SLASHED", "GRADUATE_APPROVED", "CATALYST_BOOST"].includes(claimed)) throw new Error("INVALID_CLAIM_VERDICT");
      if (reason.length > 2000) throw new Error("REASON_TOO_LONG");
      if (claimed === c.pending_verdict.verdict) throw new Error("CLAIM_NOT_CONTRADICTORY");
      c.pending_challenges = c.pending_challenges || [];
      c.challenge_used = true;
      c.pending_challenges.push({
        challenge_id: `chg-${c.curve_id}-${c.pending_challenges.length + 1}`,
        challenger: appState.activeTraderAddress, claimed_verdict: claimed,
        pending_verdict: c.pending_verdict.verdict, reason,
      });
      return "mochi-point.png";
    });
  });

  document.getElementById("btn-record-witness").addEventListener("click", () => {
    const c = appState.curves[appState.activeCurveId];
    const claimedVerdict = document.getElementById("input-witness-verdict").value;
    const claimedTag = document.getElementById("input-witness-tag").value.trim() || "none";
    submitStudionetWriteOrRehearsal(
      "record_contradiction_claim",
      [c.curve_id, appState.activeTraderAddress, claimedVerdict, claimedTag],
      async () => {
        if (!c.last_audit) throw new Error("NO_FINALIZED_AUDIT_TO_CHALLENGE");
        if (c.last_audit.verdict === claimedVerdict) throw new Error("CLAIM_NOT_CONTRADICTORY");
        const wid = `wit-${c.curve_id}-${c.contradiction_witnesses.length + 1}`;
        const wHash = await sha256HexBrowser(`${wid}|${c.last_audit.verdict}|${claimedVerdict}|${claimedTag}`);
        c.contradiction_witnesses.push({
          witness_id: wid,
          challenger: appState.activeTraderAddress,
          claimed_verdict: claimedVerdict,
          claimed_tag: claimedTag,
          active_finalized_verdict: c.last_audit.verdict,
          contradiction_cycle: `Finalized verdict ${c.last_audit.verdict} conflicts with post-audit claim ${claimedVerdict} (tag=${claimedTag}); finalized state preserved.`,
          witness_hash: wHash
        });
        return "mochi-point.png";
      }
    );
  });

  document.getElementById("btn-generate-commitment").addEventListener("click", () => {
    const bytes = crypto.getRandomValues(new Uint8Array(48));
    const hex = Array.from(bytes, x => x.toString(16).padStart(2,"0")).join("");
    document.getElementById("launch-secret-raw").value = hex.slice(0,64) + "|" + hex.slice(64);
  });

  document.getElementById("btn-launch-curve").addEventListener("click", async () => {
    const cid = document.getElementById("launch-id").value.trim() || `curve-${Date.now()}`;
    const name = document.getElementById("launch-name").value.trim() || "Mochi Custom";
    const ticker = document.getElementById("launch-ticker").value.trim() || "$MCUST";
    const repo = document.getElementById("launch-repo").value.trim() || "genlayer-craft/mochi-custom";
    const manifesto =
      document.getElementById("launch-manifesto").value.trim() ||
      "Deliver v1.0 release with >=4 verified commits and bonding curve integration.";
    const rawSecret = document.getElementById("launch-secret-raw").value.trim();

    if (!rawSecret.includes("|")) { updateTrustSurface("COMMITMENT_REQUIRED", "", "Generate a private salt and catalyst or enter salt|secret. Keep a personal copy for reveal."); return; }
    // Hash only is submitted during launch.
    const cHash = (await sha256HexBrowser(rawSecret)).trim().toLowerCase();

    // v2: the 25 GEN creator collateral is paid with the launch transaction.
    submitStudionetWriteOrRehearsal(
      "launch_curve",
      [cid, name, ticker, appState.activeTraderAddress, repo, manifesto, cHash],
      async () => {
        if (appState.curves[cid]) throw new Error("CURVE_ALREADY_EXISTS");
        const bal = appState.balances[appState.activeTraderAddress] ?? 300000;
        if (bal < APP_CONFIG.DEFAULT_CREATOR_COLLATERAL) throw new Error("INSUFFICIENT_CREATOR_COLLATERAL");
        appState.balances[appState.activeTraderAddress] = bal - APP_CONFIG.DEFAULT_CREATOR_COLLATERAL;
        const normManifesto = manifesto.trim().toLowerCase().split(/\s+/).join(" ");
        const mHash = await sha256HexBrowser(normManifesto);
        appState.curves[cid] = {
          curve_id: cid,
          name,
          ticker,
          creator: appState.activeTraderAddress,
          expected_repo_slug: repo.toLowerCase(),
          manifesto_text: manifesto,
          manifesto_hash: mHash,
          secret_catalyst_commitment: cHash,
          revealed_secret_catalyst: "",
          Supply: 0,
          base_price: APP_CONFIG.DEFAULT_BASE_PRICE,
          slope_k: APP_CONFIG.DEFAULT_SLOPE_K,
          virtual_slope_offset: 0,
          curve_reserve: 0,
          cumulative_buy_volume: 0,
          origin: "local_rehearsal",
          graduation_threshold: APP_CONFIG.GRADUATION_BUY_VOLUME_THRESHOLD,
          creator_collateral: APP_CONFIG.DEFAULT_CREATOR_COLLATERAL,
          fee_escrow_pool: 0,
          redemption_floor_pool: 0,
          floor_multiplier_bps: 10000,
          spot_price: APP_CONFIG.DEFAULT_BASE_PRICE,
          gate_status: "TRADING_OPEN",
          mochi_state: "mochi-float.png",
          positions: {},
          last_audit: null,
          pending_verdict: null,
          pending_challenges: [],
          contradiction_witnesses: []
        };
        appState.activeCurveId = cid;
        return "mochi-celebrate-jump.png";
      },
      unitsToWei(APP_CONFIG.DEFAULT_CREATOR_COLLATERAL)
    );
  });
}

function syncAudioButton() {
  const btn = document.getElementById("btn-audio-toggle");
  const t = I18N_DICT[appState.lang];
  btn.setAttribute("aria-pressed", appState.audioEnabled ? "true" : "false");
  btn.textContent = appState.audioEnabled ? t.btn_audio_on : t.btn_audio_off;
}

window.addEventListener("DOMContentLoaded", async () => {
  injectMochiStyles();
  verifyI18nParity();
  document.getElementById("ephemeral-Account-badge").textContent = "Not enabled";
  applyTranslations(appState.lang);
  bindInteractions();
  setupContinuousScrollScrub();
  try { await refreshCurvesFromChainIfConfigured(); }
  catch { updateTrustSurface("READ_FAILED", "", "Finalized state could not be read. Displayed seed data is illustrative only."); }
  renderAll();
  const saved = JSON.parse(localStorage.getItem(pendingKey) || "null");
  if (saved && saved.contract === APP_CONFIG.CONTRACT_ADDRESS && saved.chainId === 61999) pollExistingTransaction(saved);
  setInterval(async () => { if (APP_CONFIG.CONTRACT_ADDRESS && !writeInFlight) {
    try { await refreshCurvesFromChainIfConfigured(); renderAll(); } catch {}
  } else if (!APP_CONFIG.CONTRACT_ADDRESS) {
    renderGraduationGateAndWitnesses(appState.curves[appState.activeCurveId]);
  } }, 15000);
});