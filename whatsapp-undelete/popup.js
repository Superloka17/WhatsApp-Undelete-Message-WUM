document.addEventListener('DOMContentLoaded', () => {
  const list = document.getElementById('list');
  const empty = document.getElementById('empty');
  const stats = document.getElementById('stats');
  const clearBtn = document.getElementById('clear');
  const downloadBtn = document.getElementById('download');

  // Toggles
  const hideTypingToggle = document.getElementById('hideTyping');
  const hideReceiptsToggle = document.getElementById('hideReceipts');

  let lastDataHash = '';

  // ====================== LOAD SAVED STATES ======================
  chrome.storage.local.get(['hideTypingEnabled', 'hideReadReceiptsEnabled'], (result) => {
    if (hideTypingToggle) {
      hideTypingToggle.checked = result.hideTypingEnabled !== false;
    }
    if (hideReceiptsToggle) {
      hideReceiptsToggle.checked = result.hideReadReceiptsEnabled !== false;
    }
  });

  // ====================== SEND MESSAGE TO CONTENT SCRIPT ======================
  function sendToContent(action, enabled) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { action, enabled });
      }
    });
  }

  // ====================== TYPING INDICATOR TOGGLE ======================
  if (hideTypingToggle) {
    hideTypingToggle.addEventListener('change', (e) => {
      const enabled = e.target.checked;
      chrome.storage.local.set({ hideTypingEnabled: enabled });
      sendToContent('toggleTypingBlocker', enabled);
    });
  }

  // ====================== BLUE TICKS (READ RECEIPTS) TOGGLE — BULLETPROOF ======================
  if (hideReceiptsToggle) {
    // This fixes the "toggle jumps back" bug forever
    hideReceiptsToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();

      const enabled = hideReceiptsToggle.checked;
      chrome.storage.local.set({ hideReadReceiptsEnabled: enabled });
      sendToContent('toggleReadReceipts', enabled);

      console.log(`Ghost Mode: ${enabled ? 'ON (no blue ticks)' : 'OFF'}`);
    });

    // Also allow normal change event for keyboard users
    hideReceiptsToggle.addEventListener('change', (e) => {
      const enabled = e.target.checked;
      chrome.storage.local.set({ hideReadReceiptsEnabled: enabled });
      sendToContent('toggleReadReceipts', enabled);
    });
  }

  // ====================== RENDER DELETED MESSAGES ======================
  function render() {
    chrome.storage.local.get(null, (items) => {
      const entries = Object.entries(items)
        .filter(([key]) => key.startsWith('deleted_'))
        .sort((a, b) => b[1].timestamp - a[1].timestamp);

      const currentHash = JSON.stringify(entries.map(([k, v]) => k + v.timestamp));
      if (currentHash === lastDataHash && entries.length > 0) return;
      lastDataHash = currentHash;

      if (entries.length === 0) {
        list.innerHTML = '';
        empty.style.display = 'block';
        stats.classList.remove('visible');
        return;
      }

      empty.style.display = 'none';
      stats.classList.add('visible');
      stats.innerHTML = `Total recovered: <strong>${entries.length}</strong> deleted message${entries.length > 1 ? 's' : ''}`;

      list.innerHTML = entries.map(([_, data]) => {
        const date = new Date(data.timestamp);
        const dateStr = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
        const timeStr = date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

        return `
          <div class="message">
            <div class="message-header">
              <div class="chat-name">${escapeHtml(data.chatName || 'Unknown Chat')}</div>
              <div class="time">${dateStr} · ${timeStr}</div>
            </div>
            <div class="text">${escapeHtml(data.text || '(empty)')}</div>
          </div>
        `;
      }).join('');
    });
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // ====================== DOWNLOAD ======================
  downloadBtn.onclick = () => {
    chrome.storage.local.get(null, (items) => {
      const entries = Object.entries(items)
        .filter(([k]) => k.startsWith('deleted_'))
        .sort((a, b) => b[1].timestamp - a[1].timestamp);

      if (entries.length === 0) return alert('No deleted messages to download');

      const now = new Date();
      const filename = `WhatsApp_Deleted_${now.toISOString().slice(0,10)}.txt`;
      let content = `WhatsApp Deleted Messages — ${now.toLocaleString()}\n\n`;
      entries.forEach(([_, d], i) => {
        content += `${i+1}. ${d.chatName || 'Unknown'} — ${new Date(d.timestamp).toLocaleString()}\n`;
        content += `"${d.text}"\n\n`;
      });

      const blob = new Blob([content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      chrome.downloads.download({ url, filename, saveAs: true });
    });
  };

  // ====================== CLEAR ALL ======================
  clearBtn.onclick = () => {
    if (confirm('Delete ALL recovered messages permanently?')) {
      chrome.storage.local.get(null, (items) => {
        const keys = Object.keys(items).filter(k => k.startsWith('deleted_'));
        chrome.storage.local.remove(keys, () => {
          render();
          alert(`${keys.length} messages cleared`);
        });
      });
    }
  };

  // ====================== AUTO REFRESH ======================
  render();
  setInterval(render, 3000);

  // Keyboard shortcut
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'D') {
      e.preventDefault();
      downloadBtn.click();
    }
  });
});