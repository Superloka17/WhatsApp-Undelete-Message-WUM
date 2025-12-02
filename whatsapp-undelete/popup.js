document.addEventListener('DOMContentLoaded', () => {
  const list = document.getElementById('list');
  const empty = document.getElementById('empty');
  const stats = document.getElementById('stats');
  const clearBtn = document.getElementById('clear');
  const downloadBtn = document.getElementById('download');

  function render() {
    chrome.storage.local.get(null, (items) => {
      const entries = Object.entries(items)
        .filter(([key]) => key.startsWith('deleted_'))
        .sort((a, b) => b[1].timestamp - a[1].timestamp);

      if (entries.length === 0) {
        list.innerHTML = '';
        empty.style.display = 'block';
        stats.classList.remove('visible');
        return;
      }

      empty.style.display = 'none';
      stats.classList.add('visible');
      stats.innerHTML = `📊 Total deleted messages: <strong>${entries.length}</strong>`;

      list.innerHTML = entries.map(([_, data]) => {
        const date = new Date(data.timestamp);
        const dateStr = date.toLocaleDateString('en-US', { 
          month: 'short', 
          day: 'numeric', 
          year: 'numeric' 
        });
        const timeStr = date.toLocaleTimeString('en-US', { 
          hour: '2-digit', 
          minute: '2-digit' 
        });

        return `
          <div class="message">
            <div class="message-header">
              <div class="chat-name">${escapeHtml(data.chatName || 'Unknown Chat')}</div>
              <div class="time">${dateStr} at ${timeStr}</div>
            </div>
            <div class="text">${escapeHtml(data.text)}</div>
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

  // Download functionality
  downloadBtn.onclick = () => {
    chrome.storage.local.get(null, (items) => {
      const entries = Object.entries(items)
        .filter(([key]) => key.startsWith('deleted_'))
        .sort((a, b) => b[1].timestamp - a[1].timestamp);

      if (entries.length === 0) {
        alert('No deleted messages to download');
        return;
      }

      // Generate download filename with current date
      const now = new Date();
      const filename = `WhatsApp_Deleted_Messages_${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}.txt`;

      // Create text content
      let content = `WhatsApp Deleted Messages Export\n`;
      content += `Generated: ${now.toLocaleString()}\n`;
      content += `Total Messages: ${entries.length}\n`;
      content += `${'='.repeat(80)}\n\n`;

      entries.forEach(([_, data], index) => {
        const date = new Date(data.timestamp);
        const dateStr = date.toLocaleString();
        
        content += `Message #${index + 1}\n`;
        content += `Chat: ${data.chatName || 'Unknown Chat'}\n`;
        content += `Date: ${dateStr}\n`;
        content += `Text: ${data.text}\n`;
        content += `${'-'.repeat(80)}\n\n`;
      });

      // Create download
      const blob = new Blob([content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      
      chrome.downloads.download({
        url: url,
        filename: filename,
        saveAs: true
      }, (downloadId) => {
        if (chrome.runtime.lastError) {
          console.error('Download error:', chrome.runtime.lastError);
          
          // Fallback: use data URL
          const link = document.createElement('a');
          link.href = 'data:text/plain;charset=utf-8,' + encodeURIComponent(content);
          link.download = filename;
          link.click();
        } else {
          console.log('Download started:', downloadId);
        }
        
        // Clean up
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      });
    });
  };

  // Download as CSV functionality (alternative)
  function downloadAsCSV() {
    chrome.storage.local.get(null, (items) => {
      const entries = Object.entries(items)
        .filter(([key]) => key.startsWith('deleted_'))
        .sort((a, b) => b[1].timestamp - a[1].timestamp);

      if (entries.length === 0) {
        alert('No deleted messages to download');
        return;
      }

      const now = new Date();
      const filename = `WhatsApp_Deleted_Messages_${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}.csv`;

      // Create CSV content
      let csvContent = 'Chat Name,Date,Time,Message\n';
      
      entries.forEach(([_, data]) => {
        const date = new Date(data.timestamp);
        const dateStr = date.toLocaleDateString();
        const timeStr = date.toLocaleTimeString();
        
        // Escape commas and quotes in CSV
        const escapeCsv = (str) => {
          if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            return `"${str.replace(/"/g, '""')}"`;
          }
          return str;
        };
        
        csvContent += `${escapeCsv(data.chatName || 'Unknown')},${dateStr},${timeStr},${escapeCsv(data.text)}\n`;
      });

      // Create download
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      
      chrome.downloads.download({
        url: url,
        filename: filename,
        saveAs: true
      }, () => {
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      });
    });
  }

  // Add keyboard shortcut: Ctrl/Cmd + Shift + D to download
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'D') {
      e.preventDefault();
      downloadBtn.click();
    }
  });

  // Clear all functionality
  clearBtn.onclick = () => {
    if (confirm('Delete all saved deleted messages?\n\nThis will permanently remove them from the extension.')) {
      chrome.storage.local.get(null, (items) => {
        const keysToRemove = Object.keys(items).filter(k => k.startsWith('deleted_'));
        chrome.storage.local.remove(keysToRemove, render);
      });
    }
  };

  // Initial render
  render();
  
  // Auto-refresh every 3s when popup is open
  setInterval(render, 3000);
  
  // Expose CSV download (you can add another button for this if needed)
  window.downloadAsCSV = downloadAsCSV;
});