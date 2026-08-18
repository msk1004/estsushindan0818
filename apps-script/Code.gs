/**
 * サロン経営タイプ診断 — バックエンド用 Google Apps Script
 *
 * 2つの役割を1つのWebアプリで兼ねる：
 *  1) 診断ログの記録（action: "log"）— 個人情報なし。回答・タイプ・軸スコアのみ
 *  2) 自社HP／ホットペッパービューティー／Instagramの簡易分析（action: "analyze"）
 *     — ブラウザからは他サイトを直接fetchできない（CORS）ため、
 *       ここがサーバー側の代理取得・分析役を担う
 *
 * 【セットアップ手順】
 * 1. 記録用のGoogleスプレッドシートを新規作成する
 * 2. 「拡張機能」→「Apps Script」を開く
 * 3. デフォルトのコードを全て削除し、このファイルの内容を貼り付ける
 * 4. 保存 → 「デプロイ」→「新しいデプロイ」
 *    - 種類: ウェブアプリ
 *    - 実行するユーザー: 自分
 *    - アクセスできるユーザー: 全員
 * 5. 発行されたウェブアプリURLを script.js の CONFIG.API_ENDPOINT に貼り付ける
 *
 * 【分析ロジックについての注意】
 * ホットペッパービューティー・Instagramはページ構造が変わると抽出に失敗することがある
 * （Instagramは特に、公開ページの多くがJSで後から描画されるため取得できないケースが多い）。
 * いずれも取得失敗時は null を返し、フロント側で「取得できませんでした」と表示する
 * フォールバック設計にしている。あくまで簡易ベストエフォートの分析であり、
 * 保証された値ではないことを利用画面上にも明記すること。
 */

function doPost(e) {
  let data = {};
  try {
    data = JSON.parse(e.postData.contents);
  } catch (err) {
    return jsonOutput_({ error: "invalid payload" });
  }

  if (data.action === "analyze") {
    return handleAnalyze_(data);
  }
  return handleLog_(data);
}

/* =========================================================
   1) 診断ログ記録
   ========================================================= */

const LOG_SHEET_NAME = "診断ログ";
const LOG_HEADER = [
  "timestamp", "type",
  "axis1_pct", "axis2_pct", "axis3_pct", "axis4_pct",
  "q1", "q2", "q3", "q4", "q5", "q6", "q7", "q8",
  "used_web_data",
];

function handleLog_(data) {
  const sheet = getOrCreateSheet_(LOG_SHEET_NAME, LOG_HEADER);
  sheet.appendRow([
    data.ts || new Date().toISOString(),
    data.type ?? "",
    data.axis1_pct ?? "", data.axis2_pct ?? "", data.axis3_pct ?? "", data.axis4_pct ?? "",
    data.q1 ?? "", data.q2 ?? "", data.q3 ?? "", data.q4 ?? "",
    data.q5 ?? "", data.q6 ?? "", data.q7 ?? "", data.q8 ?? "",
    data.used_web_data ?? "",
  ]);
  return jsonOutput_({ ok: true });
}

/* =========================================================
   2) URL分析（自社HP／ホットペッパービューティー／Instagram）
   ========================================================= */

const ANALYZE_SHEET_NAME = "URL分析ログ";
const ANALYZE_HEADER = [
  "timestamp", "hp_url", "hpb_url", "insta_url",
  "hpb_review_count", "hpb_rating", "hpb_price_min", "hpb_price_max", "hpb_menu_count",
  "insta_followers", "insta_posts",
  "hp_has_blog", "hp_has_reserve", "hp_has_sns",
];

function handleAnalyze_(data) {
  const result = { hp: null, hpb: null, insta: null };

  if (data.hp_url) result.hp = safeRun_(() => analyzeOwnSite_(data.hp_url));
  if (data.hpb_url) result.hpb = safeRun_(() => analyzeHotPepper_(data.hpb_url));
  if (data.insta_url) result.insta = safeRun_(() => analyzeInstagram_(data.insta_url));

  logAnalysis_(data, result);
  return jsonOutput_(result);
}

function safeRun_(fn) {
  try {
    return fn();
  } catch (err) {
    return null;
  }
}

function fetchHtml_(url) {
  try {
    const res = UrlFetchApp.fetch(normalizeUrl_(url), {
      muteHttpExceptions: true,
      followRedirects: true,
      validateHttpsCertificates: true,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
      },
    });
    if (res.getResponseCode() >= 400) return null;
    return res.getContentText();
  } catch (err) {
    return null;
  }
}

function normalizeUrl_(url) {
  const trimmed = String(url).trim();
  if (!/^https?:\/\//i.test(trimmed)) return "https://" + trimmed;
  return trimmed;
}

/** 自社HP: 更新体制・導線・情報量の目安を簡易分析 */
function analyzeOwnSite_(url) {
  const html = fetchHtml_(url);
  if (!html) return null;

  const text = html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);

  return {
    title: titleMatch ? titleMatch[1].trim().slice(0, 60) : null,
    hasBlog: /(blog|ブログ|お知らせ|news|NEWS|コラム)/i.test(html),
    hasReserve: /(予約|reserve|RESERVE|hotpepper|ホットペッパー)/i.test(html),
    hasSns: /(instagram\.com|line\.me|lin\.ee|twitter\.com|x\.com)/i.test(html),
    hasPrice: /(料金|価格|メニュー表|¥\s?\d|\d,?\d{3}\s?円)/.test(text),
    volumeScore: Math.max(0, Math.min(100, Math.round(text.length / 60))),
  };
}

/** ホットペッパービューティー: 口コミ件数・評価点・価格帯・メニュー数（ベストエフォート） */
function analyzeHotPepper_(url) {
  const html = fetchHtml_(url);
  if (!html) return null;

  const text = html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

  const reviewMatch = text.match(/口コミ\s*([\d,]+)\s*件/) || text.match(/クチコミ\s*([\d,]+)\s*件/);
  const ratingMatch = text.match(/([0-5]\.\d{1,2})\s*(?:点|\/\s*5)/);
  const priceMatch = text.match(/¥\s?([\d,]{3,6})\s?[~〜\-]\s?¥?\s?([\d,]{3,6})/);
  const menuMatch = text.match(/メニュー(?:数)?\s*[:：]?\s*([\d,]+)\s*件/);

  const hasAny = reviewMatch || ratingMatch || priceMatch || menuMatch;
  if (!hasAny) return null;

  return {
    reviewCount: reviewMatch ? parseInt(reviewMatch[1].replace(/,/g, ""), 10) : null,
    rating: ratingMatch ? parseFloat(ratingMatch[1]) : null,
    priceMin: priceMatch ? parseInt(priceMatch[1].replace(/,/g, ""), 10) : null,
    priceMax: priceMatch ? parseInt(priceMatch[2].replace(/,/g, ""), 10) : null,
    menuCount: menuMatch ? parseInt(menuMatch[1].replace(/,/g, ""), 10) : null,
  };
}

/**
 * Instagram: 公開プロフィールのog:descriptionに稀に含まれる
 * "1,234 Followers, 56 Following, 78 Posts" 形式を抽出するベストエフォート実装。
 * Instagram側の仕様変更・アクセス制限により取得できないことが多い前提とする。
 */
function analyzeInstagram_(url) {
  const html = fetchHtml_(url);
  if (!html) return null;

  const ogDescMatch = html.match(/<meta\s+property="og:description"\s+content="([^"]*)"/i);
  if (!ogDescMatch) return null;

  const desc = decodeHtmlEntities_(ogDescMatch[1]);
  const m = desc.match(/([\d,.]+[KkMm]?)\s*Followers?,\s*([\d,.]+[KkMm]?)\s*Following,\s*([\d,.]+[KkMm]?)\s*Posts?/i);
  if (!m) return null;

  return {
    followers: parseCountToken_(m[1]),
    following: parseCountToken_(m[2]),
    posts: parseCountToken_(m[3]),
  };
}

function parseCountToken_(token) {
  const t = token.replace(/,/g, "").trim();
  const mult = /[Kk]$/.test(t) ? 1000 : /[Mm]$/.test(t) ? 1000000 : 1;
  const num = parseFloat(t.replace(/[KkMm]$/, ""));
  return isNaN(num) ? null : Math.round(num * mult);
}

function decodeHtmlEntities_(str) {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function logAnalysis_(input, result) {
  try {
    const sheet = getOrCreateSheet_(ANALYZE_SHEET_NAME, ANALYZE_HEADER);
    sheet.appendRow([
      new Date().toISOString(),
      input.hp_url || "", input.hpb_url || "", input.insta_url || "",
      result.hpb && result.hpb.reviewCount != null ? result.hpb.reviewCount : "",
      result.hpb && result.hpb.rating != null ? result.hpb.rating : "",
      result.hpb && result.hpb.priceMin != null ? result.hpb.priceMin : "",
      result.hpb && result.hpb.priceMax != null ? result.hpb.priceMax : "",
      result.hpb && result.hpb.menuCount != null ? result.hpb.menuCount : "",
      result.insta && result.insta.followers != null ? result.insta.followers : "",
      result.insta && result.insta.posts != null ? result.insta.posts : "",
      result.hp && result.hp.hasBlog != null ? result.hp.hasBlog : "",
      result.hp && result.hp.hasReserve != null ? result.hp.hasReserve : "",
      result.hp && result.hp.hasSns != null ? result.hp.hasSns : "",
    ]);
  } catch (err) {
    /* ログ失敗は分析結果の返却に影響させない */
  }
}

/* =========================================================
   共通ユーティリティ
   ========================================================= */

function getOrCreateSheet_(name, header) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(header);
  }
  return sheet;
}

function jsonOutput_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
