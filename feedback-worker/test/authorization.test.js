import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import worker from "../src/index.js";

const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const env = {
  SESSION_SECRET: "test-secret-with-enough-random-characters-for-hmac",
  GITHUB_APP_CLIENT_ID: "Iv1.test",
  GITHUB_APP_CLIENT_SECRET: "server-only-client-secret",
  GITHUB_APP_ID: "12345",
  GITHUB_APP_INSTALLATION_ID: "67890",
  GITHUB_APP_PRIVATE_KEY: privateKey.export({ type: "pkcs8", format: "pem" }),
  GITHUB_OWNER: "traceback-team",
  FEEDBACK_REPO: "traceback-artifacts",
  ALLOWED_GITHUB_USER_ID: "88140361",
  PUBLIC_SITE_ORIGIN: "https://traceback-team.github.io",
};
const root = "https://traceback-feedback.example.workers.dev";
const doc = "https://traceback-team.github.io/traceback-artifacts/traceback-system-guide.html";
const revision = "a".repeat(40);

function request(path, options = {}) {
  return new Request(`${root}${path}`, options);
}

function cookieFrom(response, name) {
  const item = response.headers.getSetCookie().find((value) => value.startsWith(`${name}=`));
  assert.ok(item, `${name} cookie missing`);
  return item.split(";")[0];
}

async function logIn(githubId) {
  const start = await worker.fetch(request(`/login?return_to=${encodeURIComponent(`/new?doc=${encodeURIComponent(doc)}&rev=${revision}`)}`), env);
  assert.equal(start.status, 303);
  const state = new URL(start.headers.get("Location")).searchParams.get("state");
  const oauth = cookieFrom(start, "tb_oauth");
  const callback = await worker.fetch(request(`/oauth/callback?state=${state}&code=example`, { headers: { Cookie: oauth } }), env);
  assert.equal(callback.status, githubId === 88140361 ? 303 : 403);
  return callback;
}

test("only the owner can save feedback and saving cannot start an edit", async () => {
  const originalFetch = globalThis.fetch;
  const githubCalls = [];
  let githubId = 123456;
  globalThis.fetch = async (url, options = {}) => {
    githubCalls.push({ url: String(url), options });
    if (String(url).endsWith("/login/oauth/access_token")) return Response.json({ access_token: "test-user-token" });
    if (String(url).endsWith("/user")) return Response.json({ id: githubId, login: githubId === 88140361 ? "oscar2272" : "another-user" });
    if (String(url).endsWith("/access_tokens")) return Response.json({ token: "test-installation-token" });
    if (String(url).includes("/contents/feedback/")) return Response.json({ content: { sha: "saved" } }, { status: 201 });
    throw new Error(`Unexpected GitHub request: ${url}`);
  };

  try {
    const anonymous = await worker.fetch(request("/api/feedback", { method: "POST", headers: { Origin: root }, body: new URLSearchParams() }), env);
    assert.equal(anonymous.status, 401);
    const anonymousHandoff = await worker.fetch(request("/handoff"), env);
    assert.equal(anonymousHandoff.status, 303);
    assert.match(anonymousHandoff.headers.get("Location"), /return_to=%2Fhandoff/);
    const anonymousExecute = await worker.fetch(request("/api/execute", { method: "POST" }), env);
    assert.equal(anonymousExecute.status, 404);
    assert.equal(githubCalls.length, 0);

    const rejected = await logIn(githubId);
    assert.match(await rejected.text(), /저장할 수 없습니다/);
    const rejectedExecute = await worker.fetch(request("/api/execute", { method: "POST" }), env);
    assert.equal(rejectedExecute.status, 404);
    assert.equal(githubCalls.filter((call) => call.url.includes("/contents/")).length, 0);

    githubId = 88140361;
    const accepted = await logIn(githubId);
    const session = cookieFrom(accepted, "tb_session");
    const form = await worker.fetch(request(`/new?doc=${encodeURIComponent(doc)}&rev=${revision}&section=${encodeURIComponent("전체-흐름")}`, { headers: { Cookie: session } }), env);
    assert.equal(form.status, 200);
    const formHtml = await form.text();
    assert.match(formHtml, /공개 저장소에 기록되어 누구나 읽을 수 있습니다/);
    assert.match(formHtml, /이미 저장한 의견으로 Codex Cloud 수정 요청 준비/);
    const batchHandoff = await worker.fetch(request("/handoff", { headers: { Cookie: session } }), env);
    assert.equal(batchHandoff.status, 200);
    assert.match(await batchHandoff.text(), /feedback\/\*\.json을 모두 읽어 주세요/);
    const csrf = formHtml.match(/name="csrf" value="([^"]+)"/)?.[1];
    assert.ok(csrf);

    const fields = new URLSearchParams({ csrf, document_url: doc, document_revision: revision, section_id: "전체-흐름", location: "문서 전체 흐름", comment: "전체 맥락을 더 분명히 설명해 주세요." });
    const badOrigin = await worker.fetch(request("/api/feedback", { method: "POST", headers: { Cookie: session, Origin: "https://attacker.example" }, body: fields }), env);
    assert.equal(badOrigin.status, 403);
    const badCsrf = await worker.fetch(request("/api/feedback", { method: "POST", headers: { Cookie: session, Origin: root }, body: new URLSearchParams({ ...Object.fromEntries(fields), csrf: "forged" }) }), env);
    assert.equal(badCsrf.status, 403);
    const external = await worker.fetch(request("/api/feedback", { method: "POST", headers: { Cookie: session, Origin: root }, body: new URLSearchParams({ ...Object.fromEntries(fields), document_url: "https://attacker.example/guide.html" }) }), env);
    assert.equal(external.status, 400);
    assert.equal(githubCalls.filter((call) => call.url.includes("/contents/")).length, 0);

    const saved = await worker.fetch(request("/api/feedback", { method: "POST", headers: { Cookie: session, Origin: root }, body: fields }), env);
    assert.equal(saved.status, 303);
    const savedPage = await worker.fetch(new Request(new URL(saved.headers.get("Location"), root), { headers: { Cookie: session } }), env);
    assert.equal(savedPage.status, 200);
    const savedHtml = await savedPage.text();
    assert.match(savedHtml, /공개 의견 보기/);
    assert.match(savedHtml, /github\.com\/traceback-team\/traceback-artifacts\/blob\/main\/feedback\//);
    assert.match(savedHtml, /feedback\/\*\.json을 모두 읽어 주세요/);
    assert.match(savedHtml, /이번 의견만 검토하려면/);
    assert.match(savedHtml, /https:\/\/chatgpt\.com\/codex\/cloud/);
    assert.match(savedHtml, /Codex 작업과 문서 수정은 아직 시작되지 않았습니다/);
    const handoff = await worker.fetch(request("/handoff.js"), env);
    assert.equal(handoff.status, 200);
    assert.match(await handoff.text(), /navigator\.clipboard\.writeText/);
    const write = githubCalls.find((call) => call.url.includes("/contents/feedback/"));
    assert.ok(write);
    assert.match(write.url, /^https:\/\/api\.github\.com\/repos\/traceback-team\/traceback-artifacts\/contents\/feedback\/[^/]+\.json$/);
    assert.equal(write.options.method, "PUT");
    const payload = JSON.parse(write.options.body);
    const record = JSON.parse(Buffer.from(payload.content, "base64").toString("utf8"));
    assert.equal(record.document_url, doc);
    assert.equal(record.document_revision, revision);
    assert.equal(record.section_id, "전체-흐름");
    assert.equal(record.selected_text, null);
    assert.equal(record.location, "문서 전체 흐름");
    assert.equal(record.comment, "전체 맥락을 더 분명히 설명해 주세요.");
    assert.equal(record.author.github_id, 88140361);

    const longestComment = new URLSearchParams({ ...Object.fromEntries(fields), comment: "가".repeat(10000) });
    const acceptedLong = await worker.fetch(request("/api/feedback", { method: "POST", headers: { Cookie: session, Origin: root }, body: longestComment }), env);
    assert.equal(acceptedLong.status, 303);
    const tooLarge = new URLSearchParams({ ...Object.fromEntries(fields), comment: "가".repeat(20000) });
    const rejectedLarge = await worker.fetch(request("/api/feedback", { method: "POST", headers: { Cookie: session, Origin: root }, body: tooLarge }), env);
    assert.equal(rejectedLarge.status, 413);

    const edit = await worker.fetch(request("/api/modify", { method: "POST", headers: { Cookie: session, Origin: root } }), env);
    assert.equal(edit.status, 404);
    assert.equal(githubCalls.filter((call) => call.url.includes("/contents/")).length, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
