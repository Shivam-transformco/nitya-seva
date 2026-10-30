/**
 * Receives Nitya Seva form submissions and appends them to the bound Google Sheet.
 * Setup steps are in the project README.
 */

const SHEET_NAME = "Sevaks";
// Comma-separated addresses to notify on each new submission. Leave empty to disable.
const NOTIFY_EMAILS = "";

const FIELDS = [
  ["name", "Name"],
  ["phone", "Phone"],
  ["email", "Email"],
  ["city", "City"],
  ["amount", "Amount (₹)"],
  ["frequency", "Frequency"],
  ["purposes", "Purposes"],
  ["occasion", "Occasion"],
  ["contactTime", "Best time to call"],
  ["message", "Message"],
  ["submittedFrom", "Page"],
];

function doPost(e) {
  const p = (e && e.parameter) || {};
  if (p.website) return json({ ok: true });
  if (!p.name || !p.phone || !p.amount) return json({ ok: false, error: "missing fields" });

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = getSheet();
    const row = [new Date()].concat(FIELDS.map(([key]) => sanitize(p[key])));
    row.push("New");
    sheet.appendRow(row);
  } finally {
    lock.releaseLock();
  }

  if (NOTIFY_EMAILS) notify(p);
  return json({ ok: true });
}

function getSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(SHEET_NAME);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(["Submitted at"].concat(FIELDS.map(([, label]) => label), ["Status"]));
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, FIELDS.length + 2).setFontWeight("bold");
  }
  return sheet;
}

// Prevents values like "=HYPERLINK(...)" from being evaluated as spreadsheet formulas.
function sanitize(value) {
  const s = String(value || "").slice(0, 2000);
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

function notify(p) {
  const amount = Number(p.amount || 0).toLocaleString("en-IN");
  const body = FIELDS.map(([key, label]) => `${label}: ${p[key] || "-"}`).join("\n");
  MailApp.sendEmail({
    to: NOTIFY_EMAILS,
    subject: `New Nitya Sevak: ${p.name} · ₹${amount} ${p.frequency || ""}`,
    body: `Hare Krishna! A new sevak would like to be contacted.\n\n${body}`,
  });
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
