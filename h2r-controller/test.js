const fs = require('fs');

function parseCSV(text) {
  const lines = [];
  let row = [""];
  let inQuotes = false;
  
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i+1];
    
    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        row[row.length - 1] += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      row.push("");
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++;
      }
      lines.push(row);
      row = [""];
    } else {
      row[row.length - 1] += char;
    }
  }
  if (row.length > 1 || row[0] !== "") {
    lines.push(row);
  }
  return lines;
}

function splitChineseAndEnglish(text) {
  if (!text) return { zh: '', en: '' };
  text = text.trim();
  
  // Case 1: Multiple lines
  if (text.includes('\n')) {
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    let zhParts = [];
    let enParts = [];
    lines.forEach(line => {
      if (/[\u4e00-\u9fa5]/.test(line)) {
        zhParts.push(line);
      } else {
        enParts.push(line);
      }
    });
    if (zhParts.length && enParts.length) {
      return { zh: zhParts.join(' ').trim(), en: enParts.join(' ').trim() };
    }
    if (lines.length >= 2) {
      return { zh: lines[0], en: lines[1] };
    }
  }
  
  // Case 2: Split by common delimiters
  const delimiters = ['/', '｜', '|', ' - '];
  for (let delim of delimiters) {
    if (text.includes(delim)) {
      const parts = text.split(delim).map(p => p.trim());
      if (parts.length >= 2) {
        const firstHasZh = /[\u4e00-\u9fa5]/.test(parts[0]);
        const secondHasZh = /[\u4e00-\u9fa5]/.test(parts[1]);
        if (firstHasZh && !secondHasZh) {
          return { zh: parts[0], en: parts[1] };
        } else if (!firstHasZh && secondHasZh) {
          return { zh: parts[1], en: parts[0] };
        } else {
          return { zh: parts[0], en: parts[1] };
        }
      }
    }
  }
  
  // Case 3: Mixed language without delimiters
  const hasChinese = /[\u4e00-\u9fa5]/.test(text);
  const hasEnglish = /[a-zA-Z]/.test(text);
  
  if (hasChinese && hasEnglish) {
    // Try regex split
    const parts = text.split(/(?<=[\w\?\!\.\)\uff09])\s+(?=[\u4e00-\u9fa5])|(?<=[\u4e00-\u9fa5\)\uff09])\s+(?=[a-zA-Z])/);
    if (parts.length >= 2) {
      const firstHasZh = /[\u4e00-\u9fa5]/.test(parts[0]);
      const secondHasZh = /[\u4e00-\u9fa5]/.test(parts[1]);
      if (firstHasZh && !secondHasZh) {
        return { zh: parts[0], en: parts[1] };
      } else if (!firstHasZh && secondHasZh) {
        return { zh: parts[1], en: parts[0] };
      }
    }

    // Space transition scan
    const words = text.split(/\s+/);
    for (let i = 1; i < words.length; i++) {
      const leftSide = words.slice(0, i).join(' ');
      const rightSide = words.slice(i).join(' ');
      
      const leftHasZh = /[\u4e00-\u9fa5]/.test(leftSide);
      const rightHasZh = /[\u4e00-\u9fa5]/.test(rightSide);
      const rightHasEn = /[a-zA-Z]/.test(rightSide);
      
      if (leftHasZh && !rightHasZh && rightHasEn) {
        return { zh: leftSide, en: rightSide };
      }
    }

    // Fallback
    const zh = text.replace(/[\u0000-\u007F]+/g, (match) => {
      return match.replace(/[a-zA-Z]+/g, '').replace(/\s+/g, ' ');
    }).trim();
    
    const en = text.replace(/[\u4e00-\u9fa5]/g, '').trim().replace(/\s+/g, ' ');
    return { zh, en };
  }
  
  if (hasChinese) return { zh: text, en: text };
  return { zh: text, en: text };
}

const csvData = fs.readFileSync('data.csv', 'utf8');
const rows = parseCSV(csvData);

for (let row of rows) {
  if (row.length === 0) continue;
  const cell0 = row[0] ? row[0].trim() : "";
  if (/^[0-9]/.test(cell0)) {
    const speaker = row[1] ? row[1].trim() : "";
    const parsedSpeaker = splitChineseAndEnglish(speaker);
    console.log(`Date: ${cell0} | Raw: ${speaker.replace(/\n/g, '\\n').replace(/\r/g, '\\r')} | zh: ${parsedSpeaker.zh} | en: ${parsedSpeaker.en}`);
  }
}
