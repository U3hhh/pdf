/**
 * Utils.gs - Setup and Management
 */

// === WEBHOOK MANAGEMENT ===

function checkWebhook() {
  const url = `https://api.telegram.org/bot${getBotToken()}/getWebhookInfo`;
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
  const url = `https://api.telegram.org/bot${getBotToken()}/deleteWebhook`;
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

function startWebhook(manualUrl) {
  const props = PropertiesService.getScriptProperties();
  const token = getBotToken();
  const urlToSet = manualUrl || props.getProperty('VERCEL_URL');
  
  if (!token || !urlToSet) {
    console.error('Missing BOT_TOKEN or VERCEL_URL in script properties');
    return;
  }
  
  console.log('Setting webhook to:', urlToSet);
  
  const url = `https://api.telegram.org/bot${token}/setWebhook`;
  const response = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({
      url: urlToSet,
      drop_pending_updates: true
    })
  });
  
  const result = JSON.parse(response.getContentText());
  console.log(result.ok ? '✅ Webhook set successfully!' : '❌ Failed: ' + result.description);
  return result;
}

/**
 * Setup script properties from initial values
 * Run this once after deployment
 */
function initializeProjectProperties() {
  const props = PropertiesService.getScriptProperties();
  // These should be filled by the user or pre-filled if known
  props.setProperties({
    'BOT_TOKEN': '8025257893:AAGynpQhsMEfJxex-vHn5LhsM4i1WpMYM2Q',
    'ADMIN_ID': '231207088',
    'SPREADSHEET_ID': '12SoKFk1OOyaJ2_OMaFDwS0M-wGi_pNga_wfkvO6c5No',
    'GAS_SECRET': 'YOUR_RANDOM_SECRET_HERE',
    'VERCEL_URL': 'https://your-vercel-app.vercel.app/'
  });
  console.log('✅ Initial properties set. Please update GAS_SECRET and VERCEL_URL in Project Settings if needed.');
}

// === TESTING ===

function testBot() {
  console.log('Testing bot configuration...\n');
  
  // Check BOT_TOKEN
  console.log('BOT_TOKEN:', getBotToken() ? '✅ Set' : '❌ Missing');
  
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
    const url = `https://api.telegram.org/bot${getBotToken()}/sendMessage`;
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
    const ss = SpreadsheetApp.openById(getSpreadsheetId());
    // 1. Setup Logs Sheet
    let logSheet = ss.getSheetByName('Logs');
    if (!logSheet) {
      logSheet = ss.insertSheet('Logs');
    }
    const logHeaders = [['Date', 'User ID', 'Username', 'First Name', 'File Name', 'Status']];
    logSheet.getRange(1, 1, 1, 6).setValues(logHeaders);
    logSheet.getRange(1, 1, 1, 6).setFontWeight('bold').setBackground('#EFEFEF');
    logSheet.setFrozenRows(1);

    // 2. Setup Users Sheet (Database of all visitors)
    let usersSheet = ss.getSheetByName('Users');
    if (!usersSheet) {
      usersSheet = ss.insertSheet('Users');
      const userHeaders = [['First Seen', 'User ID', 'Username', 'First Name']];
      usersSheet.getRange(1, 1, 1, 4).setValues(userHeaders);
      usersSheet.getRange(1, 1, 1, 4).setFontWeight('bold').setBackground('#D9EAD3');
      usersSheet.setFrozenRows(1);
    }

    // 3. Setup Limits Sheet
    let limitSheet = ss.getSheetByName('Limits');
    if (!limitSheet) {
      limitSheet = ss.insertSheet('Limits');
      limitSheet.appendRow(['Date', 'Chat ID', 'Count']);
      limitSheet.getRange('A1:C1').setFontWeight('bold').setBackground('#EFEFEF');
    }

    // 3. Setup Whitelist Sheet
    let whitelistSheet = ss.getSheetByName('Whitelist');
    if (!whitelistSheet) {
      whitelistSheet = ss.insertSheet('Whitelist');
      whitelistSheet.appendRow(['Identifier (ID or @Username)', 'Added Date']);
      whitelistSheet.getRange('A1:B1').setFontWeight('bold').setBackground('#EFEFEF');
    }
    
    // 4. Setup Settings Sheet (for Language)
    let settingsSheet = ss.getSheetByName('Settings');
    if (!settingsSheet) {
      settingsSheet = ss.insertSheet('Settings');
      settingsSheet.appendRow(['Chat ID', 'Language']);
      settingsSheet.getRange('A1:B1').setFontWeight('bold').setBackground('#EFEFEF');
    }
    
    console.log('✅ Spreadsheet Setup Complete. Check for all tabs!');
    SpreadsheetApp.flush(); // Force write to disk
    return "SUCCESS: Headers added and test row written.";
  } catch (e) {
    console.error('❌ Spreadsheet setup failed:', e.toString());
    return "ERROR: " + e.toString();
  }
}

