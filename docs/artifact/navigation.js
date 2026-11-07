(() => {
  const script = document.currentScript;
  if (!script) return;
  const root = new URL("./", script.src);
  const css = document.createElement("link");
  css.rel = "stylesheet";
  css.href = new URL("styles/navigation.css", root).href;
  document.head.append(css);

  const normalizePath = (url) => {
    const path = new URL(url, location.href).pathname.replace(/\/+$/, "");
    return path.endsWith("/index.html") ? path.slice(0, -11) : path;
  };
  const currentPath = normalizePath(location.href);
  const isIndex = normalizePath(location.href) === normalizePath(new URL("index.html", root));
  const resumeUrl = new URL("resume/index.html", root);
  const isResume = currentPath === normalizePath(resumeUrl);
  const storage = {
    get(key) { try { return localStorage.getItem(key); } catch { return null; } },
    set(key, value) { try { localStorage.setItem(key, value); } catch {} },
  };
  const session = {
    get(key) { try { return sessionStorage.getItem(key); } catch { return null; } },
    set(key, value) { try { sessionStorage.setItem(key, value); } catch {} },
  };

  function collectionFromHash(catalog) {
    if (!isIndex) return null;
    const view = decodeURIComponent(location.hash.replace(/^#view=/, ""));
    const collectionMatch = view.match(/^collection:([^:]+)$/);
    if (collectionMatch) return collectionMatch[1];
    const subjectMatch = view.match(/^(?:subject|topic):([^:]+)/);
    if (!subjectMatch) return null;
    return catalog.subjects.find((subject) => subject.id === subjectMatch[1])?.collection || null;
  }

  function flatten(catalog) {
    const collections = new Map(catalog.collections.map((item) => [item.id, item]));
    const documents = [];
    for (const subject of catalog.subjects) {
      const collection = collections.get(subject.collection);
      for (const topic of subject.topics) {
        for (const artifact of topic.artifacts) {
          documents.push({ ...artifact, collection, subject, topic, absolute: new URL(artifact.href, root).href });
        }
      }
    }
    return { collections, documents };
  }

  function start(catalog) {
    const { collections, documents } = flatten(catalog);
    const current = documents.find((item) => normalizePath(item.absolute) === currentPath);
    let activeCollection = current?.collection.id || collectionFromHash(catalog) || storage.get("traceback-nav-collection") || "study";
    if (!collections.has(activeCollection)) activeCollection = "study";

    const header = document.createElement("header");
    header.className = "tb-global-header";
    header.innerHTML = `<button class="tb-menu" type="button" aria-label="문서 탐색 열기" aria-expanded="false" aria-controls="tb-sidebar">☰</button><a class="tb-logo" href="${new URL("index.html", root).href}">TRACEBACK DOCS</a><nav class="tb-switch" aria-label="문서 영역 전환"></nav><a class="tb-resume-link" href="${resumeUrl.href}"${isResume ? ' aria-current="page"' : ""}>소개</a><div class="tb-context"><code>${current?.id || (isIndex ? "DOCS-HOME" : isResume ? "PROFILE-01" : "REFERENCE")}</code><span>${current?.title || document.querySelector("h1")?.textContent?.trim() || document.title}</span></div><div class="tb-search-box"><input class="tb-search" type="search" aria-label="전체 문서 검색" placeholder="전체 문서 검색"><span class="tb-search-icon" aria-hidden="true">⌕</span></div><button class="tb-search-toggle" type="button" aria-label="전체 문서 검색 열기">⌕</button>`;
    document.body.prepend(header);

    const sidebar = document.createElement("aside");
    sidebar.className = "tb-sidebar";
    sidebar.id = "tb-sidebar";
    sidebar.setAttribute("aria-label", "문서 탐색");
    sidebar.innerHTML = `<div class="tb-sidebar-head"><div><small>DOCUMENT TREE</small><strong>분야 → 주제 → 문서</strong></div><button class="tb-sidebar-close" type="button" aria-label="문서 탐색 닫기">×</button></div><div class="tb-sidebar-current"></div><nav class="tb-tree"></nav>`;
    document.body.append(sidebar);
    const backdrop = document.createElement("div");
    backdrop.className = "tb-sidebar-backdrop";
    backdrop.hidden = true;
    document.body.append(backdrop);
    const results = document.createElement("div");
    results.className = "tb-search-results";
    results.hidden = true;
    results.setAttribute("role", "listbox");
    document.body.append(results);

    const switcher = header.querySelector(".tb-switch");
    const tree = sidebar.querySelector(".tb-tree");
    const currentBox = sidebar.querySelector(".tb-sidebar-current");
    const menuButton = header.querySelector(".tb-menu");
    const search = header.querySelector(".tb-search");
    const searchToggle = header.querySelector(".tb-search-toggle");
    document.querySelectorAll("a[href]").forEach((link) => {
      if (!link.closest(".tb-global-header") && normalizePath(link.href) === normalizePath(new URL("index.html", root))) {
        link.classList.add("tb-redundant-index-link");
      }
    });

    function renderSwitcher() {
      switcher.innerHTML = [...collections.values()].map((collection) => `<button type="button" data-collection="${collection.id}" aria-pressed="${collection.id === activeCollection}">${collection.title}</button>`).join("");
      switcher.querySelectorAll("button").forEach((button) => button.addEventListener("click", () => {
        activeCollection = button.dataset.collection;
        storage.set("traceback-nav-collection", activeCollection);
        renderSwitcher();
        renderTree(true);
        setSidebar(true);
      }));
    }

    function openStateKey() { return `traceback-nav-open:${activeCollection}`; }
    function scrollStateKey() { return `traceback-nav-scroll:${activeCollection}`; }
    function storedOpenKeys() {
      try { return new Set(JSON.parse(storage.get(openStateKey()) || "[]")); } catch { return new Set(); }
    }
    function saveTreeState() {
      const openKeys = [...tree.querySelectorAll("details[open][data-nav-key]")].map((detail) => detail.dataset.navKey);
      storage.set(openStateKey(), JSON.stringify(openKeys));
      storage.set(scrollStateKey(), String(tree.scrollTop));
    }

    function renderTree(animate = false) {
      const subjects = catalog.subjects.filter((subject) => subject.collection === activeCollection);
      const openKeys = storedOpenKeys();
      tree.innerHTML = subjects.map((subject) => {
        const subjectCurrent = current?.subject.id === subject.id;
        const topics = subject.topics.map((topic) => {
          const topicCurrent = subjectCurrent && current?.topic.id === topic.id;
          const topicKey = `${subject.id}/${topic.id}`;
          const links = topic.artifacts.map((artifact) => {
            const absolute = new URL(artifact.href, root).href;
            const active = normalizePath(absolute) === currentPath;
            return `<a class="tb-doc-link" href="${absolute}"${active ? ' aria-current="page"' : ""}><code>${artifact.id}</code><span>${artifact.title}</span></a>`;
          }).join("");
          return `<details class="tb-topic" data-nav-key="${topicKey}"${topicCurrent || openKeys.has(topicKey) ? " open" : ""}><summary>${topic.title}</summary>${links}</details>`;
        }).join("");
        return `<details class="tb-subject" data-nav-key="${subject.id}"${subjectCurrent || openKeys.has(subject.id) ? " open" : ""}><summary>${subject.title}</summary>${topics}</details>`;
      }).join("");
      const collection = collections.get(activeCollection);
      const currentInTree = current && current.collection.id === activeCollection;
      currentBox.innerHTML = currentInTree ? `<code>${current.id}</code><b>${current.title}</b><span>${current.collection.title} / ${current.subject.title} / ${current.topic.title}</span>` : `<code>${isIndex ? "DOCS-HOME" : collection.label}</code><b>${collection.title}</b><span>${isIndex ? "분야와 주제를 펼쳐 실제 문서를 선택하세요." : "현재 문서는 그대로 두고 이 영역의 트리를 탐색합니다."}</span>`;
      tree.scrollTop = Number(storage.get(scrollStateKey())) || 0;
      if (animate && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
        tree.animate([
          { opacity: .35, transform: "translateX(-4px)" },
          { opacity: 1, transform: "translateX(0)" },
        ], { duration: 160, easing: "ease-out" });
        currentBox.animate([{ opacity: .45 }, { opacity: 1 }], { duration: 140, easing: "ease-out" });
      }
    }

    function setSidebar(open) {
      document.body.classList.toggle("tb-sidebar-open", open);
      menuButton.setAttribute("aria-expanded", String(open));
      menuButton.setAttribute("aria-label", open ? "문서 탐색 닫기" : "문서 탐색 열기");
      backdrop.hidden = !open || matchMedia("(min-width:1180px)").matches;
    }

    function renderResults(query) {
      const q = query.trim().toLocaleLowerCase();
      if (!q) { results.hidden = true; results.innerHTML = ""; return; }
      const matches = documents.filter((item) => [item.id, item.title, item.description, item.subject.title, item.topic.title].join(" ").toLocaleLowerCase().includes(q)).slice(0, 12);
      results.innerHTML = matches.length ? matches.map((item) => `<a role="option" href="${item.absolute}"><code>${item.id}</code><b>${item.title}</b><small>${item.subject.title} / ${item.topic.title} · ${item.description}</small></a>`).join("") : `<div class="tb-search-empty">일치하는 문서가 없습니다.</div>`;
      results.hidden = false;
    }

    renderSwitcher();
    renderTree(false);
    setSidebar(false);
    void document.body.offsetWidth;
    document.body.classList.add("tb-nav-ready");
    menuButton.addEventListener("click", () => setSidebar(!document.body.classList.contains("tb-sidebar-open")));
    sidebar.querySelector(".tb-sidebar-close").addEventListener("click", () => setSidebar(false));
    backdrop.addEventListener("click", () => setSidebar(false));
    search.addEventListener("input", () => renderResults(search.value));
    search.addEventListener("focus", () => renderResults(search.value));
    searchToggle.addEventListener("click", () => { const opening = !header.classList.contains("tb-searching"); header.classList.toggle("tb-searching", opening); if (opening) search.focus(); else { search.value = ""; renderResults(""); } });
    document.addEventListener("keydown", (event) => { if (event.key !== "Escape") return; results.hidden = true; if (matchMedia("(max-width:1179px)").matches) setSidebar(false); header.classList.remove("tb-searching"); });
    document.addEventListener("click", (event) => { if (!header.contains(event.target) && !results.contains(event.target)) results.hidden = true; });
    tree.addEventListener("click", (event) => {
      if (event.target.closest("summary")) setTimeout(saveTreeState, 0);
      if (event.target.closest("a")) saveTreeState();
      if (event.target.closest("a") && matchMedia("(max-width:1179px)").matches) setSidebar(false);
    });
    tree.addEventListener("scroll", () => storage.set(scrollStateKey(), String(tree.scrollTop)), { passive: true });
  }

  const boot = () => {
    const cached = session.get("traceback-nav-catalog");
    if (cached) {
      try { start(JSON.parse(cached)); return; } catch {}
    }
    fetch(new URL("catalog.json", root)).then((response) => {
    if (!response.ok) throw new Error("catalog unavailable");
    return response.json();
    }).then((catalog) => { session.set("traceback-nav-catalog", JSON.stringify(catalog)); start(catalog); }).catch(() => {});
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true }); else boot();
})();
