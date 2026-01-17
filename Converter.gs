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
      
      // Wait for Google Drive to finish internal processing
      Utilities.sleep(2000);
      
      const file = DriveApp.getFileById(convertedFileId);
      return file.getAs(MimeType.PDF).setName(fileName.replace(/\.[^.]+$/, '.pdf'));
      
    } else {
      // DOCX/XLSX: Direct conversion
      const mimeType = ext.startsWith('doc') ? MimeType.GOOGLE_DOCS : MimeType.GOOGLE_SHEETS;
      
      const file = Drive.Files.insert({
        title: fileName,
        mimeType: mimeType
      }, blob, { convert: true });
      tempFileId = file.id;
      
      // Wait for Google Drive to finish internal processing
      Utilities.sleep(2000);
      
      try {
        const pdfFile = DriveApp.getFileById(tempFileId);
        return pdfFile.getAs(MimeType.PDF).setName(fileName.replace(/\.[^.]+$/, '.pdf'));
      } catch (e) {
        // Retry once after another short wait if it fails
        Utilities.sleep(3000);
        const pdfFile = DriveApp.getFileById(tempFileId);
        return pdfFile.getAs(MimeType.PDF).setName(fileName.replace(/\.[^.]+$/, '.pdf'));
      }
    }
    
  } catch (err) {
    throw new Error("Conversion Error: " + err.toString() + "\nFile Name: " + fileName);
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
