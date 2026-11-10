import { githubAppConfigured, repoNameForSlug } from "./stage2.js";

export async function createPrivateRepo({ token, workspaceSlug, workspaceName, fetchImpl = fetch }) {
  if (!githubAppConfigured()) {
    return { ok: false, status: "unconfigured", name: repoNameForSlug(workspaceSlug) };
  }
  const name = repoNameForSlug(workspaceSlug);
  let response;
  try {
    response = await fetchImpl("https://api.github.com/user/repos", {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        accept: "application/vnd.github+json",
        "user-agent": "botomatic",
        "content-type": "application/json"
      },
      body: JSON.stringify({
        name,
        private: true,
        auto_init: true,
        description: `Private Botomatic repo for ${workspaceName}`
      })
    });
  } catch (error) {
    console.error(error instanceof Error ? error.message : "github repo failed");
    return { ok: false, status: "failed", name };
  }
  if (response.status === 201 || response.status === 422) {
    return { ok: response.status === 201, status: response.status === 201 ? "created" : "exists", name };
  }
  console.error(`GitHub repo was not created (${response.status}).`);
  return { ok: false, status: "failed", name };
}

export function githubAuthorizeUrl({ inviteId, redirectUri }) {
  const params = new URLSearchParams({
    client_id: process.env.GITHUB_APP_CLIENT_ID || "",
    redirect_uri: redirectUri,
    state: inviteId,
    scope: "repo"
  });
  return `https://github.com/login/oauth/authorize?${params.toString()}`;
}

export async function exchangeGithubCode({ code, redirectUri, fetchImpl = fetch }) {
  const response = await fetchImpl("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { accept: "application/json", "content-type": "application/json", "user-agent": "botomatic" },
    body: JSON.stringify({
      client_id: process.env.GITHUB_APP_CLIENT_ID || "",
      client_secret: process.env.GITHUB_APP_CLIENT_SECRET || "",
      code,
      redirect_uri: redirectUri
    })
  });
  if (!response.ok) return "";
  const body = await response.json();
  return typeof body?.access_token === "string" ? body.access_token : "";
}
