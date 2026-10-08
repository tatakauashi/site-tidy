(() => {
  if (globalThis.__siteRulesLoaded) return;
  globalThis.__siteRulesLoaded = true;
  let rules = [];
  let lastUrl = "";
  const style = document.createElement("style");
  style.dataset.siteScripter = "true";
  function apply() {
    lastUrl = location.href;
    const css = [];
    for (const rule of rules) {
      if (!rule.enabled || !SiteRules.matches(rule.pattern, lastUrl)) continue;
      try {
        for (const selector of SiteRules.selectors(rule.selectors, document)) {
          css.push(selector + " { display: none !important; }");
        }
      } catch { /* Ignore invalid stored rules; never interpret them as code. */ }
    }
    style.textContent = css.join("\n");
    if (document.documentElement && !style.isConnected) document.documentElement.append(style);
  }
  const observer = new MutationObserver(() => {
    if (document.documentElement && !style.isConnected) apply();
  });
  observer.observe(document, { childList: true, subtree: true });
  chrome.storage.local.get({ rules: [] }).then(data => { rules = data.rules; apply(); });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.rules) { rules = changes.rules.newValue || []; apply(); }
  });
  setInterval(() => { if (lastUrl !== location.href) apply(); }, 750);
})();
