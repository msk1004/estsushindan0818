/**
 * サロン経営課題診断 — 回答ログ受信用 Google Apps Script
 *
 * 個人情報は一切受け取らず、8問のスコア（1〜5）とタイムスタンプのみを
 * 紐づけたGoogleスプレッドシートに1行追記する。
 *
 * 【セットアップ手順】
 * 1. 記録用のGoogleスプレッドシートを新規作成する
 * 2. 「拡張機能」→「Apps Script」を開く
 * 3. デフォルトのコードを全て削除し、このファイルの内容を貼り付ける
 * 4. 保存 → 「デプロイ」→「新しいデプロイ」
 *    - 種類: ウェブアプリ
 *    - 実行するユーザー: 自分
 *    - アクセスできるユーザー: 全員
 * 5. 発行されたウェブアプリURLを script.js の CONFIG.LOG_ENDPOINT に貼り付ける
 */

const SHEET_NAME = "診断ログ";
const HEADER = ["timestamp", "q1", "q2", "q3", "q4", "q5", "q6", "q7", "q8"];

function doPost(e) {
  const sheet = getOrCreateSheet_();

  let data = {};
  try {
    data = JSON.parse(e.postData.contents);
  } catch (err) {
    return ContentService.createTextOutput("invalid payload");
  }

  const row = [
    data.ts || new Date().toISOString(),
    data.q1 ?? "",
    data.q2 ?? "",
    data.q3 ?? "",
    data.q4 ?? "",
    data.q5 ?? "",
    data.q6 ?? "",
    data.q7 ?? "",
    data.q8 ?? "",
  ];

  sheet.appendRow(row);
  return ContentService.createTextOutput("ok");
}

function getOrCreateSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(HEADER);
  }
  return sheet;
}
