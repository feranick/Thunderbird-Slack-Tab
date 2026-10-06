// Options page: lets the user mute or display Slack notifications.

const DEFAULTS = { showNotifications: true };

// Localize every element tagged with data-i18n
document.querySelectorAll("[data-i18n]").forEach((el) => {
  el.textContent = browser.i18n.getMessage(el.dataset.i18n);
});

const checkbox = document.getElementById("showNotifications");
const status = document.getElementById("status");

browser.storage.local.get(DEFAULTS).then((prefs) => {
  checkbox.checked = prefs.showNotifications;
});

checkbox.addEventListener("change", () => {
  browser.storage.local.set({ showNotifications: checkbox.checked }).then(() => {
    status.textContent = browser.i18n.getMessage("optionsSaved");
    setTimeout(() => { status.textContent = ""; }, 1500);
  }).catch((error) => {
    console.error("Failed to save preference:", error);
  });
});
