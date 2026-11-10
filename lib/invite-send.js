import { EMAIL_NOT_SENT, buildInviteEmail } from "./invite-email.js";
import { joinLink } from "./admin-panel.js";

export function inviteFromAddress() {
  return process.env.INVITE_FROM || "Botomatic <invites@botomatic.dev>";
}

async function defaultSend(payload) {
  const { Resend } = await import("resend");
  const client = new Resend(process.env.RESEND_API_KEY);
  const result = await client.emails.send(payload);
  if (result?.error) throw new Error(result.error.message || "Email send failed.");
  return result;
}

export async function deliverInviteEmail({ name, email, inviteId, expiresAt, origin }, { send } = {}) {
  const base = String(origin || "https://botomatic.dev").replace(/\/$/, "");
  const message = buildInviteEmail({
    firstName: name,
    joinUrl: joinLink(base, inviteId),
    expiresAt,
    countdownUrl: `${base}/api/invite/${inviteId}/countdown.png`,
    privacyUrl: `${base}/privacy`,
    assetOrigin: base
  });
  if (!process.env.RESEND_API_KEY && !send) {
    return { ok: false, error: "RESEND_API_KEY is not set.", notice: EMAIL_NOT_SENT };
  }
  try {
    await (send || defaultSend)({
      from: inviteFromAddress(),
      to: email,
      subject: message.subject,
      html: message.html,
      text: message.text
    });
    return { ok: true, notice: "" };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Email send failed.";
    return { ok: false, error: reason, notice: EMAIL_NOT_SENT };
  }
}
