/* ==========================================================
   サロン経営課題診断 — script.js
   ========================================================== */

/* ---------------------------------------------------------
   ▼ 運用設定（この2つだけ差し替えれば公開・運用できます）
   --------------------------------------------------------- */
const CONFIG = {
  // LINE公式アカウントの「友だち追加」リンク（流入経路トラッキング用パラメータ付き）
  // 例: https://lin.ee/xxxxxxx?tag=shindan
  LINE_ADD_FRIEND_URL: "https://lin.ee/REPLACE_ME",

  // 簡易ログ用 Google Apps Script Web App の URL（apps-script/Code.gs参照）
  // 空文字のままなら送信をスキップします（未設定でもアプリは正常動作します）
  LOG_ENDPOINT: "",
};

/* ---------------------------------------------------------
   ▼ 設問データ
   4カテゴリ × 2問 = 8問。各カテゴリの平均が最も低い
   （＝課題が大きい）ものを「診断タイプ」として提示する。
   質問文・カテゴリは Chat21 統合ランキングの根拠となった
   3社リサーチ（新規集客／リピート／利益率／業務効率）に基づく。
   --------------------------------------------------------- */
const QUESTIONS = [
  {
    id: "q1", type: "A", icon: "📣", cat: "新規集客",
    text: "ここ半年、新規のお客様の来店は安定していますか？",
  },
  {
    id: "q2", type: "A", icon: "📱", cat: "新規集客",
    text: "Instagram等での発信に、集客の手応えを感じていますか？",
  },
  {
    id: "q3", type: "B", icon: "💞", cat: "リピート",
    text: "一度来店したお客様の次回予約・リピート率に満足していますか？",
  },
  {
    id: "q4", type: "B", icon: "💌", cat: "リピート",
    text: "来店後のフォロー（LINE・DM等）で関係を深められていますか？",
  },
  {
    id: "q5", type: "C", icon: "💰", cat: "利益率",
    text: "原価・人件費を踏まえた価格設定に自信がありますか？",
  },
  {
    id: "q6", type: "C", icon: "🛍️", cat: "利益率",
    text: "店販・オプション提案で客単価を上げられていますか？",
  },
  {
    id: "q7", type: "D", icon: "⏱️", cat: "業務効率",
    text: "施術以外の事務作業（予約・経理・発注等）に追われていませんか？",
  },
  {
    id: "q8", type: "D", icon: "🧑‍🤝‍🧑", cat: "業務効率",
    text: "スタッフの採用・教育・定着はスムーズにできていますか？",
  },
];

/* q7・q8は「困りごと」を尋ねる逆転項目 → スコアを反転して合算する */
const REVERSED = new Set(["q7", "q8"]);

/* ---------------------------------------------------------
   ▼ 診断タイプ定義
   --------------------------------------------------------- */
const TYPES = {
  A: {
    key: "A", emoji: "📣", color: "var(--cat-a)",
    title: "新規集客\nブースト型",
    weakLabel: "新規集客",
    lead: "「知ってもらう」がいちばんの伸びしろです。",
    advice: [
      { emoji: "🎯", text: "SNS投稿・LINE配信のテンプレートを型化する", sub: "毎回ゼロから考える手間をなくす" },
      { emoji: "🧲", text: "初回来店のきっかけを1つに絞って強化する", sub: "広く浅くより、一点突破が効きやすい" },
      { emoji: "📊", text: "同規模サロンの集客成功事例を知る", sub: "詳細はLINE登録後にお届け" },
    ],
  },
  B: {
    key: "B", emoji: "💞", color: "var(--cat-b)",
    title: "リピート\n定着型",
    weakLabel: "リピート・顧客定着",
    lead: "「また来たくなる」仕組み作りが伸びしろです。",
    advice: [
      { emoji: "📅", text: "次回予約の声かけをその場で仕組み化する", sub: "会計時の一言を型化する" },
      { emoji: "💬", text: "来店後LINEフォローのタイミングを決める", sub: "3日後・3週間後など節目で接点を作る" },
      { emoji: "📊", text: "リピート率改善のテンプレートを知る", sub: "詳細はLINE登録後にお届け" },
    ],
  },
  C: {
    key: "C", emoji: "💰", color: "var(--cat-c)",
    title: "利益率\n改善型",
    weakLabel: "価格・利益率",
    lead: "「がんばりが利益に変わる」設計が伸びしろです。",
    advice: [
      { emoji: "🧮", text: "原価・時間コストを踏まえて価格を見直す", sub: "感覚ではなく数字で決める" },
      { emoji: "🛍️", text: "施術後の店販提案を1メニューだけ作る", sub: "「売り込み」ではなく「提案」の型を持つ" },
      { emoji: "📊", text: "客単価アップの実例テンプレートを知る", sub: "詳細はLINE登録後にお届け" },
    ],
  },
  D: {
    key: "D", emoji: "⏱️", color: "var(--cat-d)",
    title: "業務効率\n化型",
    weakLabel: "業務効率・体制",
    lead: "「自分の時間を取り戻す」仕組みが伸びしろです。",
    advice: [
      { emoji: "🗂️", text: "予約・経理の定型作業を最小限に整理する", sub: "毎日の判断コストを減らす" },
      { emoji: "🧑‍🏫", text: "採用・教育の基準を言語化しておく", sub: "属人化を防ぎ引き継ぎやすくする" },
      { emoji: "📊", text: "時短・効率化の実例テンプレートを知る", sub: "詳細はLINE登録後にお届け" },
    ],
  },
};

const TYPE_ORDER = ["A", "B", "C", "D"];

/* ---------------------------------------------------------
   ▼ 状態管理
   --------------------------------------------------------- */
const state = {
  index: 0,
  answers: {}, // { q1: 4, q2: 2, ... }
};

const els = {};
["screen-intro", "screen-question", "screen-loading", "screen-result"].forEach((id) => {
  els[id] = document.getElementById(id);
});

const progressWrap = document.getElementById("progressWrap");
const progressFill = document.getElementById("progressFill");
const progressLabel = document.getElementById("progressLabel");

function showScreen(id) {
  document.querySelectorAll("[data-screen]").forEach((s) => (s.hidden = s.id !== id));
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
  showScreen("screen-intro");
  progressWrap.hidden = true;
});

/* ---------------------------------------------------------
   ▼ 質問レンダリング
   --------------------------------------------------------- */
function renderQuestion() {
  const q = QUESTIONS[state.index];

  progressFill.style.width = `${((state.index) / QUESTIONS.length) * 100}%`;
  progressLabel.textContent = `${state.index + 1} / ${QUESTIONS.length}`;

  document.getElementById("qIcon").textContent = q.icon;
  document.getElementById("qCat").textContent = q.cat;
  document.getElementById("qText").textContent = q.text;

  const scaleEl = document.getElementById("qScale");
  scaleEl.innerHTML = "";
  for (let v = 1; v <= 5; v++) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "scale-btn";
    btn.dataset.v = String(v);
    btn.setAttribute("aria-label", `5段階中 ${v}`);
    btn.textContent = v;
    if (state.answers[q.id] === v) btn.classList.add("selected");
    btn.addEventListener("click", () => selectAnswer(q.id, v));
    scaleEl.appendChild(btn);
  }
}

function selectAnswer(qid, value) {
  state.answers[qid] = value;

  // 選択アニメーションのため一瞬待ってから次へ
  document.querySelectorAll(".scale-btn").forEach((b) => {
    b.classList.toggle("selected", Number(b.dataset.v) === value);
  });

  setTimeout(() => {
    if (state.index < QUESTIONS.length - 1) {
      state.index += 1;
      renderQuestion();
    } else {
      finishQuestions();
    }
  }, 220);
}

/* ---------------------------------------------------------
   ▼ 集計 → 結果表示
   --------------------------------------------------------- */
function finishQuestions() {
  progressFill.style.width = "100%";
  showScreen("screen-loading");
  logResponses(state.answers);

  setTimeout(() => {
    renderResult();
    progressWrap.hidden = true;
    showScreen("screen-result");
  }, 700);
}

function computeScores() {
  const sums = { A: 0, B: 0, C: 0, D: 0 };
  const counts = { A: 0, B: 0, C: 0, D: 0 };

  QUESTIONS.forEach((q) => {
    let v = state.answers[q.id] ?? 3;
    if (REVERSED.has(q.id)) v = 6 - v; // 困りごと系は反転
    sums[q.type] += v;
    counts[q.type] += 1;
  });

  const scores = {};
  TYPE_ORDER.forEach((k) => {
    scores[k] = sums[k] / counts[k]; // 1.0〜5.0（低いほど課題大）
  });
  return scores;
}

function renderResult() {
  const scores = computeScores();
  const weakestKey = TYPE_ORDER.reduce((a, b) => (scores[a] <= scores[b] ? a : b));
  const type = TYPES[weakestKey];

  document.getElementById("resultEmoji").textContent = type.emoji;
  document.getElementById("resultTitle").innerHTML = type.title.replace("\n", "<br>");
  document.getElementById("weakIcon").textContent = type.emoji;
  document.getElementById("weakValue").textContent = type.weakLabel;

  const adviceGrid = document.getElementById("adviceGrid");
  adviceGrid.innerHTML = "";
  type.advice.forEach((a, i) => {
    const card = document.createElement("div");
    card.className = "advice-card";
    card.innerHTML = `
      <div class="advice-num">${i + 1}</div>
      <div class="advice-emoji">${a.emoji}</div>
      <div>
        <div class="advice-text">${a.text}</div>
        <div class="advice-sub">${a.sub}</div>
      </div>
    `;
    adviceGrid.appendChild(card);
  });

  drawRadar(scores);

  const legend = document.getElementById("chartLegend");
  legend.innerHTML = "";
  TYPE_ORDER.forEach((k) => {
    const t = TYPES[k];
    const item = document.createElement("div");
    item.className = "legend-item";
    item.innerHTML = `
      <span class="legend-dot" style="background:${t.color}"></span>
      ${t.weakLabel}
      <span class="legend-score">${scores[k].toFixed(1)}</span>
    `;
    legend.appendChild(item);
  });

  const lineBtn = document.getElementById("lineBtn");
  const url = new URL(CONFIG.LINE_ADD_FRIEND_URL, location.href);
  url.searchParams.set("shindan_type", weakestKey);
  lineBtn.href = url.toString();
}

/* ---------------------------------------------------------
   ▼ レーダーチャート描画（Canvas、外部ライブラリ不使用）
   --------------------------------------------------------- */
function drawRadar(scores) {
  const canvas = document.getElementById("radarChart");
  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  const size = 320;
  canvas.width = size * dpr;
  canvas.height = size * dpr;
  canvas.style.width = "100%";
  canvas.style.height = "auto";
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, size, size);

  const cx = size / 2;
  const cy = size / 2;
  const radius = 110;
  const axes = TYPE_ORDER.length;
  const angleStep = (Math.PI * 2) / axes;
  const rootStyles = getComputedStyle(document.documentElement);

  function pointFor(i, value /* 0..1 */) {
    const angle = -Math.PI / 2 + i * angleStep;
    const r = radius * value;
    return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)];
  }

  // グリッド（同心5角形）
  ctx.strokeStyle = rootStyles.getPropertyValue("--line").trim() || "#ddd";
  ctx.lineWidth = 1;
  for (let ring = 1; ring <= 5; ring++) {
    ctx.beginPath();
    for (let i = 0; i < axes; i++) {
      const [x, y] = pointFor(i, ring / 5);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.stroke();
  }

  // 軸線
  for (let i = 0; i < axes; i++) {
    const [x, y] = pointFor(i, 1);
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(x, y);
    ctx.stroke();
  }

  // データ多角形
  const accent = rootStyles.getPropertyValue("--accent").trim() || "#7c3550";
  ctx.beginPath();
  TYPE_ORDER.forEach((k, i) => {
    const value = Math.max(scores[k], 0.4) / 5; // 最低表示値を確保
    const [x, y] = pointFor(i, value);
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.closePath();
  ctx.fillStyle = hexWithAlpha(accent, 0.18);
  ctx.fill();
  ctx.strokeStyle = accent;
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // データ点
  TYPE_ORDER.forEach((k, i) => {
    const value = Math.max(scores[k], 0.4) / 5;
    const [x, y] = pointFor(i, value);
    ctx.beginPath();
    ctx.arc(x, y, 4.5, 0, Math.PI * 2);
    ctx.fillStyle = TYPES[k].colorResolved || getResolvedColor(TYPES[k].color);
    ctx.fill();
    ctx.strokeStyle = rootStyles.getPropertyValue("--surface").trim() || "#fff";
    ctx.lineWidth = 2;
    ctx.stroke();
  });

  // ラベル（絵文字）
  ctx.font = "20px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  TYPE_ORDER.forEach((k, i) => {
    const [x, y] = pointFor(i, 1.22);
    ctx.fillText(TYPES[k].emoji, x, y);
  });
}

function getResolvedColor(cssVarExpr) {
  // "var(--cat-a)" のような文字列を実色に解決する
  const div = document.createElement("div");
  div.style.color = cssVarExpr;
  document.body.appendChild(div);
  const resolved = getComputedStyle(div).color;
  document.body.removeChild(div);
  return resolved;
}

function hexWithAlpha(hexOrColor, alpha) {
  const div = document.createElement("div");
  div.style.color = hexOrColor;
  document.body.appendChild(div);
  const rgb = getComputedStyle(div).color; // rgb(r, g, b)
  document.body.removeChild(div);
  const m = rgb.match(/\d+/g);
  if (!m) return `rgba(124,53,80,${alpha})`;
  return `rgba(${m[0]},${m[1]},${m[2]},${alpha})`;
}

/* ---------------------------------------------------------
   ▼ 簡易ログ送信（任意・匿名集計用）
   apps-script/Code.gs をデプロイしてURLを CONFIG.LOG_ENDPOINT に
   設定すると、回答スコアのみ（個人情報なし）をGoogleスプレッド
   シートへ自動記録します。未設定ならスキップされます。
   --------------------------------------------------------- */
function logResponses(answers) {
  if (!CONFIG.LOG_ENDPOINT) return;

  const payload = {
    ts: new Date().toISOString(),
    ...answers,
  };

  fetch(CONFIG.LOG_ENDPOINT, {
    method: "POST",
    mode: "no-cors", // GAS Web Appはno-corsで十分（レスポンス不要のため）
    headers: { "Content-Type": "text/plain" }, // preflightを避けるため text/plain で送信
    body: JSON.stringify(payload),
  }).catch(() => {
    /* ログ送信の失敗は診断体験に影響させない */
  });
}
