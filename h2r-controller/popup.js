document.addEventListener('DOMContentLoaded', async () => {
  // --- DOM Elements ---
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabPanels = document.querySelectorAll('.tab-panel');

  const btnReloadSheet = document.getElementById('btn-reload-sheet');
  const btnResetSync = document.getElementById('btn-reset-sync');
  const btnEmptyLoadSheet = document.getElementById('btn-empty-load-sheet');
  const serviceSelector = document.getElementById('service-selector');
  const sheetSelectGroup = document.getElementById('sheet-select-group');
  const sheetEmptyState = document.getElementById('sheet-empty-state');
  const sheetLoadingState = document.getElementById('sheet-loading-state');
  const loadingText = document.getElementById('loading-text');
  
  const dateMetaInfo = document.getElementById('date-meta-info');
  const metaSpeaker = document.getElementById('meta-speaker');
  const metaDate = document.getElementById('meta-date');

  const previewT = document.getElementById('h2r-preview-t');
  const previewS = document.getElementById('h2r-preview-s');
  const btnPushH2R = document.getElementById('btn-push-h2r');
  const checkboxAutoShow = document.getElementById('h2r-auto-show');

  const settingsSheetUrl = document.getElementById('settings-sheet-url');
  const settingsH2rPastedUrl = document.getElementById('settings-h2r-pasted-url');
  const settingsH2rHost = document.getElementById('settings-h2r-host');
  const settingsH2rProject = document.getElementById('settings-h2r-project');
  const settingsH2rGraphicId = document.getElementById('settings-h2r-graphic-id');
  const settingsH2rTemplate = document.getElementById('settings-h2r-template');
  const toastBox = document.getElementById('popup-toast-box');

  // --- State Variables ---
  let settings = {
    googleSheetUrl: "https://docs.google.com/spreadsheets/d/1zrMaPubQ7uaUvgBjYZ3lWIBRUclg0GsGliHMqpvOark/edit?gid=1244479830#gid=1244479830",
    h2rHost: "http://localhost:4001",
    h2rProject: "default",
    h2rGraphicId: "5MMWQ",
    h2rEndpoint: "",
    h2rAutoShow: true,
    selectedDateKey: "",
    h2rTemplate: JSON.stringify({
      line_one: "{title_zh} | {title_en}",
      line_two: "講員/Speaker: {speaker_zh} {speaker_en} ｜ 詩歌/Hymns: {sermon_hymns}"
    }, null, 2)
  };

  let servicesData = [];
  let selectedServiceIndex = -1;
  let parsedFields = {
    title_zh: "",
    title_en: "",
    sermon_hymn_start: "",
    sermon_hymn_end: "",
    speaker_zh: "",
    speaker_en: ""
  };

  // --- Toast System ---
  function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let icon = '✓';
    if (type === 'error') icon = '✕';
    if (type === 'info') icon = 'ℹ';

    toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
    toastBox.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(8px) scale(0.95)';
      setTimeout(() => toast.remove(), 250);
    }, 4000);
  }

  // --- Tab Switcher Logic ---
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const tabId = btn.getAttribute('data-tab');
      
      tabBtns.forEach(b => b.classList.remove('active'));
      tabPanels.forEach(p => p.classList.remove('active'));
      
      btn.classList.add('active');
      document.getElementById(`panel-${tabId}`).classList.add('active');
    });
  });

  // --- Load and Save Settings ---
  const storedData = await chrome.storage.local.get('settings');
  if (storedData.settings) {
    settings = { ...settings, ...storedData.settings };
    
    // Self-healing migration for stripping parentheses from speaker's English name
    if (settings.h2rTemplate && settings.h2rTemplate.includes("({speaker_en})")) {
      console.log("Stripping speaker English name parentheses on startup...");
      settings.h2rTemplate = settings.h2rTemplate.replace(/\({speaker_en}\)/g, "{speaker_en}");
      await chrome.storage.local.set({ settings });
    }
  }

  // Set initial UI values from loaded settings
  settingsSheetUrl.value = settings.googleSheetUrl;
  settingsH2rPastedUrl.value = settings.h2rEndpoint || '';
  settingsH2rHost.value = settings.h2rHost;
  settingsH2rProject.value = settings.h2rProject;
  settingsH2rGraphicId.value = settings.h2rGraphicId;
  settingsH2rTemplate.value = settings.h2rTemplate;
  checkboxAutoShow.checked = settings.h2rAutoShow;

  // Real-time Settings Save listeners
  const inputsToSave = [
    { el: settingsSheetUrl, key: 'googleSheetUrl' },
    { el: settingsH2rPastedUrl, key: 'h2rEndpoint' },
    { el: settingsH2rHost, key: 'h2rHost' },
    { el: settingsH2rProject, key: 'h2rProject' },
    { el: settingsH2rGraphicId, key: 'h2rGraphicId' },
    { el: settingsH2rTemplate, key: 'h2rTemplate' }
  ];

  inputsToSave.forEach(item => {
    item.el.addEventListener('input', async () => {
      settings[item.key] = item.el.value.trim();
      await chrome.storage.local.set({ settings });
    });
  });

  checkboxAutoShow.addEventListener('change', async () => {
    settings.h2rAutoShow = checkboxAutoShow.checked;
    await chrome.storage.local.set({ settings });
  });

  // Auto-parse pasted H2R URL helper
  settingsH2rPastedUrl.addEventListener('input', () => {
    const url = settingsH2rPastedUrl.value.trim();
    if (!url) return;

    try {
      const u = new URL(url);
      const host = `${u.protocol}//${u.host}`;
      settingsH2rHost.value = host;
      settings.h2rHost = host;

      // Extract Graphic ID and Project ID from URL path structure
      // Format 1: /api/project_id/graphic/graphic_id/update
      // Format 2: /graphic/graphic_id/update
      const pathParts = u.pathname.split('/').filter(Boolean);
      
      if (pathParts.includes('api')) {
        const apiIdx = pathParts.indexOf('api');
        const project = pathParts[apiIdx + 1] || 'default';
        settingsH2rProject.value = project;
        settings.h2rProject = project;

        const graphicIdx = pathParts.indexOf('graphic');
        if (graphicIdx !== -1) {
          const gid = pathParts[graphicIdx + 1];
          if (gid) {
            settingsH2rGraphicId.value = gid;
            settings.h2rGraphicId = gid;
          }
        }
      } else if (pathParts.includes('graphic')) {
        const graphicIdx = pathParts.indexOf('graphic');
        const gid = pathParts[graphicIdx + 1];
        if (gid) {
          settingsH2rGraphicId.value = gid;
          settings.h2rGraphicId = gid;
        }
        settingsH2rProject.value = 'default';
        settings.h2rProject = 'default';
      }
      
      chrome.storage.local.set({ settings });
      showToast("Auto-configured H2R connection parameters successfully!", "success");
    } catch (e) {
      console.warn("Invalid pasted H2R URL format:", e);
    }
  });

  function switchToSettingsTab() {
    tabBtns.forEach(b => b.classList.remove('active'));
    tabPanels.forEach(p => p.classList.remove('active'));
    
    const settingsBtn = Array.from(tabBtns).find(b => b.getAttribute('data-tab') === 'settings');
    if (settingsBtn) settingsBtn.classList.add('active');
    
    const settingsPanel = document.getElementById('panel-settings');
    if (settingsPanel) settingsPanel.classList.add('active');
    
    settingsSheetUrl.focus();
    settingsSheetUrl.select();
  }

  // --- Google Sheet Loading & Parsing ---
  async function loadGoogleSheet() {
    const rawUrl = settingsSheetUrl.value.trim();
    if (!rawUrl) {
      showToast("Please configure your Google Sheet URL on the Settings tab first!", "error");
      switchToSettingsTab();
      return;
    }

    sheetEmptyState.style.display = 'none';
    sheetSelectGroup.style.display = 'none';
    dateMetaInfo.style.display = 'none';
    btnResetSync.style.display = 'none';
    sheetLoadingState.style.display = 'block';
    
    const idMatch = rawUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (!idMatch) {
      showToast("Invalid Google Sheet URL format", "error");
      return;
    }
    const docId = idMatch[1];

    sheetEmptyState.style.display = 'none';
    sheetSelectGroup.style.display = 'none';
    dateMetaInfo.style.display = 'none';
    btnResetSync.style.display = 'none';
    sheetLoadingState.style.display = 'block';

    const htmlviewUrl = `https://docs.google.com/spreadsheets/d/${docId}/htmlview`;

    try {
      loadingText.textContent = "Discovering schedule workbook tabs...";
      const tabResponse = await new Promise((resolve) => {
        chrome.runtime.sendMessage({ action: 'FETCH_TABS', url: htmlviewUrl }, resolve);
      });

      if (!tabResponse || !tabResponse.success) {
        throw new Error(tabResponse ? tabResponse.error : "Failed to load workbook details.");
      }

      const tabs = tabResponse.sheets || [];
      if (tabs.length === 0) {
        let fallbackGid = "1244479830";
        const gidMatch = rawUrl.match(/gid=([0-9]+)/);
        if (gidMatch) fallbackGid = gidMatch[1];
        tabs.push({ name: "Schedule", gid: fallbackGid });
      }

      servicesData = [];
      loadingText.textContent = `Syncing schedules across ${tabs.length} tab(s)...`;
      
      const fetchPromises = tabs.map(async (tab) => {
        const csvUrl = `https://docs.google.com/spreadsheets/d/${docId}/export?format=csv&gid=${tab.gid}`;
        
        const csvResponse = await new Promise((resolve) => {
          chrome.runtime.sendMessage({ action: 'FETCH_CSV', url: csvUrl }, resolve);
        });

        if (csvResponse && csvResponse.success) {
          const rows = parseCSV(csvResponse.data);
          let currentSection = "";
          
          for (let row of rows) {
            if (row.length === 0) continue;

            const cell0 = row[0] ? row[0].trim() : "";
            if (!cell0) continue;

            // Section categories header
            if (["MONDAYS", "FRIDAYS", "SATURDAY AM'S", "SATURDAY PM'S"].includes(cell0.toUpperCase())) {
              currentSection = cell0;
              continue;
            }

            // Valid date-based service row
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
                speakerRaw: speaker,
                speaker_zh: parsedSpeaker.zh,
                speaker_en: parsedSpeaker.en,
                titleRaw: sermonTitle,
                title_zh: parsedTitle.zh,
                title_en: parsedTitle.en,
                sermonHymnsRaw: sermonHymns,
                sermon_hymn_start: sermonHymnsArr[0] || "",
                sermon_hymn_end: sermonHymnsArr[1] || ""
              });
            }
          }
        }
      });

      await Promise.all(fetchPromises);

      if (servicesData.length === 0) {
        throw new Error("No service events with valid dates found across all tabs.");
      }

      // Sort services chronologically by date
      servicesData.sort((a, b) => {
        const dateA = parseDateString(a.date);
        const dateB = parseDateString(b.date);
        return dateA.getTime() - dateB.getTime();
      });

      // Populate selector dropdown
      serviceSelector.innerHTML = '';
      servicesData.forEach((s, idx) => {
        const option = document.createElement('option');
        option.value = idx;
        option.textContent = `[${s.tabName} - ${s.section}] ${s.date} - ${s.speaker_zh || s.speaker_en}`;
        serviceSelector.appendChild(option);
      });

      // Calendar sync: auto-select closest date using proximity synchronizer
      syncClosestServiceDate();

      sheetLoadingState.style.display = 'none';
      sheetSelectGroup.style.display = 'block';
      dateMetaInfo.style.display = 'flex';
      btnResetSync.style.display = 'inline-flex';
      
      showToast(`Synced ${servicesData.length} service date(s) successfully!`);
    } catch (err) {
      console.error(err);
      sheetLoadingState.style.display = 'none';
      sheetEmptyState.style.display = 'block';
      showToast(err.message, "error");
    }
  }

  function syncClosestServiceDate() {
    if (servicesData.length === 0) return;
    
    let targetIdx = -1;
    if (settings.selectedDateKey) {
      targetIdx = servicesData.findIndex(s => 
        `${s.date}|${s.section}|${s.speaker_zh}` === settings.selectedDateKey
      );
    }

    if (targetIdx !== -1) {
      serviceSelector.value = targetIdx;
      onServiceSelected(targetIdx);
      btnResetSync.classList.add('active');
      btnResetSync.title = "Manual Override Active. Click to Reset to Today's Auto-Sync.";
      return;
    }

    // Otherwise, clear override style and run standard proximity matching
    btnResetSync.classList.remove('active');
    btnResetSync.title = "Reset to Auto-Sync Today";

    let closestIdx = 0;
    let minDiff = Infinity;
    
    let today = new Date();
    // Force midnight to only match calendar dates
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

    serviceSelector.value = closestIdx;
    onServiceSelected(closestIdx);
  }

  function onServiceSelected(index) {
    selectedServiceIndex = index;
    const s = servicesData[index];
    if (!s) return;

    metaSpeaker.textContent = `Speaker: ${s.speaker_zh} ${s.speaker_en}`;
    metaDate.textContent = `Date: ${s.date}`;

    parsedFields = {
      title_zh: s.title_zh,
      title_en: s.title_en,
      sermon_hymn_start: s.sermon_hymn_start,
      sermon_hymn_end: s.sermon_hymn_end,
      speaker_zh: s.speaker_zh,
      speaker_en: s.speaker_en
    };

    updateH2RPreview();
  }

  function updateH2RPreview() {
    const hasSpeaker = parsedFields.speaker_zh || parsedFields.speaker_en;
    const titleTemplate = parsedFields.title_zh ? `${parsedFields.title_zh} | ${parsedFields.title_en}` : "Sermon Title | 講題";
    const hymnsList = [parsedFields.sermon_hymn_start, parsedFields.sermon_hymn_end].filter(Boolean).join(', ');
    const subtitleTemplate = hasSpeaker 
      ? `講員/Speaker: ${parsedFields.speaker_zh} ${parsedFields.speaker_en} ｜ 詩歌/Hymns: ${hymnsList}`.replace(/\s+/g, ' ') 
      : "Speaker & Hymns";
    
    if (previewT) previewT.textContent = titleTemplate;
    if (previewS) previewS.textContent = subtitleTemplate;
  }

  // --- Helper Parsers ---
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
      if (year < 100) {
        year += 2000;
      }
      return new Date(year, month, day);
    }
    return new Date(0);
  }

  // --- Push to H2R Graphics Actions ---
  async function pushToH2R() {
    let endpoint = settingsH2rPastedUrl.value.trim();
    const host = settingsH2rHost.value.trim();
    const proj = settingsH2rProject.value.trim();
    const gid = settingsH2rGraphicId.value.trim();
    const templateText = settingsH2rTemplate.value;

    // Resilient endpoint builder
    if (endpoint) {
      if (!endpoint.startsWith('http://') && !endpoint.startsWith('https://')) {
        const baseHost = host || "http://localhost:4001";
        const project = proj || "default";
        if (endpoint.startsWith('graphic/')) {
          endpoint = `${baseHost.replace(/\/$/, '')}/api/${project}/${endpoint}`;
        } else {
          endpoint = `${baseHost.replace(/\/$/, '')}/${endpoint.replace(/^\//, '')}`;
        }
      }
    } else {
      if (!host || !gid) {
        showToast("Please paste the H2R Update URL or specify the Host and Graphic ID in Settings.", "error");
        return;
      }
      if (proj) {
        endpoint = `${host}/api/${proj}/graphic/${gid}/update`;
      } else {
        endpoint = `${host}/graphic/${gid}/update`;
      }
    }

    const autoShow = checkboxAutoShow.checked;

    // Compile payload safely via JSON object parser
    let templateObj;
    try {
      templateObj = JSON.parse(templateText);
    } catch (e) {
      showToast("Failed to compile payload: Invalid Template JSON inside Settings tab", "error");
      return;
    }

    function replacePlaceholders(obj) {
      if (typeof obj === 'string') {
        const speakerCombined = `${parsedFields.speaker_zh || ''} ${parsedFields.speaker_en || ''}`.trim();
        return obj
          .replace(/{title_zh}/g, parsedFields.title_zh || '')
          .replace(/{title_en}/g, parsedFields.title_en || '')
          .replace(/{speaker_zh}/g, parsedFields.speaker_zh || '')
          .replace(/{speaker_en}/g, parsedFields.speaker_en || '')
          .replace(/{speaker}/g, speakerCombined)
          .replace(/{sermon_hymns}/g, `${parsedFields.sermon_hymn_start}, ${parsedFields.sermon_hymn_end}`.trim().replace(/^,|,$/g, ''));
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

    const payloadObj = replacePlaceholders(templateObj);

    // Provide default cues array to prevent H2R server crashes on rundown items
    if (payloadObj && typeof payloadObj === 'object' && !Array.isArray(payloadObj.cues)) {
      payloadObj.cues = [];
    }

    showToast("Sending update to H2R Graphics...", "info");

    try {
      const response = await new Promise((resolve) => {
        chrome.runtime.sendMessage({
          action: 'PUSH_H2R',
          url: endpoint,
          payload: payloadObj
        }, resolve);
      });

      if (response && response.success) {
        showToast("H2R lower third graphic updated successfully!");
        
        // Auto-Show / Auto-Take Live logic
        if (autoShow) {
          const showUrl = endpoint.replace(/\/update$/, '/show');
          const showResponse = await new Promise((resolve) => {
            chrome.runtime.sendMessage({
              action: 'PUSH_H2R_ACTION',
              url: showUrl
            }, resolve);
          });
          if (showResponse && showResponse.success) {
            console.log("Auto-took live successfully!");
          }
        }
      } else {
        throw new Error(response ? response.error : "Unknown connection error.");
      }
    } catch (err) {
      showToast(`H2R Push Failed: ${err.message}. Verify that H2R Graphics is running on ${host}.`, "error");
    }
  }

  // --- Wire Listeners ---
  btnReloadSheet.addEventListener('click', loadGoogleSheet);
  btnEmptyLoadSheet.addEventListener('click', loadGoogleSheet);
  
  serviceSelector.addEventListener('change', async (e) => {
    const idx = parseInt(e.target.value, 10);
    const s = servicesData[idx];
    if (s) {
      settings.selectedDateKey = `${s.date}|${s.section}|${s.speaker_zh}`;
      await chrome.storage.local.set({ settings });
      btnResetSync.classList.add('active');
      btnResetSync.title = "Manual Override Active. Click to Reset to Today's Auto-Sync.";
    }
    onServiceSelected(idx);
  });

  btnResetSync.addEventListener('click', async () => {
    settings.selectedDateKey = "";
    await chrome.storage.local.set({ settings });
    btnResetSync.classList.remove('active');
    btnResetSync.title = "Reset to Auto-Sync Today";
    syncClosestServiceDate();
    showToast("Reset to calendar proximity auto-sync successfully!");
  });

  btnPushH2R.addEventListener('click', pushToH2R);

  // Auto-load on popup open if spreadsheet URL exists
  if (settings.googleSheetUrl) {
    loadGoogleSheet();
  }
});
