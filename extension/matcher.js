(function (root) {
  function parsePattern(input) {
    const text = input.trim();
    if (!text || text.length > 2048) throw new Error("URL条件を入力してください（2048文字以内）。");
    const match = /^(?:(https?):\/\/)?([^/]+)(\/[^?#]*)?$/.exec(text);
    if (!match) throw new Error("URL条件はホスト名とパスで指定してください。クエリ・#は指定できません。");
    const host = match[2].toLowerCase();
    if (!/^[a-z0-9*?.-]+$/.test(host) || !host.includes(".") || host === "*" || host.includes("..")) {
      throw new Error("ホスト名は example.com や *.example.com の形式で指定してください。");
    }
    return { scheme: match[1], host, path: match[3] || "/*" };
  }
  function glob(pattern, value) {
    const escaped = pattern.split(/([*?])/).map(part => part === "*" ? ".*" : part === "?" ? "." : part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("");
    return new RegExp("^" + escaped + "$", "u").test(value);
  }
  function matches(pattern, address) {
    try {
      const rule = parsePattern(pattern);
      const url = new URL(address);
      if (!["http:", "https:"].includes(url.protocol)) return false;
      if (rule.scheme && url.protocol !== rule.scheme + ":") return false;
      const hostMatch = rule.host.startsWith("*.")
        ? glob(rule.host.slice(2), url.hostname) || glob(rule.host, url.hostname)
        : glob(rule.host, url.hostname);
      return hostMatch && glob(rule.path, url.pathname);
    } catch { return false; }
  }
  function selectors(text, document) {
    const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    if (!lines.length || text.length > 20000) throw new Error("セレクターを1行に1つ入力してください（合計20000文字以内）。");
    for (const line of lines) {
      if (/[{}]/.test(line) || line.includes("/*") || line.includes("*/")) throw new Error("CSSの宣言やコメントは入力できません。セレクターだけを指定してください。");
      try {
        document.querySelector(line);
        if (document.defaultView?.CSSStyleSheet) {
          const sheet = new document.defaultView.CSSStyleSheet();
          sheet.insertRule(line + " { display: none !important; }", 0);
        }
      }
      catch { throw new Error("無効なCSSセレクター: " + line); }
    }
    return lines;
  }
  const api = { parsePattern, matches, selectors };
  root.SiteRules = api;
  if (typeof module !== "undefined") module.exports = api;
})(globalThis);
