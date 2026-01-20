/**
 * Code.gs - Entry Point
 * Clean rebuild with deduplication
 */

/**
 * Code.gs - Entry Point
 */

function doPost(e) {
  const startTime = Date.now();
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
    const duration = Date.now() - startTime;
    countResource('runtime', duration);
    return ContentService.createTextOutput('OK');
    
  } catch (error) {
    console.error('CRITICAL doPost error:', error.toString());
    const duration = Date.now() - startTime;
    countResource('runtime', duration);
    return ContentService.createTextOutput('OK');
  }
}

function doGet(e) {
  const props = PropertiesService.getScriptProperties();
  const action = e.parameter.action;
  const format = e.parameter.format;
  
  // Security check for JSON requests
  if (format === 'json') {
    const secret = props.getProperty('GAS_SECRET');
    if (secret && e.parameter.secret !== secret) {
      return ContentService.createTextOutput(JSON.stringify({error: 'Unauthorized'})).setMimeType(ContentService.MimeType.JSON);
    }

    const data = {
      health: {
        token: !!props.getProperty('BOT_TOKEN'),
        admin: !!props.getProperty('ADMIN_ID'),
        spreadsheet: !!props.getProperty('SPREADSHEET_ID'),
        loggingEnabled: props.getProperty('LOGGING_ENABLED') !== 'false',
        driveUsed: DriveApp.getStorageUsed(),
        driveTotal: DriveApp.getStorageLimit(),
        fetchCount: parseInt(props.getProperty('URL_FETCH_COUNT') || '0'),
        fetchLimit: 20000,
        runtimeCount: parseInt(props.getProperty('RUNTIME_COUNT') || '0'),
        runtimeLimit: 5400000 // 90 minutes in ms
      },
      logs: []
    };

    try {
      const ss = SpreadsheetApp.openById(props.getProperty('SPREADSHEET_ID'));
      const sheet = ss.getSheetByName('Logs');
      if (sheet) {
        const rows = sheet.getDataRange().getValues();
        // Skip header and get last 30
        const logRows = rows.length > 1 ? rows.slice(1) : [];
        
        data.logs = logRows.slice(-30).reverse().map(row => ({
          timestamp: row[0] || new Date().toISOString(),
          userId: row[1] || 'Unknown',
          username: row[2] || '---',
          type: row[3] || 'INFO',
          details: row[4] || '---',
          status: row[5] || 'Pending'
        }));
      }
    } catch (err) {
      data.error = err.toString();
    }

    return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
  }

  if (action === 'get_user_lang') {
    return ContentService.createTextOutput(JSON.stringify({ lang: getUserLang(e.parameter.userId) })).setMimeType(ContentService.MimeType.JSON);
  }

  if (action === 'set_user_lang') {
    setUserLang(e.parameter.userId, e.parameter.lang);
    return ContentService.createTextOutput(JSON.stringify({ success: true })).setMimeType(ContentService.MimeType.JSON);
  }

  if (action === 'log_user') {
    logUser({ id: e.parameter.userId, username: e.parameter.username, first_name: e.parameter.firstName });
    return ContentService.createTextOutput(JSON.stringify({ success: true })).setMimeType(ContentService.MimeType.JSON);
  }

  if (action === 'log_event') {
    logEvent(e.parameter.type, e.parameter.details, e.parameter.status, { id: e.parameter.userId, username: e.parameter.username });
    return ContentService.createTextOutput(JSON.stringify({ success: true })).setMimeType(ContentService.MimeType.JSON);
  }

  if (action === 'get_stats') {
    return ContentService.createTextOutput(JSON.stringify({ text: getBotStats() })).setMimeType(ContentService.MimeType.JSON);
  }

  if (action === 'get_health_report') {
    return ContentService.createTextOutput(JSON.stringify({ text: checkSpreadsheetHealth() })).setMimeType(ContentService.MimeType.JSON);
  }

  if (action === 'login') {
    const user = e.parameter.username;
    const pass = e.parameter.password;
    try {
      const adminSheet = SpreadsheetApp.openById(props.getProperty('SPREADSHEET_ID')).getSheetByName('DashboardAdmins');
      if (adminSheet) {
        const data = adminSheet.getDataRange().getValues();
        for (let i = 1; i < data.length; i++) {
          if (data[i][0] == user && data[i][1] == pass) {
            return ContentService.createTextOutput(JSON.stringify({ success: true, username: user })).setMimeType(ContentService.MimeType.JSON);
          }
        }
      }
      return ContentService.createTextOutput(JSON.stringify({ success: false, error: 'Invalid login' })).setMimeType(ContentService.MimeType.JSON);
    } catch (err) {
      return ContentService.createTextOutput(JSON.stringify({ success: false, error: err.toString() })).setMimeType(ContentService.MimeType.JSON);
    }
  }

  if (action === 'clear_logs') {
    try {
      const ss = SpreadsheetApp.openById(props.getProperty('SPREADSHEET_ID'));
      const sheet = ss.getSheetByName('Logs');
      if (sheet && sheet.getLastRow() > 1) {
        sheet.deleteRows(2, sheet.getLastRow() - 1);
      }
      return ContentService.createTextOutput('Logs cleared successfully').setMimeType(ContentService.MimeType.TEXT);
    } catch (err) {
      return ContentService.createTextOutput('Error clearing logs: ' + err.toString()).setMimeType(ContentService.MimeType.TEXT);
    }
  }

  if (action === 'toggle_logging') {
    const currentState = props.getProperty('LOGGING_ENABLED') !== 'false'; // Default to true
    props.setProperty('LOGGING_ENABLED', !currentState);
    return ContentService.createTextOutput(!currentState ? 'Logging Started' : 'Logging Stopped').setMimeType(ContentService.MimeType.TEXT);
  }

  if (action === 'reset_fetch') {
    props.setProperty('URL_FETCH_COUNT', '0');
    return ContentService.createTextOutput('Fetch counter reset').setMimeType(ContentService.MimeType.TEXT);
  }

  if (action === 'clear_cache') {
    CacheService.getScriptCache().removeAll(['debug_status']);
    return ContentService.createTextOutput('Cache cleared successfully').setMimeType(ContentService.MimeType.TEXT);
  }

  if (action === 'send_test') {
    try {
      const resp = sendMessage(getAdminId(), "🧪 Diagnostic Test: If you see this, your Bot Token and Admin ID are 100% correct!");
      const result = JSON.parse(resp.getContentText());
      if (result.ok) {
        return ContentService.createTextOutput('✅ Success! Check Telegram.').setMimeType(ContentService.MimeType.TEXT);
      } else {
        return ContentService.createTextOutput('❌ Telegram Error: ' + result.description).setMimeType(ContentService.MimeType.TEXT);
      }
    } catch (err) {
      return ContentService.createTextOutput('❌ Script Error: ' + err.toString()).setMimeType(ContentService.MimeType.TEXT);
    }
  }

  // If we reach here, and no action was matched, return a final 403 JSON error for safety
  return ContentService.createTextOutput(JSON.stringify({ error: 'Endpoint reached but no action specified' })).setMimeType(ContentService.MimeType.JSON);
}
