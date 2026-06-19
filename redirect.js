// --- SPACES TOOLBAR BUTTON ---

browser.spacesToolbar.addButton('Slack', {
  title: browser.i18n.getMessage("toolbarButtonTitle"),
  defaultIcons: "skin/slack_icon.svg",
  url: "https://app.slack.com/"
});

// --- USER-AGENT SPOOFING ---

browser.webRequest.onBeforeSendHeaders.addListener(
  function (details) {
    for (let header of details.requestHeaders) {
      if (header.name.toLowerCase() === "user-agent") {
        header.value = "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0";
        break;
      }
    }
    return { requestHeaders: details.requestHeaders };
  },
  { urls: ["https://app.slack.com/*", "https://*.slack.com/*"] },
  ["blocking", "requestHeaders"]
);

// --- CONTEXT MENU CODE ---

browser.menus.create({
  id: "share-to-slack",
  title: browser.i18n.getMessage("contextMenuShareText"),
  contexts: ["selection"]
});

function copyToClipboard(text) {
  if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
    return navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
  }
  return fallbackCopy(text);
}

function fallbackCopy(text) {
  const el = document.createElement('textarea');
  el.value = text;
  document.body.appendChild(el);
  el.select();
  document.execCommand('copy');
  document.body.removeChild(el);
  return Promise.resolve();
}

// Injects code directly into the Slack tab context to simulate a clean paste
function insertTextIntoTab(tabId, text, initialDelay = 200) {
  setTimeout(() => {
    browser.tabs.executeScript(tabId, {
      code: `
        (function() {
          let attempts = 0;
          function tryFocusAndPaste() {
            const target = document.querySelector('.ql-editor') ||
                           document.querySelector('div[role="textbox"]') ||
                           document.querySelector('div[contenteditable="true"]');
            if (target) {
              target.focus();
              document.execCommand('insertText', false, ${JSON.stringify(text)});
            } else if (attempts < 15) {
              attempts++;
              setTimeout(tryFocusAndPaste, 250);
            }
          }
          tryFocusAndPaste();
        })();
      `
    }).catch(err => console.error("DOM Injection failed: ", err));
  }, initialDelay);
}

browser.menus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "share-to-slack" && info.selectionText) {
    const textToShare = info.selectionText;

    copyToClipboard(textToShare)
      .then(() => browser.tabs.query({ url: "https://*.slack.com/*" }))
      .then((tabs) => {
        if (tabs.length > 0) {
          const targetTab = tabs[0];
          browser.tabs.update(targetTab.id, { active: true });
          if (targetTab.windowId) {
            browser.windows.update(targetTab.windowId, { focused: true });
          }
          insertTextIntoTab(targetTab.id, textToShare, 150);
        } else {
          browser.tabs.create({ url: "https://app.slack.com/" }).then((newTab) => {
            const statusListener = (tabId, changeInfo) => {
              if (tabId === newTab.id && changeInfo.status === 'complete') {
                browser.tabs.onUpdated.removeListener(statusListener);
                insertTextIntoTab(newTab.id, textToShare, 1000);
              }
            };
            browser.tabs.onUpdated.addListener(statusListener);
          });
        }
      })
      .catch((error) => {
        console.error("Error executing Share to Slack action: ", error);
      });
  }
});

// --- SLACK NOTIFICATION CODE ---
//
// Slack encodes unread state in the tab title in (at least) two ways:
//   * "(N) Slack | ..."  -> N direct mentions / DMs (a count)
//   * "* Slack | ..."     -> general unread activity (no count, just a marker)
// We notify when the mention count increases, or when the asterisk marker
// newly appears. State resets when the title returns to a clean (read) form.

const slackState = new Map(); // tabId -> { count, hadStar }

browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.title && tab.url && tab.url.includes("slack.com")) {
    const title = changeInfo.title;

    // TEMPORARY: confirm Slack's real title format, then remove this.
    console.log("Slack tab title:", JSON.stringify(title));

    const prev = slackState.get(tabId) || { count: 0, hadStar: false };

    // Count form: "(3) ..."
    const countMatch = title.match(/\((\d+)\+?\)/);
    const count = countMatch ? parseInt(countMatch[1], 10) : 0;

    // Asterisk form: leading "*" indicating general unread activity.
    const hasStar = /^\s*\*/.test(title);

    let shouldNotify = false;
    let body = "You have new Slack activity.";

    if (count > prev.count) {
      shouldNotify = true;
      body = count === 1 ? "You have a new mention or message."
                         : `You have ${count} new mentions or messages.`;
    } else if (hasStar && !prev.hadStar) {
      shouldNotify = true;
      body = "You have new unread messages.";
    }

    if (shouldNotify) {
      browser.notifications.create("slack-unread-alert", {
        type: "basic",
        iconUrl: "skin/slack_icon.png",
        title: "Slack",
        message: body
      }).catch((error) => {
        console.error("Failed to create notification:", error);
      });
    }

    slackState.set(tabId, { count, hadStar: hasStar });
  }
});

// Clean up tracking when a tab is closed
browser.tabs.onRemoved.addListener((tabId) => {
  slackState.delete(tabId);
});

// Focus the Slack tab when the notification is clicked
browser.notifications.onClicked.addListener((notificationId) => {
  if (notificationId === "slack-unread-alert") {
    browser.tabs.query({ url: "https://*.slack.com/*" }).then((tabs) => {
      if (tabs.length > 0) {
        browser.tabs.update(tabs[0].id, { active: true });
        if (tabs[0].windowId) {
          browser.windows.update(tabs[0].windowId, { focused: true });
        }
      }
    }).catch((error) => {
      console.error("Error focusing Slack tab via notification click: ", error);
    });
  }
});
