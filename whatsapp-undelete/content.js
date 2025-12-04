// WhatsApp Undelete - Fixed Version with Persistent Restoration
(function () {
  'use strict';

  console.log("%c🟢 WhatsApp Undelete Active - Monitoring NEW messages only", "color: #25D366; font-size: 16px; font-weight: bold;");

  // Message cache
  const messageCache = new Map();
  let cacheCount = 0;
  let isReady = false;

  // Deleted message indicators (fixed UTF-8 encoding)
  const deletedIndicators = [
    'This message was deleted',
    'You deleted this message',
    'Ce message a été supprimé',
    'Vous avez supprimé ce message',
    'deleted this message'
  ];

  // ===== Extract message ID (with fallback fingerprint) =====
  function getMessageId(element) {
    if (element.dataset && element.dataset.id) {
      return element.dataset.id;
    }

    const parent = element.closest('[data-id]');
    if (parent && parent.dataset.id) {
      return parent.dataset.id;
    }

    return null;
  }

  // Create a fingerprint for messages (backup identification)
  function getMessageFingerprint(element) {
    const allMessages = Array.from(document.querySelectorAll('[data-id]'));
    const index = allMessages.indexOf(element);
    
    const timeEl = element.querySelector('[data-testid="msg-time"], .message-time, [data-pre-plain-text]');
    const timeText = timeEl ? (timeEl.innerText || timeEl.getAttribute('data-pre-plain-text') || '') : '';
    
    return `fp_${index}_${timeText}`;
  }

  // ===== Extract text from message =====
  function extractMessageText(element) {
    // Strategy 1: copyable-text class
    let textEl = element.querySelector('.copyable-text');
    if (textEl) {
      const text = textEl.innerText || textEl.textContent || '';
      const clean = text.replace(/[\u200B-\u200D\u2060\uFEFF]/g, '').trim();
      if (clean && !isDeletedMessage(clean)) {
        return clean;
      }
    }

    // Strategy 2: selectable-text class
    textEl = element.querySelector('.selectable-text');
    if (textEl) {
      const text = textEl.innerText || textEl.textContent || '';
      const clean = text.replace(/[\u200B-\u200D\u2060\uFEFF]/g, '').trim();
      if (clean && !isDeletedMessage(clean)) {
        return clean;
      }
    }

    // Strategy 3: Find longest text in spans
    const spans = element.querySelectorAll('span');
    let longestText = '';
    
    spans.forEach(span => {
      const text = (span.innerText || span.textContent || '').trim();
      const clean = text.replace(/[\u200B-\u200D\u2060\uFEFF]/g, '').trim();
      if (clean.length > longestText.length && !isDeletedMessage(clean)) {
        longestText = clean;
      }
    });

    return longestText || null;
  }

  // ===== Detect deleted messages =====
  function isDeletedMessage(text) {
    if (!text) return false;
    const clean = text.replace(/[\u200B-\u200D\u2060\uFEFF]/g, '').trim().toLowerCase();
    
    return deletedIndicators.some(indicator => 
      clean.includes(indicator.toLowerCase())
    );
  }

  function hasDeletedIndicator(element) {
    const allText = element.innerText || element.textContent || '';
    return isDeletedMessage(allText);
  }

  // ===== Get chat name =====
  function getChatName() {
    const selectors = [
      'header span[dir="auto"]',
      'header span[title]',
      '[data-testid="conversation-info-header"] span',
    ];

    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (el && el.innerText) {
        return el.innerText.trim();
      }
    }

    return 'Unknown Chat';
  }

  // ===== MAIN PROCESSING =====
  function processMessage(messageElement, isNewMessage = true) {
    if (!isReady && isNewMessage) return;

    try {
      const msgId = getMessageId(messageElement);
      if (!msgId) return;

      const isDeleted = hasDeletedIndicator(messageElement);
      const messageText = extractMessageText(messageElement);

      // Case 1: Normal NEW message - cache it with BOTH id and fingerprint
      if (messageText && !isDeleted && isNewMessage) {
        const fingerprint = getMessageFingerprint(messageElement);
        
        if (!messageCache.has(msgId)) {
          const data = {
            text: messageText,
            timestamp: Date.now(),
            chatName: getChatName(),
            fingerprint: fingerprint
          };
          
          messageCache.set(msgId, data);
          messageCache.set(fingerprint, data);
          
          cacheCount++;
          console.log(`%c✅ [${cacheCount}] NEW message cached`, "color: #4CAF50; font-weight: bold;");
          console.log(`   ID: ${msgId.substring(0, 40)}...`);
          console.log(`   Text: "${messageText.substring(0, 60)}${messageText.length > 60 ? '...' : ''}"`);
        }
      }
      
      // Case 2: Deleted message detected - try multiple matching strategies
      else if (isDeleted) {
        let cached = messageCache.get(msgId);
        let matchMethod = 'exact ID';
        
        // Strategy 1: Try fingerprint
        if (!cached) {
          const fingerprint = getMessageFingerprint(messageElement);
          cached = messageCache.get(fingerprint);
          if (cached) matchMethod = 'fingerprint';
        }
        
        // Strategy 2: Try partial ID match
        if (!cached) {
          const baseId = msgId.split('_')[0] + '_' + msgId.split('_')[1];
          for (const [cachedId, data] of messageCache.entries()) {
            if (!cachedId.startsWith('fp_') && cachedId.includes(baseId)) {
              cached = data;
              matchMethod = 'partial ID';
              console.log(`🔍 Found by partial ID match: ${cachedId.substring(0, 40)}...`);
              break;
            }
          }
        }
        
        // Strategy 3: Try matching by position
        if (!cached) {
          const allMessages = Array.from(document.querySelectorAll('[data-id]'));
          const currentIndex = allMessages.indexOf(messageElement);
          
          for (const [cachedId, data] of messageCache.entries()) {
            if (!cachedId.startsWith('fp_') && data.timestamp > Date.now() - 60000) {
              const cachedPos = parseInt(data.fingerprint.split('_')[1]);
              if (Math.abs(cachedPos - currentIndex) <= 3) {
                cached = data;
                matchMethod = 'position proximity';
                console.log(`🔍 Found by position (cached: ${cachedPos}, current: ${currentIndex})`);
                break;
              }
            }
          }
        }
        
        if (cached && cached.text) {
          console.log(`%c🔥 DELETED MESSAGE DETECTED! (via ${matchMethod})`, "color: #ff9800; font-size: 16px; font-weight: bold;");
          console.log(`%c   Original: "${cached.text}"`, "color: #ffeb3b; font-weight: bold;");
          console.log(`   Chat: "${cached.chatName}"`);

          saveToStorage(msgId, cached.text, cached.chatName);
          restoreVisually(messageElement, cached.text);
          
        } else {
          console.log(`%c⚠️ Deleted message NOT in cache`, "color: orange; font-weight: bold;");
          console.log(`   ID: ${msgId.substring(0, 40)}...`);
          console.log(`   Cache size: ${messageCache.size / 2} messages`);
        }
      }

    } catch (err) {
      console.error('Error processing message:', err);
    }
  }

  // ===== SAVE TO STORAGE =====
  function saveToStorage(msgId, text, chatName) {
    chrome.storage.local.set({
      [`deleted_${msgId}`]: {
        text: text,
        chatName: chatName,
        timestamp: Date.now()
      }
    }, () => {
      if (!chrome.runtime.lastError) {
        console.log('💾 Saved to popup storage');
      }
    });
  }

  // Helper function to escape HTML
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // ===== VISUAL RESTORATION =====
  function restoreVisually(messageElement, originalText) {
    // Check if already restored
    if (messageElement.dataset.restored === 'true') {
      console.log('⏭️ Message already restored, skipping');
      return;
    }

    const allSpans = messageElement.querySelectorAll('span');
    let restored = false;

    allSpans.forEach(span => {
      const spanText = (span.innerText || span.textContent || '').trim();
      if (isDeletedMessage(spanText) && !span.dataset.recovered) {
        // Replace text
        span.innerText = `🔓 ${originalText}`;
        
        // Style it with !important
        span.style.cssText = `
          background: linear-gradient(135deg, #ffeb3b33 0%, #ff980033 100%) !important;
          border-left: 4px solid #ffeb3b !important;
          border-radius: 8px !important;
          padding: 8px 12px !important;
          display: inline-block !important;
          margin: 6px 0 !important;
          font-style: normal !important;
          font-weight: 500 !important;
          box-shadow: 0 2px 8px rgba(255, 235, 59, 0.3) !important;
        `;
        
        span.title = `Recovered deleted message: "${originalText}"`;
        span.dataset.recovered = 'true';
        span.setAttribute('data-recovered', 'true');
        restored = true;
        console.log('🎨 Message text replaced and highlighted!');
      }
    });

    // Fallback: Add a permanent notification badge
    if (!restored) {
      const existingBadge = messageElement.querySelector('.undelete-recovery-badge');
      if (!existingBadge) {
        const badge = document.createElement('div');
        badge.className = 'undelete-recovery-badge';
        badge.setAttribute('data-undelete-badge', 'true');
        badge.style.cssText = `
          background: linear-gradient(135deg, #ffeb3b 0%, #ffc107 100%) !important;
          color: #000 !important;
          padding: 8px 14px !important;
          border-radius: 8px !important;
          font-size: 13px !important;
          font-weight: 600 !important;
          margin: 6px 0 !important;
          display: inline-block !important;
          box-shadow: 0 2px 8px rgba(0,0,0,0.15) !important;
          border-left: 4px solid #ff9800 !important;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
          max-width: 100% !important;
          word-wrap: break-word !important;
        `;
        badge.innerHTML = `🔓 <strong>Deleted:</strong> "${escapeHtml(originalText.substring(0, 100))}${originalText.length > 100 ? '...' : ''}"`;
        
        const messageContent = messageElement.querySelector('[data-testid="msg-container"]') || messageElement;
        if (messageContent.firstChild) {
          messageContent.insertBefore(badge, messageContent.firstChild);
        } else {
          messageContent.appendChild(badge);
        }
        
        console.log('🎨 Permanent badge added!');
        restored = true;
      } else {
        console.log('⏭️ Badge already exists, skipping');
        restored = true;
      }
    }
    
    // Mark element as restored
    if (restored) {
      messageElement.dataset.restored = 'true';
      messageElement.dataset.wasDeleted = 'true';
      messageElement.setAttribute('data-restored', 'true');
    }
  }

  // ===== RESTORE DELETED MESSAGES FROM STORAGE =====
  function restoreDeletedMessagesFromStorage() {
    chrome.storage.local.get(null, (items) => {
      const deletedMessages = Object.entries(items).filter(([key]) => key.startsWith('deleted_'));
      
      if (deletedMessages.length === 0) {
        console.log('📭 No deleted messages in storage');
        return;
      }

      console.log(`🔄 Found ${deletedMessages.length} deleted messages in storage, attempting restoration...`);
      let restoredCount = 0;

      deletedMessages.forEach(([key, data]) => {
        const msgId = key.replace('deleted_', '');
        
        // Try to find the EXACT message by its ID
        const messageEl = document.querySelector(`[data-id="${msgId}"]`);
        
        if (messageEl && !messageEl.dataset.restored) {
          // Only restore if it has deleted indicator or was previously marked as deleted
          if (hasDeletedIndicator(messageEl) || messageEl.dataset.wasDeleted === 'true') {
            restoreVisually(messageEl, data.text);
            messageEl.dataset.wasDeleted = 'true';
            restoredCount++;
            console.log(`✅ Restored ID ${msgId.substring(0, 30)}...: "${data.text.substring(0, 40)}..."`);
          }
        } else if (!messageEl) {
          console.log(`⚠️ Message ID not found in DOM: ${msgId.substring(0, 30)}...`);
        }
      });

      if (restoredCount > 0) {
        console.log(`%c✓ Restored ${restoredCount} messages!`, "color: #4CAF50; font-weight: bold;");
      } else {
        console.log('ℹ️ No messages needed restoration (might be in different chat)');
      }
    });
  }

  // ===== RE-APPLY RESTORATIONS =====
  function reapplyRestorations() {
    chrome.storage.local.get(null, (items) => {
      const deletedMessages = Object.entries(items).filter(([key]) => key.startsWith('deleted_'));
      
      deletedMessages.forEach(([key, data]) => {
        const msgId = key.replace('deleted_', '');
        
        // Only look for the EXACT message by ID
        const messageEl = document.querySelector(`[data-id="${msgId}"]`);
        
        if (messageEl && messageEl.dataset.wasDeleted === 'true') {
          // Check if restoration is missing
          const hasBadge = messageEl.querySelector('.undelete-recovery-badge');
          const hasRecoveredSpan = messageEl.querySelector('[data-recovered="true"]');
          
          if (!hasBadge && !hasRecoveredSpan) {
            // Restoration was removed, re-apply it
            messageEl.dataset.restored = 'false';
            restoreVisually(messageEl, data.text);
            console.log(`🔄 Re-applied restoration for: "${data.text.substring(0, 30)}..."`);
          }
        }
      });
    });
  }

  // ===== OBSERVER =====
  let observer;

  function startObserver() {
    const chatArea = document.querySelector('#main') || 
                     document.querySelector('[data-testid="conversation-panel-body"]') ||
                     document.body;

    console.log(`👁️ Observer started - watching for NEW messages only`);

    observer = new MutationObserver((mutations) => {
      mutations.forEach(mutation => {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          mutation.addedNodes.forEach(node => {
            if (node.nodeType === 1) {
              if (node.dataset && node.dataset.id) {
                processMessage(node, true);
              }
              
              const messages = node.querySelectorAll('[data-id]');
              messages.forEach(msg => processMessage(msg, true));
            }
          });
        }

        if (mutation.type === 'characterData') {
          const element = mutation.target.nodeType === 1 ? mutation.target : mutation.target.parentElement;
          if (element) {
            const messageContainer = element.closest('[data-id]');
            if (messageContainer) {
              processMessage(messageContainer, false);
            }
          }
        }
      });
    });

    observer.observe(chatArea, {
      childList: true,
      subtree: true,
      characterData: true
    });

    isReady = true;
    console.log(`%c✓ Ready! Send new messages to start caching...`, "color: #4CAF50; font-weight: bold;");
  }

  // ===== PERIODIC DELETION CHECK =====
  function startPeriodicCheck() {
    setInterval(() => {
      messageCache.forEach((data, msgId) => {
        const messageEl = document.querySelector(`[data-id="${msgId}"]`);
        if (messageEl && hasDeletedIndicator(messageEl)) {
          processMessage(messageEl, false);
        }
      });
      
      reapplyRestorations();
    }, 2000);
    
    console.log('⏰ Periodic deletion check active (every 2 seconds)');
  }

  // ===== INITIALIZATION =====
  function init() {
    console.log('🚀 Initializing...');
    
    const startTime = Date.now();
    
    const initWhenReady = () => {
      if (document.querySelector('#main') || document.querySelector('[data-testid="conversation-panel-body"]')) {
        startObserver();
        startPeriodicCheck();
        
        // Restore deleted messages from storage
        setTimeout(() => {
          restoreDeletedMessagesFromStorage();
        }, 3000);
        
        console.log(`%c✓ Extension ready in ${Date.now() - startTime}ms`, "color: #4CAF50;");
      } else {
        setTimeout(initWhenReady, 500);
      }
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => setTimeout(initWhenReady, 1000));
    } else {
      setTimeout(initWhenReady, 1000);
    }

    // Handle chat switches
    let lastUrl = location.href;
    setInterval(() => {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        console.log('📱 Chat changed - checking for deleted messages...');
        setTimeout(restoreDeletedMessagesFromStorage, 2000);
      }
    }, 1000);
  }

  // Start extension
  init();

  // Debug helper
  window.whatsappDebug = {
    cache: messageCache,
    cacheSize: () => messageCache.size / 2,
    showCache: () => {
      const uniqueMessages = new Map();
      messageCache.forEach((data, id) => {
        if (!id.startsWith('fp_')) {
          uniqueMessages.set(id, data);
        }
      });
      console.log(`📦 Cache contains ${uniqueMessages.size} messages:`);
      uniqueMessages.forEach((data, id) => {
        console.log(`  - ID: ${id.substring(0, 40)}...`);
        console.log(`    Text: "${data.text.substring(0, 40)}..."`);
        console.log(`    Fingerprint: ${data.fingerprint}`);
      });
    },
    restoreNow: restoreDeletedMessagesFromStorage
  };

  console.log('%cℹ️ Debug: Type "whatsappDebug.restoreNow()" to manually restore messages', 'color: #00bcd4;');

})();