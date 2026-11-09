// src/i18n_and_styles.js
// Bilingual Dictionary (EN/ZH), Key Parity Verifier, WebAudio Synthesizer & MOCHI 5-Color Palette Stylesheet
// Fixed palette enforced: Purple #C73AF2, Cyan #22E8F2, Navy #122147, Lavender White #F3F1FA, Grey Silver #B9B7C9.

export const I18N_DICT = {
  en: {
    app_title: "MOCHICURVE // 61999",
    app_subtitle: "GenLayer Studionet Bonding Curve Cockpit",
    enable_test_account: "Enable temporary test account",
    generate_commitment: "Generate private salt and catalyst",
    hud_angle_label: "ORBIT",
    hud_state_label: "MOCHI STATE",
    hud_mode_label: "MODE",
    btn_audio_off: "SFX: OFF",
    btn_audio_on: "SFX: ON",
    st1_kicker: "01 // SPATIAL BONDING CURVE ORBIT (0° FRONT)",
    st1_headline: "TRADE THE CURVE. GRADUATE BY PROOF. SLASH THE RUG.",
    st1_lead: "Every token launches on an integer bonding curve with 25,000 mGEN locked creator collateral. Crossing 100,000 mGEN in cumulative net buys unlocks the GenLayer Graduation Gate: validators audit live GitHub deliverables to boost curve slope (+25%) or slash 100% of collateral into the holder Redemption Floor Pool.",
    meter_reserve_label: "Cumulative Net Buys vs. 100,000 mGEN Graduation Threshold",
    metric_supply: "Circulating Supply (S)",
    metric_spot: "Spot Price P(S)",
    metric_slope: "Slope k / Offset",
    metric_floor_pool: "Redemption Floor Pool",
    metric_collateral: "Creator Collateral + Fee Escrow",
    metric_invariant: "Solvency Invariant R_eff == R",
    st2_kicker: "02 // BONDING CURVE TRADING COCKPIT (90° SIDE PROFILE)",
    st2_title: "Integer Curve Execution & Floor Redemption",
    st2_desc: "Scrub token delta to preview exact integer reserve integral costs, 2.00% fee escrow accumulation, and pro-rata Redemption Floor Pool bonuses upon selling.",
    chart_legend_formula: "Formula: R_eff(S) = B*S + (k*S^2)//2 - offset",
    cr_title: "Secret Catalyst Commit-Reveal",
    cr_honest_warning: "Notice: SHA-256 commitment is hiding, not encryption; short guessable secrets can be brute-forced. Salt and secret never leave your browser during commit—if you lose your salt or mistype the secret, the catalyst can never be revealed.",
    cr_onchain_hash: "On-Chain Commitment:",
    cr_revealed_label: "Revealed Catalyst:",
    cr_unrevealed: "PENDING_REVEAL_SECRET",
    ph_reveal_salt: "Salt (e.g. mochi-salt-01)",
    ph_reveal_secret: "Secret Catalyst (e.g. v1.0-mainnet-bridge-module)",
    btn_reveal: "Reveal Catalyst",
    wallet_read_label: "Injected Wallet (Connect & Read Only):",
    wallet_not_connected: "Not connected",
    btn_connect_wallet: "Connect OKX / EVM Wallet",
    wallet_honest_disclosure: "Disclosure: Injected EVM wallets (OKX, MetaMask, Rabby, Coinbase) are used strictly for connection and state reading. Studionet write operations default to the explicitly labeled in-browser ephemeral test account below (key stays in browser memory and is never disguised as your main wallet signature).",
    ephemeral_signer_label: "Active Studionet Write Signer (Ephemeral Test Account):",
    user_bal_label: "Balance",
    trade_amount_label: "Token Delta (ΔS)",
    sim_buy_cost: "Est. Buy Cost (Integral ΔR + 2% Fee):",
    sim_sell_payout: "Est. Sell Payout (Integral ΔR + Pro-Rata Floor Bonus):",
    sim_holder_pos: "Your Current Position in Curve:",
    btn_buy_tokens: "Buy Along Curve",
    btn_sell_tokens: "Sell & Claim Floor",
    launch_drawer_title: "+ Launch New Bonding Curve Token (Locks 25,000 mGEN Collateral)",
    btn_launch_submit: "Commit & Launch Curve",
    st3_kicker: "03 // GENLAYER GRADUATION GATE (140° REAR-SIDE INSPECTION)",
    st3_title: "Dual-Mirror GitHub Release Adjudication",
    st3_desc: "Once cumulative net buys reach 100,000 mGEN, validators fetch release_manifest.json from Primary (GitHub Raw) and Backup (jsDelivr CDN) mirrors, compare canonical manifests, independently verify the claimed GitHub tag, and execute CATALYST_BOOST, GRADUATE_APPROVED, or RUG_SLASHED.",
    label_primary_mirror: "Primary Source (GitHub Raw JSON Mirror)",
    label_backup_mirror: "Backup Source (jsDelivr CDN Equivalent Mirror)",
    rehearsal_scenario_label: "Local Mock Test Scenario (When No Live Contract Configured):",
    btn_trigger_gate: "Trigger Consensus Graduation Audit",
    audit_card_title: "Latest Consensus Graduation Verdict",
    audit_empty: "No consensus audit executed yet. Reach cumulative net buys >= 100,000 mGEN to unlock gate.",
    st4_kicker: "04 // CONTRADICTION WITNESS LOG (180° BACK CORE)",
    st4_title: "Immutable State & Contradiction Witnesses",
    st4_desc: "Conflicting post-audit declarations never overwrite a finalized graduation verdict. Instead, the contract preserves the active state and appends a cryptographic contradiction witness.",
    wit_form_title: "Submit Conflicting Post-Audit Claim",
    btn_record_witness: "Record Witness",
    wit_empty: "No contradiction claims recorded yet. Finalized state remains immutable.",
    trust_title: "Studionet Trust & Finality Surface",
    trust_network: "Target Network:",
    trust_rpc: "RPC Endpoint:",
    trust_contract: "Contract Address:",
    trust_tx_status: "Latest Transaction Status:",
    trust_tx_hash: "Transaction / Explorer Link:",
    trust_timestamp: "Last Telemetry Timestamp:",
    unconfigured_contract_note: "Unconfigured (Local Seed Rehearsal Mode — Non-On-Chain)",
    msg_rehearsal_running: "Running local integer bonding curve & consensus simulation...",
    msg_rehearsal_done: "Local simulation finished successfully. Solvency invariant verified.",
    msg_action_failed: "Action reverted",
    msg_checking_net: "Checking GenLayer Studionet Chain ID 61999...",
    msg_waiting_finalized: "Transaction submitted. Waiting for multi-validator consensus finality...",
    msg_tx_finalized_ok: "Transaction reached FINALIZED state successfully on Studionet."
  },
  zh: {
    app_title: "MOCHICURVE // 61999",
    app_subtitle: "GenLayer Studionet 联合曲线交易舱",
    enable_test_account: "启用临时测试账号",
    generate_commitment: "生成私密盐与催化剂",
    hud_angle_label: "轨道视角",
    hud_state_label: "MOCHI 状态",
    hud_mode_label: "运行模式",
    btn_audio_off: "音效: 关闭",
    btn_audio_on: "音效: 开启",
    st1_kicker: "01 // 空间联合曲线轨道 (0° 正面)",
    st1_headline: "沿曲线交易，让交付决定毕业。",
    st1_lead: "所有代币均在整数联合曲线发行，并锁定 25,000 mGEN 创作者抵押金。累计净买入达到 100,000 mGEN 即触发 GenLayer 毕业网关：验证者独立拉取 GitHub 交付物，共识决定上调斜率 (+25%) 或是将 100% 抵押金罚没注入持币人托底赎回池。",
    meter_reserve_label: "累计净买入 / 100,000 mGEN 毕业门槛",
    metric_supply: "流通供应量 (S)",
    metric_spot: "当前边际价格 P(S)",
    metric_slope: "斜率 k / 偏移量",
    metric_floor_pool: "托底赎回池 (Floor Pool)",
    metric_collateral: "创作者抵押 + 手续费托管",
    metric_invariant: "偿付不变量 R_eff == R",
    st2_kicker: "02 // 联合曲线交易舱 (90° 侧面剖面)",
    st2_title: "整数曲线执行与底池赎回",
    st2_desc: "拖动滑块预览整数储备积分成本、2.00% 手续费托管提取，以及卖出时按持仓比例获得的托底池分红。",
    chart_legend_formula: "公式: R_eff(S) = B*S + (k*S^2)//2 - offset",
    cr_title: "秘密催化剂 Commit-Reveal 承诺机制",
    cr_honest_warning: "提示：SHA-256 哈希承诺仅用于隐藏而非加密，短小可猜的秘密易被暴力破解。提交时盐与秘密绝不离开浏览器——若丢失盐或记错秘密，催化剂将永久无法揭晓。",
    cr_onchain_hash: "链上哈希承诺:",
    cr_revealed_label: "已揭晓催化剂:",
    cr_unrevealed: "等待揭晓秘密",
    ph_reveal_salt: "盐 (例如 mochi-salt-01)",
    ph_reveal_secret: "秘密催化剂 (例如 v1.0-mainnet-bridge-module)",
    btn_reveal: "揭晓催化剂",
    wallet_read_label: "注入式钱包 (仅连接与读取):",
    wallet_not_connected: "未连接钱包",
    btn_connect_wallet: "连接 OKX / EVM 钱包",
    wallet_honest_disclosure: "申明：注入式 EVM 钱包（OKX、MetaMask、Rabby、Coinbase）仅用于连接与状态读取。Studionet 链上写入默认采用下方明确标注的浏览器内临时测试账号（私钥存留于浏览器内存，绝不伪装成您的主钱包签名）。",
    ephemeral_signer_label: "当前 Studionet 写入签名者 (临时测试账号):",
    user_bal_label: "账户余额",
    trade_amount_label: "代币变动量 (ΔS)",
    sim_buy_cost: "预估买入成本 (积分 ΔR + 2% 手续费):",
    sim_sell_payout: "预估卖出收益 (积分 ΔR + 比例底池分红):",
    sim_holder_pos: "您在当前曲线的持仓:",
    btn_buy_tokens: "沿曲线买入",
    btn_sell_tokens: "卖出并领取底池分红",
    launch_drawer_title: "+ 发行新的联合曲线代币 (需锁定 25,000 mGEN 抵押金)",
    btn_launch_submit: "提交承诺并发行曲线",
    st3_kicker: "03 // GENLAYER 毕业网关 (140° 后侧审阅)",
    st3_title: "双镜像 GitHub 发布版本仲裁",
    st3_desc: "当累计净买入达到 100,000 mGEN 时，验证者从主源（GitHub Raw）与备源（jsDelivr CDN）拉取 release_manifest.json，校验镜像一致性并通过 GitHub API 独立核验标签，再执行 CATALYST_BOOST、GRADUATE_APPROVED 或 RUG_SLASHED。",
    label_primary_mirror: "主数据源 (GitHub Raw JSON 镜像)",
    label_backup_mirror: "备用数据源 (jsDelivr CDN 等价镜像)",
    rehearsal_scenario_label: "本地 Mock 测试场景 (未配置真实合约时):",
    btn_trigger_gate: "触发共识毕业审计",
    audit_card_title: "最新共识毕业裁决结果",
    audit_empty: "尚未执行共识审计。请将累计净买入推至 >= 100,000 mGEN 以解锁网关。",
    st4_kicker: "04 // 矛盾见证记录 (180° 背面核心)",
    st4_title: "不可篡改状态与矛盾见证记录",
    st4_desc: "冲突的后置声明绝不会覆盖已终局的毕业裁决。合约将保留生效状态，并追加不可篡改的密码学矛盾见证。",
    wit_form_title: "提交冲突的后置声明",
    btn_record_witness: "记录矛盾见证",
    wit_empty: "尚无矛盾声明记录。链上终局状态保持不变。",
    trust_title: "Studionet 来源与交易状态",
    trust_network: "目标网络:",
    trust_rpc: "RPC 节点:",
    trust_contract: "合约地址:",
    trust_tx_status: "最新交易状态:",
    trust_tx_hash: "交易 / 浏览器链接:",
    trust_timestamp: "最后遥测时间戳:",
    unconfigured_contract_note: "未配置 (本地种子演练模式 — 非真实上链)",
    msg_rehearsal_running: "正在运行本地整数联合曲线与共识模拟...",
    msg_rehearsal_done: "本地模拟成功完成，偿付不变量已通过校验。",
    msg_action_failed: "操作被回滚",
    msg_checking_net: "正在检查 GenLayer Studionet 链 ID 61999...",
    msg_waiting_finalized: "交易已提交，正在等待多验证者共识终局 (FINALIZED)...",
    msg_tx_finalized_ok: "交易已在 Studionet 上成功达成 FINALIZED 终局状态。"
  }
};

export function applyTranslations(lang) {
  const dict = I18N_DICT[lang] || I18N_DICT.en;
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.dataset.i18n;
    if (dict[key]) el.textContent = dict[key];
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
    const key = el.dataset.i18nPlaceholder;
    if (dict[key]) el.placeholder = dict[key];
  });
  const ind = document.getElementById("lang-indicator");
  if (ind) ind.textContent = lang === "en" ? "EN / 中文" : "中文 / EN";
}

export function verifyI18nParity() {
  const enKeys = Object.keys(I18N_DICT.en).sort();
  const zhKeys = Object.keys(I18N_DICT.zh).sort();
  const missingInZh = enKeys.filter((k) => !I18N_DICT.zh[k]);
  const missingInEn = zhKeys.filter((k) => !I18N_DICT.en[k]);
  if (missingInZh.length || missingInEn.length) {
    console.warn("[I18N Warning] Key mismatch! Missing in zh:", missingInZh, "Missing in en:", missingInEn);
    return false;
  }
  return true;
}

// ==============================================================================
// WEBAUDIO SYNTHESIZER (Zero external asset dependencies; respects first-click rule)
// ==============================================================================
let audioCtx = null;
export function playUiSound(type = "click") {
  try {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === "suspended") {
      audioCtx.resume();
    }
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);

    const now = audioCtx.currentTime;
    if (type === "click") {
      osc.type = "sine";
      osc.frequency.setValueAtTime(580, now);
      osc.frequency.exponentialRampToValueAtTime(240, now + 0.05);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.linearRampToValueAtTime(0.001, now + 0.05);
      osc.start(now);
      osc.stop(now + 0.05);
    } else if (type === "success") {
      osc.type = "triangle";
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.setValueAtTime(880, now + 0.08);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.linearRampToValueAtTime(0.001, now + 0.22);
      osc.start(now);
      osc.stop(now + 0.22);
    } else if (type === "finalized") {
      osc.type = "sine";
      osc.frequency.setValueAtTime(523.25, now);
      osc.frequency.setValueAtTime(659.25, now + 0.1);
      osc.frequency.setValueAtTime(783.99, now + 0.2);
      osc.frequency.setValueAtTime(1046.5, now + 0.3);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.linearRampToValueAtTime(0.001, now + 0.5);
      osc.start(now);
      osc.stop(now + 0.5);
    } else if (type === "error") {
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(180, now);
      osc.frequency.linearRampToValueAtTime(110, now + 0.15);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.linearRampToValueAtTime(0.001, now + 0.15);
      osc.start(now);
      osc.stop(now + 0.15);
    }
  } catch (e) {
    // Ignore audio context autoplay restrictions before interaction
  }
}

// ==============================================================================
// STYLESHEET INJECTION (Strictly adhering to MOCHI 5-color palette: Purple #C73AF2, Cyan #22E8F2, Navy #122147, Lavender White #F3F1FA, Grey Silver #B9B7C9)
// ==============================================================================
export function injectMochiStyles() {
  if (document.getElementById("mochi-injected-styles")) return;
  const style = document.createElement("style");
  style.id = "mochi-injected-styles";
  style.textContent = `
    [hidden] { display: none !important; }
    :root {
      --mochi-purple: #C73AF2;
      --mochi-cyan: #22E8F2;
      --mochi-navy: #122147;
      --mochi-lavender: #F3F1FA;
      --mochi-silver: #B9B7C9;
      --bg-dark: #122147;
      --card-bg: #122147;
      --border-glow: rgba(34, 232, 242, 0.35);
    }

    *, *::before, *::after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }

    body {
      background-color: var(--bg-dark);
      color: var(--mochi-lavender);
      overflow-x: hidden;
      min-height: 100vh;
      -webkit-font-smoothing: antialiased;
    }

    /* Spatial HUD Header */
    .spatial-hud {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      height: 72px;
      background: rgba(18, 33, 71, 0.88);
      backdrop-filter: blur(14px);
      border-bottom: 1px solid rgba(199, 58, 242, 0.25);
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 32px;
      z-index: 100;
    }

    .hud-brand {
      display: flex;
      align-items: center;
      gap: 14px;
    }

    .hud-logo-mark {
      color: var(--mochi-cyan);
      font-size: 20px;
      text-shadow: 0 0 12px var(--mochi-cyan);
    }

    .hud-brand-text {
      display: flex;
      flex-direction: column;
    }

    .hud-title {
      font-weight: 800;
      font-size: 15px;
      letter-spacing: 1.5px;
      color: var(--mochi-lavender);
    }

    .hud-subtitle {
      font-size: 11px;
      color: var(--mochi-silver);
      letter-spacing: 0.5px;
    }

    .hud-scroll-telemetry {
      display: flex;
      gap: 18px;
    }

    .telemetry-chip {
      background: rgba(18, 33, 71, 0.9);
      border: 1px solid rgba(34, 232, 242, 0.3);
      padding: 6px 14px;
      border-radius: 20px;
      font-size: 12px;
      color: var(--mochi-silver);
    }

    .telemetry-chip strong {
      color: var(--mochi-cyan);
      margin-left: 6px;
    }

    .hud-controls {
      display: flex;
      gap: 12px;
    }

    .hud-pill-btn {
      background: rgba(199, 58, 242, 0.15);
      border: 1px solid var(--mochi-purple);
      color: var(--mochi-lavender);
      padding: 8px 16px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .hud-pill-btn:hover {
      background: var(--mochi-purple);
      box-shadow: 0 0 14px rgba(199, 58, 242, 0.5);
    }

    /* One continuous atmosphere behind the narrative, with a camera in front. */
    .mochi-atmosphere {
      position: fixed; inset: 0; z-index: 0; overflow: hidden;
      pointer-events: none; background: var(--mochi-navy);
    }
    .scene-light, .scene-shade { position: absolute; inset: -12%; will-change: transform, opacity; }
    .scene-light-cyan {
      background: radial-gradient(ellipse at 72% 42%, rgba(34,232,242,0.55), transparent 72%);
    }
    .scene-light-violet {
      background: radial-gradient(ellipse at 48% 48%, rgba(112,72,242,0.60), transparent 72%);
    }
    .scene-light-magenta {
      background: radial-gradient(ellipse at 26% 58%, rgba(242,58,194,0.60), transparent 72%);
    }
    .scene-shade { background: var(--mochi-navy); will-change: opacity; }
    .mochi-stage-layer {
      position: fixed; top: 50%; left: 50%;
      transform: translate(-50%, -50%);
      width: clamp(300px, 32vw, 460px); aspect-ratio: 1;
      pointer-events: none; z-index: 20;
      perspective: 850px; perspective-origin: 50% 42%;
    }
    .mochi-rig {
      position: relative; width: 100%; height: 100%;
      display: flex; align-items: center; justify-content: center;
      transform-style: preserve-3d; will-change: transform;
    }
    .mochi-turntable {
      position: absolute; inset: 0;
      transform-style: preserve-3d; will-change: transform;
    }
    .mochi-halo {
      position: absolute; inset: 3%; border-radius: 50%;
      will-change: transform; pointer-events: none;
    }
    .halo-light {
      position: absolute; inset: 0; border-radius: inherit;
      will-change: opacity; opacity: 0;
    }
    .halo-light-cyan {
      background: radial-gradient(circle, rgba(34,232,242,0.28), transparent 70%);
      box-shadow: inset 0 0 60px rgba(34,232,242,0.24), 0 0 70px rgba(34,232,242,0.16);
    }
    .halo-light-violet {
      background: radial-gradient(circle, rgba(112,72,242,0.36), rgba(112,72,242,0.10) 50%, transparent 72%);
      box-shadow: inset 0 0 60px rgba(112,72,242,0.3);
    }
    .halo-light-magenta {
      background: radial-gradient(circle, rgba(242,58,194,0.38), transparent 72%);
      box-shadow: inset 0 0 60px rgba(242,58,194,0.35), 0 0 80px rgba(242,58,194,0.22);
    }
    .mochi-sprite {
      position: absolute; inset: 0; width: 100%; height: 100%;
      object-fit: contain; opacity: 0; backface-visibility: hidden;
      will-change: transform, opacity;
      /* Exactly one decoded view is opaque; residual perspective never approaches edge-on. */
      transition: none;
      filter: drop-shadow(0 16px 22px rgba(18,33,71,0.45));
    }
    .mochi-sprite.is-visible { opacity: 1; }

    .mochi-caption-pill {
      position: absolute;
      bottom: -10px;
      background: rgba(18, 33, 71, 0.85);
      border: 1px solid var(--mochi-cyan);
      color: var(--mochi-cyan);
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 10px;
      font-weight: 800;
      letter-spacing: 1px;
      backdrop-filter: blur(6px);
    }

    /* Spatial Scroll World */
    .spatial-world {
      margin-top: 72px;
      position: relative;
    }

    .spatial-station {
      min-height: 100vh;
      padding: 140px 64px;
      display: grid;
      grid-template-columns: minmax(0,1fr) minmax(0,1fr);
      column-gap: clamp(64px, 9vw, 160px);
      row-gap: 48px;
      align-items: center;
      border-bottom: 0;
      position: relative;
    }

    .station-left, .station-right {
      display: flex;
      flex-direction: column;
      gap: 20px;
      z-index: auto;
    }

    /* The complete actor passes in front of headings and cards without backdrop ghosts. */
    .station-column > * { position: relative; z-index: 12; }
    .station-column > .kinetic-headline, .station-column > .station-title { z-index: 2; }
    @media (min-width: 861px) {
      .station-01 .station-right { align-self: end; }
    }
    .station-lead, .station-desc {
      background: rgba(18,33,71,0.88); border-radius: 12px;
      padding: 14px 16px;
    }
    .station-02 .station-title, .station-03 .station-title {
      font-size: clamp(42px, 5.8vw, 88px); line-height: 0.98;
      letter-spacing: -0.055em; max-width: 11ch;
    }
    .station-kicker {
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 2px;
      color: var(--mochi-cyan);
    }

    .kinetic-headline {
      font-size: 42px;
      font-weight: 900;
      line-height: 1.1;
      color: var(--mochi-lavender);
      letter-spacing: -0.5px;
      will-change: transform;
    }

    .station-title {
      font-size: 32px;
      font-weight: 800;
      color: var(--mochi-lavender);
    }

    .station-lead, .station-desc {
      font-size: 15px;
      line-height: 1.6;
      color: var(--mochi-silver);
    }

    /* Orbit Curve Card Selector */
    .curve-orbit-selector {
      display: flex;
      flex-direction: column;
      gap: 12px;
      margin-top: 10px;
    }

    .orbit-curve-card {
      background: var(--card-bg);
      border: 1px solid rgba(185, 183, 201, 0.2);
      border-radius: 14px;
      padding: 16px 20px;
      cursor: pointer;
      text-align: left;
      transition: all 0.25s ease;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .orbit-curve-card:hover {
      border-color: var(--mochi-cyan);
      box-shadow: 0 0 20px rgba(34, 232, 242, 0.2);
    }

    .orbit-curve-card.is-selected {
      background: #302454;
      border-color: var(--mochi-purple);
      box-shadow: 0 0 24px rgba(199, 58, 242, 0.35);
    }

    .orbit-card-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .orbit-card-top strong {
      font-size: 15px;
      color: var(--mochi-lavender);
    }

    .status-pill {
      font-size: 10px;
      font-weight: 800;
      padding: 3px 10px;
      border-radius: 10px;
      letter-spacing: 0.5px;
    }

    .status-gate_unlocked { background: rgba(34, 232, 242, 0.2); color: var(--mochi-cyan); border: 1px solid var(--mochi-cyan); }
    .status-catalyst_boost { background: rgba(34, 232, 242, 0.28); color: var(--mochi-cyan); border: 1px solid var(--mochi-cyan); }
    .status-rug_slashed { background: rgba(199, 58, 242, 0.25); color: var(--mochi-purple); border: 1px solid var(--mochi-purple); }
    .status-trading_open { background: rgba(185, 183, 201, 0.2); color: var(--mochi-silver); border: 1px solid var(--mochi-silver); }

    .orbit-card-metrics {
      display: flex;
      gap: 16px;
      font-size: 12px;
      color: var(--mochi-silver);
    }

    /* Telemetry & Metrics Cards */
    .telemetry-card, .cockpit-trade-card, .mirror-config-card, .audit-verdict-card, .witness-form-card, .trust-surface-card {
      background: var(--card-bg);
      border: 1px solid rgba(34, 232, 242, 0.25);
      border-radius: 18px;
      padding: 24px;
      backdrop-filter: blur(10px);
      box-shadow: 0 16px 32px rgba(18,33,71,0.4);
    }

    .card-header-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }

    .badge-ticker {
      font-weight: 900;
      font-size: 16px;
      color: var(--mochi-cyan);
      letter-spacing: 1px;
    }

    .card-curve-title {
      font-size: 22px;
      font-weight: 800;
      color: var(--mochi-lavender);
      margin-bottom: 8px;
    }

    .card-manifesto {
      font-size: 13px;
      color: var(--mochi-silver);
      line-height: 1.5;
      margin-bottom: 20px;
    }

    .threshold-meter-box {
      margin-bottom: 22px;
    }

    .meter-labels {
      display: flex;
      justify-content: space-between;
      font-size: 11px;
      color: var(--mochi-silver);
      margin-bottom: 6px;
    }

    .meter-labels strong {
      color: var(--mochi-cyan);
    }

    .meter-track {
      width: 100%;
      height: 8px;
      background: rgba(18, 33, 71, 0.9);
      border-radius: 4px;
      overflow: hidden;
      border: 1px solid rgba(34, 232, 242, 0.3);
    }

    .meter-fill {
      width: 100%;
      height: 100%;
      background: linear-gradient(90deg, var(--mochi-purple), var(--mochi-cyan));
      transform-origin: left;
      transition: transform 0.4s ease;
    }

    .metrics-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 14px;
    }

    .metric-item {
      background: rgba(18, 33, 71, 0.6);
      border: 1px solid rgba(185, 183, 201, 0.12);
      border-radius: 12px;
      padding: 12px;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .metric-label {
      font-size: 11px;
      color: var(--mochi-silver);
    }

    .metric-val {
      font-size: 15px;
      font-weight: 800;
      color: var(--mochi-lavender);
    }

    .highlight-cyan { color: var(--mochi-cyan) !important; }
    .highlight-purple { color: var(--mochi-purple) !important; }

    /* Curve Chart SVG */
    .curve-chart-box {
      background: rgba(18, 33, 71, 0.85);
      border: 1px solid rgba(34, 232, 242, 0.25);
      border-radius: 14px;
      padding: 16px;
      position: relative;
    }

    #bonding-curve-svg {
      width: 100%;
      height: 180px;
    }

    #svg-curve-path {
      fill: none;
      stroke: var(--mochi-cyan);
      stroke-width: 3;
    }

    #svg-curve-area {
      fill: rgba(34, 232, 242, 0.12);
    }

    #svg-threshold-line {
      stroke: var(--mochi-purple);
      stroke-dasharray: 4;
      stroke-width: 1.5;
    }

    #svg-current-dot {
      fill: var(--mochi-purple);
      stroke: var(--mochi-lavender);
      stroke-width: 2;
    }

    .chart-legend {
      display: flex;
      justify-content: space-between;
      font-size: 11px;
      color: var(--mochi-silver);
      margin-top: 10px;
    }

    /* Commit-Reveal Capsule */
    .commit-reveal-box {
      background: rgba(18, 33, 71, 0.75);
      border: 1px solid rgba(199, 58, 242, 0.3);
      border-radius: 14px;
      padding: 18px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .sub-box-title {
      font-size: 15px;
      font-weight: 800;
      color: var(--mochi-lavender);
    }

    .warning-banner {
      font-size: 11px;
      color: #C73AF2;
      background: rgba(199, 58, 242, 0.1);
      border-left: 3px solid #C73AF2;
      padding: 8px 10px;
      border-radius: 4px;
      line-height: 1.4;
    }

    .cr-status-line {
      display: flex;
      justify-content: space-between;
      font-size: 12px;
      color: var(--mochi-silver);
    }

    .cr-status-line code {
      color: var(--mochi-cyan);
    }

    .cr-input-row {
      display: flex;
      gap: 10px;
    }

    .cr-input-row input, .cr-input-row select, .url-input {
      flex: 1;
      background: rgba(18, 33, 71, 0.9);
      border: 1px solid rgba(185, 183, 201, 0.3);
      border-radius: 10px;
      padding: 10px 14px;
      color: var(--mochi-lavender);
      font-size: 13px;
    }

    .cr-input-row input:focus, .cr-input-row select:focus, .url-input:focus {
      outline: none;
      border-color: var(--mochi-cyan);
      box-shadow: 0 0 10px rgba(34, 232, 242, 0.3);
    }

    /* Trading Cockpit Card */
    .wallet-disclosure-box {
      background: rgba(18, 33, 71, 0.65);
      border: 1px solid rgba(185, 183, 201, 0.15);
      border-radius: 12px;
      padding: 14px;
      margin-bottom: 16px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .wallet-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .wallet-label {
      font-size: 11px;
      color: var(--mochi-silver);
      display: block;
    }

    .wallet-row strong {
      font-size: 13px;
      color: var(--mochi-cyan);
    }

    .signer-honest-note {
      font-size: 11px;
      color: var(--mochi-silver);
      line-height: 1.4;
    }

    .ephemeral-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 11px;
      color: var(--mochi-silver);
      background: rgba(199, 58, 242, 0.1);
      padding: 6px 10px;
      border-radius: 8px;
    }

    .ephemeral-row code {
      color: var(--mochi-purple);
      font-weight: 800;
    }

    .balance-pill {
      color: var(--mochi-lavender);
    }

    .balance-pill strong {
      color: var(--mochi-cyan);
    }

    .trade-slider-block {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    .slider-header {
      display: flex;
      justify-content: space-between;
      font-size: 13px;
      color: var(--mochi-silver);
    }

    .slider-header strong {
      color: var(--mochi-cyan);
    }

    input[type="range"] {
      width: 100%;
      accent-color: var(--mochi-cyan);
      cursor: pointer;
    }

    .trade-sim-breakdown {
      background: rgba(18, 33, 71, 0.7);
      border-radius: 10px;
      padding: 12px;
      display: flex;
      flex-direction: column;
      gap: 6px;
      font-size: 12px;
    }

    .sim-line {
      display: flex;
      justify-content: space-between;
      color: var(--mochi-silver);
    }

    .sim-line strong {
      color: var(--mochi-lavender);
    }

    .trade-btn-group {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }

    .action-btn {
      padding: 12px;
      border-radius: 12px;
      font-size: 13px;
      font-weight: 800;
      cursor: pointer;
      border: none;
      transition: all 0.2s ease;
    }

    .primary-btn {
      background: var(--mochi-purple);
      color: var(--mochi-lavender);
      box-shadow: 0 0 16px rgba(199, 58, 242, 0.4);
    }

    .primary-btn:hover {
      background: #C73AF2;
      box-shadow: 0 0 24px rgba(199, 58, 242, 0.7);
    }

    .secondary-btn {
      background: rgba(34, 232, 242, 0.15);
      border: 1px solid var(--mochi-cyan);
      color: var(--mochi-cyan);
    }

    .secondary-btn:hover {
      background: var(--mochi-cyan);
      color: var(--mochi-navy);
    }

    .cyan-btn {
      background: var(--mochi-cyan);
      color: var(--mochi-navy);
      box-shadow: 0 0 16px rgba(34, 232, 242, 0.4);
    }

    .cyan-btn:hover {
      background: #22E8F2;
      box-shadow: 0 0 24px rgba(34, 232, 242, 0.7);
    }

    .launch-drawer {
      margin-top: 16px;
      background: rgba(18, 33, 71, 0.6);
      border: 1px dashed rgba(185, 183, 201, 0.3);
      border-radius: 12px;
      padding: 12px;
    }

    .launch-drawer summary {
      font-size: 12px;
      font-weight: 800;
      color: var(--mochi-cyan);
      cursor: pointer;
    }

    .launch-form-grid {
      display: flex;
      flex-direction: column;
      gap: 10px;
      margin-top: 12px;
    }

    .launch-form-grid input {
      background: rgba(18, 33, 71, 0.9);
      border: 1px solid rgba(185, 183, 201, 0.3);
      border-radius: 8px;
      padding: 10px;
      color: var(--mochi-lavender);
      font-size: 12px;
    }

    /* Graduation Gate & Audit Verdict */
    .mirror-config-card {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .mirror-label {
      font-size: 12px;
      font-weight: 700;
      color: var(--mochi-silver);
    }

    .rehearsal-preset-row {
      display: flex;
      flex-direction: column;
      gap: 6px;
      font-size: 12px;
      color: var(--mochi-silver);
    }

    .rehearsal-preset-row select {
      background: rgba(18, 33, 71, 0.9);
      border: 1px solid rgba(185, 183, 201, 0.3);
      border-radius: 10px;
      padding: 10px 14px;
      color: var(--mochi-lavender);
    }

    .audit-body {
      display: flex;
      flex-direction: column;
      gap: 14px;
      margin-top: 12px;
    }

    .verdict-banner {
      padding: 12px 16px;
      border-radius: 10px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 13px;
    }

    .verdict-catalyst_boost { background: rgba(34, 232, 242, 0.2); border: 1px solid var(--mochi-cyan); color: var(--mochi-cyan); }
    .verdict-graduate_approved { background: rgba(34, 232, 242, 0.15); border: 1px solid var(--mochi-cyan); color: var(--mochi-cyan); }
    .verdict-rug_slashed { background: rgba(199, 58, 242, 0.2); border: 1px solid var(--mochi-purple); color: var(--mochi-purple); }

    .audit-detail-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      font-size: 12px;
      color: var(--mochi-silver);
    }

    .audit-detail-grid strong {
      color: var(--mochi-lavender);
    }

    .full-span {
      grid-column: span 2;
    }

    .full-span code {
      color: var(--mochi-cyan);
      word-break: break-all;
    }

    /* Contradiction Witness List */
    .witness-list {
      display: flex;
      flex-direction: column;
      gap: 10px;
      margin-top: 12px;
      max-height: 240px;
      overflow-y: auto;
    }

    .witness-item {
      background: rgba(18, 33, 71, 0.8);
      border: 1px solid rgba(199, 58, 242, 0.3);
      border-radius: 10px;
      padding: 12px;
      display: flex;
      flex-direction: column;
      gap: 6px;
      font-size: 11px;
    }

    .wit-head {
      display: flex;
      justify-content: space-between;
      color: var(--mochi-lavender);
      font-weight: 800;
    }

    .wit-head span {
      color: var(--mochi-purple);
    }

    .witness-item p {
      color: var(--mochi-silver);
      line-height: 1.4;
    }

    .witness-item code {
      color: var(--mochi-cyan);
    }

    /* Trust Surface */
    .trust-grid {
      display: flex;
      flex-direction: column;
      gap: 12px;
      margin-top: 12px;
      font-size: 12px;
    }

    .trust-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: rgba(18, 33, 71, 0.6);
      padding: 10px 14px;
      border-radius: 10px;
      border: 1px solid rgba(185, 183, 201, 0.1);
    }

    .trust-row span {
      color: var(--mochi-silver);
    }

    .trust-row strong, .trust-row code, .trust-row a {
      color: var(--mochi-cyan);
      word-break: break-all;
    }

    .tx-badge {
      background: rgba(34, 232, 242, 0.15);
      border: 1px solid var(--mochi-cyan);
      padding: 3px 8px;
      border-radius: 8px;
    }

    .trust-feedback {
      margin-top: 14px;
      font-size: 12px;
      color: var(--mochi-lavender);
      background: rgba(199, 58, 242, 0.12);
      border-left: 3px solid var(--mochi-purple);
      padding: 10px 12px;
      border-radius: 6px;
      line-height: 1.4;
    }

    .empty-state {
      font-size: 12px;
      color: var(--mochi-silver);
      font-style: italic;
      text-align: center;
      padding: 16px;
    }

    .seed-demo-badge, #seed-demo-notice { color: var(--mochi-silver); font-size: 12px; line-height: 1.5; }
    button:focus-visible, input:focus-visible, select:focus-visible, summary:focus-visible { outline: 3px solid var(--mochi-cyan); outline-offset: 4px; }
    .orbit-curve-card { text-align: left; }
    .spatial-hud { padding-top: env(safe-area-inset-top); }
    @media (prefers-reduced-motion: reduce) {
      .mochi-stage-layer { perspective: none; }
      .mochi-rig, .mochi-turntable { transform-style: flat; }
      *, *::before, *::after { animation: none !important; transition: none !important; scroll-behavior: auto !important; }
    }
    @media (max-width: 860px) {
      .spatial-station { min-height: 100svh; padding-bottom: 130px !important; }
      .station-left, .station-right, .spatial-station > *, .mirror-config-card, .trade-cockpit-card { min-width: 0; max-width: 100%; }
      .cr-input-row, .wallet-row, .ephemeral-row, .sim-line, .cr-status-line, .wit-head, .verdict-banner, .chart-legend { flex-wrap: wrap; gap: 8px; }
      .cr-input-row > input, .cr-input-row > select, .cr-input-row > button { flex: 1 1 100%; min-width: 0; width: 100%; }
      .url-input, .rehearsal-preset-row select { width: 100%; min-width: 0; }
      input, select { font-size: 16px !important; }
      .full-span { grid-column: 1 / -1; }
      code, .sim-line strong, .wit-head { overflow-wrap: anywhere; }
      .hud-subtitle { font-size: 10px; }

      .trust-row { align-items: flex-start; gap: 12px; flex-wrap: wrap; }
      .trust-row code, .trust-row a { max-width: 100%; }
      .mochi-stage-layer { pointer-events: none; }
      .spatial-hud { height: auto; min-height: 72px; gap: 8px; }
      .hud-brand { min-width: 0; }
      .hud-controls { gap: 6px; }
      .hud-pill-btn { padding: 9px; min-height: 44px; }
      .orbit-card-top { flex-wrap: wrap; gap: 6px; }
      input, select, button { max-width: 100%; }
      .mochi-rig, .mochi-halo, .mochi-sprite { filter: none !important; }
    }
    /* Responsive Mobile Media Query */
    @media (max-width: 860px) {
      .spatial-station {
        grid-template-columns: minmax(0, 1fr);
        padding: 60px 24px;
      }
      .spatial-hud {
        padding: 0 16px;
      }
      .hud-scroll-telemetry {
        display: none;
      }
      .mochi-stage-layer {
        perspective: none;
        top: auto; bottom: 0; left: auto; right: 6px; transform: none;
        width: 118px;
        height: 150px;
      }
      .mochi-rig { width: 118px; height: 118px; transform-style: flat; }
      .mochi-turntable { transform-style: flat; }
      .mochi-sprite { width: 118px; height: 118px; }
      .station-02 .station-title, .station-03 .station-title {
        font-size: 36px; line-height: 1.08; letter-spacing: -0.03em; max-width: none;
      }
      .station-lead, .station-desc { padding: 0; background: none; }
      .scene-light { inset: 0; }

      .metrics-grid, .trade-btn-group, .audit-detail-grid {
        grid-template-columns: minmax(0, 1fr);
      }
    }
  `;
  document.head.appendChild(style);
}
