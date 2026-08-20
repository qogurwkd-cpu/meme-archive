import assert from "node:assert/strict";
import test from "node:test";

async function render(path = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const workerModule = await import(workerUrl.href);
  const worker = workerModule.default;
  const fetchHandler =
    typeof worker === "function"
      ? worker
      : typeof worker?.fetch === "function"
        ? worker.fetch.bind(worker)
        : null;

  assert.ok(fetchHandler, "built worker must expose a fetch handler");

  return fetchHandler(
    new Request(`http://localhost${path}`, {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the minimal troll entrance", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /입장하기/);
  assert.doesNotMatch(
    html,
    /웃음은|Internet culture|ACCESS|장난 라운드|codex-preview|react-loading-skeleton/i,
  );
});

test("server-renders the meme archive foundation", async () => {
  const response = await render("/memes");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /오늘도 인터넷은/);
  assert.match(html, /월요일의 나/);
  assert.match(html, /제목이나 태그를 검색하세요/);
});

test("server-renders the mini game foundation", async () => {
  const response = await render("/game");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Space \/ ↑ 점프/);
  assert.match(html, /EXIT에/);
  assert.match(html, /모바일 게임 조작/);
  assert.doesNotMatch(
    html,
    /Score|Lives|Leaderboard|Game Over|Collapse Floor|Break Head|Overjump|Shatter/i,
  );
});
