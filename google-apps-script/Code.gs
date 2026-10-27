/**
 * CSSA Hub relay, running on the dedicated CSSA Hub Google account. Convex calls it for two things:
 *   1. Email: sends the daily digest from the account's Gmail. Convex renders every email.
 *   2. Google Drive: stores files over 10 MB (or uploaded when a space is full) in the account's Drive.
 *      The browser uploads straight to Drive; this script only opens the upload session, then checks,
 *      shares ("anyone with the link can view") and trashes files inside the "CSSA Hub Files" folder.
 * Setup and contract: doc/06-email-apps-script.md
 *
 * Script Properties (Project Settings → Script Properties):
 *   SHARED_SECRET  the same value as APPS_SCRIPT_SHARED_SECRET in Convex
 *   DRIVE_ROOT_ID  set automatically: the "CSSA Hub Files" folder
 */

const SENDER_NAME = "CSSA Hub";
const MAX_BCC = 50;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const DRIVE_ROOT_NAME = "CSSA Hub Files";
const DRIVE_MAX_BYTES = 500 * 1024 * 1024;
const SPACE_PATTERN = /^[a-z0-9-]{1,40}$/;
const ORIGIN_PATTERN = /^https?:\/\/[^\s/]+$/;
const FILE_ID_PATTERN = /^[\w-]{10,200}$/;

function doPost(e) {
  let body;
  try {
    const secret = PropertiesService.getScriptProperties().getProperty("SHARED_SECRET");
    if (!e || !e.postData || !e.postData.contents) {
      return json({ ok: false, code: "INVALID", error: "empty body" });
    }
    body = JSON.parse(e.postData.contents);
    if (!secret || typeof body.secret !== "string" || !safeEquals(body.secret, secret)) {
      return json({ ok: false, code: "UNAUTHORIZED", error: "bad secret" });
    }
  } catch (err) {
    return json({ ok: false, code: "INVALID", error: String(err) });
  }

  try {
    switch (body.action || "sendEmail") {
      case "sendEmail":
        return json(sendEmail(body));
      case "driveSession":
        return json(driveSession(body));
      case "driveFinalize":
        return json(driveFinalize(body));
      case "driveTrash":
        return json(driveTrash(body));
      default:
        return json({ ok: false, code: "INVALID", error: "unknown action" });
    }
  } catch (err) {
    console.error(body.action + " failed: " + err);
    return json({ ok: false, code: "SEND_FAILED", error: String(err) });
  }
}

// ---------- Email ----------

function sendEmail(body) {
  const to = typeof body.to === "string" ? body.to.trim() : "";
  const bcc = Array.isArray(body.bcc) ? body.bcc.filter((a) => typeof a === "string" && a.trim()) : [];
  if ((!to && bcc.length === 0) || !body.subject || !body.html) {
    return { ok: false, code: "INVALID", error: "missing fields" };
  }
  if ((to && !EMAIL_PATTERN.test(to)) || bcc.length > MAX_BCC || bcc.some((a) => !EMAIL_PATTERN.test(a.trim()))) {
    return { ok: false, code: "INVALID", error: "bad address" };
  }

  const recipients = (to ? 1 : 0) + bcc.length;
  if (MailApp.getRemainingDailyQuota() < recipients) {
    return { ok: false, code: "QUOTA", error: "daily quota reached" };
  }

  const options = { htmlBody: String(body.html), name: SENDER_NAME };
  if (bcc.length > 0) options.bcc = bcc.join(",");
  if (typeof body.replyTo === "string" && EMAIL_PATTERN.test(body.replyTo)) options.replyTo = body.replyTo;
  GmailApp.sendEmail(to, String(body.subject), String(body.text || ""), options);

  console.log("sent job " + (body.jobId || "?") + " to " + recipients + " recipient(s)");
  return { ok: true };
}

// ---------- Google Drive ----------

/**
 * Opens a resumable upload session in "CSSA Hub Files/<space>" and returns its URL.
 * The browser PUTs the file there; `origin` lets Drive accept that cross-site request.
 */
function driveSession(body) {
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const size = Number(body.size);
  const mimeType = typeof body.mimeType === "string" && body.mimeType ? body.mimeType : "application/octet-stream";
  if (!name || name.length > 255 || !(size > 0) || size > DRIVE_MAX_BYTES || !SPACE_PATTERN.test(body.folder || "")) {
    return { ok: false, code: "INVALID", error: "bad upload" };
  }

  const headers = {
    Authorization: "Bearer " + ScriptApp.getOAuthToken(),
    "X-Upload-Content-Type": mimeType,
    "X-Upload-Content-Length": String(size),
  };
  if (typeof body.origin === "string" && ORIGIN_PATTERN.test(body.origin)) headers.Origin = body.origin;

  const response = UrlFetchApp.fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable", {
    method: "post",
    contentType: "application/json; charset=UTF-8",
    headers: headers,
    payload: JSON.stringify({ name: name, mimeType: mimeType, parents: [spaceFolder(body.folder).getId()] }),
    muteHttpExceptions: true,
  });
  const responseHeaders = response.getHeaders();
  const uploadUrl = responseHeaders.Location || responseHeaders.location;
  if (response.getResponseCode() !== 200 || !uploadUrl) {
    const text = response.getContentText();
    const full = text.indexOf("storageQuotaExceeded") !== -1;
    return { ok: false, code: full ? "DRIVE_FULL" : "SEND_FAILED", error: "HTTP " + response.getResponseCode() };
  }
  return { ok: true, uploadUrl: uploadUrl };
}

/** Checks the uploaded file is ours, makes it viewable by link, and reports its real size and type. */
function driveFinalize(body) {
  const file = hubFile(body.fileId);
  if (!file) return { ok: false, code: "INVALID", error: "not a CSSA Hub file" };
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return { ok: true, name: file.getName(), size: file.getSize(), mimeType: file.getMimeType() };
}

/** Moves a file deleted in the Hub to the Drive trash (emptied by Google after 30 days). */
function driveTrash(body) {
  const file = hubFile(body.fileId);
  if (file) file.setTrashed(true);
  return { ok: true };
}

/** The file, if it exists and sits in a space folder under "CSSA Hub Files"; otherwise null. */
function hubFile(fileId) {
  if (typeof fileId !== "string" || !FILE_ID_PATTERN.test(fileId)) return null;
  let file;
  try {
    file = DriveApp.getFileById(fileId);
  } catch (err) {
    return null;
  }
  const rootId = rootFolder().getId();
  const parents = file.getParents();
  while (parents.hasNext()) {
    const grandparents = parents.next().getParents();
    while (grandparents.hasNext()) {
      if (grandparents.next().getId() === rootId) return file;
    }
  }
  return null;
}

function rootFolder() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty("DRIVE_ROOT_ID");
  if (id) {
    try {
      const folder = DriveApp.getFolderById(id);
      if (!folder.isTrashed()) return folder;
    } catch (err) {
      // Deleted: make a new one below.
    }
  }
  return withLock(() => {
    const again = props.getProperty("DRIVE_ROOT_ID");
    if (again && again !== id) return DriveApp.getFolderById(again);
    const folder = DriveApp.createFolder(DRIVE_ROOT_NAME);
    props.setProperty("DRIVE_ROOT_ID", folder.getId());
    return folder;
  });
}

function spaceFolder(key) {
  const root = rootFolder();
  const existing = root.getFoldersByName(key);
  if (existing.hasNext()) return existing.next();
  return withLock(() => {
    const again = root.getFoldersByName(key);
    return again.hasNext() ? again.next() : root.createFolder(key);
  });
}

function withLock(fn) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    return fn();
  } finally {
    lock.releaseLock();
  }
}

// ---------- Helpers ----------

/** Browsers opening the web app URL see this instead of an error page. */
function doGet() {
  return json({ ok: true, service: "CSSA Hub relay" });
}

/**
 * Run once from the editor (select setup, then Run) to grant the Gmail and Drive permissions.
 * It emails the account that owns the script and creates the "CSSA Hub Files" folder.
 * Run it again after updating this file if Google asks for new permissions.
 */
function setup() {
  const me = Session.getEffectiveUser().getEmail();
  GmailApp.sendEmail(me, "CSSA Hub relay test", "If you can read this, email works.", { name: SENDER_NAME });
  console.log("test email sent to " + me + "; remaining email quota today: " + MailApp.getRemainingDailyQuota());
  console.log("Drive folder: " + rootFolder().getUrl());
}

function safeEquals(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
