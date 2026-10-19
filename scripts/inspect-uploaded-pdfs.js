const fs = require('fs');
const path = require('path');
const { PDFParse } = require('pdf-parse');

(async () => {
  const uploadsDir = path.join(__dirname, '..', 'uploads');
  const files = fs.readdirSync(uploadsDir).filter((name) => name.toLowerCase().endsWith('.pdf'));
  for (const file of files) {
    const fullPath = path.join(uploadsDir, file);
    const buffer = fs.readFileSync(fullPath);
    try {
      const parser = new PDFParse({ data: buffer, verbosity: 0 });
      const result = await parser.getText();
      console.log(file, 'textLength=', (result?.text || '').length);
      console.log((result?.text || '').slice(0, 500));
      console.log('---');
    } catch (error) {
      console.error(file, error.message);
    }
  }
})();

