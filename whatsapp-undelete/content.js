// -*- coding: utf-8 -*-
// WhatsApp Undelete - Clean Version (Only New Messages)
(function () {
  'use strict';

  console.log("%c🟢 WhatsApp Undelete Active - Monitoring NEW messages only", "color: #25D366; font-size: 16px; font-weight: bold;");

  // Message cache
  const messageCache = new Map();
  let cacheCount = 0;
  let isReady = false;

  // Deleted message indicators
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
    // Use position + timestamp as fingerprint
    const allMessages = Array.from(document.querySelectorAll('[data-id]'));
    const index = allMessages.indexOf(element);
    
    // Get time if available
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
    if (!isReady && isNewMessage) return; // Don't process until ready

    try {
      const msgId = getMessageId(messageElement);
      if (!msgId) return;

      const isDeleted = hasDeletedIndicator(messageElement);
      const messageText = extractMessageText(messageElement);

      // Case 1: Normal NEW message - cache it with BOTH id and fingerprint
      if (messageText && !isDeleted && isNewMessage) {
        const fingerprint = getMessageFingerprint(messageElement);
        
        // Store by both ID and fingerprint
        if (!messageCache.has(msgId)) {
          const data = {
            text: messageText,
            timestamp: Date.now(),
            chatName: getChatName(),
            fingerprint: fingerprint
          };
          
          messageCache.set(msgId, data);
          messageCache.set(fingerprint, data); // Also store by fingerprint
          
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
        
        // Strategy 2: Try partial ID match (ID might have changed slightly)
        if (!cached) {
          const baseId = msgId.split('_')[0] + '_' + msgId.split('_')[1]; // Get "true_number" part
          for (const [cachedId, data] of messageCache.entries()) {
            if (!cachedId.startsWith('fp_') && cachedId.includes(baseId)) {
              cached = data;
              matchMethod = 'partial ID';
              console.log(`🔍 Found by partial ID match: ${cachedId.substring(0, 40)}...`);
              break;
            }
          }
        }
        
        // Strategy 3: Try matching by position (last 5 messages)
        if (!cached) {
          const allMessages = Array.from(document.querySelectorAll('[data-id]'));
          const currentIndex = allMessages.indexOf(messageElement);
          
          // Check recent cached messages (within last 5 positions)
          for (const [cachedId, data] of messageCache.entries()) {
            if (!cachedId.startsWith('fp_') && data.timestamp > Date.now() - 60000) { // Last 60 seconds
              // This is a recent message, might be ours
              const cachedPos = parseInt(data.fingerprint.split('_')[1]);
              if (Math.abs(cachedPos - currentIndex) <= 3) { // Within 3 positions
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

          // Save to storage
          saveToStorage(msgId, cached.text, cached.chatName);

          // Restore visually
          restoreVisually(messageElement, cached.text);
          
        } else {
          console.log(`%c⚠️ Deleted message NOT in cache`, "color: orange; font-weight: bold;");
          console.log(`   ID: ${msgId.substring(0, 40)}...`);
          console.log(`   Cache size: ${messageCache.size / 2} messages`);
          console.log(`   Available IDs in cache:`);
          let count = 0;
          for (const [id, data] of messageCache.entries()) {
            if (!id.startsWith('fp_') && count < 3) {
              console.log(`     - ${id.substring(0, 50)}...`);
              count++;
            }
          }
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

  // ===== VISUAL RESTORATION =====
  function restoreVisually(messageElement, originalText) {
    const allSpans = messageElement.querySelectorAll('span');
    let restored = false;

    allSpans.forEach(span => {
      const spanText = (span.innerText || span.textContent || '').trim();
      if (isDeletedMessage(spanText)) {
        // Replace text
        span.innerText = `🔓 ${originalText}`;
        
        // Style it
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
        restored = true;
        console.log('🎨 Message restored and highlighted in chat!');
      }
    });

    // Fallback: Add a notification badge
    if (!restored) {
      const badge = document.createElement('div');
      badge.style.cssText = `
        background: #ffeb3b;
        color: #000;
        padding: 6px 12px;
        border-radius: 6px;
        font-size: 12px;
        font-weight: bold;
        margin: 6px 0;
        display: inline-block;
        box-shadow: 0 2px 6px rgba(0,0,0,0.2);
      `;
      badge.innerHTML = `🔓 <strong>Deleted:</strong> "${originalText.substring(0, 50)}${originalText.length > 50 ? '...' : ''}"`;
      
      messageElement.insertBefore(badge, messageElement.firstChild);
      console.log('🎨 Fallback badge added!');
    }
  }

  // ===== OBSERVER (Only watch for NEW messages) =====
  let observer;

  function startObserver() {
    const chatArea = document.querySelector('#main') || 
                     document.querySelector('[data-testid="conversation-panel-body"]') ||
                     document.body;

    console.log(`👁️ Observer started - watching for NEW messages only`);

    observer = new MutationObserver((mutations) => {
      mutations.forEach(mutation => {
        // Only process NEW nodes added to DOM
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          mutation.addedNodes.forEach(node => {
            if (node.nodeType === 1) {
              // Check if it's a message
              if (node.dataset && node.dataset.id) {
                processMessage(node, true);
              }
              
              // Or contains messages
              const messages = node.querySelectorAll('[data-id]');
              messages.forEach(msg => processMessage(msg, true));
            }
          });
        }

        // Watch for text changes (when messages get deleted)
        if (mutation.type === 'characterData') {
          const element = mutation.target.nodeType === 1 ? mutation.target : mutation.target.parentElement;
          if (element) {
            const messageContainer = element.closest('[data-id]');
            if (messageContainer) {
              processMessage(messageContainer, false); // Don't cache again, just check if deleted
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

    // Mark as ready (start caching new messages)
    isReady = true;
    console.log(`%c✓ Ready! Send new messages to start caching...`, "color: #4CAF50; font-weight: bold;");
  }

  // ===== PERIODIC DELETION CHECK (every 2 seconds) =====
  function startPeriodicCheck() {
    setInterval(() => {
      // Only check messages we've cached
      messageCache.forEach((data, msgId) => {
        const messageEl = document.querySelector(`[data-id="${msgId}"]`);
        if (messageEl && hasDeletedIndicator(messageEl)) {
          processMessage(messageEl, false);
        }
      });
    }, 2000);
    
    console.log('⏰ Periodic deletion check active (every 2 seconds)');
  }

  // ===== INITIALIZATION =====
  function init() {
    console.log('🚀 Initializing...');
    
    // Wait for page to load, then start watching
    const startTime = Date.now();
    
    const initWhenReady = () => {
      if (document.querySelector('#main') || document.querySelector('[data-testid="conversation-panel-body"]')) {
        startObserver();
        startPeriodicCheck();
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

    // Handle chat switches (reset doesn't clear cache)
    let lastUrl = location.href;
    setInterval(() => {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        console.log('📱 Chat changed - still monitoring...');
      }
    }, 1000);
  }

  // Start extension
  init();

  // Debug helper
  window.whatsappDebug = {
    cache: messageCache,
    cacheSize: () => messageCache.size / 2, // Divide by 2 since we store each message twice
    showCache: () => {
      const uniqueMessages = new Map();
      messageCache.forEach((data, id) => {
        if (!id.startsWith('fp_')) { // Only show real IDs, not fingerprints
          uniqueMessages.set(id, data);
        }
      });
      console.log(`📦 Cache contains ${uniqueMessages.size} messages:`);
      uniqueMessages.forEach((data, id) => {
        console.log(`  - ID: ${id.substring(0, 40)}...`);
        console.log(`    Text: "${data.text.substring(0, 40)}..."`);
        console.log(`    Fingerprint: ${data.fingerprint}`);
      });
    }
  };

  console.log('%cℹ️ Type "whatsappDebug.showCache()" to see cached messages', 'color: #00bcd4;');

})();