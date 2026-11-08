import https from "node:https";
import { Readable } from "node:stream";
import { isBlockedAddress, isBlockedHost } from "./compose.js";

const PREVIEW_BYTES = 100000;
const MAX_REDIRECTS = 3;

async function defaultLookup(hostname) {
  const { lookup } = await import("node:dns/promises");
  return lookup(hostname, { all: true, verbatim: true });
}

function hostOf(url) {
  return url.hostname.replace(/^\[|\]$/g, "").split("%")[0];
}

function isIpLiteral(host) {
  return host.includes(":") || /^\d{1,3}(?:\.\d{1,3}){3}$/.test(host);
}

function addressesFrom(records) {
  return (Array.isArray(records) ? records : [records])
    .map((record) => (typeof record === "string" ? record : record?.address))
    .filter(Boolean);
}

export async function approvedAddresses(urlString, lookup = defaultLookup) {
  let url;
  try {
    url = new URL(urlString);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.username || url.password) return null;
  if (isBlockedHost(url.hostname)) return null;
  const host = hostOf(url);
  if (isIpLiteral(host)) return isBlockedAddress(host) ? null : [host];
  let records;
  try {
    records = await lookup(host, { all: true, verbatim: true });
  } catch {
    return null;
  }
  const addresses = addressesFrom(records);
  if (!addresses.length || addresses.some((address) => isBlockedAddress(address))) return null;
  return addresses;
}

export function pinLookup(address) {
  const family = address.includes(":") ? 6 : 4;
  return function lookup(hostname, options, callback) {
    const done = typeof options === "function" ? options : callback;
    done(null, address, family);
  };
}

export function pinnedRequestOptions(urlString, address) {
  const url = new URL(urlString);
  return {
    protocol: url.protocol,
    hostname: url.hostname,
    servername: url.hostname,
    port: url.port || 443,
    path: `${url.pathname}${url.search}`,
    method: "GET",
    headers: {
      host: url.host,
      accept: "text/html"
    },
    lookup: pinLookup(address),
    rejectUnauthorized: true
  };
}

export function fetchPinned(url, { address, signal, request = https.request } = {}) {
  const options = pinnedRequestOptions(url, address);
  return new Promise((resolve, reject) => {
    const req = request({ ...options, signal }, (res) => {
      resolve(new Response(Readable.toWeb(res), {
        status: res.statusCode || 0,
        headers: res.headers
      }));
    });
    req.on("error", reject);
    req.end();
  });
}

async function readCapped(response, limit) {
  const reader = response.body?.getReader?.();
  if (!reader) return String(await response.text()).slice(0, limit);
  const decoder = new TextDecoder();
  let size = 0;
  let html = "";
  try {
    while (size < limit) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      html += decoder.decode(value, { stream: true });
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  return html.slice(0, limit);
}

function pageTitle(html) {
  const match = html.match(/<title[^>]*>([\s\S]{1,200})<\/title>/i);
  if (!match) return "";
  return match[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 140);
}

export async function readPageTitle(url, { fetch: fetchImpl = fetchPinned, lookup = defaultLookup } = {}) {
  let current = url;
  try {
    for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
      const addresses = await approvedAddresses(current, lookup);
      if (!addresses) return "";
      const response = await fetchImpl(current, {
        redirect: "manual",
        address: addresses[0],
        signal: AbortSignal.timeout(2500),
        headers: { accept: "text/html", host: new URL(current).host }
      });
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location || hop === MAX_REDIRECTS) return "";
        current = new URL(location, current).href;
        continue;
      }
      if (!response.ok) return "";
      return pageTitle(await readCapped(response, PREVIEW_BYTES));
    }
  } catch {
    return "";
  }
  return "";
}
