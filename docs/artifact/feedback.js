/* Site-wide feedback link. The deployed site-config.json contains no secrets. */
(() => {
  const script = document.currentScript;
  if (!script) return;

  const navigation = document.createElement("script");
  navigation.src = new URL("navigation.js?v=2", script.src).href;
  navigation.defer = true;
  document.head.append(navigation);

  fetch(new URL("site-config.json", script.src), { cache: "no-store" })
    .then((response) => {
      if (!response.ok) throw new Error("Feedback is not configured");
      return response.json();
    })
    .then(({ revision, feedback_origin: origin }) => {
      if (!/^[a-f0-9]{40}$/.test(revision)) return;
      const worker = new URL(origin);
      if (worker.protocol !== "https:" || worker.pathname !== "/" || worker.search || worker.hash) return;

      const link = document.createElement("a");
      link.textContent = "의견 남기기";
      link.setAttribute("aria-label", "현재 문서에 공개 의견 남기기");
      link.className = "traceback-feedback-link";
      const style = document.createElement("style");
      style.textContent = `.traceback-feedback-link{position:fixed;left:16px;bottom:16px;z-index:40;display:inline-flex;align-items:center;min-height:44px;padding:8px 16px;border-radius:999px;background:#176b91;color:#fff!important;font:700 15px/1.4 system-ui,"Apple SD Gothic Neo",sans-serif;text-decoration:none;box-shadow:0 5px 18px #172b3840}.traceback-feedback-link:focus-visible{outline:3px solid #172b38;outline-offset:3px}@media print{.traceback-feedback-link{display:none}}`;
      const update = () => {
        const target = new URL("/new", worker);
        target.searchParams.set("doc", location.origin + location.pathname);
        target.searchParams.set("rev", revision);
        let section = "";
        try { section = decodeURIComponent(location.hash.slice(1)); } catch { /* Invalid fragments are treated as the whole document. */ }
        if (section && document.getElementById(section)) target.searchParams.set("section", section);
        link.href = target.href;
      };
      update();
      link.addEventListener("click", update);
      window.addEventListener("hashchange", update);
      document.head.append(style);
      document.body.append(link);
    })
    .catch(() => {});
})();
