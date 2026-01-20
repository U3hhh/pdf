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

    console.log('--- NEW INCOMING REQUEST ---');
    console.log('Secret valid:', (gasSecret === incomingSecret));

    if (gasSecret && incomingSecret !== gasSecret) {
      console.warn('Unauthorized access attempt: Secret mismatch');
      return ContentService.createTextOutput('Unauthorized').setMimeType(ContentService.MimeType.TEXT);
    }

    const contents = e.postData.contents;
    if (!contents) {
      console.error('No postData contents found');
      return ContentService.createTextOutput('No content');
    }
    
    const update = JSON.parse(contents);
    console.log('Update Content:', JSON.stringify(update));

    if (!update || !update.update_id) {
      console.warn('Invalid update format');
      return ContentService.createTextOutput('OK');
    }
    
    const uid = 'update_' + update.update_id;
    const cache = CacheService.getScriptCache();
    
    if (cache.get(uid)) {
      console.log('Duplicate update ignored:', update.update_id);
      return ContentService.createTextOutput('OK');
    }
    cache.put(uid, '1', 600);
    
    // Check if processMessage exists and is callable
    if (update.message) {
      console.log('Routing to processMessage. Message text:', update.message.text);
      processMessage(update.message);
    } else if (update.callback_query) {
      console.log('Routing to handleCallback');
      handleCallback(update.callback_query);
    }
    
    console.log('Processing completed for update:', update.update_id);
    return ContentService.createTextOutput('OK');
    
  } catch (error) {
    console.error('CRITICAL doPost error:', error.toString());
    console.error('Stack:', error.stack);
    return ContentService.createTextOutput('OK');
  }
}

function doGet(e) {
  return ContentService.createTextOutput('Bot Bridge is active');
}
