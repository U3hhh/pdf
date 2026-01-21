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
    try {
      if (update.message) {
        console.log('Routing to processMessage. ID:', update.update_id);
        processMessage(update.message);
      } else if (update.callback_query) {
        console.log('Routing to handleCallback. ID:', update.update_id);
        handleCallback(update.callback_query);
      }
    } catch (routeError) {
      console.error('Routing Error (processMessage/handleCallback):', routeError.toString());
      logEvent('SYSTEM', 'Routing Error: ' + routeError.toString(), 'ERROR');
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
        maintenanceMode: props.getProperty('MAINTENANCE_MODE') === 'true',
        driveUsed: DriveApp.getStorageUsed(),
        driveTotal: DriveApp.getStorageLimit(),
        fetchCount: parseInt(props.getProperty('URL_FETCH_COUNT') || '0'),
        fetchLimit: 20000,
        runtimeCount: parseInt(props.getProperty('RUNTIME_COUNT') || '0'),
        runtimeLimit: 5400000 
      },
      stats: {
        totalConversions: 0,
        totalUsers: 0,
        hourlyActivity: {}
      },
      users: [],
      logs: []
    };

    try {
      const ss = SpreadsheetApp.openById(props.getProperty('SPREADSHEET_ID'));
      
      // 1. Stats Aggregation
      const logSheet = ss.getSheetByName('Logs');
      if (logSheet) {
        const rows = logSheet.getDataRange().getValues();
        const body = rows.slice(1);
        data.stats.totalConversions = body.filter(r => r[3] === 'CONVERSION').length;
        
        // Hourly Trend (Last 24h)
        const now = new Date();
        body.forEach(row => {
          const date = new Date(row[0]);
          if (now - date < 24 * 60 * 60 * 1000) {
            const hour = date.getHours();
            data.stats.hourlyActivity[hour] = (data.stats.hourlyActivity[hour] || 0) + 1;
          }
        });

        // Logs for Feed
        data.logs = body.slice(-40).reverse().map(row => ({
          timestamp: row[0] || new Date().toISOString(),
          userId: row[1] || 'Unknown',
          username: row[2] || '---',
          type: row[3] || 'INFO',
          details: row[4] || '---',
          status: row[5] || 'Pending'
        }));
      }

      // 2. User Data
      const usersSheet = ss.getSheetByName('Users');
      if (usersSheet) {
        const uRows = usersSheet.getDataRange().getValues();
        data.stats.totalUsers = uRows.length - 1;
        data.users = uRows.slice(1).slice(-10).reverse().map(row => ({
          joined: row[0],
          id: row[1],
          username: row[2],
          name: row[3]
        }));
      }
    } catch (err) {
      data.error = err.toString();
    }

    return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
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

  if (action === 'toggle_maintenance') {
    const currentState = props.getProperty('MAINTENANCE_MODE') === 'true';
    props.setProperty('MAINTENANCE_MODE', !currentState);
    return ContentService.createTextOutput(!currentState ? 'Maintenance Enabled' : 'Maintenance Disabled').setMimeType(ContentService.MimeType.TEXT);
  }

  if (action === 'broadcast') {
    const msg = e.parameter.message;
    if (!msg) return ContentService.createTextOutput('Error: No message').setMimeType(ContentService.MimeType.TEXT);
    try {
      const results = sendBroadcast(msg);
      return ContentService.createTextOutput(results).setMimeType(ContentService.MimeType.TEXT);
    } catch (err) {
      return ContentService.createTextOutput('Broadcast Error: ' + err.toString()).setMimeType(ContentService.MimeType.TEXT);
    }
  }

  if (action === 'add_whitelist') {
    const user = e.parameter.user;
    whitelistUser(user);
    return ContentService.createTextOutput('User ' + user + ' whitelisted').setMimeType(ContentService.MimeType.TEXT);
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
