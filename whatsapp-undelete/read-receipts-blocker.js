// read-receipts-blocker.js – WA Incognito Method (Dec 2025)
(() => {
  'use strict';
  console.log('%cBlue Ticks Blocker: WA Incognito Style', 'color: #2196f3; font-weight: bold;');

  let blockBlueTicks = true;

  // Load state
  chrome.storage.local.get(['hideReadReceiptsEnabled'], (res) => {
    blockBlueTicks = res.hideReadReceiptsEnabled !== false;
    applyWAIncognitoMethod();
  });

  // Toggle listener
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.action === 'toggleReadReceipts') {
      blockBlueTicks = msg.enabled;
      chrome.storage.local.set({ hideReadReceiptsEnabled: blockBlueTicks });
      applyWAIncognitoMethod();
    }
  });

  function applyWAIncognitoMethod() {
    if (!blockBlueTicks) return;

    // #1 WebSocket Stanza Block (WA Incognito core)
    if (!window.__waIncognitoWS) {
      const origWS = window.WebSocket;
      window.WebSocket = function(url, protocols) {
        const ws = new origWS(url, protocols);
        const origSend = ws.send;
        ws.send = function(data) {
          try {
            const stanza = data instanceof ArrayBuffer 
              ? new TextDecoder().decode(data) 
              : data.toString();
            if (stanza.includes('type="read"') || stanza.includes('receipt') || stanza.includes('seen')) {
              console.log('%cBLOCKED read receipt stanza (WA Incognito)', 'color: #ff4444; font-weight: bold;');
              return; // Drop it
            }
          } catch (e) {}
          return origSend.call(this, data);
        };
        return ws;
      };
      window.WebSocket.prototype = origWS.prototype; // MV3 fix
      window.__waIncognitoWS = true;
      console.log('%cWebSocket hooked (stanza block)', 'color: green;');
    }

    // #2 Store Patch (fallback, fixed path)
    const timer = setInterval(() => {
      const proto = window.Store?.Message?.prototype; // Fixed: Message (capital M)
      if (proto?.sendSeen) {
        clearInterval(timer);
        const orig = proto.sendSeen;
        proto.sendSeen = function() {
          if (blockBlueTicks) {
            console.log('%cBLOCKED sendSeen (Store fallback)', 'color: #ff4444; font-weight: bold;');
            return Promise.resolve(); // Fake success
          }
          return orig.apply(this, arguments);
        };
        console.log('%cStore patched (blue ticks blocked)', 'color: green; font-weight: bold;');
      }
    }, 300);
  }

  // Debug (like WA Incognito)
  window.WAdebugMode = false; // Set to true in console to log stanzas
})();