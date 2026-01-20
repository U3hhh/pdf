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
  const props = PropertiesService.getScriptProperties();
  const action = e.parameter.action;
  
  if (action === 'clear_cache') {
    CacheService.getScriptCache().removeAll(['debug_status']);
    return ContentService.createTextOutput('Cache cleared successfully').setMimeType(ContentService.MimeType.TEXT);
  }

  const token = props.getProperty('BOT_TOKEN');
  const adminId = props.getProperty('ADMIN_ID');
  const ssId = props.getProperty('SPREADSHEET_ID');
  const secret = props.getProperty('GAS_SECRET');
  
  let tgStatus = 'Checking...';
  let botUsername = '';
  if (token) {
    try {
      const resp = UrlFetchApp.fetch(`https://api.telegram.org/bot${token}/getMe`);
      const data = JSON.parse(resp.getContentText());
      if (data.ok) {
        botUsername = data.result.username;
        tgStatus = `<b class="ok">✅ Connected to @${botUsername}</b>`;
      } else {
        tgStatus = `<b class="error">❌ Telegram Error: ${data.description}</b>`;
      }
    } catch (err) {
      tgStatus = `<b class="error">❌ Connection Failed: ${err.toString()}</b>`;
    }
  } else {
    tgStatus = `<b class="error">❌ No Token Provided</b>`;
  }

  let driveStatus = 'Checking...';
  try {
    DriveApp.getRootFolder();
    driveStatus = '<b class="ok">✅ Drive API Enabled</b>';
  } catch (err) {
    driveStatus = '<b class="error">❌ Drive API Error (Enable in Services)</b>';
  }

  const html = `
    <html>
      <head>
        <title>Bot Diagnostic</title>
        <style>
          body{font-family:sans-serif;background:#f4f7f6;padding:40px;color:#333}
          .card{background:white;padding:20px;border-radius:8px;box-shadow:0 2px 5px rgba(0,0,0,0.1);max-width:600px;margin:auto}
          h1{color:#2c3e50;font-size:24px;margin-bottom:20px;border-bottom:2px solid #eee;padding-bottom:10px}
          ul{list-style:none;padding:0}
          li{padding:12px 0;border-bottom:1px solid #eee;display:flex;justify-content:space-between;align-items:center}
          .ok{color:#27ae60} .error{color:#e74c3c} .label{font-weight:bold;color:#7f8c8d}
          .btn{background:#3498db;color:white;padding:10px 15px;text-decoration:none;border-radius:4px;display:inline-block;margin-top:20px}
        </style>
      </head>
      <body>
        <div class="card">
          <h1>🛠️ Bot Live Diagnostic</h1>
          <ul>
            <li><span class="label">Telegram Bot:</span> ${tgStatus}</li>
            <li><span class="label">Google Drive:</span> ${driveStatus}</li>
            <li><span class="label">Admin ID:</span> ${adminId ? `<b class="ok">✅ ${adminId}</b>` : '<b class="error">❌ Missing</b>'}</li>
            <li><span class="label">Spreadsheet ID:</span> ${ssId ? '<b class="ok">✅ Set</b>' : '<b class="error">❌ Missing</b>'}</li>
            <li><span class="label">Security Secret:</span> ${secret ? '<b class="ok">✅ Set</b>' : '<b class="error">❌ Missing</b>'}</li>
          </ul>
          <div style="margin-top:20px;text-align:center">
            <a href="?action=clear_cache" class="btn">🧹 Clear Script Cache</a>
            <p style="font-size:12px;color:#95a5a6;margin-top:10px">Refresh this page after updating <b>Script Properties</b>.</p>
          </div>
        </div>
      </body>
    </html>
  `;
  return ContentService.createTextOutput(html).setMimeType(ContentService.MimeType.HTML);
}
