import { INVITE_HOURS } from "./invite-time.js";

const COUNTDOWN_WIDTH = 464;
const COUNTDOWN_HEIGHT = 112;

export const EMAIL_NOT_SENT = "Email not sent. Copy the link instead.";
export const WORDMARK = { src: "/email/wordmark.png", width: 398, height: 107 };

const GREY = "#8b93a7";
const WHITE = "#ffffff";
const OUTER = "#101218";
const CARD = "#22243a";
const LIME = "#c6ff3d";
const INK = "#12131c";

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function oneLine(value) {
  return String(value || "").replace(/[\u0000-\u001F\u007F]+/g, " ").replace(/\s+/g, " ").trim();
}

export function inviteSubject(firstName) {
  const name = oneLine(firstName).slice(0, 40) || "there";
  return `${name}, you're invited to the Botomatic beta`;
}

export function formatExpiry(expiresAt) {
  const date = expiresAt instanceof Date ? expiresAt : new Date(expiresAt);
  if (Number.isNaN(date.getTime())) return "soon";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
    hourCycle: "h23"
  }).format(date) + " UTC";
}

function imgTag({ src, width, height, alt }) {
  return `<img src="${escapeHtml(src)}" width="${width}" height="${height}" alt="${escapeHtml(alt)}" style="display:block;width:100%;max-width:${width}px;height:auto;border:0;outline:none;text-decoration:none;" />`;
}

export function buildInviteEmail({ firstName, joinUrl, expiresAt, countdownUrl, privacyUrl, assetOrigin, wordmark = WORDMARK }) {
  const rawName = oneLine(firstName).slice(0, 40) || "there";
  const name = escapeHtml(rawName);
  const subject = inviteSubject(rawName);
  const when = formatExpiry(expiresAt);
  const origin = String(assetOrigin || "https://botomatic.dev").replace(/\/$/, "");
  const href = escapeHtml(joinUrl);
  const privacy = escapeHtml(privacyUrl);
  const wordmarkUrl = `${origin}${wordmark.src}`;
  const fontUrl = `${origin}/email/fraunces-black-soft.woff2`;
  const intro = `Hi ${name}, you're one of a few select people invited to the private beta of Botomatic, where bots collaborate.`;
  const html = `<!DOCTYPE html>
<html lang="en" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="color-scheme" content="light dark" />
<meta name="supported-color-schemes" content="light dark" />
<meta name="x-apple-disable-message-reformatting" />
<title>${escapeHtml(subject)}</title>
<!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
<style>
@font-face { font-family: "Fraunces Email"; src: url("${fontUrl}") format("woff2"); font-weight: 900; font-style: normal; }
.headline { font-family: "Fraunces Email", Georgia, "Times New Roman", serif !important; font-weight: 900 !important; }
:root { color-scheme: light dark; supported-color-schemes: light dark; }
u + .body .gmail-screen { background:#000; mix-blend-mode:screen; }
u + .body .gmail-difference { background:#000; mix-blend-mode:difference; }
[data-ogsc] .force-bg, [data-ogsb] .force-bg { background-color:${OUTER} !important; }
[data-ogsc] .force-card, [data-ogsb] .force-card { background-color:${CARD} !important; }
[data-ogsc] .force-white { color:${WHITE} !important; }
[data-ogsc] .force-grey { color:${GREY} !important; }
</style>
</head>
<body class="body force-bg" bgcolor="${OUTER}" style="margin:0;padding:0;background:${OUTER};color:${WHITE};">
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:${OUTER};">A small, hand-picked group. Where bots collaborate.</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${OUTER}" class="force-bg" style="background:${OUTER};width:100%;">
    <tr><td align="center" bgcolor="${OUTER}" class="force-bg" style="background:${OUTER};padding:56px 16px;">
      <!--[if mso]><table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${CARD}" class="force-card" style="width:100%;max-width:600px;background:${CARD};border-radius:28px;">
        <tr><td align="center" bgcolor="${CARD}" class="force-card" style="padding:48px 28px 36px;background:${CARD};text-align:center;">
          <div class="gmail-screen" style="display:inline-block;"><div class="gmail-difference">
            ${imgTag({ src: wordmarkUrl, width: wordmark.width, height: wordmark.height, alt: "Botomatic" }).replace("width:100%;", "width:" + wordmark.width + "px;margin:0 auto;")}
          </div></div>
          <p class="force-grey" style="margin:22px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:700;letter-spacing:0.08em;color:${GREY};text-align:center;">PRIVATE BETA · INVITATION ONLY</p>
          <h1 class="headline force-white" style="margin:16px 0 0;font-family:'Fraunces Email',Georgia,'Times New Roman',serif;font-size:42px;line-height:1.05;font-weight:900;color:${WHITE};text-align:center;">${name}, you're invited.</h1>
          <p class="force-grey" style="margin:14px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.5;color:${GREY};text-align:center;">${intro}</p>
          <p class="force-grey" style="margin:28px 0 12px;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:700;letter-spacing:0.12em;color:${GREY};text-align:center;">YOUR INVITE EXPIRES IN</p>
          <div class="gmail-screen" style="display:inline-block;"><div class="gmail-difference">
            ${imgTag({ src: countdownUrl, width: COUNTDOWN_WIDTH, height: COUNTDOWN_HEIGHT, alt: "Hours, minutes and seconds left on your invite" }).replace("width:100%;", "width:" + COUNTDOWN_WIDTH + "px;margin:0 auto;")}
          </div></div>
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:22px auto 0;"><tr>
            <td align="center" bgcolor="${LIME}" style="background:${LIME};border-radius:999px;">
              <!--[if mso]>
              <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${href}" style="height:52px;v-text-anchor:middle;width:240px;" arcsize="50%" stroke="f" fillcolor="${LIME}">
                <w:anchorlock/>
                <center style="color:${INK};font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:bold;">Accept your invite</center>
              </v:roundrect>
              <![endif]-->
              <!--[if !mso]><!-->
              <a href="${href}" style="display:inline-block;padding:16px 28px;background:${LIME};border-radius:999px;font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:700;line-height:20px;color:${INK};text-decoration:none;">Accept your invite</a>
              <!--<![endif]-->
            </td>
          </tr></table>
          <p class="force-grey" style="margin:16px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:${GREY};text-align:center;">This invite is just for you.</p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:28px;"><tr>
            <td align="left" style="padding-top:22px;border-top:1px solid #2c3048;text-align:left;">
              <p class="force-grey" style="margin:0 0 14px;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:700;letter-spacing:0.14em;color:${GREY};text-align:left;">ALL YOU NEED</p>
              <p class="force-white" style="margin:0 0 10px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.45;color:${WHITE};text-align:left;"><span style="color:${LIME};font-weight:700;">01</span>&nbsp;&nbsp;<strong>A GitHub account.</strong> <span class="force-grey" style="color:${GREY};font-weight:400;">to sign in.</span></p>
              <p class="force-white" style="margin:0 0 16px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.45;color:${WHITE};text-align:left;"><span style="color:${LIME};font-weight:700;">02</span>&nbsp;&nbsp;<strong>At least two agentic platforms,</strong> <span class="force-grey" style="color:${GREY};font-weight:400;">like Claude, Grok or OpenAI.</span></p>
              <p class="headline force-white" style="margin:0 0 22px;font-family:'Fraunces Email',Georgia,'Times New Roman',serif;font-size:22px;line-height:1.3;font-weight:900;color:${WHITE};text-align:left;">That's it. You're in.</p>
              <p class="force-grey" style="margin:0 0 6px;font-family:Georgia,'Times New Roman',serif;font-size:18px;line-height:1.4;color:${GREY};text-align:left;">We can't wait to see what you create.</p>
              <p class="force-white" style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.4;font-weight:700;color:${WHITE};text-align:left;">The team at BrandOSX</p>
            </td>
          </tr></table>
          <p class="force-grey" style="margin:28px 0 0;padding-top:16px;border-top:1px solid #2c3048;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;color:${GREY};text-align:left;">BrandOSX Automation Pty Ltd · ABN 73 695 131 143 · <a href="${privacy}" style="color:${GREY};text-decoration:underline;">Privacy</a></p>
        </td></tr>
      </table>
      <!--[if mso]></td></tr></table><![endif]-->
    </td></tr>
  </table>
</body>
</html>`;
  const text = [
    `${rawName}, you're invited to the Botomatic beta`,
    "",
    "A small, hand-picked group. Where bots collaborate.",
    "",
    `Hi ${rawName}, you're one of a few select people invited to the private beta of Botomatic, where bots collaborate.`,
    "",
    "All you need:",
    "1. A GitHub account",
    "2. At least two agentic platforms, like Claude, Grok or OpenAI",
    "",
    "That's it. You're in.",
    "",
    `Accept your invite: ${joinUrl}`,
    "This invite is just for you.",
    `It expires on ${when} (${INVITE_HOURS} hours).`,
    "",
    "We can't wait to see what you create.",
    "The team at BrandOSX",
    "",
    "BrandOSX Automation Pty Ltd · ABN 73 695 131 143",
    privacyUrl
  ].join("\n");
  return { subject, html, text };
}

export function emailWithoutStyleBlock(html) {
  return String(html || "").replace(/<style[\s\S]*?<\/style>/gi, "");
}
