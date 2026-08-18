/* ==========================================================
   サロン経営タイプ診断 — script.js
   MBTI風・4軸2択×8問 → 16タイプ診断
   ========================================================== */

/* ---------------------------------------------------------
   ▼ 運用設定（この2つだけ差し替えれば公開・運用できます）
   --------------------------------------------------------- */
const CONFIG = {
  // LINE公式アカウントの「友だち追加」リンク（流入経路トラッキング用パラメータ付き）
  LINE_ADD_FRIEND_URL: "https://lin.ee/REPLACE_ME",

  // 簡易ログ用 Google Apps Script Web App の URL（apps-script/Code.gs参照）
  // 空文字のままなら送信をスキップします（未設定でもアプリは正常動作します）
  LOG_ENDPOINT: "",
};

/* ---------------------------------------------------------
   ▼ 4つの特性軸（各2極）
   軸の切り口は Chat21 統合ランキングの根拠となった3社リサーチの
   経営課題カテゴリ（集客・リピート・利益率・業務効率）を、
   「良い/悪い」ではなく「タイプの違い」として再構成したもの。
   --------------------------------------------------------- */
const AXES = [
  {
    id: "axis1",
    label: "集客スタイル",
    poleA: {
      code: "G", emoji: "🧲", label: "新規開拓型",
      trait: "新しい出会いにワクワクする",
      strength: "新規のお客様を惹きつける発信力",
      tip: "SNS・LINE配信をテンプレ化すると、もっと広く届けられます",
    },
    poleB: {
      code: "E", emoji: "🤝", label: "常連育成型",
      trait: "常連さんとの関係を大切にする",
      strength: "また来たくなる信頼関係づくり",
      tip: "来店後フォローのタイミングを型化すると、さらに定着率が上がります",
    },
  },
  {
    id: "axis2",
    label: "価値提供スタイル",
    poleA: {
      code: "P", emoji: "💎", label: "単価特化型",
      trait: "特別な価値をじっくり届ける",
      strength: "納得感のある高単価メニュー力",
      tip: "原価・時間を踏まえた価格設計を見直すと、自信がさらに裏付けられます",
    },
    poleB: {
      code: "V", emoji: "⚡", label: "回転重視型",
      trait: "効率よく多くの人に届ける",
      strength: "回転率を活かした安定経営力",
      tip: "店販・オプション提案を1つ足すと、客単価をさらに底上げできます",
    },
  },
  {
    id: "axis3",
    label: "運営体制スタイル",
    poleA: {
      code: "S", emoji: "🧵", label: "一人型",
      trait: "すべて自分の目で見て動く",
      strength: "隅々まで行き届いた丁寧な運営",
      tip: "事務作業を整理すると、自分の時間をもっと確保できます",
    },
    poleB: {
      code: "T", emoji: "🌳", label: "チーム型",
      trait: "仲間と一緒にサロンを育てる",
      strength: "人を活かして拡げていく力",
      tip: "採用・教育の基準を言語化すると、任せる範囲がさらに広がります",
    },
  },
  {
    id: "axis4",
    label: "意思決定スタイル",
    poleA: {
      code: "I", emoji: "🔮", label: "感覚型",
      trait: "経験と勘で最適解を選ぶ",
      strength: "お客様の空気を読む対応力",
      tip: "感覚を数字で裏付けると、判断の説得力がさらに増します",
    },
    poleB: {
      code: "D", emoji: "📐", label: "データ型",
      trait: "数字を見てから判断する",
      strength: "再現性のある堅実な意思決定力",
      tip: "データに勘の要素も少し足すと、打ち手の幅がさらに広がります",
    },
  },
];

/* ---------------------------------------------------------
   ▼ 設問（各軸2問・計8問）。表示順は軸をまたいでインターリーブ。
   --------------------------------------------------------- */
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

/* ---------------------------------------------------------
   ▼ 16タイプ定義（4軸の組み合わせ = 2^4）
   --------------------------------------------------------- */
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
  answers: {}, // { q1: "A" | "N" | "B", ... }
};

const progressWrap = document.getElementById("progressWrap");
const progressFill = document.getElementById("progressFill");
const progressLabel = document.getElementById("progressLabel");

function showScreen(id) {
  document.querySelectorAll("[data-screen]").forEach((s) => (s.hidden = s.id !== id));
}

/* ---------------------------------------------------------
   ▼ URLパラメータで直接タイプ結果を表示（シェア・リサーチ用）
   例: index.html?type=GPSI
   --------------------------------------------------------- */
const urlType = new URLSearchParams(location.search).get("type");
if (urlType && TYPE_META[urlType.toUpperCase()]) {
  const code = urlType.toUpperCase();
  renderResultFromCode(code, axisPercentsFromCode(code));
  showScreen("screen-result");
} else {
  showScreen("screen-intro");
}

function axisPercentsFromCode(code) {
  // 直接リンクで開いた場合は、そのタイプらしい代表値（78%）を仮表示する
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
  history.replaceState(null, "", location.pathname);
  showScreen("screen-intro");
  progressWrap.hidden = true;
});

/* ---------------------------------------------------------
   ▼ 質問レンダリング（MBTI風・二択カード＋中間選択）
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
      finishQuestions();
    }
  }, 260);
}

/* ---------------------------------------------------------
   ▼ 集計 → 結果表示
   --------------------------------------------------------- */
function finishQuestions() {
  progressFill.style.width = "100%";
  showScreen("screen-loading");
  logResponses(state.answers);

  setTimeout(() => {
    const { code, percents } = computeResult();
    renderResultFromCode(code, percents);
    progressWrap.hidden = true;
    history.replaceState(null, "", `?type=${code}`);
    showScreen("screen-result");
  }, 750);
}

/**
 * 各軸2問の回答（A=0 / N=50 / B=100）を平均し、
 * 50%以上ならpoleB、未満ならpoleAを採用してタイプコードを生成する。
 */
function computeResult() {
  const percents = AXES.map((axis, axisIndex) => {
    const qs = QUESTIONS.filter((q) => q.axis === axisIndex);
    const vals = qs.map((q) => ({ A: 0, N: 50, B: 100 }[state.answers[q.id] ?? "N"]));
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
    return avg; // 0〜100（poleB寄りほど高い）
  });

  const code = AXES.map((axis, i) => (percents[i] >= 50 ? axis.poleB.code : axis.poleA.code)).join("");
  return { code, percents };
}

function renderResultFromCode(code, percents) {
  const meta = TYPE_META[code];

  document.getElementById("resultMascot").textContent = meta.mascot;
  document.getElementById("typeCode").textContent = code;
  document.getElementById("resultTitle").textContent = meta.name;
  document.getElementById("resultCatch").textContent = meta.catch;
  document.getElementById("ctaTitle").innerHTML = `${code}タイプ向けの<br>経営アクションBOOKを無料プレゼント`;

  // 各軸で「勝った極」の情報（強み・確信度）を組み立てる
  const won = AXES.map((axis, i) => {
    const pB = percents[i];
    const isB = pB >= 50;
    const pole = isB ? axis.poleB : axis.poleA;
    const confidence = isB ? pB : 100 - pB; // 50〜100
    return { axis, pole, confidence, isB, index: i };
  });

  // レーダーチャート：各軸で「勝った極」への確信度（50〜100）を描画
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

  // 軸ごとの割合バー（二極の割合を可視化）
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

  // いちばん際立つ個性（最も確信度が高い軸）
  const standout = won.reduce((a, b) => (a.confidence >= b.confidence ? a : b));
  document.getElementById("standoutEmoji").textContent = standout.pole.emoji;
  document.getElementById("standoutLabel").textContent = standout.pole.label;
  document.getElementById("standoutPct").textContent = `${Math.round(standout.confidence)}%`;

  // 伸ばすとさらに強くなる視点（最も確信度が低い＝拮抗している軸のヒント）
  const balancedAxis = won.reduce((a, b) => (a.confidence <= b.confidence ? a : b));
  document.getElementById("tipText").textContent = balancedAxis.pole.tip;

  // LINEボタン（タイプコードをタグとして付与）
  const lineBtn = document.getElementById("lineBtn");
  const url = new URL(CONFIG.LINE_ADD_FRIEND_URL, location.href);
  url.searchParams.set("shindan_type", code);
  lineBtn.href = url.toString();
}

/* ---------------------------------------------------------
   ▼ 結果シェア（URLに ?type=コード を付与してコピー）
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
   ▼ レーダーチャート描画（Canvas、外部ライブラリ不使用）
   軸ごとに「勝った極」への確信度（50〜100）をプロットする
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

  // グリッド
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

  // 軸線
  for (let i = 0; i < axesCount; i++) {
    const [x, y] = pointFor(i, 1);
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(x, y);
    ctx.stroke();
  }

  // データ多角形（確信度50〜100を0.35〜1.0の半径比に正規化）
  const accent = rootStyles.getPropertyValue("--accent").trim() || "#7c3550";
  ctx.beginPath();
  won.forEach((w, i) => {
    const norm = 0.3 + ((w.confidence - 50) / 50) * 0.7; // 50%→0.3, 100%→1.0
    const [x, y] = pointFor(i, norm);
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.closePath();
  ctx.fillStyle = hexWithAlpha(accent, 0.18);
  ctx.fill();
  ctx.strokeStyle = accent;
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // データ点
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

  // ラベル（勝った極の絵文字＋%）
  ctx.font = "13px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  won.forEach((w, i) => {
    const [ex, ey] = pointFor(i, 1.2);
    ctx.font = "20px sans-serif";
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
   ▼ 簡易ログ送信（任意・匿名集計用／リサーチ活用向け）
   apps-script/Code.gs をデプロイしてURLを CONFIG.LOG_ENDPOINT に
   設定すると、8問の回答と算出タイプをGoogleスプレッドシートへ
   自動記録します（個人情報は取得しません）。未設定ならスキップ。
   --------------------------------------------------------- */
function logResponses(answers) {
  if (!CONFIG.LOG_ENDPOINT) return;

  const { code, percents } = computeResult();

  const payload = {
    ts: new Date().toISOString(),
    type: code,
    axis1_pct: Math.round(percents[0]),
    axis2_pct: Math.round(percents[1]),
    axis3_pct: Math.round(percents[2]),
    axis4_pct: Math.round(percents[3]),
    ...answers,
  };

  fetch(CONFIG.LOG_ENDPOINT, {
    method: "POST",
    mode: "no-cors",
    headers: { "Content-Type": "text/plain" },
    body: JSON.stringify(payload),
  }).catch(() => {
    /* ログ送信の失敗は診断体験に影響させない */
  });
}
