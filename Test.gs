/**
 * Test.gs - System Doctor & Diagnostics
 * Run 'runDiagnostics' to fix/check everything.
 */

/**
 * 🩺 MAIN SYSTEM DOCTOR
 * Run this function to check everything!
 */
function runDiagnostics() {
  const ui = console; // Using console for logs
  console.log('🩺 STARTING SYSTEM DIAGNOSTICS...');
  
  const results = {
    config: false,
    permissions: false,
    conversion: false,
    spreadsheet: false,
    telegram: false
  };

  // 1. CONFIGURATION CHECK
  try {
    console.log('\n1️⃣ Checking Configuration...');
    if (!getBotToken()) throw new Error('BOT_TOKEN is missing');
    if (!getAdminId()) console.warn('⚠️ ADMIN_ID is missing (optional but recommended)');
    
    // Check Webhook Validation
    const webhookInfo = UrlFetchApp.fetch(`https://api.telegram.org/bot${getBotToken()}/getWebhookInfo`).getContentText();
    const webhookJson = JSON.parse(webhookInfo);
    if (!webhookJson.ok) throw new Error('Telegram API Error: ' + webhookJson.description);
    if (!webhookJson.result.url) throw new Error('Webhook URL is NOT set! Run startWebhook() in Utils.gs');
    
    console.log('✅ Configuration looks good.');
    results.config = true;
  } catch (e) {
    console.error('❌ CONFIG FAILED:', e.message);
    return; // Stop here
  }

  // 2. PERMISSION CHECK (DriveApp)
  try {
    console.log('\n2️⃣ Checking Drive Permissions...');
    // This simple call forces the script to ask for DriveApp permission if missing
    const files = DriveApp.getFiles();
    if (files.hasNext()) {
      console.log('✅ DriveApp Access: GRANTED');
    }
    results.permissions = true;
  } catch (e) {
    console.error('❌ PERMISSION ERROR:', e.message);
    console.error('👉 ACTION REQUIRED: Run this function again and click "Review Permissions"');
    return;
  }

  // 3. CONVERSION LOGIC CHECK
  try {
    console.log('\n3️⃣ Testing PDF Conversion (Internal)...');
    const testContent = 'System Diagnostic Test - ' + new Date().toString();
    const testBlob = Utilities.newBlob(testContent, 'text/plain', 'diagnostic.txt');
    
    // Create temp Google Doc
    const resource = {
      title: 'Diagnostic_Temp',
      mimeType: MimeType.GOOGLE_DOCS
    };
    const file = Drive.Files.insert(resource, testBlob, { convert: true });
    console.log('  → Temp file created:', file.id);
    
    // TEST THE NEW CONVERTER LOGIC (DriveApp)
    const pdfBlob = DriveApp.getFileById(file.id).getAs(MimeType.PDF);
    console.log('  → Conversion successful, PDF size:', pdfBlob.getBytes().length);
    
    // Cleanup
    Drive.Files.remove(file.id);
    console.log('✅ Conversion Logic: WORKING');
    results.conversion = true;
  } catch (e) {
    console.error('❌ CONVERSION FAILED:', e.message);
    console.error('Stack:', e.stack);
    return;
  }

  // 4. SPREADSHEET LOGGING CHECK
  try {
    console.log('\n4️⃣ Checking Spreadsheet Logging...');
    const ss = SpreadsheetApp.openById(getSpreadsheetId());
    const sheet = ss.getSheetByName('Logs');
    // Test writing a single cell to verify permissions
    console.log('  → Testing write access...');
    sheet.getRange(sheet.getLastRow() + 1, 1).setValue('Diagnostic Check: ' + new Date());
    console.log('✅ Spreadsheet & Logs Tab: READY & WRITABLE');
    results.spreadsheet = true;
  } catch (e) {
    console.error('❌ SPREADSHEET FAILED:', e.message);
    console.error('👉 Ensure SPREADSHEET_ID is correct and you have approved "Google Sheets" permissions.');
  }

  // 5. TELEGRAM CONNECTIVITY
  try {
    console.log('\n5️⃣ Testing Telegram Connection...');
    const url = `https://api.telegram.org/bot${getBotToken()}/sendMessage`;
    UrlFetchApp.fetch(url, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify({
        chat_id: getAdminId() || '231207088', // Fallback to your ID
        text: '🩺 System Diagnostics: ALL SYSTEMS GO ✅'
      })
    });
    console.log('✅ Telegram Message: SENT');
    results.telegram = true;
  } catch (e) {
    console.error('❌ TELEGRAM FAILED:', e.message);
  }

  // FINAL SUMMARY
  console.log('\n=============================');
  if (results.config && results.permissions && results.conversion && results.spreadsheet) {
    console.log('🎉 RESULT: YOUR BOT IS HEALTHY!');
    console.log('If it still fails in Telegram, ensure you have DEPLOYED "New version".');
  } else {
    console.log('⚠️ RESULT: ISSUES FOUND. See logs above.');
  }
  console.log('=============================');
}
