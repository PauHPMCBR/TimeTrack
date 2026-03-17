const fs = require('fs');
const content = fs.readFileSync('frontend/app/i18n.tsx', 'utf8');

// Use regex to find the dictionaries object
const dictRegex = /const dictionaries: Record<Lang, Dict> = ({[\s\S]*?});/;
const match = content.match(dictRegex);

if (match) {
  // This is a bit hacky because it's not valid JSON, it's a TS object.
  // But since it's mostly string keys and values, we can try to evaluate it carefully
  // or use a more sophisticated regex.
  
  const dictStr = match[1];
  
  // A safer way to extract each language:
  const langs = ['ca', 'es', 'en'];
  langs.forEach(lang => {
    const langRegex = new RegExp(`${lang}: \{([\s\S]*?)},`, 'm');
    const langMatch = dictStr.match(langRegex);
    if (langMatch) {
      const entriesStr = langMatch[1];
      const dict = {};
      const entryRegex = /"([^"]+)":\s*"([^"]*)"/g;
      let entry;
      while ((entry = entryRegex.exec(entriesStr)) !== null) {
        dict[entry[1]] = entry[2].replace(/\\"/g, '"');
      }
      fs.writeFileSync(`frontend/locales/${lang}.json`, JSON.stringify(dict, null, 2));
      console.log(`Extracted ${lang}.json`);
    }
  });
} else {
  console.error('Dictionaries not found');
}
