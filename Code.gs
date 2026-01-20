/**
 * Code.gs - Entry Point
 * Clean rebuild with deduplication
 */

/**
 * Code.gs - Entry Point
 */

function doPost(e) {
  try {
    const props = PropertiesService.getScriptProperties();
    const gasSecret = props.getProperty('GAS_SECRET');
    const incomingSecret = e.parameter.secret || '';

    // Log the event for debugging (view in Executions tab)
    console.log('Incoming update. Secret valid:', (gasSecret === incomingSecret));

    if (gasSecret && incomingSecret !== gasSecret) {
      console.warn('Unauthorized access attempt: Secret mismatch');
      return ContentService.createTextOutput('Unauthorized').setMimeType(ContentService.MimeType.TEXT);
    }

    const botToken = props.getProperty('BOT_TOKEN');
    if (!botToken) {
      console.error('CRITICAL: BOT_TOKEN is missing in Script Properties');
      return ContentService.createTextOutput('Missing Token');
    }

    const contents = e.postData.contents;
    if (!contents) return ContentService.createTextOutput('No content');
    
    const update = JSON.parse(contents);
    if (!update || !update.update_id) return ContentService.createTextOutput('OK');
    
    const uid = 'update_' + update.update_id;
    const cache = CacheService.getScriptCache();
    
    // 2. Deduplication
    if (cache.get(uid)) {
      return ContentService.createTextOutput('OK');
    }
    cache.put(uid, '1', 600);
    
    // 3. Process
    if (update.message) {
      processMessage(update.message);
    } else if (update.callback_query) {
      handleCallback(update.callback_query);
    }
    
    return ContentService.createTextOutput('OK');
    
  } catch (error) {
    console.error('doPost error:', error.toString());
    return ContentService.createTextOutput('OK');
  }
}

function doGet(e) {
  return ContentService.createTextOutput('Bot Bridge is active');
}
