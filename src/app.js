// src/app.js
// Spatial Scroll-Scrubbed MOCHI Controller, Bonding Curve Integer Simulator & Studionet Lifecycle Engine

import {
  APP_CONFIG,
  INITIAL_SEED_STATE,
  calcCurveIntegralReserve,
  calcSpotPrice,
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
  scrollDeg: 0,
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
  if (!appState.curves[appState.activeCurveId]) appState.activeCurveId = Object.keys(appState.curves)[0];
  if (appState.activeTraderAddress) {
    const balance = await publicClient.readContract({ address: APP_CONFIG.CONTRACT_ADDRESS,
      functionName: "get_user_balance", args: [appState.activeTraderAddress], transactionHashVariant: "latest-final" });
    appState.balances[appState.activeTraderAddress] = Number(balance);
  }
  document.getElementById("trust-timestamp").textContent = new Date().toISOString();
  return true;
}

function transactionSucceeded(tx) {
  const raw = tx.consensus_data?.leader_receipt;
  const leaders = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return leaders.length > 0 && leaders.every(r => r.execution_result === "SUCCESS");
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

async function submitStudionetWriteOrRehearsal(methodName, args, rehearsalCallback) {
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
    const actorSlots = { launch_curve: 3, buy_tokens: 2, sell_tokens: 2, record_contradiction_claim: 1 };
    if (Object.hasOwn(actorSlots, methodName)) args[actorSlots[methodName]] = appState.ephemeralSigner.address;
    appState.activeTraderAddress = appState.ephemeralSigner.address;
    updateTrustSurface("SUBMITTING", "", `Temporary test account ${appState.ephemeralSigner.address} is signing ${methodName}.`);
    const signer = getTestSigningClient(signedHash => {
      if (activeTransaction && activeTransaction.hash !== signedHash) throw new Error("Unresolved broadcast must be inspected first.");
      activeTransaction = { hash: signedHash, methodName, contract: APP_CONFIG.CONTRACT_ADDRESS, chainId: 61999 };
      localStorage.setItem(pendingKey, JSON.stringify(activeTransaction));
      updateTrustSurface("BROADCASTING", signedHash, "A signed request is being sent. Its public hash has been retained for recovery.");
    });
    const hash = await signer.writeContract({ address: APP_CONFIG.CONTRACT_ADDRESS,
      functionName: methodName, args, value: 0n, consensusMaxRotations: 3 });
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
  const sprites = ["front", "side", "back", "state"].map(view =>
    document.getElementById(`mochi-layer-${view}`));
  const halo = document.getElementById("mochi-halo-ring");
  const degLabel = document.getElementById("hud-orbit-deg");
  const caption = document.getElementById("mochi-caption-pill");
  const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  const mobileQuery = window.matchMedia("(max-width: 860px)");
  const turntable = document.createElement("div");
  turntable.className = "mochi-turntable";
  rig.insertBefore(turntable, sprites[0]);
  sprites.forEach(sprite => turntable.appendChild(sprite));

  // Layered palette lights blend by opacity; no per-frame color or filter paints.
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
  let width = innerWidth, height = innerHeight, maxScroll = 1, passes = [];

  function measureScene() {
    width = innerWidth; height = innerHeight;
    maxScroll = Math.max(1, document.documentElement.scrollHeight - height);
    passes = [...document.querySelectorAll(".station-02 .station-title, .station-03 .station-title")]
      .map(title => {
        const rect = title.getBoundingClientRect();
        return { progress: (rect.top + scrollY + rect.height / 2 - height / 2) / maxScroll,
          x: rect.left + rect.width / 2 - width / 2 };
      });
    target = clamp(scrollY / maxScroll);
    requestMochiFrame();
  }

  function renderFrame(time) {
    frame = 0;
    const reduced = motionQuery.matches, mobile = mobileQuery.matches;
    appState.reducedMotion = reduced;
    const dt = previousTime ? Math.min(32, time - previousTime) : 16.67;
    previousTime = time;
    // Frame-rate independent 110ms camera response, with no scroll interception.
    current = reduced ? 0 : current + (target - current) * (1 - Math.exp(-dt / 110));
    if (Math.abs(target - current) < 0.00002) current = target;
    const p = reduced ? 0 : current;
    const yaw = mobile || reduced ? 0 : p * 180;
    const pitch = mobile || reduced ? 0 : p <= 0.5
      ? mix(0, -12, smooth(p * 2)) : mix(-12, 8, smooth((p - 0.5) * 2));
    const scale = reduced ? 1 : mobile ? 0.88 : p <= 0.5
      ? mix(0.85, 1.5, smooth(p * 2)) : mix(1.5, 1.15, smooth((p - 0.5) * 2));
    let x = mobile || reduced ? 0 : mix(width * 0.27, -width * 0.27, smooth(p));
    const y = mobile || reduced ? 0 : Math.sin(p * Math.PI * 2) * height * 0.055;
    let foreground = 0;
    if (!mobile && !reduced) {
      for (const pass of passes) {
        const weight = 1 - smooth(Math.abs(p - pass.progress) / (height * 0.62 / maxScroll));
        if (weight > foreground) { foreground = weight; x = mix(x, pass.x, weight); }
      }
    }
    rig.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0) scale(${scale.toFixed(4)})`;
    turntable.style.transform = `rotateX(${pitch.toFixed(3)}deg) rotateY(${yaw.toFixed(3)}deg)`;

    // Each texture is a facet of the turn. A short hinge makes the outgoing
    // and incoming facets edge-on at 45/135 degrees. Never overlap textures.
    const view = mobile || reduced ? 0 : yaw < 45 ? 0 : yaw < 135 ? 1 : 2;
    const boundary = view === 0 ? 45 : view === 2 ? 135 : yaw < 90 ? 45 : 135;
    let hinge = 0;
    if (!mobile && !reduced) {
      if (view > 0 && yaw < view * 90 - 40)
        hinge = -45 * (1 - smooth((yaw - (view * 90 - 45)) / 5));
      if (view < 2 && yaw > view * 90 + 40)
        hinge = 45 * smooth((yaw - (view * 90 + 40)) / 5);
    }
    const alpha = mobile || reduced ? 1 : clamp(Math.abs(yaw - boundary) / 0.9);
    const showState = !reduced && view === 0 && Boolean(appState.mochiOverridePose);
    const selected = showState ? 3 : view;
    sprites.forEach((sprite, index) => {
      sprite.style.opacity = index === selected ? String(alpha) : "0";
      sprite.style.transform = `rotateY(${-view * 90 + hinge}deg)`;
    });
    const weights = p <= 0.5 ? [1 - smooth(p * 2), smooth(p * 2), 0]
      : [0, 1 - smooth((p - 0.5) * 2), smooth((p - 0.5) * 2)];
    lightLayers.forEach(([light, rim], index) => {
      light.style.opacity = String(weights[index]); rim.style.opacity = String(weights[index]);
      light.style.transform = `translate3d(${(x * 0.25).toFixed(1)}px, ${(-y).toFixed(1)}px, 0) scale(${(1 + p * 0.18).toFixed(3)})`;
    });
    shade.style.opacity = String(reduced ? 0.18 : mix(0.38, 0.08, Math.sin(p * Math.PI)));
    halo.style.transform = `scale(${(0.92 + Math.sin(p * Math.PI) * 0.18).toFixed(3)})`;
    const degrees = Math.round(yaw), tag = ["FRONT", "SIDE", "BACK"][view];
    appState.scrollDeg = degrees;
    degLabel.textContent = `${degrees}° ${tag}`;
    caption.textContent = `${degrees}° ${tag}`;
    // Public visual telemetry is also useful when checking device fallbacks.
    stage.dataset.yaw = yaw.toFixed(2); stage.dataset.pitch = pitch.toFixed(2);
    stage.dataset.scale = scale.toFixed(3); stage.dataset.progress = p.toFixed(5);
    stage.dataset.foreground = foreground.toFixed(3);
    stage.dataset.motion = reduced ? "reduced" : mobile ? "mobile" : "desktop";
    if (!reduced && current !== target) requestMochiFrame();
    else previousTime = 0;
  }
  requestMochiFrame = () => { if (!frame) frame = requestAnimationFrame(renderFrame); };
  window.addEventListener("scroll", () => {
    target = clamp(scrollY / maxScroll); requestMochiFrame();
  }, { passive: true });
  window.addEventListener("resize", measureScene);
  motionQuery.addEventListener("change", measureScene);
  mobileQuery.addEventListener("change", measureScene);
  new ResizeObserver(measureScene).observe(document.body);
  measureScene();
}

function setMochiPoseOverride(assetFilename, poseLabel) {
  appState.mochiOverridePose = assetFilename;
  requestMochiFrame();
  const stateImg = document.getElementById("mochi-layer-state");
  const poseHud = document.getElementById("hud-mochi-pose");
  if (stateImg && assetFilename) {
    stateImg.src = `./assets/${assetFilename}`;
  }
  if (poseHud && poseLabel) {
    poseHud.textContent = poseLabel;
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
  const poseHud = document.getElementById("hud-mochi-pose");
  if (!c || !stateImg) return;

  const targetFile = appState.mochiOverridePose || c.mochi_state || "mochi-float.png";
  stateImg.src = `./assets/${targetFile}`;
  poseHud.textContent = targetFile.replace(".png", "").toUpperCase();

  requestMochiFrame();
  // Status remains available separately from the scroll-driven scene lights.
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
  Object.values(appState.curves).forEach((curve) => {
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
        <span>R: ${curve.curve_reserve.toLocaleString()} mGEN | Net buys: ${curve.cumulative_buy_volume.toLocaleString()} (${pct}%)</span>
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
  if (!c) return;

  document.getElementById("active-curve-ticker").textContent = c.ticker;
  document.getElementById("active-curve-status").textContent = c.gate_status;
  document.getElementById("active-curve-name").textContent = c.name;
  document.getElementById("active-curve-manifesto").textContent = c.manifesto_text;

  const pct = Math.min(100, Math.floor((c.cumulative_buy_volume * 100) / c.graduation_threshold));
  document.getElementById("meter-reserve-text").textContent =
    `${c.cumulative_buy_volume.toLocaleString()} / ${c.graduation_threshold.toLocaleString()} mGEN (${pct}%)`;
  document.getElementById("meter-reserve-fill").style.transform = `scaleX(${(pct / 100).toFixed(3)})`;

  const rEff = calcCurveIntegralReserve(c.Supply, c.base_price, c.slope_k, c.virtual_slope_offset);
  const invariantOk = rEff === Number(c.curve_reserve);
  const floorMult = (Number(c.floor_multiplier_bps) / 10000).toFixed(4);

  document.getElementById("metric-val-supply").textContent = String(c.Supply);
  document.getElementById("metric-val-spot").textContent = `${c.spot_price.toLocaleString()} mGEN`;
  document.getElementById("metric-val-slope").textContent = `k=${c.slope_k} / off=${c.virtual_slope_offset.toLocaleString()}`;
  document.getElementById("metric-val-floor").textContent = `${c.redemption_floor_pool.toLocaleString()} mGEN (${floorMult}x)`;
  document.getElementById("metric-val-collateral").textContent =
    `${(Number(c.creator_collateral) + Number(c.fee_escrow_pool)).toLocaleString()} mGEN`;
  document.getElementById("metric-val-invariant").textContent =
    invariantOk ? `VERIFIED (${rEff.toLocaleString()})` : `MISMATCH (${rEff})`;

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
    `S=${c.Supply} | R=${c.curve_reserve.toLocaleString()} mGEN`;

  updateTradeSimulation();
  renderGraduationGateAndWitnesses(c);
  syncMochiWithActiveCurve();
}

function updateTradeSimulation() {
  const c = appState.curves[appState.activeCurveId];
  const delta = Number(document.getElementById("input-trade-amount").value || 1);
  document.getElementById("trade-amount-display").textContent = `${delta} Tokens`;

  const s0 = Number(c.Supply);
  const b = Number(c.base_price);
  const k = Number(c.slope_k);
  const vOff = Number(c.virtual_slope_offset);
  const r0 = calcCurveIntegralReserve(s0, b, k, vOff);

  // Buy simulation
  const rBuy = calcCurveIntegralReserve(s0 + delta, b, k, vOff);
  const buyDeltaR = rBuy - r0;
  const buyFee = Math.floor((buyDeltaR * APP_CONFIG.TRADE_FEE_BPS) / APP_CONFIG.BPS_SCALE);
  const totalBuyCost = buyDeltaR + buyFee;
  document.getElementById("sim-buy-val").textContent = `${totalBuyCost.toLocaleString()} mGEN`;

  // Sell simulation
  const sellAmt = Math.min(delta, s0);
  const rSell = calcCurveIntegralReserve(s0 - sellAmt, b, k, vOff);
  const sellRefund = r0 - rSell;
  const floorBonus = s0 > 0 ? Math.floor((Number(c.redemption_floor_pool) * sellAmt) / s0) : 0;
  const totalSellPayout = sellRefund + floorBonus;
  document.getElementById("sim-sell-val").textContent =
    `${totalSellPayout.toLocaleString()} mGEN (Floor Bonus: +${floorBonus.toLocaleString()})`;

  const userBal = appState.balances[appState.activeTraderAddress] ?? 300000;
  const held = c.positions[appState.activeTraderAddress] ?? 0;
  document.getElementById("user-mgen-balance").textContent = userBal.toLocaleString();
  document.getElementById("user-token-position").textContent = `${held} Tokens`;

  const buyBtn = document.getElementById("btn-buy-tokens");
  buyBtn.disabled = c.gate_status === "RUG_SLASHED";
}

function renderGraduationGateAndWitnesses(c) {
  const pUrl = `https://raw.githubusercontent.com/${c.expected_repo_slug}/main/release_manifest.json`;
  const bUrl = `https://cdn.jsdelivr.net/gh/${c.expected_repo_slug}@main/release_manifest.json`;
  if (document.getElementById("input-primary-url").dataset.curve !== c.curve_id) {
    document.getElementById("input-primary-url").value = pUrl;
    document.getElementById("input-backup-url").value = bUrl;
    document.getElementById("input-primary-url").dataset.curve = c.curve_id;
  }

  const auditBody = document.getElementById("audit-verdict-body");
  if (!c.last_audit) {
    auditBody.innerHTML = `<p class="empty-state">${I18N_DICT[appState.lang].audit_empty}</p>`;
  } else {
    const a = c.last_audit;
    auditBody.innerHTML = `
      <div class="verdict-banner verdict-${escapeHtml(a.verdict.toLowerCase())}">
        <strong>${escapeHtml(a.verdict)}</strong>
        <span>Source: ${escapeHtml(a.source_used.toUpperCase())}</span>
      </div>
      <div class="audit-detail-grid">
        <div><span>Tag / Commits:</span> <strong>${escapeHtml(a.tag_name || "v1.0")} / ${escapeHtml(a.commit_count || "0")}</strong></div>
        <div><span>Scores (Comp/Auth/Bonus):</span> <strong>${escapeHtml(a.completeness_score)} / ${escapeHtml(a.authenticity_score)} / ${escapeHtml(a.overdelivery_bonus)}</strong></div>
        <div><span>Slashed to Floor:</span> <strong>${Number(a.slashed_amount).toLocaleString()} mGEN</strong></div>
        <div><span>Catalyst Boost Added:</span> <strong>${Number(a.boost_subsidy_added).toLocaleString()} mGEN (k=${Number(a.new_slope_k)})</strong></div>
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
  document.getElementById("select-mock-scenario").closest(".rehearsal-preset-row")?.toggleAttribute("hidden", isLive);
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
    const amt = Number(document.getElementById("input-trade-amount").value || 1);
    submitStudionetWriteOrRehearsal("buy_tokens", [c.curve_id, amt, appState.activeTraderAddress], async () => {
      if (c.gate_status === "RUG_SLASHED") throw new Error("CURVE_SLASHED_BUY_DISABLED");
      const s0 = Number(c.Supply);
      const s1 = s0 + amt;
      const r0 = calcCurveIntegralReserve(s0, c.base_price, c.slope_k, c.virtual_slope_offset);
      const r1 = calcCurveIntegralReserve(s1, c.base_price, c.slope_k, c.virtual_slope_offset);
      const deltaR = r1 - r0;
      const fee = Math.floor((deltaR * APP_CONFIG.TRADE_FEE_BPS) / APP_CONFIG.BPS_SCALE);
      const cost = deltaR + fee;
      const bal = appState.balances[appState.activeTraderAddress] ?? 300000;
      if (bal < cost) throw new Error("INSUFFICIENT_BALANCE");
      appState.balances[appState.activeTraderAddress] = bal - cost;
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
    });
  });

  document.getElementById("btn-sell-tokens").addEventListener("click", () => {
    const c = appState.curves[appState.activeCurveId];
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
      appState.balances[appState.activeTraderAddress] =
        (appState.balances[appState.activeTraderAddress] || 0) + refund + bonus;
      c.floor_multiplier_bps = 10000 + Math.floor((c.redemption_floor_pool * 10000) / Math.max(1, r1));
      return "mochi-celebrate-expr.png";
    });
  });

  document.getElementById("btn-reveal-catalyst").addEventListener("click", () => {
    const c = appState.curves[appState.activeCurveId];
    const salt = document.getElementById("input-reveal-salt").value.trim();
    const secret = document.getElementById("input-reveal-secret").value.trim();
    submitStudionetWriteOrRehearsal("reveal_secret_catalyst", [c.curve_id, salt, secret], async () => {
      const digest = await sha256HexBrowser(`${salt}|${secret}`);
      if (digest !== c.secret_catalyst_commitment) {
        throw new Error("COMMITMENT_MISMATCH_BEFORE_WRITE");
      }
      c.revealed_secret_catalyst = secret;
      return "mochi-celebrate-jump.png";
    });
  });

  document.getElementById("btn-evaluate-gate").addEventListener("click", () => {
    const c = appState.curves[appState.activeCurveId];
    const pUrl = document.getElementById("input-primary-url").value;
    const bUrl = document.getElementById("input-backup-url").value;
    const scenario = document.getElementById("select-mock-scenario").value;

    submitStudionetWriteOrRehearsal("evaluate_graduation_gate", [c.curve_id, pUrl, bUrl], async () => {
      if (["GRADUATE_APPROVED", "CATALYST_BOOST", "RUG_SLASHED"].includes(c.gate_status)) {
        throw new Error("FINALIZED_VERDICT_IMMUTABLE");
      }
      if (c.cumulative_buy_volume < c.graduation_threshold) {
        throw new Error("GRADUATION_THRESHOLD_NOT_REACHED: cumulative net buys < 100000");
      }
      if (scenario === "BOTH_FAIL") {
        throw new Error("EXTERNAL_FETCH_FAILED_BOTH_SOURCES_PENDING_RETRY");
      }
      if (scenario === "BACKUP_SLASH") {
        const slashed = Number(c.creator_collateral) + Number(c.fee_escrow_pool);
        c.creator_collateral = 0;
        c.fee_escrow_pool = 0;
        c.redemption_floor_pool += slashed;
        c.gate_status = "RUG_SLASHED";
        c.mochi_state = "mochi-point.png";
        c.floor_multiplier_bps = 10000 + Math.floor((c.redemption_floor_pool * 10000) / Math.max(1, c.curve_reserve));
        const evHash = await sha256HexBrowser(`${c.expected_repo_slug}|none|1|false|placeholder readme`);
        c.last_audit = {
          verdict: "RUG_SLASHED",
          source_used: "backup",
          primary_url: pUrl,
          backup_url: bUrl,
          evidence_hash: evHash,
          tag_name: "none",
          commit_count: "1",
          completeness_score: "20",
          authenticity_score: "20",
          overdelivery_bonus: "0",
          slashed_amount: String(slashed),
          boost_subsidy_added: "0",
          new_slope_k: String(c.slope_k)
        };
        return "mochi-point.png";
      }
      // [Fix 2] GRADUATE_APPROVED rehearsal branch matching contract logic
      if (scenario === "GRADUATE_APPROVED") {
        const creatorReward = Number(c.creator_collateral) + Number(c.fee_escrow_pool);
        c.creator_collateral = 0;
        c.fee_escrow_pool = 0;
        appState.balances[c.creator] = (Number(appState.balances[c.creator]) || 0) + creatorReward;
        c.gate_status = "GRADUATE_APPROVED";
        c.mochi_state = "mochi-celebrate-expr.png";
        c.floor_multiplier_bps = 10000 + Math.floor((c.redemption_floor_pool * 10000) / Math.max(1, c.curve_reserve));
        const evHash = await sha256HexBrowser(`${c.expected_repo_slug}|v1.0.0|6|true|verified standard release manifest`);
        c.last_audit = {
          verdict: "GRADUATE_APPROVED",
          source_used: "primary",
          primary_url: pUrl,
          backup_url: bUrl,
          evidence_hash: evHash,
          tag_name: "v1.0.0",
          commit_count: "6",
          completeness_score: "70",
          authenticity_score: "70",
          overdelivery_bonus: "50",
          slashed_amount: "0",
          boost_subsidy_added: "0",
          new_slope_k: String(c.slope_k)
        };
        return "mochi-celebrate-expr.png";
      }
      // [Fix 1] Default PRIMARY_BOOST: credit creatorReward to appState.balances[c.creator] before zeroing
      const kNew = Math.floor((c.slope_k * 125) / 100);
      const rawNew = c.base_price * c.Supply + Math.floor((kNew * c.Supply * c.Supply) / 2);
      c.virtual_slope_offset = rawNew - c.curve_reserve;
      c.slope_k = kNew;
      c.spot_price = calcSpotPrice(c.Supply, c.base_price, kNew);
      const subsidy = Number(c.protocol_catalyst_pool);
      c.protocol_catalyst_pool = 0;
      c.redemption_floor_pool += subsidy;
      const creatorReward = Number(c.creator_collateral) + Number(c.fee_escrow_pool);
      c.creator_collateral = 0;
      c.fee_escrow_pool = 0;
      appState.balances[c.creator] = (Number(appState.balances[c.creator]) || 0) + creatorReward;
      c.gate_status = "CATALYST_BOOST";
      c.mochi_state = "mochi-celebrate-jump.png";
      c.floor_multiplier_bps = 10000 + Math.floor((c.redemption_floor_pool * 10000) / Math.max(1, c.curve_reserve));
      const evHash = await sha256HexBrowser(`${c.expected_repo_slug}|v1.2.0|9|true|verified release manifest`);
      c.last_audit = {
        verdict: "CATALYST_BOOST",
        source_used: "primary",
        primary_url: pUrl,
        backup_url: bUrl,
        evidence_hash: evHash,
        tag_name: "v1.2.0",
        commit_count: "9",
        completeness_score: "95",
        authenticity_score: "90",
        overdelivery_bonus: "90",
        slashed_amount: "0",
        boost_subsidy_added: String(subsidy),
        new_slope_k: String(kNew)
      };
      return "mochi-celebrate-jump.png";
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
          protocol_catalyst_pool: 15000,
          fee_escrow_pool: 0,
          redemption_floor_pool: 0,
          floor_multiplier_bps: 10000,
          spot_price: APP_CONFIG.DEFAULT_BASE_PRICE,
          gate_status: "TRADING_OPEN",
          mochi_state: "mochi-float.png",
          positions: {},
          last_audit: null,
          contradiction_witnesses: []
        };
        appState.activeCurveId = cid;
        return "mochi-celebrate-jump.png";
      }
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
  } }, 15000);
});