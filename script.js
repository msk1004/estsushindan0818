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

/* ---------------------------------------------------------
   ▼ 6タイプ診断（16Personalities方式のロールグループ構成を踏襲）
   4軸の実測%を、6つの代表的な経営タイプ「セントロイド」に
   最も近いものへ分類する（最近傍法）。
   --------------------------------------------------------- */
const GROUPS = {
  miseru: { name: "魅せる系", tagline: "新規開拓と拡散に強い", accent: "#c8672c", soft: "#f7e3d1" },
  fukameru: { name: "深める系", tagline: "関係性と世界観づくりに強い", accent: "#7c3550", soft: "#f4e3e9" },
  sasaeru: { name: "支える系", tagline: "仕組みと安定運営に強い", accent: "#2c6b74", soft: "#dcebec" },
};

const GROUPS_DARK = {
  miseru: { accent: "#e69257", soft: "#3a2a1c" },
  fukameru: { accent: "#e08aa6", soft: "#3a2530" },
  sasaeru: { accent: "#6fb9c2", soft: "#1e3236" },
};

const TYPES6 = {
  TC: {
    group: "miseru", mascot: "✨", name: "トレンドクリエイター型",
    catch: "話題を作り、勢いでサロンを広げるムードメーカー",
    vector: [20, 75, 70, 25], // [E%, V%, T%, D%]
    overview: [
      "新しい出会いをエネルギーに変えるタイプです。SNSや口コミの「今」の空気を読むのが得意で、思いついたらすぐ発信・すぐ実行。堅苦しい計画よりも、勢いと直感でサロンの認知を広げていきます。",
      "チームで動くときは、周りを巻き込むムードメーカーとして力を発揮します。ただし移り気な面もあり、始めたことを最後まで仕組み化するのはやや苦手かもしれません。",
    ],
    strengths: ["新規のお客様を惹きつける発信力", "トレンドを察知するアンテナの高さ", "周囲を巻き込むエネルギー", "変化への抵抗の少なさ"],
    cautions: ["常連さんへのフォローが後回しになりがち", "勢い任せで価格設計が曖昧になりやすい", "一つの施策を続ける忍耐がやや必要"],
    quote: "迷ったらまずやってみる、が合言葉。",
    compatible: "ST",
  },
  BP: {
    group: "miseru", mascot: "🎬", name: "ブランドプロデューサー型",
    catch: "データと世界観で、サロンをブランドに育てる",
    vector: [15, 25, 65, 75],
    overview: [
      "新しいお客様を「特別な体験」で惹きつけるタイプです。感覚だけでなく、データや世界観設計にもこだわり、サロン全体を一つのブランドとして育てていく視点を持っています。",
      "チームを率いて大きな絵を描くのが得意な一方、細かな日々のオペレーションは人に任せたいと感じることが多いでしょう。",
    ],
    strengths: ["高単価メニューを支えるブランド構築力", "データに基づいた新規開拓の戦略性", "チームを一つの方向へまとめる推進力", "長期的な視点での意思決定"],
    cautions: ["現場の細かい変化に気づきにくいことがある", "理想を追い求めすぎて完成が遅れがち", "スタッフとの温度差に注意"],
    quote: "良いものを、正しく届ける。を大切にする。",
    compatible: "HS",
  },
  AR: {
    group: "fukameru", mascot: "🎨", name: "匠のアーティスト型",
    catch: "一人で丁寧に、特別な世界観を届ける",
    vector: [80, 20, 20, 20],
    overview: [
      "一人で丁寧に、特別な価値を届けるタイプです。感覚を頼りに、お客様一人ひとりに向き合う時間を大切にします。常連さんとの深い信頼関係が、何よりの財産です。",
      "規模の拡大よりも、質を磨き続けることに喜びを感じるタイプ。効率を求められる場面ではペースを乱されやすいかもしれません。",
    ],
    strengths: ["納得感のある高単価メニュー力", "一人ひとりに向き合う丁寧な対応", "隅々まで行き届いた運営の質", "独自の世界観・技術への強いこだわり"],
    cautions: ["新規集客の発信は後回しになりがち", "一人で抱え込みすぎることがある", "忙しくなると質が下がることへの不安"],
    quote: "量より質、を貫く職人気質。",
    compatible: "SL",
  },
  HS: {
    group: "fukameru", mascot: "🍵", name: "おもてなしの達人型",
    catch: "チームの温かさで、常連との絆を育てる",
    vector: [75, 70, 75, 25],
    overview: [
      "チームの温かさで、常連さんとの関係を育てるタイプです。効率よく多くの人に価値を届けながらも、一人ひとりとの心の距離は近く保ちます。",
      "感覚的な対応力に優れ、場の空気を読むのが得意。一方で、数字での裏付けや仕組み化はやや苦手意識があるかもしれません。",
    ],
    strengths: ["また来たくなる信頼関係づくり", "回転率を活かした安定経営力", "チームで生み出す温かい接客体験", "お客様の空気を読む対応力"],
    cautions: ["感覚に頼りすぎて振り返りが手薄になりがち", "忙しい時期はチームへの負荷が集中しやすい", "価格改定などドライな判断がやや苦手"],
    quote: "また会いたい、と思われることを何より大切にする。",
    compatible: "BP",
  },
  ST: {
    group: "sasaeru", mascot: "📋", name: "堅実オペレーター型",
    catch: "数字の裏付けで、一人でも堅実に運営する",
    vector: [70, 75, 25, 75],
    overview: [
      "一人でも、数字の裏付けをもとに堅実にサロンを運営するタイプです。感覚に頼りすぎず、リピート率や客単価といった指標を見ながら、着実に経営を積み上げていきます。",
      "派手さはありませんが、変化に強く、長く安定して選ばれるサロンをつくる力があります。",
    ],
    strengths: ["再現性のある堅実な意思決定力", "隅々まで行き届いた丁寧な運営", "地道な改善を積み重ねる継続力", "無理のない現実的な計画力"],
    cautions: ["新しい挑戦への一歩が慎重になりがち", "発信面で存在感が埋もれやすい", "変化のスピードにやや保守的"],
    quote: "小さな改善の積み重ね、が信条。",
    compatible: "TC",
  },
  SL: {
    group: "sasaeru", mascot: "📈", name: "システムリーダー型",
    catch: "データとチームで、仕組みから拡大する",
    vector: [20, 70, 70, 75],
    overview: [
      "データとチームの力で、サロンを仕組みから拡大していくタイプです。新しいお客様を呼び込みながら、感覚に頼らず数字で判断し、再現性のある成長を目指します。",
      "複数店舗展開やスタッフ育成など、大きな絵を描いて実行するリーダーシップに向いています。",
    ],
    strengths: ["データとチーム力を掛け合わせた成長設計", "人を活かして拡げていく力", "新規集客と仕組み化の両立", "再現性のある意思決定力"],
    cautions: ["現場の細かな感情面のケアが手薄になりやすい", "仕組み化を急ぎすぎて負担をかけることがある", "一人サロンならではの機微に鈍感になりがち"],
    quote: "仕組みが人を自由にする、と考えるタイプ。",
    compatible: "AR",
  },
};

/** 4軸%（[E,V,T,D]寄り）から、最も距離の近いタイプを返す */
function classifyType(percents) {
  let best = null;
  let bestDist = Infinity;
  for (const [code, meta] of Object.entries(TYPES6)) {
    const dist = meta.vector.reduce((sum, v, i) => sum + (v - percents[i]) ** 2, 0);
    if (dist < bestDist) {
      bestDist = dist;
      best = code;
    }
  }
  return best;
}

/**
 * イントロ画面の6タイルにも、images/type-xx.png があれば自動で反映する。
 * 無ければ絵文字のまま（setResultMascotと同じフェイルオープン設計）。
 */
function initIntroMascots() {
  document.querySelectorAll(".intro-mascot-tile").forEach((tile) => {
    const code = tile.dataset.typeCode;
    const candidate = new Image();
    candidate.onload = () => {
      tile.innerHTML = "";
      const img = document.createElement("img");
      img.src = candidate.src;
      img.alt = "";
      tile.appendChild(img);
    };
    candidate.src = `images/type-${code.toLowerCase()}.png`;
  });
}
initIntroMascots();

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
  if (urlType && TYPES6[urlType.toUpperCase()]) {
    const code = urlType.toUpperCase();
    renderResultFromCode(code, TYPES6[code].vector, null);
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
    : "6タイプの中から診断中…";

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
  const code = classifyType(percents);
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

/**
 * タイプ別イラスト（images/type-xx.png 等）があれば自動的に表示し、
 * 無ければ絵文字マスコットにフォールバックする。
 * 少女漫画風キャラクターを用意した場合は、ここに置くだけで反映される
 * （コード変更不要。ファイル名は images/type-{code小文字}.png）。
 */
function setResultMascot(code, emoji) {
  const img = document.getElementById("resultMascotImg");
  const emojiEl = document.getElementById("resultMascot");

  img.hidden = true;
  emojiEl.hidden = false;
  emojiEl.textContent = emoji;

  const candidate = new Image();
  candidate.onload = () => {
    img.src = candidate.src;
    img.hidden = false;
    emojiEl.hidden = true;
  };
  candidate.onerror = () => {
    /* 画像が無ければ絵文字のまま表示を継続 */
  };
  candidate.src = `images/type-${code.toLowerCase()}.png`;
}

/* ---------------------------------------------------------
   ▼ 結果レンダリング
   --------------------------------------------------------- */
function renderResultFromCode(code, percents, webData) {
  const meta = TYPES6[code];
  const group = GROUPS[meta.group];
  const groupDark = GROUPS_DARK[meta.group];

  // ロールグループカラーを結果画面全体に適用（16Personalities方式）
  const resultScreen = document.getElementById("screen-result");
  resultScreen.style.setProperty("--result-accent", group.accent);
  resultScreen.style.setProperty("--result-soft", group.soft);
  resultScreen.style.setProperty("--result-accent-dark", groupDark.accent);
  resultScreen.style.setProperty("--result-soft-dark", groupDark.soft);

  setResultMascot(code, meta.mascot);
  document.getElementById("typeCode").textContent = code;
  document.getElementById("resultTitle").textContent = meta.name;
  document.getElementById("resultCatch").textContent = meta.catch;

  const groupChip = document.getElementById("groupChip");
  groupChip.textContent = `${group.name}｜${group.tagline}`;

  const won = AXES.map((axis, i) => {
    const pB = percents[i];
    const isB = pB >= 50;
    const pole = isB ? axis.poleB : axis.poleA;
    const confidence = isB ? pB : 100 - pB;
    return { axis, pole, confidence, isB, index: i };
  });

  const standout = won.reduce((a, b) => (a.confidence >= b.confidence ? a : b));
  const ringPct = Math.round(standout.confidence);
  document.getElementById("resultBadgeRing").style.setProperty("--ring-pct", `${ringPct}%`);

  document.getElementById("standoutEmoji").textContent = standout.pole.emoji;
  document.getElementById("standoutLabel").textContent = standout.pole.label;
  document.getElementById("standoutPct").textContent = `${ringPct}%`;

  drawRadar(won);

  // タイプ概要（物語調・複数段落）
  const overviewEl = document.getElementById("overviewText");
  overviewEl.innerHTML = meta.overview.map((p) => `<p>${p}</p>`).join("");

  const quoteEl = document.getElementById("quoteText");
  quoteEl.textContent = `“ ${meta.quote} ”`;

  // 強み一覧（タイプごとに編集部が定義したもの）
  const strengthList = document.getElementById("strengthList");
  strengthList.innerHTML = "";
  meta.strengths.forEach((s) => {
    const row = document.createElement("div");
    row.className = "strength-row";
    row.innerHTML = `<span class="strength-emoji">✓</span><span class="strength-text">${s}</span>`;
    strengthList.appendChild(row);
  });

  // 気をつけたいポイント
  const cautionList = document.getElementById("cautionList");
  cautionList.innerHTML = "";
  meta.cautions.forEach((c) => {
    const row = document.createElement("div");
    row.className = "caution-row";
    row.innerHTML = `<span class="caution-emoji">△</span><span class="caution-text">${c}</span>`;
    cautionList.appendChild(row);
  });

  // 相性の良いタイプ
  const compatMeta = TYPES6[meta.compatible];
  const compatGroup = GROUPS[compatMeta.group];
  document.getElementById("compatMascot").textContent = compatMeta.mascot;
  document.getElementById("compatName").textContent = compatMeta.name;
  document.getElementById("compatCatch").textContent = compatMeta.catch;
  document.getElementById("compatLink").href = `?type=${meta.compatible}`;
  document.getElementById("compatBadge").style.background = compatGroup.accent;

  // 軸ごとの割合バー（実測データ）
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

  // 伸ばすとさらに強くなる視点（実測データのうち最も拮抗している軸）
  const balancedAxis = won.reduce((a, b) => (a.confidence <= b.confidence ? a : b));
  document.getElementById("tipText").textContent = balancedAxis.pole.tip;

  renderDataPanel(webData);
  renderMarketingPanel(webData);
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
   ▼ マーケティング診断エンジン（SWOT / 3C / STP / スコア）
   実際に取得できた信号（口コミ件数・評価・価格帯・メニュー構成・
   発信有無・キーワード傾向）だけから、ルールベースで組み立てる。
   ※ 商圏内の競合密度・人流データ等は取得していないため、
      「商圏マッチ率」のような立地起点の指標は算出しない。
      代わりに算出可能な「デジタル接客力スコア」として提示する。
   --------------------------------------------------------- */
function buildMarketingAnalysis(webData) {
  const hp = (webData && webData.hp) || null;
  const hpb = (webData && webData.hpb) || null;
  const insta = (webData && webData.insta) || null;
  if (!hp && !hpb && !insta) return null;

  const strengths = [];
  const weaknesses = [];
  const opportunities = [];
  const threats = [];

  // ---- 強み・弱み（実測データにもとづくルール判定） ----
  if (hpb && hpb.rating != null) {
    if (hpb.rating >= 4.5) strengths.push(`高評価（★${hpb.rating.toFixed(1)}）を獲得できている`);
    else if (hpb.rating < 4.0) weaknesses.push(`評価点（★${hpb.rating.toFixed(1)}）に改善余地がある可能性`);
  }
  if (hpb && hpb.reviewCount != null) {
    if (hpb.reviewCount >= 100) strengths.push(`口コミ${hpb.reviewCount.toLocaleString()}件という実績の厚み`);
    else if (hpb.reviewCount < 20) weaknesses.push("口コミ件数がまだ少なく、実績が伝わりにくい可能性");
  }
  const menuCats = uniqueMerge_((hpb && hpb.menuCategories) || [], (hp && hp.menuCategories) || []);
  if (menuCats.length >= 3) strengths.push(`「${menuCats.slice(0, 3).join("・")}」など幅広いメニュー対応力`);
  else if (menuCats.length <= 1) weaknesses.push("メニューの見せ方が単一で、比較検討時に埋もれやすい可能性");

  const hasBlog = !!(hp && hp.hasBlog);
  const hasSns = !!(hp && hp.hasSns) || !!insta;
  if (hasBlog && hasSns) strengths.push("複数チャネル（ブログ・SNS）での情報発信ができている");
  if (!hasBlog && !hasSns) weaknesses.push("WEB上の情報発信チャネルが少ない");
  if (hp && hp.hasReserve === false) weaknesses.push("オンライン予約導線が見当たらない");

  const keywordCounts = mergeKeywordCounts_((hpb && hpb.keywordCounts) || [], (hp && hp.keywordCounts) || []);
  if (keywordCounts[0]) strengths.push(`サイト上で「${keywordCounts[0].word}」という印象が目立つ`);

  // ---- 機会・脅威（弱みの裏返し＋一般的な業界動向。特定競合の分析ではない） ----
  if (!hasSns) opportunities.push("Instagram等SNSでの発信を強化すると、新しい接点を増やせる余地");
  if (hpb && hpb.priceMax != null && menuCats.length <= 2) opportunities.push("メニューを絞った高単価特化ブランディングの余地");
  opportunities.push("LINE等での継続接点づくりは、業界的にも関心の高い領域");

  threats.push("エステ市場全体はやや縮小傾向。情報発信力の差が集客格差に直結しやすい局面（業界動向）");
  if ((hpb && hpb.reviewCount != null && hpb.reviewCount < 20) || (!hasBlog && !hasSns)) {
    threats.push("オンラインでの信頼形成が遅れると、比較検討で選ばれにくくなるリスク");
  }

  // ---- STP（価格帯からのセグメント推定） ----
  const priceMax = hpb && hpb.priceMax;
  let segment = "価格情報からは判定不可";
  let target = "—";
  if (priceMax != null) {
    if (priceMax >= 15000) { segment = "プレミアム層"; target = "特別な体験・高い専門性を求める層"; }
    else if (priceMax >= 6000) { segment = "スタンダード層"; target = "品質と価格のバランスを重視する層"; }
    else { segment = "バリュー層"; target = "気軽さ・通いやすさを重視する層"; }
  }
  const topStrength = strengths[0] || "着実な運営";
  const positioning = `「${topStrength}」を軸にした、${segment}向けサロンとしての立ち位置が見えてきています。`;

  // ---- 3C ----
  const company = [];
  if (hpb && hpb.rating != null && hpb.reviewCount != null) company.push(`評価★${hpb.rating.toFixed(1)}・口コミ${hpb.reviewCount.toLocaleString()}件`);
  if (hpb && hpb.priceMin != null && hpb.priceMax != null) company.push(`価格帯 ¥${hpb.priceMin.toLocaleString()}〜${hpb.priceMax.toLocaleString()}`);
  if (menuCats.length) company.push(`メニュー: ${menuCats.slice(0, 4).join("・")}`);
  company.push(`発信: ブログ${hasBlog ? "あり" : "なし"}／SNS${hasSns ? "あり" : "なし"}`);

  const customer = [];
  if (keywordCounts.length) customer.push(`よく見えるキーワード: ${keywordCounts.slice(0, 4).map((k) => k.word).join("・")}`);
  customer.push(`推定ターゲット: ${target}`);

  const market = [
    "エステティックサロン市場は前年度比92.1%とやや縮小局面（業界動向）",
    "情報収集はSNS・ブログ経由が主流（業界動向）",
  ];

  // ---- デジタル接客力スコア（0〜100の合成指標） ----
  let score = 0;
  score += hp && hp.hasReserve ? 15 : 0;
  score += hasBlog ? 10 : 0;
  score += hasSns ? 10 : 0;
  score += hpb && hpb.rating != null ? (hpb.rating / 5) * 20 : 8;
  score += hpb && hpb.reviewCount != null ? Math.min(hpb.reviewCount, 200) / 200 * 20 : 5;
  score += menuCats.length ? Math.min(menuCats.length, 5) / 5 * 15 : 5;
  score += insta && insta.followers != null ? Math.min(insta.followers, 3000) / 3000 * 10 : 0;
  score = Math.round(Math.max(0, Math.min(100, score)));

  return {
    score, keywordCounts,
    swot: { strengths: strengths.slice(0, 4), weaknesses: weaknesses.slice(0, 3), opportunities: opportunities.slice(0, 3), threats: threats.slice(0, 2) },
    stp: { segment, target, positioning },
    threeC: { company: company.slice(0, 4), customer, market },
  };
}

function uniqueMerge_(a, b) {
  return [...new Set([...(a || []), ...(b || [])])];
}

function mergeKeywordCounts_(a, b) {
  const map = new Map();
  [...(a || []), ...(b || [])].forEach((k) => map.set(k.word, (map.get(k.word) || 0) + k.count));
  return [...map.entries()].map(([word, count]) => ({ word, count })).sort((x, y) => y.count - x.count);
}

function renderMarketingPanel(webData) {
  const panel = document.getElementById("marketingPanel");
  const analysis = buildMarketingAnalysis(webData);

  if (!analysis) {
    panel.hidden = true;
    return;
  }
  panel.hidden = false;

  // スコアゲージ
  document.getElementById("mktScoreRing").style.setProperty("--ring-pct", `${analysis.score}%`);
  document.getElementById("mktScoreValue").textContent = analysis.score;

  // キーワードチップ
  const kwWrap = document.getElementById("mktKeywords");
  kwWrap.innerHTML = "";
  if (analysis.keywordCounts.length) {
    const maxCount = analysis.keywordCounts[0].count;
    analysis.keywordCounts.slice(0, 6).forEach((k) => {
      const chip = document.createElement("span");
      chip.className = "kw-chip";
      const scale = 0.85 + (k.count / maxCount) * 0.45;
      chip.style.fontSize = `${(12 * scale).toFixed(1)}px`;
      chip.textContent = k.word;
      kwWrap.appendChild(chip);
    });
  } else {
    kwWrap.innerHTML = `<span class="kw-empty">キーワードは検出されませんでした</span>`;
  }

  // SWOT
  fillList_("swotStrengths", analysis.swot.strengths, "—");
  fillList_("swotWeaknesses", analysis.swot.weaknesses, "—");
  fillList_("swotOpportunities", analysis.swot.opportunities, "—");
  fillList_("swotThreats", analysis.swot.threats, "—");

  // 3C
  fillList_("threeCCompany", analysis.threeC.company, "—");
  fillList_("threeCCustomer", analysis.threeC.customer, "—");
  fillList_("threeCMarket", analysis.threeC.market, "—");

  // STP
  document.getElementById("stpSegment").textContent = analysis.stp.segment;
  document.getElementById("stpTarget").textContent = analysis.stp.target;
  document.getElementById("stpPositioning").textContent = analysis.stp.positioning;
}

function fillList_(elId, items, emptyText) {
  const el = document.getElementById(elId);
  el.innerHTML = "";
  if (!items.length) {
    const li = document.createElement("li");
    li.className = "mkt-empty";
    li.textContent = emptyText;
    el.appendChild(li);
    return;
  }
  items.forEach((text) => {
    const li = document.createElement("li");
    li.textContent = text;
    el.appendChild(li);
  });
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
  const resultStyles = getComputedStyle(document.getElementById("screen-result"));

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

  const accent = resultStyles.getPropertyValue("--result-accent").trim() || rootStyles.getPropertyValue("--accent").trim() || "#7c3550";
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
