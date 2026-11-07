const encoder = new TextEncoder();
const decoder = new TextDecoder();
const ONE_HOUR = 60 * 60;

function asBase64Url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function fromBase64Url(value) {
  const base64 = value.replaceAll("-", "+").replaceAll("_", "/");
  const binary = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "="));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function randomString() {
  return asBase64Url(crypto.getRandomValues(new Uint8Array(32)));
}

async function hmacKey(secret) {
  return crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

async function sign(value, secret) {
  const payload = asBase64Url(encoder.encode(JSON.stringify(value)));
  const signature = await crypto.subtle.sign("HMAC", await hmacKey(secret), encoder.encode(payload));
  return `${payload}.${asBase64Url(new Uint8Array(signature))}`;
}

async function verify(value, secret) {
  if (typeof value !== "string" || !value.includes(".")) return null;
  const [payload, signature, extra] = value.split(".");
  if (extra !== undefined || !payload || !signature) return null;
  try {
    const valid = await crypto.subtle.verify("HMAC", await hmacKey(secret), fromBase64Url(signature), encoder.encode(payload));
    if (!valid) return null;
    const decoded = JSON.parse(decoder.decode(fromBase64Url(payload)));
    if (!Number.isSafeInteger(decoded.exp) || decoded.exp <= Math.floor(Date.now() / 1000)) return null;
    return decoded;
  } catch {
    return null;
  }
}

function cookie(request, name) {
  const item = (request.headers.get("Cookie") || "").split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));
  return item?.slice(name.length + 1) || "";
}

function setCookie(name, value, maxAge, path = "/") {
  return `${name}=${value}; Path=${path}; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`;
}

function htmlEscape(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
}

function html(body, status = 200, headers = {}) {
  return new Response(`<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>TRACEBACK 의견</title><style>
    :root{font-family:system-ui,"Apple SD Gothic Neo",sans-serif;color:#172b38;background:#f4f7f9}*{box-sizing:border-box}body{margin:0;line-height:1.6}main{width:min(760px,calc(100% - 32px));margin:32px auto 80px}h1{line-height:1.2}a{color:#176b91}label{display:block;font-weight:700;margin:24px 0 7px}textarea,input{font:inherit;width:100%;border:1px solid #aabcc7;border-radius:9px;padding:12px;background:#fff;color:#172b38}textarea{min-height:145px;resize:vertical}button{font:inherit;font-weight:700;background:#176b91;color:#fff;border:0;border-radius:9px;padding:13px 20px;margin-top:22px;cursor:pointer}button:focus-visible,a:focus-visible{outline:3px solid #176b91;outline-offset:3px}.card{background:#fff;border:1px solid #cbd8df;border-radius:14px;padding:clamp(20px,5vw,34px)}.muted{color:#536977}.meta{overflow-wrap:anywhere}.error{color:#a72424}
  </style></head><body><main>${body}</main></body></html>`, { status, headers: {
    "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; script-src 'self'; form-action 'self' https://github.com; base-uri 'none'; frame-ancestors 'none'", "X-Content-Type-Options": "nosniff", ...headers,
  } });
}

function redirect(path, headers = {}) {
  return new Response(null, { status: 303, headers: { Location: path, "Cache-Control": "no-store", ...headers } });
}

function validDocument(raw, origin) {
  try {
    const url = new URL(raw);
    if (url.origin !== origin || url.search || url.hash) return null;
    if (!/^\/traceback-artifacts\/(?:[a-zA-Z0-9._-]+\.html)?$/.test(url.pathname)) return null;
    return url.href;
  } catch {
    return null;
  }
}

function validFields(fields, env) {
  const documentUrl = validDocument(fields.get("document_url"), env.PUBLIC_SITE_ORIGIN);
  const revision = fields.get("document_revision");
  const section = fields.get("section_id") || "";
  const location = fields.get("location") || "";
  const comment = fields.get("comment") || "";
  if (!documentUrl || typeof revision !== "string" || !/^[a-f0-9]{40}$/.test(revision)) return null;
  if (typeof section !== "string" || section.length > 180 || /[\u0000-\u001f\u007f]/.test(section)) return null;
  if (typeof location !== "string" || location.trim().length < 2 || location.length > 500) return null;
  if (typeof comment !== "string" || comment.trim().length < 3 || comment.length > 10000) return null;
  return { document_url: documentUrl, section_id: section || null, selected_text: null, location: location.trim(), comment: comment.trim(), document_revision: revision };
}

async function session(request, env) {
  const value = await verify(cookie(request, "tb_session"), env.SESSION_SECRET);
  return value?.uid === Number(env.ALLOWED_GITHUB_USER_ID) ? value : null;
}

async function startLogin(request, env, url) {
  const returnTo = url.searchParams.get("return_to") || "/new";
  if (!returnTo.startsWith("/new?") && returnTo !== "/new" && returnTo !== "/handoff") return new Response("Invalid return path", { status: 400 });
  const state = randomString();
  const verifier = randomString();
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(verifier));
  const oauth = await sign({ state, verifier, returnTo, exp: Math.floor(Date.now() / 1000) + 600 }, env.SESSION_SECRET);
  const auth = new URL("https://github.com/login/oauth/authorize");
  auth.searchParams.set("client_id", env.GITHUB_APP_CLIENT_ID);
  auth.searchParams.set("redirect_uri", `${url.origin}/oauth/callback`);
  auth.searchParams.set("state", state);
  auth.searchParams.set("code_challenge", asBase64Url(new Uint8Array(digest)));
  auth.searchParams.set("code_challenge_method", "S256");
  return redirect(auth.href, { "Set-Cookie": setCookie("tb_oauth", oauth, 600, "/oauth") });
}

async function completeLogin(request, env, url) {
  const state = await verify(cookie(request, "tb_oauth"), env.SESSION_SECRET);
  if (!state || url.searchParams.get("state") !== state.state || !url.searchParams.get("code")) return html('<div class="card"><h1>로그인 확인에 실패했습니다</h1><p>처음부터 다시 시도하세요.</p></div>', 400);
  const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST", headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: env.GITHUB_APP_CLIENT_ID, client_secret: env.GITHUB_APP_CLIENT_SECRET, code: url.searchParams.get("code"), redirect_uri: `${url.origin}/oauth/callback`, code_verifier: state.verifier }),
  });
  if (!tokenResponse.ok) return html('<div class="card"><h1>GitHub 로그인에 실패했습니다</h1></div>', 502);
  const token = (await tokenResponse.json()).access_token;
  if (!token) return html('<div class="card"><h1>GitHub 로그인에 실패했습니다</h1></div>', 502);
  const userResponse = await fetch("https://api.github.com/user", { headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "User-Agent": "traceback-feedback" } });
  if (!userResponse.ok) return html('<div class="card"><h1>GitHub 계정을 확인하지 못했습니다</h1></div>', 502);
  const user = await userResponse.json();
  if (user.id !== Number(env.ALLOWED_GITHUB_USER_ID)) return html('<div class="card"><h1>이 계정은 의견을 저장할 수 없습니다</h1></div>', 403, { "Set-Cookie": setCookie("tb_oauth", "", 0, "/oauth") });
  const signed = await sign({ uid: user.id, login: user.login, nonce: randomString(), exp: Math.floor(Date.now() / 1000) + 12 * ONE_HOUR }, env.SESSION_SECRET);
  const headers = new Headers({ Location: state.returnTo, "Cache-Control": "no-store" });
  headers.append("Set-Cookie", setCookie("tb_oauth", "", 0, "/oauth"));
  headers.append("Set-Cookie", setCookie("tb_session", signed, 12 * ONE_HOUR));
  return new Response(null, { status: 303, headers });
}

async function newForm(request, env, url) {
  const owner = await session(request, env);
  if (!owner) return redirect(`/login?return_to=${encodeURIComponent(url.pathname + url.search)}`);
  const documentUrl = validDocument(url.searchParams.get("doc"), env.PUBLIC_SITE_ORIGIN);
  const revision = url.searchParams.get("rev") || "";
  const section = url.searchParams.get("section") || "";
  if (!documentUrl || !/^[a-f0-9]{40}$/.test(revision) || section.length > 180 || /[\u0000-\u001f\u007f]/.test(section)) return html('<div class="card"><h1>문서 정보가 올바르지 않습니다</h1><p>학습 페이지에서 다시 의견 남기기를 누르세요.</p></div>', 400);
  const csrf = await sign({ nonce: owner.nonce, exp: owner.exp }, env.SESSION_SECRET);
  return html(`<div class="card"><p><a href="${htmlEscape(documentUrl)}${section ? `#${encodeURIComponent(section)}` : ""}">← 문서로 돌아가기</a></p><h1>이 문서에 의견 남기기</h1><p class="muted">의견은 공개 저장소에 기록되어 누구나 읽을 수 있습니다. 저장만 수행하며 문서는 수정되지 않고 Codex 작업도 시작되지 않습니다.</p><p><a href="/handoff">이미 저장한 의견으로 Codex Cloud 수정 요청 준비</a></p>
    <p class="meta"><strong>문서</strong> ${htmlEscape(documentUrl)}<br><strong>절 ID</strong> ${htmlEscape(section || "전체 문서")}<br><strong>게시 revision</strong> <code>${htmlEscape(revision.slice(0, 12))}</code></p>
    <form method="post" action="/api/feedback"><input type="hidden" name="csrf" value="${htmlEscape(csrf)}"><input type="hidden" name="document_url" value="${htmlEscape(documentUrl)}"><input type="hidden" name="document_revision" value="${htmlEscape(revision)}"><input type="hidden" name="section_id" value="${htmlEscape(section)}">
      <label for="location">어느 부분인가요?</label><input id="location" name="location" maxlength="500" required placeholder="예: 첫 번째 그림의 전체 흐름, 또는 문서 전반" autocomplete="off">
      <label for="comment">어떤 점이 아쉽거나 궁금한가요?</label><textarea id="comment" name="comment" maxlength="10000" required placeholder="전체 문맥을 기준으로 자유롭게 적으세요."></textarea>
      <button type="submit">의견만 저장</button></form></div>`);
}

async function installationToken(env) {
  const pem = env.GITHUB_APP_PRIVATE_KEY.replace(/\\n/g, "\n").replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, "");
  const key = await crypto.subtle.importKey("pkcs8", fromBase64Url(pem.replaceAll("+", "-").replaceAll("/", "_")), { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const now = Math.floor(Date.now() / 1000);
  const header = asBase64Url(encoder.encode(JSON.stringify({ alg: "RS256", typ: "JWT" })));
  const payload = asBase64Url(encoder.encode(JSON.stringify({ iat: now - 60, exp: now + 540, iss: env.GITHUB_APP_ID })));
  const data = `${header}.${payload}`;
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, encoder.encode(data));
  const response = await fetch(`https://api.github.com/app/installations/${env.GITHUB_APP_INSTALLATION_ID}/access_tokens`, {
    method: "POST", headers: { Authorization: `Bearer ${data}.${asBase64Url(new Uint8Array(signature))}`, Accept: "application/vnd.github+json", "User-Agent": "traceback-feedback", "Content-Type": "application/json" },
    body: JSON.stringify({ repositories: [env.FEEDBACK_REPO], permissions: { contents: "write" } }),
  });
  if (!response.ok) throw new Error(`GitHub installation token failed (${response.status})`);
  const result = await response.json();
  return result.token;
}

async function saveFeedback(env, record) {
  const token = await installationToken(env);
  const path = `feedback/${record.id}.json`;
  let binary = "";
  for (const byte of encoder.encode(`${JSON.stringify(record, null, 2)}\n`)) binary += String.fromCharCode(byte);
  const content = btoa(binary);
  const response = await fetch(`https://api.github.com/repos/${env.GITHUB_OWNER}/${env.FEEDBACK_REPO}/contents/${path}`, {
    method: "PUT", headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "User-Agent": "traceback-feedback", "Content-Type": "application/json" },
    body: JSON.stringify({ message: `Save feedback ${record.id}`, content }),
  });
  if (!response.ok) throw new Error(`GitHub feedback save failed (${response.status})`);
  return path;
}

async function limitedFormData(request) {
  // A 10,000-character Korean comment can approach 90 KB when URL-encoded.
  const maxBytes = 128 * 1024;
  if (Number(request.headers.get("Content-Length")) > maxBytes) return null;
  const reader = request.body?.getReader();
  if (!reader) return new FormData();
  const chunks = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new Response(bytes, { headers: { "Content-Type": request.headers.get("Content-Type") || "" } }).formData();
}

async function submit(request, env, url) {
  const owner = await session(request, env);
  if (!owner) return new Response("Unauthorized", { status: 401 });
  if (request.headers.get("Origin") !== url.origin) return new Response("Forbidden origin", { status: 403 });
  let fields;
  try { fields = await limitedFormData(request); } catch { return new Response("Invalid form", { status: 400 }); }
  if (!fields) return new Response("Request too large", { status: 413 });
  const csrf = await verify(fields.get("csrf"), env.SESSION_SECRET);
  if (!csrf || csrf.nonce !== owner.nonce) return new Response("Invalid CSRF token", { status: 403 });
  const values = validFields(fields, env);
  if (!values) return html('<div class="card"><h1>입력값을 확인해 주세요</h1><p>문서 주소, 게시 revision, 위치와 의견을 확인하세요.</p></div>', 400);
  const record = { id: crypto.randomUUID(), ...values, author: { github_id: owner.uid, login: owner.login }, created_at: new Date().toISOString() };
  try {
    const path = await saveFeedback(env, record);
    return redirect(`/saved?id=${encodeURIComponent(record.id)}&doc=${encodeURIComponent(record.document_url)}`);
  } catch (error) {
    console.error(error);
    return html('<div class="card"><h1>저장하지 못했습니다</h1><p>잠시 뒤 다시 시도하세요. 문서는 수정되지 않았습니다.</p></div>', 502);
  }
}

async function saved(request, env, url) {
  if (!await session(request, env)) return new Response("Unauthorized", { status: 401 });
  const id = url.searchParams.get("id") || "";
  const documentUrl = validDocument(url.searchParams.get("doc"), env.PUBLIC_SITE_ORIGIN);
  if (!/^[0-9a-f-]{36}$/.test(id) || !documentUrl) return new Response("Invalid feedback reference", { status: 400 });
  const repoUrl = `https://github.com/${env.GITHUB_OWNER}/${env.FEEDBACK_REPO}/blob/main/feedback/${id}.json`;
  const allPrompt = batchPrompt(` 특히 방금 저장한 feedback/${id}.json을 포함하세요.`);
  const onePrompt = `TRACEBACK Study (3 repos) Codex Cloud 환경에서 traceback-team/traceback-artifacts의 feedback/${id}.json을 읽어 주세요. 의견의 문서 URL과 게시 revision을 현재 HTML 및 관련 원본 코드와 비교하고, 타당한 수정만 AGENTS.md와 auth-flow-visualizer 스킬에 따라 반영해 주세요. python3 scripts/verify_site.py와 좁은 화면 및 데스크톱 화면을 확인하고 문서 PR을 만들어 주세요. 자동 병합은 하지 마세요.`;
  return html(`<div class="card"><h1>의견을 저장했습니다</h1><p>의견 ID: <code>${htmlEscape(id)}</code></p><p><a href="${htmlEscape(repoUrl)}">공개 의견 보기</a></p><p class="muted">저장만 완료됐습니다. Codex 작업과 문서 수정은 아직 시작되지 않았습니다.</p>
    <h2>Codex Cloud에서 수정 요청</h2><p>다음 요청을 복사하고 <strong>TRACEBACK Study (3 repos)</strong> 환경에서 새 작업으로 보내세요. 여러 의견을 한 작업에서 검토할 수 있습니다.</p>
    <label for="prompt-all">모든 의견을 한 번에 검토</label><textarea id="prompt-all" readonly>${htmlEscape(allPrompt)}</textarea><button type="button" data-copy="prompt-all">요청 복사</button>
    <details><summary>이번 의견만 검토하려면</summary><label for="prompt-one">이번 의견</label><textarea id="prompt-one" readonly>${htmlEscape(onePrompt)}</textarea><button type="button" data-copy="prompt-one">이번 의견 요청 복사</button></details>
    <p id="copy-status" role="status" aria-live="polite"></p><p><a href="https://chatgpt.com/codex/cloud" target="_blank" rel="noopener noreferrer">Codex Cloud 열기</a> · <a href="${htmlEscape(documentUrl)}">문서로 돌아가기</a></p></div><script src="/handoff.js" defer></script>`);
}

function batchPrompt(recent = "") {
  return `TRACEBACK Study (3 repos) Codex Cloud 환경에서 traceback-team/traceback-artifacts의 feedback/*.json을 모두 읽어 주세요.${recent} 각 의견의 document_url, section_id, location, comment, document_revision을 확인하고 현재 HTML 및 관련 원본 코드와 비교하세요. 중복되거나 이미 반영된 의견은 구분하고, 타당한 의견만 한 번의 아티팩트 변경으로 정리해 주세요. AGENTS.md와 auth-flow-visualizer 스킬을 따르고 python3 scripts/verify_site.py 및 좁은 화면과 데스크톱 화면을 확인하세요. 변경 이유와 반영하지 않은 의견을 설명하고 문서 PR을 만들어 주세요. 자동 병합은 하지 마세요.`;
}

async function handoff(request, env) {
  if (!await session(request, env)) return redirect(`/login?return_to=${encodeURIComponent("/handoff")}`);
  return html(`<div class="card"><h1>저장된 의견으로 수정 요청 준비</h1><p>이 공개 저장소의 모든 의견을 한 번의 Codex Cloud 작업에서 검토합니다. 아직 작업은 시작되지 않았습니다.</p><label for="prompt-all">모든 의견을 검토할 요청</label><textarea id="prompt-all" readonly>${htmlEscape(batchPrompt())}</textarea><button type="button" data-copy="prompt-all">요청 복사</button><p id="copy-status" role="status" aria-live="polite"></p><p><a href="https://chatgpt.com/codex/cloud" target="_blank" rel="noopener noreferrer">Codex Cloud 열기</a> · <a href="${htmlEscape(env.PUBLIC_SITE_ORIGIN)}/traceback-artifacts/">학습 목차로 돌아가기</a></p></div><script src="/handoff.js" defer></script>`);
}

const handoffScript = `document.querySelectorAll('[data-copy]').forEach((button) => {
  button.addEventListener('click', async () => {
    const field = document.getElementById(button.dataset.copy);
    const status = document.getElementById('copy-status');
    try {
      await navigator.clipboard.writeText(field.value);
      status.textContent = '요청을 복사했습니다. Codex Cloud를 열고 새 작업에 붙여넣어 보내세요.';
    } catch {
      field.focus();
      field.select();
      status.textContent = '자동 복사가 되지 않았습니다. 선택된 요청을 직접 복사해 주세요.';
    }
  });
});`;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/healthz" && request.method === "GET") return new Response("ok", { headers: { "Cache-Control": "no-store" } });
    if (url.pathname === "/login" && request.method === "GET") return startLogin(request, env, url);
    if (url.pathname === "/oauth/callback" && request.method === "GET") return completeLogin(request, env, url);
    if (url.pathname === "/new" && request.method === "GET") return newForm(request, env, url);
    if (url.pathname === "/api/feedback" && request.method === "POST") return submit(request, env, url);
    if (url.pathname === "/saved" && request.method === "GET") return saved(request, env, url);
    if (url.pathname === "/handoff" && request.method === "GET") return handoff(request, env);
    if (url.pathname === "/handoff.js" && request.method === "GET") return new Response(handoffScript, { headers: { "Content-Type": "text/javascript; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
    return new Response("Not found", { status: 404 });
  },
};
