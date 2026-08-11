const fs = require('fs');

// --- Configuration ---
const CONFIG = {
  googleSheetUrl: "https://docs.google.com/spreadsheets/d/1zrMaPubQ7uaUvgBjYZ3lWIBRUclg0GsGliHMqpvOark/edit?gid=1244479830#gid=1244479830",
  h2rHost: "http://localhost:4001",
  h2rProject: "ABCD",
  h2rGraphicId: "5MMWQ",
  h2rAutoShow: true,
  template: {
    line_one: "{title_zh} | {title_en}",
    line_two: "講員/Speaker: {speaker_zh} {speaker_en} ｜ 詩歌/Hymns: {sermon_hymns}"
  }
};

// --- Parsers (Ported from popup.js) ---
function parseCSV(text) {
  const lines = [];
  let row = [""];
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

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

  const hasChinese = /[\u4e00-\u9fa5]/.test(text);
  const hasEnglish = /[a-zA-Z]/.test(text);

  if (hasChinese && hasEnglish) {
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

    const zh = text.replace(/[\u0000-\u007F]+/g, (match) => {
      return match.replace(/[a-zA-Z]+/g, '').replace(/\s+/g, ' ');
    }).trim();

    const en = text.replace(/[\u4e00-\u9fa5]/g, '').trim().replace(/\s+/g, ' ');
    return { zh, en };
  }

  if (hasChinese) return { zh: text, en: '' };
  if (hasEnglish) return { zh: '', en: text };
  return { zh: text, en: text };
}

function parseHymnCell(text) {
  if (!text) return [];
  return text.split(',')
    .map(h => h.trim())
    .filter(Boolean)
    .map(h => {
      const match = h.match(/^([0-9]+[a-zA-Z]?)/);
      return match ? match[1] : h;
    });
}

function parseDateString(dateStr) {
  const parts = dateStr.split('/');
  if (parts.length === 3) {
    let month = parseInt(parts[0], 10) - 1;
    let day = parseInt(parts[1], 10);
    let year = parseInt(parts[2], 10);
    if (year < 100) year += 2000;
    return new Date(year, month, day);
  }
  return new Date(0);
}

// --- Main Execution ---
async function main() {
  try {
    const idMatch = CONFIG.googleSheetUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (!idMatch) throw new Error("Invalid Google Sheet URL in CONFIG.");
    const docId = idMatch[1];

    console.log(`[1] Fetching tabs for document ${docId}...`);
    const htmlviewUrl = `https://docs.google.com/spreadsheets/d/${docId}/htmlview`;
    const htmlResp = await fetch(htmlviewUrl);
    const htmlText = await htmlResp.text();

    const sheets = [];
    const regex = /items\.push\(\{\s*name:\s*"([^"]+)",\s*pageUrl:\s*"[^"]+",\s*gid:\s*"([0-9]+)"/g;
    let match;
    while ((match = regex.exec(htmlText)) !== null) {
      sheets.push({
        name: match[1].replace(/\\x3d/g, '=').replace(/\\u0026/g, '&'),
        gid: match[2]
      });
    }

    if (sheets.length === 0) {
      let fallbackGid = "1244479830";
      const gidMatch = CONFIG.googleSheetUrl.match(/gid=([0-9]+)/);
      if (gidMatch) fallbackGid = gidMatch[1];
      sheets.push({ name: "Schedule", gid: fallbackGid });
    }

    let servicesData = [];
    console.log(`[2] Syncing schedules across ${sheets.length} tabs...`);

    for (const tab of sheets) {
      const csvUrl = `https://docs.google.com/spreadsheets/d/${docId}/export?format=csv&gid=${tab.gid}`;
      const csvResp = await fetch(csvUrl);
      const csvText = await csvResp.text();

      const rows = parseCSV(csvText);
      let currentSection = "";

      for (let row of rows) {
        if (row.length === 0) continue;
        const cell0 = row[0] ? row[0].trim() : "";
        if (!cell0) continue;

        if (["MONDAYS", "FRIDAYS", "SATURDAY AM'S", "SATURDAY PM'S"].includes(cell0.toUpperCase())) {
          currentSection = cell0;
          continue;
        }

        if (/^[0-9]/.test(cell0)) {
          const speaker = row[1] ? row[1].trim() : "";
          const sermonTitle = row[2] ? row[2].trim() : "";
          const sermonHymns = row[3] ? row[3].trim() : "";

          if (!speaker && !sermonTitle && !sermonHymns) continue;

          const parsedSpeaker = splitChineseAndEnglish(speaker);
          const parsedTitle = splitChineseAndEnglish(sermonTitle);
          const sermonHymnsArr = parseHymnCell(sermonHymns);

          servicesData.push({
            tabName: tab.name,
            section: currentSection,
            date: cell0,
            speaker_zh: parsedSpeaker.zh,
            speaker_en: parsedSpeaker.en,
            title_zh: parsedTitle.zh,
            title_en: parsedTitle.en,
            sermon_hymn_start: sermonHymnsArr[0] || "",
            sermon_hymn_end: sermonHymnsArr[1] || ""
          });
        }
      }
    }

    if (servicesData.length === 0) {
      throw new Error("No service events with valid dates found across all tabs.");
    }

    servicesData.sort((a, b) => parseDateString(a.date).getTime() - parseDateString(b.date).getTime());

    // Find closest date to today
    let closestIdx = 0;
    let minDiff = Infinity;
    let today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayMs = today.getTime();

    servicesData.forEach((s, idx) => {
      const serviceDate = parseDateString(s.date);
      serviceDate.setHours(0, 0, 0, 0);
      const diff = Math.abs(serviceDate.getTime() - todayMs);
      if (diff < minDiff) {
        minDiff = diff;
        closestIdx = idx;
      }
    });

    const targetService = servicesData[closestIdx];
    console.log(`[3] Found closest service date: ${targetService.date}`);
    console.log(`    Speaker: ${targetService.speaker_zh} ${targetService.speaker_en}`);

    // Build Payload
    const speakerCombined = `${targetService.speaker_zh || ''} ${targetService.speaker_en || ''}`.trim();
    const hymnsList = `${targetService.sermon_hymn_start}, ${targetService.sermon_hymn_end}`.trim().replace(/^,|,$/g, '');

    function replacePlaceholders(obj) {
      if (typeof obj === 'string') {
        return obj
          .replace(/{title_zh}/g, targetService.title_zh || '')
          .replace(/{title_en}/g, targetService.title_en || '')
          .replace(/{speaker_zh}/g, targetService.speaker_zh || '')
          .replace(/{speaker_en}/g, targetService.speaker_en || '')
          .replace(/{speaker}/g, speakerCombined)
          .replace(/{sermon_hymns}/g, hymnsList);
      } else if (Array.isArray(obj)) {
        return obj.map(replacePlaceholders);
      } else if (obj !== null && typeof obj === 'object') {
        const res = {};
        for (const k in obj) {
          res[k] = replacePlaceholders(obj[k]);
        }
        return res;
      }
      return obj;
    }

    const payloadObj = replacePlaceholders(CONFIG.template);
    if (!Array.isArray(payloadObj.cues)) {
      payloadObj.cues = [];
    }

    // Push to H2R
    const updateUrl = `${CONFIG.h2rHost.replace(/\/$/, '')}/api/${CONFIG.h2rProject}/graphic/${CONFIG.h2rGraphicId}/update`;
    console.log(`[4] Pushing to H2R Graphic (${updateUrl})...`);

    const updateResp = await fetch(updateUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payloadObj)
    });

    if (!updateResp.ok) {
      throw new Error(`H2R server returned HTTP ${updateResp.status} on update`);
    }
    console.log(`    Update Successful!`);

    if (CONFIG.h2rAutoShow) {
      const showUrl = `${CONFIG.h2rHost.replace(/\/$/, '')}/api/${CONFIG.h2rProject}/graphic/${CONFIG.h2rGraphicId}/show`;
      console.log(`[5] Taking graphic live (${showUrl})...`);

      const showResp = await fetch(showUrl, { method: 'POST' });
      if (!showResp.ok) {
        throw new Error(`H2R server returned HTTP ${showResp.status} on show`);
      }
      console.log(`    Take Live Successful!`);
    }

    console.log(`[6] Done.`);
  } catch (err) {
    console.error(`Error: ${err.message}`);
    throw err;
  }
}

module.exports = { main };
