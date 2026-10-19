const fs = require('fs');
const pdfParse = require('pdf-parse');

(async () => {
  const buffer = fs.readFileSync('uploads/sample.pdf');
  try {
    const data = await pdfParse(buffer);
    console.log('textLength', data.text.length);
    console.log(data.text.slice(0, 1500));
  } catch (error) {
    console.error(error);
  }
})();

