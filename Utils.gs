/**
 * Utils.gs - Setup and Management
 */

// === WEBHOOK MANAGEMENT ===

function checkWebhook() {
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo`;
  const response = UrlFetchApp.fetch(url);
  const info = JSON.parse(response.getContentText());
  
  console.log('=== WEBHOOK DIAGNOSTIC INFO ===\n');
  console.log('Webhook URL:', info.result.url || '(not set)');
  console.log('Pending Updates:', info.result.pending_update_count);
  console.log('Max Connections:', info.result.max_connections || 'default');
  console.log('IP Address:', info.result.ip_address || 'N/A');
  
  // Detailed error information
  if (info.result.last_error_message) {
    console.log('\n❌ LAST ERROR DETECTED:');
    console.log('Error Message:', info.result.last_error_message);
    console.log('Error Date:', new Date(info.result.last_error_date * 1000).toLocaleString());
    
    // Error-specific troubleshooting
    if (info.result.last_error_message.includes('302')) {
      console.log('\n🔧 TROUBLESHOOTING 302 ERROR:');
      console.log('→ This means the deployment requires authentication');
      console.log('→ Go to: Deploy → Manage deployments → Edit');
      console.log('→ Set "Who has access" to "Anyone" (NOT "Anyone with Google account")');
      console.log('→ Click Deploy, then run: stopWebhook(); startWebhook();');
    } else if (info.result.last_error_message.includes('404')) {
      console.log('\n🔧 TROUBLESHOOTING 404 ERROR:');
      console.log('→ Deployment URL is wrong or deployment doesn\'t exist');
      console.log('→ Run startWebhook() to auto-detect and set correct URL');
    }
  } else {
    console.log('\n✅ No errors - Webhook is working correctly!');
  }
  
  // Full response
  console.log('\n📋 FULL WEBHOOK INFO:');
  console.log(JSON.stringify(info.result, null, 2));
  
  return info.result;
}

function stopWebhook() {
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/deleteWebhook`;
  const response = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({
      drop_pending_updates: true
    })
  });
  const result = JSON.parse(response.getContentText());
  
  console.log(result.ok ? '✅ Webhook deleted' : '❌ Failed: ' + result.description);
  return result;
}

function resetBot() {
  console.log('--- RESETTING BOT ---');
  stopWebhook();
  
  // Clear the deduplication cache
  const cache = CacheService.getScriptCache();
  // We can't clear everything easily but we can wait or just restart
  console.log('Cache will expire naturally, webhook cleared.');
  
  Utilities.sleep(1000);
  startWebhook();
  console.log('✅ Bot Reset Complete.');
}

function startWebhook() {
  const WEBHOOK_URL = 'https://script.google.com/macros/s/AKfycbwiSSfx6a2cpc3zxdn1dUUTLfTC1j4haInLdgF-Iw5B3V61zbcpPnFT1pnSesAz5VT6/exec';
  
  console.log('Setting webhook to:', WEBHOOK_URL);
  
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`;
  const response = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({
      url: WEBHOOK_URL,
      drop_pending_updates: true
    })
  });
  
  const result = JSON.parse(response.getContentText());
  console.log(result.ok ? '✅ Webhook set successfully!' : '❌ Failed: ' + result.description);
  return result;
}

// === TESTING ===

function testBot() {
  console.log('Testing bot configuration...\n');
  
  // Check BOT_TOKEN
  console.log('BOT_TOKEN:', BOT_TOKEN ? '✅ Set' : '❌ Missing');
  
  // Check Drive API
  try {
    Drive.Files.list({ maxResults: 1 });
    console.log('Drive API: ✅ Enabled');
  } catch (e) {
    console.log('Drive API: ❌ Not enabled - Add it in Services');
  }
  
  // Check webhook
  const webhook = checkWebhook();
  console.log('\nWebhook configured:', webhook.url ? '✅' : '❌');
}

// === MANUAL TEST ===

function sendTestMessage() {
  // Replace with your Telegram user ID (231207088)
  const MY_CHAT_ID = '231207088';
  
  try {
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
    const response = UrlFetchApp.fetch(url, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify({
        chat_id: MY_CHAT_ID,
        text: '🔧 Manual test successful! The bot can send messages.'
      })
    });
    
    const result = JSON.parse(response.getContentText());
    console.log('Test message sent:', result.ok ? '✅' : '❌');
    console.log('Full result:', JSON.stringify(result));
    return result;
  } catch (e) {
    console.error('Test failed:', e.toString());
    return e;
  }
}

// === DEPLOYMENT VERIFICATION ===

function verifyDeployment() {
  console.log('=== VERIFYING DEPLOYMENT URL ===\n');
  const WEBHOOK_URL = 'https://script.google.com/macros/s/AKfycbwF0HmIyIjXusS-99eUmTyYptp7A-hfywJSEgnLzieonjMexl-hA0U0l_guzIuz910/exec';
  
  console.log('Testing URL:', WEBHOOK_URL);
  
  try {
    // 1. Test GET (like browser)
    console.log('1. Testing GET request (Browser checks)...');
    const getResponse = UrlFetchApp.fetch(WEBHOOK_URL, {
      method: 'get',
      followRedirects: false,
      muteHttpExceptions: true
    });
    console.log('GET Status:', getResponse.getResponseCode());
    
    // 2. Test POST (like Telegram)
    console.log('2. Testing POST request (Telegram checks)...');
    const postResponse = UrlFetchApp.fetch(WEBHOOK_URL, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify({ update_id: 12345, message: { text: "test" } }),
      followRedirects: false,
      muteHttpExceptions: true
    });
    console.log('POST Status:', postResponse.getResponseCode());
    
    // Diagnosis
    if (postResponse.getResponseCode() === 200) {
      console.log('\n✅ SUCCESS! The deployment accepts POST requests.');
      console.log('If Telegram fails, reset the webhook: stopWebhook() -> startWebhook()');
    } else if (postResponse.getResponseCode() === 302) {
      console.log('\n❌ FAILED: Got 302 Redirect.');
      console.log('This CONFIRMS the deployment requires login.');
      console.log('SOLUTION: Create a NEW Deployment with "Anyone" access.');
    } else {
      console.log('\n⚠️ Unexpected Status:', postResponse.getResponseCode());
      console.log('Response:', postResponse.getContentText().slice(0, 100));
    }
    
  } catch (e) {
    console.error('Error during test:', e.toString());
  }
}

// === SPREADSHEET SETUP ===

function setupSpreadsheet() {
  console.log('--- STARTING AGGRESSIVE SPREADSHEET SETUP ---');
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    let sheet = ss.getSheetByName('Logs');
    
    if (!sheet) {
      console.log('Creating "Logs" sheet...');
      sheet = ss.insertSheet('Logs');
    }
    
    // Force set headers on Row 1 regardless of contents
    console.log('Forcing headers on Row 1...');
    const headers = [['Timestamp', 'Chat ID', 'File Name', 'Status']];
    sheet.getRange(1, 1, 1, 4).setValues(headers);
    sheet.getRange(1, 1, 1, 4).setFontWeight('bold').setBackground('#EFEFEF').setVerticalAlignment('middle');
    sheet.setFrozenRows(1);
    
    // Add a test row immediately
    sheet.appendRow([new Date(), 'SETUP_TEST', '---', 'SYSTEM_RESET']);
    
    console.log('✅ Spreadsheet Setup Complete. Check for row 2!');
    SpreadsheetApp.flush(); // Force write to disk
    return "SUCCESS: Headers added and test row written.";
  } catch (e) {
    console.error('❌ Spreadsheet setup failed:', e.toString());
    return "ERROR: " + e.toString();
  }
}

