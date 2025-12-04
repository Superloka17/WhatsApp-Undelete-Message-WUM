# WhatsApp-Undelete-Message-WUM
WhatsApp Web extension that recovers deleted messages you've already seen. Monitors new messages in real-time, detects when they're deleted, and restores them with visual highlighting. Includes a popup to view all deleted messages with timestamps and export functionality.


WhatsApp Undelete - Message Recovery Extension

A Chrome extension that automatically saves and recovers deleted WhatsApp Web messages. 

Features:
- Real-time monitoring of new messages
- Automatic detection when messages are deleted
- Visual restoration with yellow highlighting in chat
- Popup dashboard showing all deleted messages
- Export deleted messages as TXT or CSV with contact names and timestamps
- Persistent storage - recovered messages survive page refreshes
- Privacy-focused - only caches messages you've already seen

How It Works:
1. Extension monitors WhatsApp Web for new messages
2. When a message appears, it's cached with a unique ID
3. If someone deletes the message, the extension detects the deletion
4. Original message is restored visually with a yellow highlight
5. All deleted messages are saved and viewable in the extension popup
6. Export your deleted message history anytime

Limitations:
- Only works for messages sent AFTER the extension is active
- Must see the message before it's deleted for it to be cached
- Works only on WhatsApp Web (https://web.whatsapp.com)

Built with vanilla JavaScript and Chrome Extension Manifest V3. (more features and updates to come in the future.)
