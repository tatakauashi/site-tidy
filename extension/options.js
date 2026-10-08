const $ = id => document.getElementById(id);
let editing = null;
function status(message) { $("status").textContent = message; }
function button(text, handler) {
  const element = document.createElement("button"); element.type = "button";
  element.className = "secondary"; element.textContent = text;
  element.addEventListener("click", () => Promise.resolve().then(handler).catch(error => status(error.message)));
  return element;
}
async function getRules() { return (await chrome.storage.local.get({ rules: [] })).rules; }
function reset() { editing = null; $("editor").reset(); $("editor-title").textContent = "ルールを追加"; }
async function render() {
  const rules = await getRules(); $("rules").replaceChildren();
  if (!rules.length) $("rules").textContent = "まだルールがありません。下のフォームから追加してください。";
  for (const rule of rules) {
    const row = document.createElement("div"); row.className = "row";
    const toggle = document.createElement("input"); toggle.type = "checkbox"; toggle.checked = rule.enabled;
    toggle.setAttribute("aria-label", rule.name + "を有効にする");
    toggle.addEventListener("change", async () => {
      try { const latest = await getRules(); const target = latest.find(item => item.id === rule.id); if (target) target.enabled = toggle.checked;
        await chrome.storage.local.set({ rules: latest }); rule.enabled = toggle.checked; status("ルールの有効／無効を反映しました。");
      } catch (error) { toggle.checked = !toggle.checked; status(error.message); }
    });
    const description = document.createElement("div"); description.className = "description";
    const name = document.createElement("strong"); name.textContent = rule.name;
    const pattern = document.createElement("small"); pattern.textContent = rule.pattern;
    description.append(name, pattern);
    row.append(toggle, description, button("編集", () => {
      editing = rule.id; for (const key of ["name", "pattern", "selectors"]) $(key).value = rule[key];
      $("enabled").checked = rule.enabled; $("editor-title").textContent = "ルールを編集"; $("name").focus();
    }), button("削除", async () => {
      if (!confirm("「" + rule.name + "」を削除しますか？")) return;
      await chrome.storage.local.set({ rules: (await getRules()).filter(item => item.id !== rule.id) });
      if (editing === rule.id) reset(); await render(); status("ルールを削除しました。");
    })); $("rules").append(row);
  }
  $("permissions").replaceChildren();
  for (const origin of (await chrome.permissions.getAll()).origins || []) {
    const row = document.createElement("div"); row.className = "row";
    const text = document.createElement("span"); text.className = "description"; text.textContent = origin;
    row.append(text, button("許可を取り消す", async () => {
      await chrome.permissions.remove({ origins: [origin] }); await chrome.runtime.sendMessage({ type: "sync" });
      await render(); status("許可を取り消しました。開いている対象ページを再読み込みしてください。");
    })); $("permissions").append(row);
  }
}
$("editor").addEventListener("submit", async event => {
  event.preventDefault();
  try {
    const pattern = $("pattern").value.trim(); SiteRules.parsePattern(pattern);
    const selectors = SiteRules.selectors($("selectors").value, document).join("\n");
    const name = $("name").value.trim(); if (!name) throw new Error("ルール名を入力してください。");
    const rule = { id: editing || crypto.randomUUID(), name, pattern, selectors, enabled: $("enabled").checked };
    const rules = await getRules(); const index = rules.findIndex(item => item.id === rule.id);
    if (index < 0) rules.push(rule); else rules[index] = rule;
    await chrome.storage.local.set({ rules }); reset(); await render();
    status("保存しました。許可済みの開いているページにも反映されます。");
  } catch (error) { status(error.message); }
});
$("grant").addEventListener("click", async () => {
  try {
    const host = $("permission-host").value.trim().toLowerCase();
    if (!/^(?:\*\.)?[a-z0-9]+(?:[a-z0-9.-]*[a-z0-9])?$/.test(host) || !host.includes(".") || host.includes("..")) throw new Error("example.com または *.example.com の形式で入力してください。");
    const granted = await chrome.permissions.request({ origins: ["http://" + host + "/*", "https://" + host + "/*"] });
    if (!granted) { status("サイトへの許可がキャンセルされました。"); return; }
    const result = await chrome.runtime.sendMessage({ type: "sync" }); if (result.error) throw new Error(result.error);
    await render(); status("サイトを許可しました。対象ページを再読み込みしてください。");
  } catch (error) { status(error.message); }
});
$("cancel").addEventListener("click", reset);
$("add").addEventListener("click", () => { reset(); $("name").focus(); });
render().catch(error => status(error.message));
