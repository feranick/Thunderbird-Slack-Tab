browser.spacesToolbar.addButton('Slack', {
    title: browser.i18n.getMessage("toolbarButtonTitle"),
    defaultIcons: "skin/slack_icon.svg",
    url: "https://app.slack.com/"
});

browser.webRequest.onBeforeSendHeaders.addListener(
  function(details) {
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
            // Target Slack's rich text editor classes or generic contenteditables
            const target = document.querySelector('.ql-editor') || 
                           document.querySelector('div[role="textbox"]') || 
                           document.querySelector('div[contenteditable="true"]');
            
            if (target) {
              target.focus();
              // Executing 'insertText' preserves Slack's React/Quill internal state updates
              document.execCommand('insertText', false, ${JSON.stringify(text)});
            } else if (attempts < 15) {
              // If Slack is still rendering or changing channels, poll again shortly
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
      .then(() => {
        return browser.tabs.query({ url: "https://*.slack.com/*" });
      })
      .then((tabs) => {
        if (tabs.length > 0) {
          const targetTab = tabs[0];
          browser.tabs.update(targetTab.id, { active: true });
          
          if (targetTab.windowId) {
            browser.windows.update(targetTab.windowId, { focused: true });
          }
          
          // Tab is already open; inject and target the input field immediately
          insertTextIntoTab(targetTab.id, textToShare, 150);
        } else {
          // No tab open; create a new one and wait for it to load before injecting
          browser.tabs.create({ url: "https://app.slack.com/" }).then((newTab) => {
            const statusListener = (tabId, changeInfo) => {
              if (tabId === newTab.id && changeInfo.status === 'complete') {
                browser.tabs.onUpdated.removeListener(statusListener);
                // Give Slack an initial second to start mounting its application layout
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
