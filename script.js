/* ==========================================================
   サロン経営タイプ診断 — script.js
   MBTI風・4軸2択×8問 ＋ 実データ分析（HP/ホットペッパー/Instagram）
   ＋ LINE友だちゲート（LIFF）
   ========================================================== */

/* ---------------------------------------------------------
   ▼ 運用設定（この3つを差し替えれば公開・運用できます）
   --------------------------------------------------------- */
const CONFIG = {
  // LINE公式アカウントの「友だち追加」リンク
  LINE_ADD_FRIEND_URL: "https://lin.ee/REPLACE_ME",

  // LIFF ID（LINE Developersコンソールで発行）。
  // 空文字のままなら「友だちゲート」自体をスキップし、誰でも診断できる状態で動作します
  // （開発・テスト用のフェイルオープン挙動）。
  LIFF_ID: "",

  // バックエンド用 Google Apps Script Web App の URL（apps-script/Code.gs参照）
  // ログ記録・URL分析の両方に使う。空文字のままなら該当機能はスキップされます。
  API_ENDPOINT: "",
};

/* ---------------------------------------------------------
   ▼ 4つの特性軸（各2極）
   --------------------------------------------------------- */
const AXES = [
  {
    id: "axis1", label: "集客スタイル",
    poleA: { code: "G", emoji: "🧲", label: "新規開拓型", trait: "新しい出会いにワクワクする",
      strength: "新規のお客様を惹きつける発信力", tip: "SNS・LINE配信をテンプレ化すると、もっと広く届けられます" },
    poleB: { code: "E", emoji: "🤝", label: "常連育成型", trait: "常連さんとの関係を大切にする",
      strength: "また来たくなる信頼関係づくり", tip: "来店後フォローのタイミングを型化すると、さらに定着率が上がります" },
  },
  {
    id: "axis2", label: "価値提供スタイル",
    poleA: { code: "P", emoji: "💎", label: "単価特化型", trait: "特別な価値をじっくり届ける",
      strength: "納得感のある高単価メニュー力", tip: "原価・時間を踏まえた価格設計を見直すと、自信がさらに裏付けられます" },
    poleB: { code: "V", emoji: "⚡", label: "回転重視型", trait: "効率よく多くの人に届ける",
      strength: "回転率を活かした安定経営力", tip: "店販・オプション提案を1つ足すと、客単価をさらに底上げできます" },
  },
  {
    id: "axis3", label: "運営体制スタイル",
    poleA: { code: "S", emoji: "🧵", label: "一人型", trait: "すべて自分の目で見て動く",
      strength: "隅々まで行き届いた丁寧な運営", tip: "事務作業を整理すると、自分の時間をもっと確保できます" },
    poleB: { code: "T", emoji: "🌳", label: "チーム型", trait: "仲間と一緒にサロンを育てる",
      strength: "人を活かして拡げていく力", tip: "採用・教育の基準を言語化すると、任せる範囲がさらに広がります" },
  },
  {
    id: "axis4", label: "意思決定スタイル",
    poleA: { code: "I", emoji: "🔮", label: "感覚型", trait: "経験と勘で最適解を選ぶ",
      strength: "お客様の空気を読む対応力", tip: "感覚を数字で裏付けると、判断の説得力がさらに増します" },
    poleB: { code: "D", emoji: "📐", label: "データ型", trait: "数字を見てから判断する",
      strength: "再現性のある堅実な意思決定力", tip: "データに勘の要素も少し足すと、打ち手の幅がさらに広がります" },
  },
];

const QUESTIONS = [
  { id: "q1", axis: 0, a: "新しいお客様との出会いにワクワクする", b: "常連さんとの深い関係作りにやりがいを感じる" },
  { id: "q2", axis: 1, a: "じっくり時間をかけた特別な施術に自信がある", b: "効率よく多くの人に施術するのが得意" },
  { id: "q3", axis: 2, a: "すべて自分の目が届く範囲でやりたい", b: "人に任せてサロンを大きくしたい" },
  { id: "q4", axis: 3, a: "経験と勘で決めることが多い", b: "数字やデータを見て決めることが多い" },
  { id: "q5", axis: 0, a: "空いた時間があれば新規向けの発信をしたい", b: "空いた時間があれば既存客のフォローをしたい" },
  { id: "q6", axis: 1, a: "価格は高くても納得してもらえる価値を作りたい", b: "適正価格で回転数を増やしたい" },
  { id: "q7", axis: 2, a: "一人で完結する方が気楽", b: "仲間と一緒に作る方が楽しい" },
  { id: "q8", axis: 3, a: "お客様の反応を見ながら柔軟に変える", b: "計画を立てたら淡々と実行する" },
];

const TYPE_META = {
  GPSI: { mascot: "🦉", name: "こだわり職人型", catch: "新規のお客様に、自分だけの特別な一品を届ける" },
  GPSD: { mascot: "🦊", name: "戦略職人型", catch: "データに裏付けられた特別メニューで新規を掴む" },
  GPTI: { mascot: "🔥", name: "情熱ブランド型", catch: "チームの熱量で唯一無二の体験をつくる" },
  GPTD: { mascot: "💎", name: "プロデューサー型", catch: "数字と仲間の力でブランドを設計する" },
  GVSI: { mascot: "🐝", name: "フットワーク職人型", catch: "新しい出会いを求めて軽やかに動き回る" },
  GVSD: { mascot: "🛠️", name: "効率職人型", catch: "仕組みと数字で新規対応をまわしきる" },
  GVTI: { mascot: "🌸", name: "ムードメーカー型", catch: "チームの明るさで新規客をどんどん呼び込む" },
  GVTD: { mascot: "⭐", name: "急成長リーダー型", catch: "データとチーム力でサロンを勢いよく拡げる" },
  EPSI: { mascot: "🌙", name: "隠れ家の匠型", catch: "常連だけが知る、特別な時間を紡ぐ" },
  EPSD: { mascot: "🎨", name: "ブランド職人型", catch: "数字に裏付けられた自分だけの世界観を育てる" },
  EPTI: { mascot: "🦋", name: "おもてなしブランド型", catch: "チームの心遣いで唯一無二の常連体験を" },
  EPTD: { mascot: "🧭", name: "サロン経営家型", catch: "常連との絆とデータでブランドを経営する" },
  EVSI: { mascot: "🍃", name: "町の人気者型", catch: "気さくな人柄でご近所に愛される" },
  EVSD: { mascot: "🌊", name: "堅実職人型", catch: "数字で裏付けた安定運営で信頼を積み重ねる" },
  EVTI: { mascot: "🎯", name: "ファミリーサロン型", catch: "チームの温かさで居心地の良い場所をつくる" },
  EVTD: { mascot: "🌟", name: "安定成長リーダー型", catch: "データとチームで着実にサロンを育てる" },
};

/* ---------------------------------------------------------
   ▼ 状態管理
   --------------------------------------------------------- */
const state = {
  index: 0,
  answers: {},
  webData: { hp: null, hpb: null, insta: null },
  usedWebData: false,
};

const progressWrap = document.getElementById("progressWrap");
const progressFill = document.getElementById("progressFill");
const progressLabel = document.getElementById("progressLabel");

function showScreen(id) {
  document.querySelectorAll("[data-screen]").forEach((s) => (s.hidden = s.id !== id));
}

/* ---------------------------------------------------------
   ▼ 起動シーケンス：LINE友だちゲート → 直リンク結果 or イントロ
   --------------------------------------------------------- */
(async function boot() {
  const urlType = new URLSearchParams(location.search).get("type");
  if (urlType && TYPE_META[urlType.toUpperCase()]) {
    const code = urlType.toUpperCase();
    renderResultFromCode(code, axisPercentsFromCode(code), null);
    showScreen("screen-result");
    return;
  }

  const passedGate = await checkLiffFriendship();
  showScreen(passedGate ? "screen-intro" : "screen-gate");
})();

/**
 * LIFF未設定の場合は常にtrue（フェイルオープン）。
 * 設定済みでLIFF初期化・友だち判定に失敗した場合もtrue（診断自体は使えるようにする）。
 */
async function checkLiffFriendship() {
  const lineUrl = new URL(CONFIG.LINE_ADD_FRIEND_URL, location.href).toString();
  document.getElementById("gateLineBtn").href = lineUrl;

  if (!CONFIG.LIFF_ID || typeof liff === "undefined") return true;

  try {
    await liff.init({ liffId: CONFIG.LIFF_ID });

    if (!liff.isLoggedIn()) {
      liff.login({ redirectUri: location.href });
      return false; // ログイン画面へ遷移するため、ここでは表示しない
    }

    try {
      const friendship = await liff.getFriendship();
      return !!friendship.friendFlag;
    } catch (err) {
      return true; // 友だち判定APIが使えない環境（LINE外ブラウザ等）ではフェイルオープン
    }
  } catch (err) {
    return true;
  }
}

document.getElementById("gateRecheckBtn").addEventListener("click", async () => {
  const passed = await checkLiffFriendship();
  showScreen(passed ? "screen-intro" : "screen-gate");
});

/* ---------------------------------------------------------
   ▼ URLパラメータ直リンク用ヘルパー
   --------------------------------------------------------- */
function axisPercentsFromCode(code) {
  return AXES.map((axis, i) => (code[i] === axis.poleB.code ? 78 : 22));
}

/* ---------------------------------------------------------
   ▼ イントロ → 質問開始
   --------------------------------------------------------- */
document.getElementById("startBtn").addEventListener("click", () => {
  state.index = 0;
  state.answers = {};
  progressWrap.hidden = false;
  renderQuestion();
  showScreen("screen-question");
});

document.getElementById("backBtn").addEventListener("click", () => {
  if (state.index === 0) {
    progressWrap.hidden = true;
    showScreen("screen-intro");
    return;
  }
  state.index -= 1;
  renderQuestion();
});

document.getElementById("retryBtn").addEventListener("click", () => {
  state.index = 0;
  state.answers = {};
  state.webData = { hp: null, hpb: null, insta: null };
  state.usedWebData = false;
  ["hpUrlInput", "hpbUrlInput", "instaUrlInput"].forEach((id) => (document.getElementById(id).value = ""));
  history.replaceState(null, "", location.pathname);
  showScreen("screen-intro");
  progressWrap.hidden = true;
});

/* ---------------------------------------------------------
   ▼ 質問レンダリング
   --------------------------------------------------------- */
function renderQuestion() {
  const q = QUESTIONS[state.index];
  const axis = AXES[q.axis];

  progressFill.style.width = `${(state.index / QUESTIONS.length) * 100}%`;
  progressLabel.textContent = `${state.index + 1} / ${QUESTIONS.length}`;

  document.getElementById("qAxis").textContent = axis.label;
  document.getElementById("choiceAEmoji").textContent = axis.poleA.emoji;
  document.getElementById("choiceAText").textContent = q.a;
  document.getElementById("choiceBEmoji").textContent = axis.poleB.emoji;
  document.getElementById("choiceBText").textContent = q.b;

  ["choiceA", "choiceB", "choiceN"].forEach((id) => document.getElementById(id).classList.remove("selected"));
  const current = state.answers[q.id];
  if (current === "A") document.getElementById("choiceA").classList.add("selected");
  if (current === "B") document.getElementById("choiceB").classList.add("selected");
  if (current === "N") document.getElementById("choiceN").classList.add("selected");
}

document.getElementById("choiceA").addEventListener("click", () => selectAnswer("A"));
document.getElementById("choiceB").addEventListener("click", () => selectAnswer("B"));
document.getElementById("choiceN").addEventListener("click", () => selectAnswer("N"));

function selectAnswer(value) {
  const q = QUESTIONS[state.index];
  state.answers[q.id] = value;

  const map = { A: "choiceA", B: "choiceB", N: "choiceN" };
  ["choiceA", "choiceB", "choiceN"].forEach((id) => document.getElementById(id).classList.remove("selected"));
  document.getElementById(map[value]).classList.add("selected");

  setTimeout(() => {
    if (state.index < QUESTIONS.length - 1) {
      state.index += 1;
      renderQuestion();
    } else {
      progressFill.style.width = "100%";
      progressWrap.hidden = true;
      showScreen("screen-urlinput");
    }
  }, 260);
}

/* ---------------------------------------------------------
   ▼ URL入力 → 分析 → 結果
   --------------------------------------------------------- */
document.getElementById("analyzeBtn").addEventListener("click", () => runAnalysisAndShowResult(true));
document.getElementById("skipUrlBtn").addEventListener("click", () => runAnalysisAndShowResult(false));

async function runAnalysisAndShowResult(withAnalysis) {
  const hpUrl = document.getElementById("hpUrlInput").value.trim();
  const hpbUrl = document.getElementById("hpbUrlInput").value.trim();
  const instaUrl = document.getElementById("instaUrlInput").value.trim();
  const hasAnyUrl = withAnalysis && (hpUrl || hpbUrl || instaUrl);

  showScreen("screen-loading");
  document.getElementById("loadingText").textContent = hasAnyUrl
    ? "サロンの情報を分析中…"
    : "16タイプの中から診断中…";

  if (hasAnyUrl && CONFIG.API_ENDPOINT) {
    state.webData = await analyzeUrls({ hp_url: hpUrl, hpb_url: hpbUrl, insta_url: instaUrl });
    state.usedWebData = !!(state.webData.hp || state.webData.hpb || state.webData.insta);
  }

  const { code, percents } = computeResult();
  logResponses(code, percents);

  setTimeout(() => {
    renderResultFromCode(code, percents, state.webData);
    history.replaceState(null, "", `?type=${code}`);
    showScreen("screen-result");
  }, hasAnyUrl ? 300 : 700);
}

async function analyzeUrls(payload) {
  try {
    const res = await fetch(CONFIG.API_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({ action: "analyze", ...payload }),
    });
    if (!res.ok) return { hp: null, hpb: null, insta: null };
    return await res.json();
  } catch (err) {
    return { hp: null, hpb: null, insta: null };
  }
}

/* ---------------------------------------------------------
   ▼ 集計（クイズ回答 → 軸%） ＋ 実データによる補正
   --------------------------------------------------------- */
function computeResult() {
  const rawPercents = AXES.map((axis, axisIndex) => {
    const qs = QUESTIONS.filter((q) => q.axis === axisIndex);
    const vals = qs.map((q) => ({ A: 0, N: 50, B: 100 }[state.answers[q.id] ?? "N"]));
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  });

  const percents = applyWebDataNudge(rawPercents, state.webData);
  const code = AXES.map((axis, i) => (percents[i] >= 50 ? axis.poleB.code : axis.poleA.code)).join("");
  return { code, percents };
}

/**
 * 実データの簡易シグナルで軸%を補正する（最大±8pt程度の穏やかな補正）。
 * 取得できなかった項目は補正なし。
 */
function applyWebDataNudge(percents, webData) {
  const next = [...percents];
  if (!webData) return next;

  // 軸1（集客: G新規開拓 ⇄ E常連育成）— Instagramフォロワー数が多いほど新規開拓力の証left寄り
  if (webData.insta && typeof webData.insta.followers === "number") {
    if (webData.insta.followers >= 1000) next[0] -= 8;
    else if (webData.insta.followers < 100) next[0] += 4;
  }

  // 軸2（価値提供: P単価特化 ⇄ V回転重視）— ホットペッパーの価格帯・口コミ件数から推定
  if (webData.hpb) {
    if (typeof webData.hpb.priceMax === "number") {
      if (webData.hpb.priceMax >= 15000) next[1] -= 8;
      else if (webData.hpb.priceMax <= 6000) next[1] += 8;
    }
    if (typeof webData.hpb.reviewCount === "number" && webData.hpb.reviewCount >= 200) {
      next[1] += 5;
    }
  }

  // 軸3（運営体制: S一人 ⇄ Tチーム）— メニュー数が多いほどチーム運営の可能性
  if (webData.hpb && typeof webData.hpb.menuCount === "number" && webData.hpb.menuCount >= 20) {
    next[2] += 6;
  }

  return next.map((v) => Math.max(0, Math.min(100, v)));
}

/* ---------------------------------------------------------
   ▼ 結果レンダリング
   --------------------------------------------------------- */
function renderResultFromCode(code, percents, webData) {
  const meta = TYPE_META[code];

  document.getElementById("resultMascot").textContent = meta.mascot;
  document.getElementById("typeCode").textContent = code;
  document.getElementById("resultTitle").textContent = meta.name;
  document.getElementById("resultCatch").textContent = meta.catch;

  const won = AXES.map((axis, i) => {
    const pB = percents[i];
    const isB = pB >= 50;
    const pole = isB ? axis.poleB : axis.poleA;
    const confidence = isB ? pB : 100 - pB;
    return { axis, pole, confidence, isB, index: i };
  });

  // バッジのリング（最も際立つ軸の確信度をゲージ表示）
  const standout = won.reduce((a, b) => (a.confidence >= b.confidence ? a : b));
  const ringPct = Math.round(standout.confidence);
  document.getElementById("resultBadgeRing").style.setProperty("--ring-pct", `${ringPct}%`);

  document.getElementById("standoutEmoji").textContent = standout.pole.emoji;
  document.getElementById("standoutLabel").textContent = standout.pole.label;
  document.getElementById("standoutPct").textContent = `${ringPct}%`;

  drawRadar(won);

  // 強み一覧
  const strengthList = document.getElementById("strengthList");
  strengthList.innerHTML = "";
  won.forEach((w) => {
    const row = document.createElement("div");
    row.className = "strength-row";
    row.innerHTML = `<span class="strength-emoji">${w.pole.emoji}</span><span class="strength-text">${w.pole.strength}</span>`;
    strengthList.appendChild(row);
  });

  // 軸ごとの割合バー
  const axisBars = document.getElementById("axisBars");
  axisBars.innerHTML = "";
  AXES.forEach((axis, i) => {
    const pB = Math.round(percents[i]);
    const pA = 100 - pB;
    const bar = document.createElement("div");
    bar.className = "axis-bar";
    bar.innerHTML = `
      <div class="axis-bar-label">
        <span>${axis.poleA.emoji} ${axis.poleA.label} <b>${pA}%</b></span>
        <span><b>${pB}%</b> ${axis.poleB.label} ${axis.poleB.emoji}</span>
      </div>
      <div class="axis-bar-track">
        <div class="axis-bar-fill-a" style="width:${pA}%"></div>
        <div class="axis-bar-fill-b" style="width:${pB}%"></div>
      </div>
    `;
    axisBars.appendChild(bar);
  });

  // 伸ばすとさらに強くなる視点
  const balancedAxis = won.reduce((a, b) => (a.confidence <= b.confidence ? a : b));
  document.getElementById("tipText").textContent = balancedAxis.pole.tip;

  // 実データ分析パネル
  renderDataPanel(webData);

  // ホワイトペーパーリンクにタイプコードを付与
  const wpBtn = document.getElementById("whitepaperBtn");
  wpBtn.href = `whitepaper.html?type=${code}`;
}

function renderDataPanel(webData) {
  const panel = document.getElementById("dataPanel");
  const grid = document.getElementById("dataGrid");
  grid.innerHTML = "";

  if (!webData || (!webData.hp && !webData.hpb && !webData.insta)) {
    panel.hidden = true;
    return;
  }
  panel.hidden = false;

  const tiles = [];

  if (webData.hpb) {
    tiles.push(tile("📝", "口コミ件数", webData.hpb.reviewCount != null ? `${webData.hpb.reviewCount.toLocaleString()}件` : null));
    tiles.push(tile("⭐", "評価点", webData.hpb.rating != null ? webData.hpb.rating.toFixed(1) : null));
    tiles.push(tile("💴", "価格帯", (webData.hpb.priceMin && webData.hpb.priceMax) ? `¥${webData.hpb.priceMin.toLocaleString()}〜${webData.hpb.priceMax.toLocaleString()}` : null));
    tiles.push(tile("📋", "掲載メニュー数", webData.hpb.menuCount != null ? `${webData.hpb.menuCount}件` : null));
  }
  if (webData.insta) {
    tiles.push(tile("📷", "フォロワー数", webData.insta.followers != null ? webData.insta.followers.toLocaleString() : null));
  }
  if (webData.hp) {
    tiles.push(tile("🌐", "WEB発信力", webData.hp.hasBlog || webData.hp.hasSns ? "発信あり" : "発信少なめ"));
  }

  tiles.forEach((t) => grid.appendChild(t));
}

function tile(emoji, label, value) {
  const el = document.createElement("div");
  el.className = "data-tile";
  el.innerHTML = value
    ? `<span class="data-tile-emoji">${emoji}</span><span class="data-tile-value">${value}</span><span class="data-tile-label">${label}</span>`
    : `<span class="data-tile-emoji">${emoji}</span><span class="data-tile-value data-tile-empty">—</span><span class="data-tile-label">${label}（取得不可）</span>`;
  return el;
}

/* ---------------------------------------------------------
   ▼ 結果シェア
   --------------------------------------------------------- */
document.getElementById("shareBtn").addEventListener("click", async () => {
  const shareUrl = location.href;
  const btn = document.getElementById("shareBtn");
  try {
    await navigator.clipboard.writeText(shareUrl);
    const original = btn.textContent;
    btn.textContent = "✅ コピーしました";
    setTimeout(() => (btn.textContent = original), 1800);
  } catch (err) {
    window.prompt("このURLをコピーしてシェアしてください", shareUrl);
  }
});

/* ---------------------------------------------------------
   ▼ レーダーチャート描画
   --------------------------------------------------------- */
function drawRadar(won) {
  const canvas = document.getElementById("radarChart");
  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  const size = 320;
  canvas.width = size * dpr;
  canvas.height = size * dpr;
  canvas.style.width = "100%";
  canvas.style.height = "auto";
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, size, size);

  const cx = size / 2;
  const cy = size / 2;
  const radius = 108;
  const axesCount = won.length;
  const angleStep = (Math.PI * 2) / axesCount;
  const rootStyles = getComputedStyle(document.documentElement);

  function pointFor(i, value01) {
    const angle = -Math.PI / 2 + i * angleStep;
    const r = radius * value01;
    return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)];
  }

  ctx.strokeStyle = rootStyles.getPropertyValue("--line").trim() || "#ddd";
  ctx.lineWidth = 1;
  for (let ring = 1; ring <= 4; ring++) {
    ctx.beginPath();
    for (let i = 0; i < axesCount; i++) {
      const [x, y] = pointFor(i, ring / 4);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.stroke();
  }

  for (let i = 0; i < axesCount; i++) {
    const [x, y] = pointFor(i, 1);
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(x, y);
    ctx.stroke();
  }

  const accent = rootStyles.getPropertyValue("--accent").trim() || "#7c3550";
  const gradient = ctx.createRadialGradient(cx, cy, 10, cx, cy, radius);
  gradient.addColorStop(0, hexWithAlpha(accent, 0.35));
  gradient.addColorStop(1, hexWithAlpha(accent, 0.08));

  ctx.beginPath();
  won.forEach((w, i) => {
    const norm = 0.3 + ((w.confidence - 50) / 50) * 0.7;
    const [x, y] = pointFor(i, norm);
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.closePath();
  ctx.fillStyle = gradient;
  ctx.fill();
  ctx.strokeStyle = accent;
  ctx.lineWidth = 2.5;
  ctx.stroke();

  won.forEach((w, i) => {
    const norm = 0.3 + ((w.confidence - 50) / 50) * 0.7;
    const [x, y] = pointFor(i, norm);
    ctx.beginPath();
    ctx.arc(x, y, 4.5, 0, Math.PI * 2);
    ctx.fillStyle = accent;
    ctx.fill();
    ctx.strokeStyle = rootStyles.getPropertyValue("--surface").trim() || "#fff";
    ctx.lineWidth = 2;
    ctx.stroke();
  });

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  won.forEach((w, i) => {
    const [ex, ey] = pointFor(i, 1.2);
    ctx.font = "18px sans-serif";
    ctx.fillText(w.pole.emoji, ex, ey - 8);
    ctx.font = "700 11px sans-serif";
    ctx.fillStyle = rootStyles.getPropertyValue("--ink-soft").trim() || "#666";
    ctx.fillText(`${Math.round(w.confidence)}%`, ex, ey + 10);
  });
}

function hexWithAlpha(hexOrColor, alpha) {
  const div = document.createElement("div");
  div.style.color = hexOrColor;
  document.body.appendChild(div);
  const rgb = getComputedStyle(div).color;
  document.body.removeChild(div);
  const m = rgb.match(/\d+/g);
  if (!m) return `rgba(124,53,80,${alpha})`;
  return `rgba(${m[0]},${m[1]},${m[2]},${alpha})`;
}

/* ---------------------------------------------------------
   ▼ 簡易ログ送信（任意・匿名集計用）
   --------------------------------------------------------- */
function logResponses(code, percents) {
  if (!CONFIG.API_ENDPOINT) return;

  const payload = {
    action: "log",
    ts: new Date().toISOString(),
    type: code,
    axis1_pct: Math.round(percents[0]),
    axis2_pct: Math.round(percents[1]),
    axis3_pct: Math.round(percents[2]),
    axis4_pct: Math.round(percents[3]),
    used_web_data: state.usedWebData,
    ...state.answers,
  };

  fetch(CONFIG.API_ENDPOINT, {
    method: "POST",
    mode: "no-cors",
    headers: { "Content-Type": "text/plain" },
    body: JSON.stringify(payload),
  }).catch(() => {});
}
