const fs = require('fs');

(async () => {
  const files = ['uploads/sample.pdf', 'uploads/Preheater_11.700_Beam.pdf'];
  for (const file of files) {
    if (!fs.existsSync(file)) {
      console.log(file, 'not found');
      continue;
    }

    const buffer = fs.readFileSync(file);
    try {
      const pdfParseModule = await import('pdf-parse');
      const PdfParser = pdfParseModule.PDFParse || pdfParseModule.default;
      const parser = new PdfParser();
      const result = await parser.parse(buffer, { pagerender: 1 });
      console.log(file, 'bytes=', buffer.length, 'numpages=', result?.numpages || 1, 'textLength=', (result?.text || '').length);
      console.log((result?.text || '').slice(0, 2000));
      console.log('---');
    } catch (error) {
      console.error(file, error.message);
    }
  }
})();

