let pending = Promise.resolve();
function synchronize() {
  pending = pending.catch(() => {}).then(async () => {
    const permissions = await chrome.permissions.getAll();
    const matches = (permissions.origins || []).filter(origin => /^https?:\/\//.test(origin));
    const registered = await chrome.scripting.getRegisteredContentScripts({ ids: ["site-rules"] });
    if (!matches.length) {
      if (registered.length) await chrome.scripting.unregisterContentScripts({ ids: ["site-rules"] });
      return;
    }
    const script = { id: "site-rules", matches, js: ["matcher.js", "content.js"], runAt: "document_start", persistAcrossSessions: true };
    if (registered.length) await chrome.scripting.updateContentScripts([script]);
    else await chrome.scripting.registerContentScripts([script]);
  });
  return pending;
}
for (const event of [chrome.runtime.onInstalled, chrome.runtime.onStartup, chrome.permissions.onAdded, chrome.permissions.onRemoved]) {
  event.addListener(() => { synchronize().catch(console.error); });
}
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (sender.id !== chrome.runtime.id || sender.url?.startsWith(chrome.runtime.getURL("")) !== true || message?.type !== "sync") return;
  synchronize().then(() => respond({ ok: true }), error => respond({ error: error.message }));
  return true;
});
