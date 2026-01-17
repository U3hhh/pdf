/**
 * Bot.gs - Message Handling
 */

// Configuration Constants
const BOT_TOKEN = '8025257893:AAGynpQhsMEfJxex-vHn5LhsM4i1WpMYM2Q';
const ADMIN_ID = '231207088';
const SPREADSHEET_ID = '12SoKFk1OOyaJ2_OMaFDwS0M-wGi_pNga_wfkvO6c5No';

const BOT_API = 'https://api.telegram.org/bot';

function getBotUrl() {
  return BOT_API + BOT_TOKEN + '/';
}

function processMessage(msg) {
  console.log('processMessage called');
  const chatId = msg.chat.id;
  const text = msg.text || ''; // Handle undefined text
  
  console.log('Chat ID:', chatId);
  console.log('Text:', text || '(no text)');
  console.log('Has document:', !!msg.document);
  
  // Commands
  if (text === '/start') {
    sendMessage(chatId, '👋 Welcome! Send me a Word, Excel, or PowerPoint file and I will convert it to PDF.');
    return;
  }
  
  if (text === '/help') {
    sendMessage(chatId, 'Just upload a document (.docx, .xlsx, .pptx) and I will convert it to PDF.');
    return;
  }

  if (text === '/version') {
    sendMessage(chatId, '🤖 Bot Version: 11.0 (Simple Mode)\n🛠️ Logic: Multi-lane Enabled\n📊 Spreadsheet: ACTIVE');
    return;
  }
  
  // File handling
  if (msg.document) {
    console.log('Document detected, calling handleFile');
    handleFile(chatId, msg.document);
  } else {
    console.log('No document in message');
  }
}

function handleFile(chatId, doc) {
  console.log('handleFile called for chatId:', chatId);
  
  try {
    // Validate file
    const fileName = doc.file_name;
    const ext = fileName.split('.').pop().toLowerCase();
    
    if (!['docx', 'xlsx', 'pptx', 'doc', 'xls', 'ppt'].includes(ext)) {
      sendMessage(chatId, '❌ Unsupported file. Send .docx, .xlsx, or .pptx');
      return;
    }
    
    // Process
    const requestId = Math.floor(Math.random() * 8999) + 1000;
    sendMessage(chatId, '📥 Processing... (ID: ' + requestId + ')');
    const fileBlob = downloadFile(doc.file_id);
    
    // Convert
    const pdfBlob = convertToPdf(fileBlob, fileName);
    
    // Send
    sendDocument(chatId, pdfBlob);
    
    // Log to Spreadsheet
    logToSheet(chatId, fileName);
    
    // Final Confirmation
    sendMessage(chatId, '✅ PDF Delivered! Tracking updated.');
    
  } catch (error) {
    console.error('!!! handleFile ERROR:', error.toString());
    sendMessage(chatId, '❌ CRASH: ' + error.toString());
  }
}

function logToSheet(chatId, fileName) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    let sheet = ss.getSheetByName('Logs');
    
    if (!sheet) {
      throw new Error('Tab named "Logs" not found in your spreadsheet! Please run setupSpreadsheet() first.');
    }
    
    sheet.appendRow([
      new Date(),
      chatId,
      fileName,
      'Success'
    ]);
  } catch (e) {
    console.error('Logging failed:', e.toString());
    sendMessage(chatId, '⚠️ Spreadsheet Log Failed: ' + e.toString());
  }
}

function sendMessage(chatId, text) {
  const url = getBotUrl() + 'sendMessage';
  const payload = {
    chat_id: chatId,
    text: text
  };
  
  UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload)
  });
}

function sendDocument(chatId, blob) {
  const url = getBotUrl() + 'sendDocument';
  
  UrlFetchApp.fetch(url, {
    method: 'post',
    payload: {
      chat_id: String(chatId),
      document: blob
    }
  });
}

function downloadFile(fileId) {
  const url = getBotUrl() + 'getFile';
  const response = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({ file_id: fileId })
  });
  
  const result = JSON.parse(response.getContentText());
  const filePath = result.result.file_path;
  const downloadUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${filePath}`;
  
  return UrlFetchApp.fetch(downloadUrl).getBlob();
}
