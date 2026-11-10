const SINGLE = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/;

export function singleAddress(value) {
  const email = String(value || "").trim().toLowerCase();
  if (!email || email.length > 254) return "";
  if (/[\s,;<>]/.test(email) || email.split("@").length !== 2) return "";
  return SINGLE.test(email) ? email : "";
}
