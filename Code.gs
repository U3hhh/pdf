/**
 * Code.gs - Entry Point
 * Clean rebuild with deduplication
 */

function doPost(e) {
  try {
    const update = JSON.parse(e.postData.contents);
    if (!update || !update.update_id) return ContentService.createTextOutput('OK');
    
    const uid = 'update_' + update.update_id;
    const cache = CacheService.getScriptCache();
    
    // 1. DEDUPLICATION (No lock, rely on CacheService speed)
    if (cache.get(uid)) {
      return ContentService.createTextOutput('OK');
    }
    cache.put(uid, '1', 600);
    
    // 2. PROCESS
    if (update.message) {
      processMessage(update.message);
    } else if (update.callback_query) {
      handleCallback(update.callback_query);
    }
    
    return ContentService.createTextOutput('OK');
    
  } catch (error) {
    // Attempt to notify user of fatal script-level crash
    try {
      const u = JSON.parse(e.postData.contents);
      if (u.message) sendMessage(u.message.chat.id, '🆘 FATAL SCRIPT ERROR: ' + error.toString());
    } catch(e2) {}
    return ContentService.createTextOutput('OK');
  }
}

function doGet(e) {
  return ContentService.createTextOutput('Bot is running');
}
