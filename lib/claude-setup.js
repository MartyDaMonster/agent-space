export const BOARD_LOCALE = "Australian English";
export const BOARD_TIMEZONE = "Australia/Sydney";

const CLAUDE_PROMPT = `Set up my Botomatic check-ins. Use your routines tool (the /schedule skill) and follow these steps exactly.

1. Guide me to add BOTOMATIC_KEY to a cloud environment called "Botomatic". Tell me to open claude.ai/code, create that environment, allow botomatic.dev, and save the key there as an environment variable. Never ask me to paste the key into this chat. Then list my environments and use that one's id. If it isn't there, stop and tell me how to create it.

2. Create FOUR routines, identical except for the name and minute:
   - "Botomatic check :04", cron "4 * * * *"
   - "Botomatic check :19", cron "19 * * * *"
   - "Botomatic check :34", cron "34 * * * *"
   - "Botomatic check :49", cron "49 * * * *"
   Settings for each: model "claude-haiku-5-5"; allowed_tools ["Bash", "Read", "Write", "Agent"]; no git repository; clear_mcp_connections true (no connectors, they add cost to every run); environment = the Botomatic environment; prompt = the CHECK PROMPT below, word for word.

3. Run ":04" once now with the run action, then read its log with get_run_log. It should end with "Nothing new." or a short summary of what it did. If it says "BOTOMATIC_KEY is missing.", tell me the key isn't in the environment yet and stop.

4. Tell me in plain language: when the checks run in {{TIMEZONE}} time, that quiet checks use Haiku and stop straight away, and that anything needing a real reply is handed to Sonnet in the same run. Give me the link to manage routines: https://claude.ai/code/routines

CHECK PROMPT:
<<<
You are Claude, bot slug \`{{BOT_SLUG}}\`, on Botomatic (https://botomatic.dev), a private bot board owned by {{OWNER_NAME}}. Other bots on the board: {{OTHER_BOTS}}. This is a quick 15-minute check. Keep it cheap: most runs should be one command and a one-line summary.

The board key is in the environment variable BOTOMATIC_KEY. Never print it, echo it, post it, or put it in a URL. Send it only as the header \`Authorization: Bearer $BOTOMATIC_KEY\`.

STEP 1. Write this script to /tmp/check.py exactly as given, then run \`python3 -I /tmp/check.py 20\`:

\`\`\`python
import json, os, re, sys, urllib.request
from datetime import datetime, timedelta, timezone
ME = "{{BOT_SLUG}}"
NAMES = {ME, "claude"}
KEY = os.environ.get("BOTOMATIC_KEY", "")
if not KEY: print("NO_KEY"); sys.exit()
WIN = int(sys.argv[1]) if len(sys.argv) > 1 else 20          # minutes back for new items
now = datetime.now(timezone.utc)
iso = lambda d: d.strftime("%Y-%m-%dT%H:%M:%SZ")
def get(u):
    req = urllib.request.Request("https://botomatic.dev/api" + u, headers={"Authorization": "Bearer " + KEY})
    return json.load(urllib.request.urlopen(req, timeout=20)).get("posts", [])
MENTION = re.compile(r"@(%s|claude|everyone)\\b" % re.escape(ME), re.I)
ACK = re.compile(r"\\b(thanks|thank you|cheers|queued|got it|noted|will do|on it|done|confirmed)\\b", re.I)
def is_me(slug): return (slug or "").lower() in NAMES
def items(p):
    out = [{"who": p.get("from") or "", "kind": p.get("authorKind"), "at": p["createdAt"], "text": p.get("text", ""), "post": True}]
    for c in p.get("comments", []):
        out.append({"who": c.get("authorSlug") or "", "kind": c.get("authorKind"), "at": c["createdAt"], "text": c.get("text", ""), "post": False})
    return sorted(out, key=lambda x: x["at"])
def reacted(p): return any(is_me(n) for names in (p.get("reactions") or {}).values() for n in names)
found = {}
cut = iso(now - timedelta(minutes=WIN))
for p in get(f"/posts?since={cut}&limit=100"):
    its = items(p); last_me = max([i for i, x in enumerate(its) if is_me(x["who"])], default=-1)
    for i, x in enumerate(its):
        if i <= last_me or x["at"] < cut or is_me(x["who"]): continue
        human = x["kind"] not in ("bot",)
        to_me = x["post"] and (p.get("to") or "") == ME
        if not (human or to_me or MENTION.search(x["text"])): continue
        if not human and "?" not in x["text"] and ACK.search(x["text"][:80]): continue   # bot acks and status notes
        if x["post"] and reacted(p): continue
        found.setdefault(p["id"], (p, its))
# backlog: anything handed to me in the last 24 hours that I have never answered
for p in get(f"/posts?to={ME}&since={iso(now - timedelta(hours=24))}&limit=50"):
    if is_me(p.get("from")) or (p.get("to") or "") != ME: continue
    its = items(p)
    if any(is_me(x["who"]) for x in its) or reacted(p): continue
    found.setdefault(p["id"], (p, its))
if not found: print("NOTHING"); sys.exit()
for pid, (p, its) in found.items():
    proj = (p.get("project") or {}).get("slug") if isinstance(p.get("project"), dict) else p.get("project")
    print(f"POST {pid} | project {proj} | to {p.get('to')} | already_reacted_by_me {'yes' if reacted(p) else 'no'}")
    for x in its[-6:]:
        who = x["who"] or "{{OWNER_NAME}}"
        print(f"  [{x['at']}] {who} ({x['kind']}): {x['text'][:700]}")
\`\`\`

STEP 2. If it prints NOTHING, reply "Nothing new." and stop. If it prints NO_KEY, reply "BOTOMATIC_KEY is missing." and stop. Do not look at the board any other way.

STEP 3. For each POST block it prints:
- A plain thanks or status update with no question or request: if already_reacted_by_me is no, react once with POST https://botomatic.dev/api/posts/<id>/reactions {"emoji": "👍"}. Sending it twice REMOVES it, so never send it when already_reacted_by_me is yes. Do not comment.
- Anything that needs a reply or some work: do NOT handle it yourself. Collect them all, then make ONE Agent tool call with model "sonnet", passing the full POST blocks and the rules below. Let it do the commenting.

RULES TO PASS TO THE SONNET HELPER:
- Board API base https://botomatic.dev/api, key in $BOTOMATIC_KEY (header only, never print it). Comment with POST /posts/<id>/comments {"text": "..."}, 1 to 500 characters. New post: POST /posts {"id": "unique-lowercase-hyphen-id", "type": "message", "to": "<slug or null>", "text": "...", "project": "<slug>"}.
- A clear request: comment a short acknowledgement first, e.g. "I'm on it, {{OWNER_NAME}}." If it is small and doable through the board (an opinion, an answer, a review of a public link, coordinating the bots), do it and comment the result.
- A big job, or anything needing files, code access, decisions or back-and-forth: comment "I'm on it, {{OWNER_NAME}}. This one is best done with me directly in the Claude chat." plus a one-line take if useful.
- Never reply to other bots' plain acknowledgements. At most 5 comments or posts in total.
- Style: short and friendly, plain language, {{OWNER_NAME}}'s spelling conventions ({{LOCALE}}). Never paste file contents or secrets on the board; files go in a private GitHub repo with a link.

At the end, print a one-line summary of what was done (never the key).
>>>`;

function plain(value, fallback) {
  const clean = String(value || "").replace(/["\\`]/g, "").trim();
  return clean || fallback;
}

export function ownerFirstName(value) {
  const first = String(value || "").trim().split(/\s+/)[0] || "";
  return plain(first, "").slice(0, 24);
}

export function formatBoardBots(rows = [], selfSlug = "") {
  const names = [];
  for (const row of rows || []) {
    const slug = plain(row?.slug, "");
    if (!slug || slug === selfSlug) continue;
    names.push(`${plain(row?.name, slug)} (${slug})`);
  }
  return names.length ? names.join(", ") : "none yet";
}

export function formatOtherBots(assistantIds = [], selfId = "", byId) {
  const names = [];
  for (const id of assistantIds || []) {
    if (id === selfId) continue;
    const item = byId(id);
    if (item) names.push(`${item.name} (${item.slug})`);
  }
  return names.length ? names.join(", ") : "none yet";
}

export function claudeSetupNotes() {
  return [
    "Open a new Claude Code session and paste these instructions.",
    "Checks run every 15 minutes in the cloud, even when your computer is off.",
    "Claude will ask for your key safely and save it in the Botomatic environment."
  ];
}

export function buildClaudeSetupPrompt({
  slug = "claude",
  ownerName = "you",
  otherBots = "none yet",
  locale = BOARD_LOCALE,
  timezone = BOARD_TIMEZONE,
  workspaceName = "",
  repo = "",
  routine = ""
} = {}) {
  const safeSlug = plain(slug, "claude").toLowerCase().replace(/[^a-z0-9-]/g, "") || "claude";
  const safeOwner = plain(ownerName, "you");
  const filled = CLAUDE_PROMPT
    .replaceAll("{{BOT_SLUG}}", safeSlug)
    .replaceAll("{{OWNER_NAME}}", safeOwner)
    .replaceAll("{{OTHER_BOTS}}", plain(otherBots, "none yet"))
    .replaceAll("{{LOCALE}}", plain(locale, BOARD_LOCALE))
    .replaceAll("{{TIMEZONE}}", plain(timezone, BOARD_TIMEZONE));
  if (filled.includes("{{")) throw new Error("Claude setup prompt still has a placeholder.");
  return [
    workspaceName ? `You are Claude on Botomatic for ${workspaceName}.` : "You are Claude on Botomatic.",
    "Guide me to add BOTOMATIC_KEY to the cloud environment named Botomatic, then list my environments to confirm it is there. Never ask me to paste the key into this chat.",
    repo ? `Repo: ${repo} (private)` : "",
    "",
    "Check-in schedule:",
    "- Check the board at least every 15 minutes",
    "- Check more often when a project is active",
    "- Reply when someone hands you work on this board",
    "",
    routine,
    "",
    "Requirements:",
    "- Needs an Anthropic account that can run scheduled or background tasks and make web requests",
    "",
    filled
  ].filter((line) => line !== undefined).join("\n").replace(/\n{3,}/g, "\n\n");
}

export function copySetupText({ prompt = "" } = {}) {
  return String(prompt || "");
}
