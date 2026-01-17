/**
 * Converter.gs - File Conversion
 */

function convertToPdf(blob, fileName) {
  const ext = fileName.split('.').pop().toLowerCase();
  let tempFileId, convertedFileId;
  
  try {
    if (ext === 'pptx' || ext === 'ppt') {
      // PPTX: Upload → Copy to Slides → Export
      const upload = Drive.Files.insert({
        title: fileName,
        mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
      }, blob);
      tempFileId = upload.id;
      
      const slides = Drive.Files.copy({
        title: fileName,
        mimeType: MimeType.GOOGLE_SLIDES
      }, tempFileId);
      convertedFileId = slides.id;
      
      // Export using DriveApp (No Auth/Spam check issues)
      const pdfBlob = DriveApp.getFileById(convertedFileId).getAs(MimeType.PDF);
      return pdfBlob.setName(fileName.replace(/\.[^.]+$/, '.pdf'));
      
    } else {
      // DOCX/XLSX: Direct conversion
      const mimeType = ext.startsWith('doc') ? MimeType.GOOGLE_DOCS : MimeType.GOOGLE_SHEETS;
      
      const file = Drive.Files.insert({
        title: fileName,
        mimeType: mimeType
      }, blob, { convert: true });
      tempFileId = file.id;
      
      // Export using DriveApp
      const pdfBlob = DriveApp.getFileById(tempFileId).getAs(MimeType.PDF);
      return pdfBlob.setName(fileName.replace(/\.[^.]+$/, '.pdf'));
    }
    
  } finally {
    // Cleanup
    if (tempFileId) {
      try { Drive.Files.remove(tempFileId); } catch (e) {}
    }
    if (convertedFileId) {
      try { Drive.Files.remove(convertedFileId); } catch (e) {}
    }
  }
}
