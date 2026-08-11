// TJC Service Flow Automator - Injected Content Script

(async () => {
  // 1. Early Return: Disable extension UI on presenter/projector/display screens
  const isPresenter = window.location.href.toLowerCase().includes('/present') ||
    window.location.href.toLowerCase().includes('/projector') ||
    window.location.href.toLowerCase().includes('/display') ||
    window.location.href.toLowerCase().includes('/view') ||
    window.location.href.toLowerCase().includes('/screen') ||
    window.location.search.toLowerCase().includes('present') ||
    window.location.search.toLowerCase().includes('projector') ||
    window.location.search.toLowerCase().includes('display');

  if (isPresenter) {
    console.log("TJC Service Flow Automator: Presenter/projector view detected. Setting up Verse Observer and returning to keep UI clean.");
    setupVerseObserver();
    return;
  }

  // Clean up any existing container first to prevent dual-DOM conflicts on extension re-injections
  const existingContainer = document.getElementById('tjc-automator-shadow-root');
  if (existingContainer) {
    existingContainer.remove();
    console.log("Cleaned up existing TJC Service Flow container.");
  }

  console.log("TJC Service Flow Automator loaded successfully!");

  // Create isolated Shadow DOM container
  const container = document.createElement('div');
  container.id = 'tjc-automator-shadow-root';
  container.style.position = 'fixed';
  container.style.top = '0';
  container.style.right = '0';
  container.style.height = '100vh';
  container.style.zIndex = '9999999';
  document.body.appendChild(container);

  const shadowRoot = container.attachShadow({ mode: 'open' });

  // Load stylesheet from web accessible resource
  const styleLink = document.createElement('link');
  styleLink.rel = 'stylesheet';
  styleLink.href = chrome.runtime.getURL('styles.css');
  shadowRoot.appendChild(styleLink);

  // Default App Settings
  let settings = {
    sheetUrl: "https://docs.google.com/spreadsheets/d/1zrMaPubQ7uaUvgBjYZ3lWIBRUclg0GsGliHMqpvOark/edit?gid=1244479830#gid=1244479830",
    h2rVerseIp: "http://10.10.1.67:4001",
    h2rVerseProject: "ABCD",
    h2rVerseGraphicId: "",
    h2rVerseTemplate: '{\n  "body": "{reference}\\n{chinese}\\n{english}"\n}'
  };

  // Selectors Map (saved to chrome.storage.local)
  let elementSelectors = {
    title_zh: "",
    title_en: "",
    praise_hymns: "",
    sermon_hymns: ""
  };

  // State Management
  let servicesData = [];
  let selectedServiceIndex = -1;
  let parsedFields = {
    pre_hymn_1: "",
    pre_hymn_2: "",
    pre_hymn_3: "",
    pre_hymn_4: "",
    sermon_hymn_start: "",
    sermon_hymn_end: "",
    title_zh: "",
    title_en: "",
    speaker_zh: "",
    speaker_en: ""
  };

  let activeTab = "data"; // "data", "settings"
  let activeMappingFieldId = null; // field ID currently in "Target Mapping" mode

  // Load stored configurations
  console.log("TJC Service Flow: Fetching Chrome Storage...");
  const storedData = await chrome.storage.local.get(['settings', 'elementSelectors']);
  if (storedData.settings) {
    settings = { ...settings, ...storedData.settings };
    console.log("TJC Service Flow: Loaded settings:", settings);
  }

  // Clean and parse elementSelectors safely on startup
  const loadedSelectors = storedData.elementSelectors || {};
  let migrated = false;

  // Empathetic migration: Migrate legacy keys if they exist and new keys don't
  if (loadedSelectors.pre_hymn_1 && !loadedSelectors.praise_hymns) {
    loadedSelectors.praise_hymns = loadedSelectors.pre_hymn_1;
    migrated = true;
  }
  if (loadedSelectors.sermon_hymn_start && !loadedSelectors.sermon_hymns) {
    loadedSelectors.sermon_hymns = loadedSelectors.sermon_hymn_start;
    migrated = true;
  }

  // Always clean and align keys to default keys
  const defaultKeys = ['title_zh', 'title_en', 'praise_hymns', 'sermon_hymns'];
  defaultKeys.forEach(key => {
    if (loadedSelectors[key] !== undefined) {
      elementSelectors[key] = loadedSelectors[key];
    } else {
      elementSelectors[key] = "";
    }
  });

  // If we migrated or if storage has extra/missing keys, sync back to storage immediately to stay clean
  const hasExtraOrMissingKeys = Object.keys(loadedSelectors).some(k => !defaultKeys.includes(k)) ||
    defaultKeys.some(k => loadedSelectors[k] === undefined);

  if (migrated || hasExtraOrMissingKeys) {
    console.log("TJC Service Flow: Cleaning and saving aligned selectors in storage...");
    await chrome.storage.local.set({ elementSelectors });
  }

  console.log("TJC Service Flow: Loaded elementSelectors:", elementSelectors);



  // Create UI Structure inside Shadow DOM
  const widget = document.createElement('div');
  widget.className = 'sidebar-wrapper collapsed';
  shadowRoot.appendChild(widget);

  // Render HTML markup
  widget.innerHTML = `
    <!-- Slide-in Toggle Handle -->
    <div class="sidebar-handle" id="tjc-toggle-btn">
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M15 19l-7-7 7-7"></path>
      </svg>
    </div>

    <!-- Header -->
    <div class="sidebar-header">
      <h1>
        <svg style="width:24px;height:24px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M5 3v18l7-3 7 3V3z" />
        </svg>
        TJC Service Flow
      </h1>
      <p>Automate sermon preparation & live graphics</p>
    </div>

    <!-- Navigation Tabs -->
    <div class="nav-tabs">
      <button class="tab-btn active" data-tab="data">
        <svg style="width:18px;height:18px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        Schedule
      </button>
      <button class="tab-btn" data-tab="settings">
        <svg style="width:18px;height:18px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        Settings
      </button>
    </div>

    <!-- Scrollable Container -->
    <div class="tab-content-container">
      
      <!-- DATA PANEL -->
      <div class="tab-panel active" id="panel-data">
        <div class="form-group">
          <label>Google Sheet URL</label>
          <div class="input-row">
            <input type="text" id="tjc-sheet-url-input" value="${settings.sheetUrl}" placeholder="Google Sheet URL..." />
            <button class="btn btn-secondary" style="padding:10px" id="tjc-load-sheet-btn">
              <svg style="width:16px;height:16px" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 8H17" />
              </svg>
            </button>
          </div>
        </div>

        <div class="form-group" id="service-select-group" style="display:none;">
          <label>Select Service Date</label>
          <select id="tjc-service-selector"></select>
        </div>

        <div class="service-details" id="tjc-fields-list" style="display:none;">
          <div class="service-meta">
            <span id="meta-speaker">Speaker: -</span>
            <span id="meta-date">Date: -</span>
          </div>

          <!-- Sermon Titles -->
          <div class="card">
            <div class="card-header">
              <div class="card-title">Sermon Title (ZH)</div>
              <div class="mapping-controls">
                <span class="card-badge" id="badge-title_zh">Not Mapped</span>
                <button class="btn-map" id="map-title_zh" title="Map Element">⌖</button>
              </div>
            </div>
            <input type="text" id="field-title_zh" />
          </div>

          <div class="card">
            <div class="card-header">
              <div class="card-title">Sermon Title (EN)</div>
              <div class="mapping-controls">
                <span class="card-badge" id="badge-title_en">Not Mapped</span>
                <button class="btn-map" id="map-title_en" title="Map Element">⌖</button>
              </div>
            </div>
            <input type="text" id="field-title_en" />
          </div>

          <!-- Praise Hymns Target & List -->
          <div class="card" style="border-left: 3px solid var(--secondary);">
            <div class="card-header">
              <div class="card-title" style="color: var(--secondary-hover);">Praise Hymns Input Field</div>
              <div class="mapping-controls">
                <span class="card-badge" id="badge-praise_hymns">Not Mapped</span>
                <button class="btn-map" id="map-praise_hymns" title="Map Praise Hymns Input Field">⌖</button>
              </div>
            </div>
            <p style="font-size:11px; color:var(--text-muted); margin:0; line-height:1.4;">
              💡 Map this to the <strong>Praise Hymns input box</strong> on the page. The extension will <strong>automatically find and click remove buttons (no separate mapping needed!)</strong> to clear the list, then enter hymns sequentially with Enter keypresses!
            </p>
          </div>

          <div style="background:rgba(255,255,255,0.02); border:1px solid var(--border-color); border-radius:12px; padding:12px; display:flex; flex-direction:column; gap:8px;">
            <div style="font-size:11px; font-weight:600; text-transform:uppercase; color:var(--text-primary); margin-bottom:4px; letter-spacing:0.05em;">Praise Hymn List</div>
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:8px;">
              <div class="form-group">
                <label style="font-size:10px;">Hymn 1</label>
                <input type="text" id="field-pre_hymn_1" style="padding: 8px 10px; font-size: 13px;" />
              </div>
              <div class="form-group">
                <label style="font-size:10px;">Hymn 2</label>
                <input type="text" id="field-pre_hymn_2" style="padding: 8px 10px; font-size: 13px;" />
              </div>
              <div class="form-group">
                <label style="font-size:10px;">Hymn 3</label>
                <input type="text" id="field-pre_hymn_3" style="padding: 8px 10px; font-size: 13px;" />
              </div>
              <div class="form-group">
                <label style="font-size:10px;">Hymn 4</label>
                <input type="text" id="field-pre_hymn_4" style="padding: 8px 10px; font-size: 13px;" />
              </div>
            </div>
          </div>

          <!-- Sermon Hymns Target & List -->
          <div class="card" style="border-left: 3px solid var(--primary);">
            <div class="card-header">
              <div class="card-title" style="color: var(--primary-hover);">Sermon Hymns Input Field</div>
              <div class="mapping-controls">
                <span class="card-badge" id="badge-sermon_hymns">Not Mapped</span>
                <button class="btn-map" id="map-sermon_hymns" title="Map Sermon Hymns Input Field">⌖</button>
              </div>
            </div>
            <p style="font-size:11px; color:var(--text-muted); margin:0; line-height:1.4;">
              💡 Map this to the <strong>Sermon Hymns input box</strong> on the page. The extension will <strong>automatically find and click remove buttons (no separate mapping needed!)</strong> to clear the list, then enter hymns sequentially with Enter keypresses!
            </p>
          </div>

          <div style="background:rgba(255,255,255,0.02); border:1px solid var(--border-color); border-radius:12px; padding:12px; display:flex; flex-direction:column; gap:8px;">
            <div style="font-size:11px; font-weight:600; text-transform:uppercase; color:var(--text-primary); margin-bottom:4px; letter-spacing:0.05em;">Sermon Hymns List</div>
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:8px;">
              <div class="form-group">
                <label style="font-size:10px;">Before Sermon</label>
                <input type="text" id="field-sermon_hymn_start" style="padding: 8px 10px; font-size: 13px;" />
              </div>
              <div class="form-group">
                <label style="font-size:10px;">After Sermon</label>
                <input type="text" id="field-sermon_hymn_end" style="padding: 8px 10px; font-size: 13px;" />
              </div>
            </div>
          </div>

          <button class="btn" id="tjc-autofill-btn">
            <svg style="width:18px;height:18px" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            Auto-Fill service.tjc.org
          </button>
        </div>

        <div id="data-loading-state" style="display:none; text-align:center; padding: 20px;">
          <div class="loader-spinner"></div>
          <p style="color:var(--text-secondary); margin-top:12px; font-size:13px;" id="data-loading-text">Discovering spreadsheet tabs...</p>
        </div>

        <div id="data-empty-state" style="text-align:center; padding: 40px 20px; color: var(--text-secondary);">
          <svg style="width:48px;height:48px;margin:0 auto 12px auto;opacity:0.4;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
          </svg>
          <p style="font-size: 14px; font-weight: 500; margin:0 0 4px 0;">No Schedule Loaded</p>
          <p style="font-size: 12px; margin:0;">Enter your Google Sheet URL above and click reload to parse the schedule.</p>
        </div>
      </div>

      <!-- SETTINGS PANEL -->
      <div class="tab-panel" id="panel-settings">
        
        <button class="btn btn-secondary btn-danger" id="tjc-reset-selectors-btn" style="margin-top:4px">
          Reset CSS Mappings
        </button>

        <div style="border-top:1px solid var(--border-color); margin:20px 0 8px 0; padding-top:16px; display:flex; flex-direction:column; gap:12px;">
          <div style="font-size:11px; font-weight:600; text-transform:uppercase; color:var(--text-secondary); letter-spacing:0.05em; display:flex; justify-content:space-between; align-items:center;">
            <span>Active CSS Mappings (Debugger)</span>
            <button id="tjc-refresh-debug-btn" style="background:none; border:none; color:var(--primary-hover); cursor:pointer; font-size:10px; padding:0;">Refresh ↻</button>
          </div>
          <div style="font-size:11px; background: rgba(0,0,0,0.2); padding: 10px 12px; border-radius: 8px; border:1px solid var(--border-color); font-family: monospace; line-height: 1.5; max-height: 140px; overflow-y: auto;" id="tjc-debug-selectors-info">
            Loading storage debugger...
          </div>
        </div>

        <div style="border-top:1px solid var(--border-color); margin:20px 0 8px 0; padding-top:16px; display:flex; flex-direction:column; gap:12px;">
          <div style="font-size:11px; font-weight:600; text-transform:uppercase; color:var(--text-secondary); letter-spacing:0.05em;">H2R Verse Sync (Pop-up Monitor)</div>
          
          <div class="form-group">
            <label>H2R IP Address & Port</label>
            <input type="text" id="tjc-verse-ip-input" value="${settings.h2rVerseIp}" placeholder="http://10.10.1.67:4001" />
          </div>

          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:8px;">
            <div class="form-group">
              <label>H2R Project</label>
              <input type="text" id="tjc-verse-project-input" value="${settings.h2rVerseProject}" placeholder="ABCD" />
            </div>
            <div class="form-group">
              <label>H2R Graphic ID</label>
              <input type="text" id="tjc-verse-graphic-input" value="${settings.h2rVerseGraphicId}" placeholder="e.g. 5MMWQ" />
            </div>
          </div>

          <div class="form-group">
            <label>Payload Template (JSON)</label>
            <textarea id="tjc-verse-template-input" rows="5" style="width:100%; padding:8px; font-family:monospace; font-size:11px; border:1px solid var(--border-color); border-radius:6px; background:var(--bg-secondary); color:var(--text-primary); resize:vertical;">${settings.h2rVerseTemplate}</textarea>
            <p style="font-size:10px; color:var(--text-muted); margin:4px 0 0 0;">Available variables: <code>{reference}</code>, <code>{chinese}</code>, <code>{english}</code></p>
          </div>
        </div>
      </div>
      
    </div>

    <!-- Toast Notification Injected Area -->
    <div class="toast-container" id="tjc-toast-box"></div>
  `;

  // UI Element Caches
  const sidebar = shadowRoot.querySelector('.sidebar-wrapper');
  const toggleBtn = shadowRoot.querySelector('#tjc-toggle-btn');
  const tabBtns = shadowRoot.querySelectorAll('.tab-btn');
  const tabPanels = shadowRoot.querySelectorAll('.tab-panel');
  const sheetUrlInput = shadowRoot.querySelector('#tjc-sheet-url-input');
  const loadSheetBtn = shadowRoot.querySelector('#tjc-load-sheet-btn');
  const serviceSelector = shadowRoot.querySelector('#tjc-service-selector');
  const fieldsList = shadowRoot.querySelector('#tjc-fields-list');
  const dataLoadingState = shadowRoot.querySelector('#data-loading-state');
  const dataLoadingText = shadowRoot.querySelector('#data-loading-text');
  const dataEmptyState = shadowRoot.querySelector('#data-empty-state');
  const serviceSelectGroup = shadowRoot.querySelector('#service-select-group');
  const toastBox = shadowRoot.querySelector('#tjc-toast-box');

  const metaSpeaker = shadowRoot.querySelector('#meta-speaker');
  const metaDate = shadowRoot.querySelector('#meta-date');

  // Input Field DOMs
  const inputDoms = {
    title_zh: shadowRoot.querySelector('#field-title_zh'),
    title_en: shadowRoot.querySelector('#field-title_en'),
    sermon_hymn_start: shadowRoot.querySelector('#field-sermon_hymn_start'),
    sermon_hymn_end: shadowRoot.querySelector('#field-sermon_hymn_end'),
    pre_hymn_1: shadowRoot.querySelector('#field-pre_hymn_1'),
    pre_hymn_2: shadowRoot.querySelector('#field-pre_hymn_2'),
    pre_hymn_3: shadowRoot.querySelector('#field-pre_hymn_3'),
    pre_hymn_4: shadowRoot.querySelector('#field-pre_hymn_4')
  };

  // Toast Notification System
  function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    let icon = '✓';
    if (type === 'error') icon = '✕';
    if (type === 'info') icon = 'ℹ';

    toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
    toastBox.appendChild(toast);

    setTimeout(() => {
      toast.style.animation = 'slideUp 0.3s reverse forwards';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }

  // Sidebar toggling
  toggleBtn.addEventListener('click', () => {
    sidebar.classList.toggle('collapsed');
  });

  // Tab navigation
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tabBtns.forEach(b => b.classList.remove('active'));
      tabPanels.forEach(p => p.classList.remove('active'));

      btn.classList.add('active');
      const tabId = btn.getAttribute('data-tab');
      shadowRoot.querySelector(`#panel-${tabId}`).classList.add('active');
      activeTab = tabId;
    });
  });

  // Native CSV Parser
  function parseCSV(text) {
    const lines = [];
    let row = [""];
    let insideQuote = false;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const nextChar = text[i + 1];

      if (char === '"') {
        if (insideQuote && nextChar === '"') {
          row[row.length - 1] += '"';
          i++; // Skip next quote
        } else {
          insideQuote = !insideQuote;
        }
      } else if (char === ',' && !insideQuote) {
        row.push("");
      } else if ((char === '\r' || char === '\n') && !insideQuote) {
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

  // Smart Language Script Segmenter
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

    // Case 3: Mixed language without delimiters (e.g. "What is Your Hope? 什麼是你的盼望?")
    const hasChinese = /[\u4e00-\u9fa5]/.test(text);
    const hasEnglish = /[a-zA-Z]/.test(text);

    if (hasChinese && hasEnglish) {
      // Try regex splits first (with improved boundaries including parentheses and punctuation)
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

      // If regex split didn't yield a clean split, find the earliest space transition manually
      // Scan spaces in the text from left to right to locate the split where:
      // - The right side has English letters and NO Chinese characters
      // - The left side contains Chinese characters
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

      // Fallback: character-based split but preserve all punctuation and parentheses
      const zh = text.replace(/[\u0000-\u007F]+/g, (match) => {
        // Strip English letters from Chinese part, but preserve spaces and punctuation
        return match.replace(/[a-zA-Z]+/g, '').replace(/\s+/g, ' ');
      }).trim();

      const en = text.replace(/[\u4e00-\u9fa5]/g, '').trim().replace(/\s+/g, ' ');
      return { zh, en };
    }

    if (hasChinese) return { zh: text, en: text };
    return { zh: text, en: text };
  }

  // Parses Hymns cell
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

  // Parse custom Date Strings into JS Date objects
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

  // Dynamic Google Sheet Tab Scraper and Chronological Compiler
  async function loadGoogleSheet() {
    const rawUrl = sheetUrlInput.value.trim();
    if (!rawUrl) {
      showToast("Please enter a valid Google Sheet URL", "error");
      return;
    }

    const idMatch = rawUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (!idMatch) {
      showToast("Invalid Google Sheet URL format", "error");
      return;
    }
    const docId = idMatch[1];

    dataEmptyState.style.display = 'none';
    fieldsList.style.display = 'none';
    serviceSelectGroup.style.display = 'none';
    dataLoadingState.style.display = 'block';
    dataLoadingText.textContent = "Discovering spreadsheet tabs...";

    try {
      // 1. Fetch htmlview to scan available workbook tabs
      const htmlviewUrl = `https://docs.google.com/spreadsheets/d/${docId}/htmlview`;
      const tabsResponse = await new Promise((resolve) => {
        chrome.runtime.sendMessage({ action: 'FETCH_TABS', url: htmlviewUrl }, resolve);
      });

      if (!tabsResponse || !tabsResponse.success) {
        throw new Error(tabsResponse ? tabsResponse.error : "Failed to load workbook details.");
      }

      const tabs = tabsResponse.sheets;
      if (tabs.length === 0) {
        // Fallback: If scraping fails, try using the default parsed gid from URL or fallback gid
        let fallbackGid = "1244479830";
        const gidMatch = rawUrl.match(/gid=([0-9]+)/);
        if (gidMatch) fallbackGid = gidMatch[1];
        tabs.push({ name: "Schedule", gid: fallbackGid });
      }

      console.log("Discovered Sheet Tabs:", tabs);
      dataLoadingText.textContent = `Found ${tabs.length} tabs. Downloading schedule data...`;

      // 2. Fetch CSVs in parallel for each tab
      servicesData = [];
      const fetchPromises = tabs.map(async (tab) => {
        const csvUrl = `https://docs.google.com/spreadsheets/d/${docId}/export?format=csv&gid=${tab.gid}`;
        const csvResponse = await new Promise((resolve) => {
          chrome.runtime.sendMessage({ action: 'FETCH_CSV', url: csvUrl }, resolve);
        });

        if (csvResponse && csvResponse.success) {
          const csvRows = parseCSV(csvResponse.data);
          let currentSection = "GENERAL";

          for (let i = 1; i < csvRows.length; i++) {
            const row = csvRows[i];
            if (!row || row.length === 0) continue;

            const cell0 = row[0] ? row[0].trim() : "";
            if (!cell0) continue;

            // Update sub-category
            if (["MONDAYS", "FRIDAYS", "SATURDAY AM'S", "SATURDAY PM'S"].includes(cell0.toUpperCase())) {
              currentSection = cell0;
              continue;
            }

            // Parse valid service rows
            if (/^[0-9]/.test(cell0)) {
              const speaker = row[1] ? row[1].trim() : "";
              const sermonTitle = row[2] ? row[2].trim() : "";
              const sermonHymns = row[3] ? row[3].trim() : "";
              const leaderHymns = row[4] ? row[4].trim() : "";

              // Skip rows with completely empty sermon/speaker data (filler rows)
              if (!speaker && !sermonTitle && !sermonHymns && !leaderHymns) continue;

              const parsedSpeaker = splitChineseAndEnglish(speaker);
              const parsedTitle = splitChineseAndEnglish(sermonTitle);
              const sermonHymnsArr = parseHymnCell(sermonHymns);
              const leaderHymnsArr = parseHymnCell(leaderHymns);

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
                sermon_hymn_end: sermonHymnsArr[1] || "",
                hymnleaderHymnsRaw: leaderHymns,
                pre_hymn_1: leaderHymnsArr[0] || "",
                pre_hymn_2: leaderHymnsArr[1] || "",
                pre_hymn_3: leaderHymnsArr[2] || "",
                pre_hymn_4: leaderHymnsArr[3] || ""
              });
            }
          }
        }
      });

      await Promise.all(fetchPromises);

      if (servicesData.length === 0) {
        throw new Error("No service events with valid dates could be found across all tabs.");
      }

      // 3. Sort services chronologically by date
      servicesData.sort((a, b) => {
        const dateA = parseDateString(a.date);
        const dateB = parseDateString(b.date);
        return dateA.getTime() - dateB.getTime();
      });

      // Populate selector dropdown
      serviceSelector.innerHTML = "";
      servicesData.forEach((s, idx) => {
        const option = document.createElement('option');
        option.value = idx;
        option.textContent = `[${s.tabName} - ${s.section}] ${s.date} - ${s.speaker_zh || s.speaker_en}`;
        serviceSelector.appendChild(option);
      });

      // Save URL config
      settings.sheetUrl = rawUrl;
      await chrome.storage.local.set({ settings });

      // Show panels
      dataLoadingState.style.display = 'none';
      serviceSelectGroup.style.display = 'block';
      fieldsList.style.display = 'block';

      // Explicitly refresh mapping badges UI state on sheet reloads
      updateMappingBadges();

      // 4. AUTOMATIC DATE SELECTOR - Find record closest to today's date!
      const today = new Date();
      // Force midnight to only match calendar dates
      today.setHours(0, 0, 0, 0);
      const todayMs = today.getTime();

      let closestIdx = 0;
      let minDiff = Infinity;

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

      const closestService = servicesData[closestIdx];
      showToast(`Scraped ${servicesData.length} records. Auto-selected date: ${closestService.date}!`);

    } catch (err) {
      console.error(err);
      dataLoadingState.style.display = 'none';
      dataEmptyState.style.display = 'block';
      showToast(err.message, "error");
    }
  }

  // Handle service selection change
  function onServiceSelected(index) {
    selectedServiceIndex = index;
    const s = servicesData[index];
    if (!s) return;

    metaSpeaker.textContent = `Speaker: ${s.speaker_zh} (${s.speaker_en})`;
    metaDate.textContent = `Date: ${s.date}`;

    // Fill UI form inputs with parsed values
    parsedFields = {
      title_zh: s.title_zh,
      title_en: s.title_en,
      sermon_hymn_start: s.sermon_hymn_start,
      sermon_hymn_end: s.sermon_hymn_end,
      pre_hymn_1: s.pre_hymn_1,
      pre_hymn_2: s.pre_hymn_2,
      pre_hymn_3: s.pre_hymn_3,
      pre_hymn_4: s.pre_hymn_4,
      speaker_zh: s.speaker_zh,
      speaker_en: s.speaker_en
    };

    Object.keys(inputDoms).forEach(key => {
      inputDoms[key].value = parsedFields[key];
    });
  }

  // Listen to input changes to update model state in real-time
  Object.keys(inputDoms).forEach(key => {
    inputDoms[key].addEventListener('input', (e) => {
      parsedFields[key] = e.target.value.trim();
    });
  });

  serviceSelector.addEventListener('change', (e) => {
    onServiceSelected(parseInt(e.target.value));
  });

  loadSheetBtn.addEventListener('click', loadGoogleSheet);

  // Auto-load on startup if URL exists
  if (settings.sheetUrl) {
    loadGoogleSheet();
  }

  // Selector mapping badge state updater
  function updateMappingBadges() {
    Object.keys(elementSelectors).forEach(key => {
      const badge = shadowRoot.querySelector(`#badge-${key}`);
      const btn = shadowRoot.querySelector(`#map-${key}`);
      if (!badge || !btn) return;

      if (elementSelectors[key]) {
        badge.textContent = "Mapped";
        badge.classList.add('mapped');
        btn.textContent = "✓";
      } else {
        badge.textContent = "Not Mapped";
        badge.classList.remove('mapped');
        btn.textContent = "⌖";
      }
    });

    // Update diagnostic debugger panel in real-time
    const debugInfo = shadowRoot.querySelector('#tjc-debug-selectors-info');
    if (debugInfo) {
      debugInfo.innerHTML = Object.keys(elementSelectors)
        .map(key => {
          const val = elementSelectors[key];
          const color = val ? '#10b981' : 'var(--text-muted)';
          const text = val ? val : '[Not Mapped]';
          return `<span style="color:${color}"><strong>${key}</strong></span>: <span style="word-break:break-all">${text}</span>`;
        })
        .join('<br>');
    }
  }

  // Handle unique selector computation
  function getUniqueSelector(el) {
    // Ignore dynamic Material-UI generated IDs like mui-xxxxx or mu-xxxxx which change on every reload
    const isDynamicMuiId = el.id && (
      /^mui-\d+/i.test(el.id) ||
      /^mui-/i.test(el.id) ||
      /^mu-\d+/i.test(el.id) ||
      /^mu-/i.test(el.id)
    );

    if (el.id && !isDynamicMuiId) {
      return `#${el.id}`;
    }
    if (isDynamicMuiId) {
      console.log(`Ignoring dynamic Material-UI element ID: "#${el.id}" to ensure stable selector path.`);
    }

    // Ensure attribute selectors are actually unique on the page before using them
    if (el.getAttribute('aria-label')) {
      const sel = `${el.tagName.toLowerCase()}[aria-label="${el.getAttribute('aria-label')}"]`;
      if (document.querySelectorAll(sel).length === 1) {
        return sel;
      }
    }
    if (el.name) {
      const sel = `${el.tagName.toLowerCase()}[name="${el.name}"]`;
      if (document.querySelectorAll(sel).length === 1) {
        return sel;
      }
    }
    if (el.getAttribute('placeholder')) {
      const sel = `${el.tagName.toLowerCase()}[placeholder="${el.getAttribute('placeholder')}"]`;
      if (document.querySelectorAll(sel).length === 1) {
        return sel;
      }
    }

    const path = [];
    let current = el;
    while (current && current.nodeType === Node.ELEMENT_NODE) {
      let selector = current.tagName.toLowerCase();
      const classAttr = current.getAttribute('class');
      let classes = [];
      if (classAttr && typeof classAttr === 'string') {
        classes = classAttr.trim().split(/\s+/).filter(Boolean);
        classes = classes.filter(c => {
          // Exclude dynamic class names ending in digits (MUI -131, jss131)
          if (/\d+$/.test(c)) return false;
          // Exclude css- prefixed dynamic hash classes or dynamic styled components
          if (/^css-/i.test(c)) return false;
          if (/^jss/i.test(c)) return false;
          // Exclude dynamic UI states (focus, hover, active, disabled, error, required, mapping highlights)
          if (/focused|active|hover|disabled|error|required|mapping-/i.test(c)) return false;
          return true;
        });
        if (classes.length) {
          selector += '.' + classes.join('.');
        }
      }

      if (current.parentNode) {
        const siblings = Array.from(current.parentNode.children);

        // Count how many siblings have the same tag and base classes
        const matchingSiblings = siblings.filter(s => {
          if (s.tagName !== current.tagName) return false;

          const sClassAttr = s.getAttribute('class') || '';
          let sClasses = sClassAttr.trim().split(/\s+/).filter(Boolean);
          sClasses = sClasses.filter(c => {
            if (/\d+$/.test(c)) return false;
            if (/^css-/i.test(c)) return false;
            if (/^jss/i.test(c)) return false;
            if (/focused|active|hover|disabled|error|required|mapping-/i.test(c)) return false;
            return true;
          });

          return JSON.stringify(sClasses.sort()) === JSON.stringify(classes.sort());
        });

        if (matchingSiblings.length > 1) {
          let index = 1;
          for (let i = 0; i < siblings.length; i++) {
            const sibling = siblings[i];
            if (sibling === current) {
              selector += `:nth-child(${index})`;
              break;
            }
            index++;
          }
        }
      }
      path.unshift(selector);

      // Perform defensive uniqueness checks at every DOM tree height level
      const currentPath = path.join(' > ');
      if (document.querySelectorAll(currentPath).length === 1) {
        return currentPath;
      }

      current = current.parentNode;
      if (!current || current.tagName === 'BODY' || current.tagName === 'HTML') break;
    }
    return path.join(' > ');
  }

  // Interactive Target Selector Map Handlers
  function startInteractiveMapping(fieldId) {
    if (activeMappingFieldId) {
      stopInteractiveMapping();
    }

    activeMappingFieldId = fieldId;
    const btn = shadowRoot.querySelector(`#map-${fieldId}`);
    if (btn) btn.classList.add('active');

    sidebar.classList.add('collapsed');
    showToast(`Click any input or text field on the page to map to "${fieldId.toUpperCase()}"`, "info");

    document.addEventListener('mouseover', onTargetHover);
    document.addEventListener('mouseout', onTargetUnhover);
    document.addEventListener('click', onTargetSelected, true);
  }

  function stopInteractiveMapping() {
    if (!activeMappingFieldId) return;

    const btn = shadowRoot.querySelector(`#map-${activeMappingFieldId}`);
    if (btn) btn.classList.remove('active');

    activeMappingFieldId = null;

    document.removeEventListener('mouseover', onTargetHover);
    document.removeEventListener('mouseout', onTargetUnhover);
    document.removeEventListener('click', onTargetSelected, true);
  }

  function onTargetHover(e) {
    const el = e.target;
    if (container.contains(el)) return;

    if (['INPUT', 'TEXTAREA'].includes(el.tagName) || el.getAttribute('contenteditable') === 'true') {
      el.classList.add('mapping-hover');
    }
  }

  function onTargetUnhover(e) {
    e.target.classList.remove('mapping-hover');
  }

  async function onTargetSelected(e) {
    const el = e.target;
    if (container.contains(el)) return;

    e.preventDefault();
    e.stopPropagation();

    el.classList.remove('mapping-hover');

    const selector = getUniqueSelector(el);
    const fieldId = activeMappingFieldId;

    // Update local variable directly
    elementSelectors[fieldId] = selector;

    // Fetch latest storage state to prevent overwriting keys that might have been changed in other tabs
    const currentStorage = await chrome.storage.local.get('elementSelectors');
    const mergedSelectors = {
      ...elementSelectors,
      ...(currentStorage.elementSelectors || {}),
      [fieldId]: selector
    };

    // Self-heal/migration: Only keep keys currently defined in our default elementSelectors
    const cleanedSelectors = {};
    const defaultKeys = ['title_zh', 'title_en', 'praise_hymns', 'sermon_hymns'];
    defaultKeys.forEach(key => {
      cleanedSelectors[key] = mergedSelectors[key] || "";
    });

    elementSelectors = cleanedSelectors;

    // Write the complete clean selectors object back to storage atomically
    await chrome.storage.local.set({ elementSelectors });

    updateMappingBadges();
    stopInteractiveMapping();

    sidebar.classList.remove('collapsed');
    showToast(`Successfully mapped "${fieldId}" to selector: ${selector}`);
  }

  // Wire map button clicks
  Object.keys(elementSelectors).forEach(key => {
    const btn = shadowRoot.querySelector(`#map-${key}`);
    if (btn) {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        startInteractiveMapping(key);
      });
    }
  });

  // Resilient Heuristic Fallback Element Finder
  function findResilientElement(selector, fieldKey) {
    if (selector) {
      const element = document.querySelector(selector);
      if (element) return element;
    }

    console.log(`Failed to find element with selector: "${selector}". Performing resilient heuristic fallback search for field: "${fieldKey}"...`);

    // 1. Label-based search: Find input associated with a text label
    const labels = Array.from(document.querySelectorAll('label, span, p, div, legend, h5, h6, th, td'));
    for (const label of labels) {
      // Robustly strip out all spaces, tabs, zero-width characters, and non-breaking spaces (e.g. for "開 會 詩")
      const txt = (label.textContent || '').replace(/[\s\xa0\u200b]+/g, '').trim().toLowerCase();
      if (!txt) continue;

      let match = false;
      if (fieldKey === 'title_zh') {
        match = (txt.includes('講題') && (txt.includes('中') || txt.includes('zh') || txt.includes('chinese'))) || (txt === '講題');
      } else if (fieldKey === 'title_en') {
        match = (txt.includes('title') && (txt.includes('en') || txt.includes('英') || txt.includes('english'))) || (txt === 'sermontitle') || (txt === 'title');
      } else if (fieldKey === 'praise_hymns') {
        match = txt.includes('唱詩') || txt.includes('praise') || txt.includes('開會') || txt.includes('讚美') || txt.includes('preservice') || txt.includes('opening');
      } else if (fieldKey === 'sermon_hymns') {
        match = txt.includes('講前') || txt.includes('講後') || txt.includes('sermon') || txt.includes('講員') || txt.includes('closing') || txt.includes('responding') || txt.includes('respond');
      }

      if (match) {
        // We found a label element! Let's find its associated input.
        console.log(`Found matching label element: "${label.textContent.trim()}" for field: "${fieldKey}"`);

        // Scenario A: Label has 'htmlFor' pointing to an input
        if (label.htmlFor) {
          const input = document.getElementById(label.htmlFor);
          if (input) return input;
        }

        // Scenario B: Input is nested inside the label
        const nestedInput = label.querySelector('input, textarea, [contenteditable="true"]');
        if (nestedInput) return nestedInput;

        // Scenario C: Input is inside the same form control or parent container safely
        const parentControl = label.closest('.MuiFormControl-root, .form-group, .MuiInputBase-root') || label.parentElement;
        if (parentControl) {
          let currentParent = parentControl;
          for (let pDepth = 0; pDepth < 2; pDepth++) {
            if (!currentParent || currentParent.tagName === 'FORM' || currentParent.tagName === 'BODY') break;
            const input = currentParent.querySelector('input, textarea, [contenteditable="true"]');
            if (input) return input;
            currentParent = currentParent.parentElement;
          }
        }

        // Scenario D: Input is the next sibling or descendant of next sibling
        let sibling = label.nextElementSibling;
        while (sibling) {
          if (['INPUT', 'TEXTAREA'].includes(sibling.tagName) || sibling.getAttribute('contenteditable') === 'true') {
            return sibling;
          }
          const input = sibling.querySelector('input, textarea, [contenteditable="true"]');
          if (input) return input;
          sibling = sibling.nextElementSibling;
        }
      }
    }

    // 2. Placeholder/Aria-label/Name/ID search on all inputs
    const inputs = Array.from(document.querySelectorAll('input, textarea, [contenteditable="true"]'));
    for (const input of inputs) {
      const placeholder = (input.getAttribute('placeholder') || '').toLowerCase();
      const ariaLabel = (input.getAttribute('aria-label') || '').toLowerCase();
      const name = (input.getAttribute('name') || '').toLowerCase();
      const id = (input.id || '').toLowerCase();

      if (fieldKey === 'title_zh') {
        if (placeholder.includes('講題') || (placeholder.includes('title') && (placeholder.includes('zh') || placeholder.includes('中') || placeholder.includes('chinese')))) return input;
        if (ariaLabel.includes('講題') || (ariaLabel.includes('title') && (ariaLabel.includes('zh') || ariaLabel.includes('中') || ariaLabel.includes('chinese')))) return input;
      } else if (fieldKey === 'title_en') {
        if (placeholder.includes('sermon title') || (placeholder.includes('title') && (placeholder.includes('en') || placeholder.includes('英') || placeholder.includes('english')))) return input;
        if (ariaLabel.includes('sermon title') || (ariaLabel.includes('title') && (ariaLabel.includes('en') || ariaLabel.includes('英') || ariaLabel.includes('english')))) return input;
      } else if (fieldKey === 'praise_hymns') {
        if (placeholder.includes('praise') || placeholder.includes('唱詩') || placeholder.includes('pre-service') || placeholder.includes('hymn') || placeholder.includes('opening') || placeholder.includes('開會') || placeholder.includes('讚美')) return input;
        if (ariaLabel.includes('praise') || ariaLabel.includes('唱詩') || ariaLabel.includes('pre-service') || ariaLabel.includes('hymn') || ariaLabel.includes('opening') || ariaLabel.includes('開會') || ariaLabel.includes('讚美')) return input;
        if (name.includes('praise') || id.includes('praise') || name.includes('opening') || id.includes('opening')) return input;
      } else if (fieldKey === 'sermon_hymns') {
        const hasHymn = placeholder.includes('hymn') || placeholder.includes('song') || placeholder.includes('詩');
        const hasSermon = placeholder.includes('sermon') || placeholder.includes('講') || placeholder.includes('closing') || placeholder.includes('responding') || placeholder.includes('respond');
        if (hasHymn && hasSermon) return input;
        if (placeholder.includes('講前') || placeholder.includes('講後') || placeholder.includes('講員詩') || placeholder.includes('closing') || placeholder.includes('responding') || placeholder.includes('respond')) return input;

        const ariaHasHymn = ariaLabel.includes('hymn') || ariaLabel.includes('song') || ariaLabel.includes('詩');
        const ariaHasSermon = ariaLabel.includes('sermon') || ariaLabel.includes('講') || ariaLabel.includes('closing') || ariaLabel.includes('responding') || ariaLabel.includes('respond');
        if (ariaHasHymn && ariaHasSermon) return input;
        if (ariaLabel.includes('講前') || ariaLabel.includes('講後') || ariaLabel.includes('講員詩') || ariaLabel.includes('closing') || ariaLabel.includes('responding') || ariaLabel.includes('respond')) return input;

        const nameHasHymn = name.includes('hymn') || name.includes('song') || name.includes('詩');
        const nameHasSermon = name.includes('sermon') || name.includes('講') || name.includes('closing') || name.includes('responding') || name.includes('respond');
        if (nameHasHymn && nameHasSermon) return input;

        const idHasHymn = id.includes('hymn') || id.includes('song') || id.includes('詩');
        const idHasSermon = id.includes('sermon') || id.includes('講') || id.includes('closing') || id.includes('responding') || id.includes('respond');
        if (idHasHymn && idHasSermon) return input;
      }
    }

    return null;
  }

  // Framework-Safe React/Vue Input Auto-Filler
  function setInputValue(selector, value, fieldKey) {
    if (!selector && !fieldKey) return false;
    const element = findResilientElement(selector, fieldKey);
    if (!element) return false;

    // Resolve target input/textarea safely (e.g. if the selector points to a sibling/chip/border/parent container)
    let inputEl = element;
    if (element.tagName !== 'INPUT' && element.tagName !== 'TEXTAREA') {
      let nested = element.querySelector('input, textarea');
      if (!nested) {
        const parent = element.closest('.MuiFormControl-root, .MuiInputBase-root, .form-group') || element.parentElement;
        if (parent) {
          nested = parent.querySelector('input, textarea');
        }
      }
      if (nested) {
        inputEl = nested;
      }
    }

    inputEl.focus();

    if (inputEl.tagName === 'INPUT' || inputEl.tagName === 'TEXTAREA') {
      const nativeSetter = Object.getOwnPropertyDescriptor(
        inputEl.tagName === 'INPUT' ? window.HTMLInputElement.prototype : window.HTMLTextAreaElement.prototype,
        'value'
      );
      if (nativeSetter && nativeSetter.set) {
        nativeSetter.set.call(inputEl, value);
      } else {
        inputEl.value = value;
      }
      inputEl.dispatchEvent(new Event('input', { bubbles: true }));
      inputEl.dispatchEvent(new Event('change', { bubbles: true }));
      inputEl.dispatchEvent(new Event('blur', { bubbles: true }));
    } else if (inputEl.getAttribute('contenteditable') === 'true') {
      inputEl.innerHTML = value;
      inputEl.dispatchEvent(new Event('input', { bubbles: true }));
      inputEl.dispatchEvent(new Event('change', { bubbles: true }));
      inputEl.dispatchEvent(new Event('blur', { bubbles: true }));
    }
    return true;
  }

  // Resilient Event Listener Registration System
  function safeAddListener(selector, event, callback) {
    const element = shadowRoot.querySelector(selector);
    if (element) {
      element.addEventListener(event, callback);
    } else {
      console.warn(`TJC Automator Warning: Element matching "${selector}" was not found in Shadow DOM.`);
    }
  }

  async function clearExistingHymns(selector, fieldKey) {
    if (!selector && !fieldKey) return;
    const element = findResilientElement(selector, fieldKey);
    if (!element) return;

    // Resolve the other input element to prevent boundary over-reach
    const otherFieldKey = fieldKey === 'praise_hymns' ? 'sermon_hymns' : 'praise_hymns';
    let otherSelector = null;
    if (typeof elementSelectors !== 'undefined') {
      otherSelector = elementSelectors[otherFieldKey];
    }
    const otherElement = findResilientElement(otherSelector, otherFieldKey);

    // Helper: Traverse upwards to find the highest ancestor that does NOT contain the other input
    function getIsolatedWrapper(el) {
      let wrapper = el.parentElement || el;
      let current = el.parentElement;
      let depth = 0;
      const maxDepth = 6;

      while (current && current.tagName !== 'BODY' && current.tagName !== 'HTML' && current.tagName !== 'FORM' && depth < maxDepth) {
        if (otherElement && current.contains(otherElement)) {
          break; // Stop before including the other field's tree
        }
        wrapper = current;
        current = current.parentElement;
        depth++;
      }
      return wrapper;
    }

    let wrapper = getIsolatedWrapper(element);
    if (!wrapper) return;

    // Helper: Simulate standard clicks and PointerEvents for modern frameworks
    function triggerClick(el) {
      if (!el) return;
      el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, view: window }));
      el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
      el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true, view: window }));
      el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }));
      el.click();
    }

    // Live DOM Re-Query Loop to handle React node recreation
    const clickedTargets = new Set();
    let attempts = 0;
    const maxAttempts = 20; // Safe-guard limit

    while (attempts < maxAttempts) {
      // Re-verify wrapper attachment
      if (!document.body.contains(wrapper)) {
        const freshElement = findResilientElement(selector, fieldKey);
        if (!freshElement) break;
        wrapper = getIsolatedWrapper(freshElement);
        if (!wrapper) break;
      }

      // Query live descendants inside our boundary wrapper
      const deleteButtons = Array.from(wrapper.querySelectorAll('*')).filter(el => {
        if (el === element) return false;
        if (el.children.length > 1) return false; // Leaf nodes only

        const txt = (el.textContent || '').trim().toLowerCase();
        if (['✕', 'x', '×', 'remove', 'delete', 'clear', 'close'].includes(txt)) {
          return true;
        }

        const className = (el.getAttribute('class') || '').toString().toLowerCase();
        const ariaLabel = (el.getAttribute('aria-label') || '').toLowerCase();
        const title = (el.getAttribute('title') || '').toLowerCase();

        const matchPattern = /close|remove|delete|clear|btn-close/i;
        return matchPattern.test(className) || matchPattern.test(ariaLabel) || matchPattern.test(title);
      });

      // Filter out elements we already clicked (prevents looping on permanent static UI elements)
      const unclickedButtons = deleteButtons.filter(btn => {
        const clickTarget = btn.closest('button, [role="button"]') || btn;
        return !clickedTargets.has(clickTarget);
      });

      if (unclickedButtons.length === 0) {
        break; // Wiped clean!
      }

      const btn = unclickedButtons[0];
      const clickTarget = btn.closest('button, [role="button"]') || btn;

      clickedTargets.add(clickTarget);
      console.log(`TJC Automator: Clearing list item...`, clickTarget);
      triggerClick(clickTarget);

      attempts++;
      await new Promise(r => setTimeout(r, 120)); // Settle time for React state machines
    }

    // Settled-state buffer delay before typing starts
    await new Promise(r => setTimeout(r, 400));
  }

  // Framework-Safe Sequential Hymn Input Filler
  async function fillSequentialHymns(selector, hymnsArray, fieldKey) {
    if ((!selector && !fieldKey) || !hymnsArray || hymnsArray.length === 0) return false;
    const element = findResilientElement(selector, fieldKey);
    if (!element) return false;

    // Resolve target input/textarea safely (e.g. if the selector points to a sibling/chip/border/parent container)
    let inputEl = element;
    if (element.tagName !== 'INPUT' && element.tagName !== 'TEXTAREA') {
      let nested = element.querySelector('input, textarea');
      if (!nested) {
        const parent = element.closest('.MuiFormControl-root, .MuiInputBase-root, .form-group') || element.parentElement;
        if (parent) {
          nested = parent.querySelector('input, textarea');
        }
      }
      if (nested) {
        inputEl = nested;
      }
    }

    // Focus on the input first
    inputEl.focus();

    for (const hymn of hymnsArray) {
      if (!hymn) continue;

      // 1. Focus the input
      inputEl.focus();

      // 2. Set input value
      if (inputEl.tagName === 'INPUT' || inputEl.tagName === 'TEXTAREA') {
        const nativeSetter = Object.getOwnPropertyDescriptor(
          inputEl.tagName === 'INPUT' ? window.HTMLInputElement.prototype : window.HTMLTextAreaElement.prototype,
          'value'
        );
        if (nativeSetter && nativeSetter.set) {
          nativeSetter.set.call(inputEl, hymn);
        } else {
          inputEl.value = hymn;
        }
      } else if (inputEl.getAttribute('contenteditable') === 'true') {
        inputEl.innerHTML = hymn;
      }

      // 3. Dispatch input and change events to update framework bindings (e.g. React state)
      inputEl.dispatchEvent(new Event('input', { bubbles: true }));
      inputEl.dispatchEvent(new Event('change', { bubbles: true }));

      // 4. Dispatch keydown, keypress, and keyup KeyboardEvents for 'Enter' key
      const dispatchEnter = (type) => {
        const ev = new KeyboardEvent(type, {
          key: 'Enter',
          code: 'Enter',
          bubbles: true,
          cancelable: true,
          view: window
        });
        Object.defineProperty(ev, 'keyCode', { get: () => 13 });
        Object.defineProperty(ev, 'which', { get: () => 13 });
        inputEl.dispatchEvent(ev);
      };
      dispatchEnter('keydown');
      dispatchEnter('keypress');
      dispatchEnter('keyup');

      // 5. Short sleep delay to allow React/Vue/Angular page cycle to process the keypress and commit it to list
      await new Promise(r => setTimeout(r, 250));
    }

    // Clear final remaining text inside input in case the site doesn't clear it automatically
    inputEl.focus();
    if (inputEl.tagName === 'INPUT' || inputEl.tagName === 'TEXTAREA') {
      const nativeSetter = Object.getOwnPropertyDescriptor(
        inputEl.tagName === 'INPUT' ? window.HTMLInputElement.prototype : window.HTMLTextAreaElement.prototype,
        'value'
      );
      if (nativeSetter && nativeSetter.set) {
        nativeSetter.set.call(inputEl, '');
      } else {
        inputEl.value = '';
      }
    } else if (inputEl.getAttribute('contenteditable') === 'true') {
      inputEl.innerHTML = '';
    }
    inputEl.dispatchEvent(new Event('input', { bubbles: true }));
    inputEl.dispatchEvent(new Event('change', { bubbles: true }));

    return true;
  }

  // Perform full slide fields autofill
  safeAddListener('#tjc-autofill-btn', 'click', async () => {
    let failedFields = [];

    // 1. Autofill Sermon Chinese Title
    const titleZhSelector = elementSelectors.title_zh;
    const titleZhVal = inputDoms.title_zh.value.trim();
    const titleZhSuccess = setInputValue(titleZhSelector, titleZhVal, 'title_zh');
    if (!titleZhSuccess) failedFields.push("Sermon Title (ZH)");

    // 2. Autofill Sermon English Title
    const titleEnSelector = elementSelectors.title_en;
    const titleEnVal = inputDoms.title_en.value.trim();
    const titleEnSuccess = setInputValue(titleEnSelector, titleEnVal, 'title_en');
    if (!titleEnSuccess) failedFields.push("Sermon Title (EN)");

    // 3. Autofill Praise Hymns (sequentially)
    const praiseSelector = elementSelectors.praise_hymns;
    const praiseHymnsArray = [
      inputDoms.pre_hymn_1.value.trim(),
      inputDoms.pre_hymn_2.value.trim(),
      inputDoms.pre_hymn_3.value.trim(),
      inputDoms.pre_hymn_4.value.trim()
    ].filter(Boolean);

    await clearExistingHymns(praiseSelector, 'praise_hymns');
    if (praiseHymnsArray.length > 0) {
      const praiseSuccess = await fillSequentialHymns(praiseSelector, praiseHymnsArray, 'praise_hymns');
      if (!praiseSuccess) failedFields.push("Praise Hymns Input Field");
    }

    // 4. Autofill Sermon Hymns (sequentially)
    const sermonSelector = elementSelectors.sermon_hymns;
    const sermonHymnsArray = [
      inputDoms.sermon_hymn_start.value.trim(),
      inputDoms.sermon_hymn_end.value.trim()
    ].filter(Boolean);

    await clearExistingHymns(sermonSelector, 'sermon_hymns');
    if (sermonHymnsArray.length > 0) {
      const sermonSuccess = await fillSequentialHymns(sermonSelector, sermonHymnsArray, 'sermon_hymns');
      if (!sermonSuccess) failedFields.push("Sermon Hymns Input Field");
    }

    const filledCount = 4 - failedFields.length;
    if (filledCount > 0) {
      showToast(`Auto-filled ${filledCount} field(s) successfully!`);
    }

    if (failedFields.length > 0) {
      showToast(`Warning: Failed to update ${failedFields.join(', ')}. Please map them by clicking the ⌖ icon next to each field in the sidebar!`, "error");
    }
  });



  // Reset mappings button
  safeAddListener('#tjc-reset-selectors-btn', 'click', async () => {
    if (confirm("Are you sure you want to clear all your mapped field selectors?")) {
      Object.keys(elementSelectors).forEach(key => elementSelectors[key] = "");
      await chrome.storage.local.set({ elementSelectors });
      updateMappingBadges();
      showToast("CSS selectors mappings cleared.", "info");
    }
  });

  // Wire debug panel refresh button
  safeAddListener('#tjc-refresh-debug-btn', 'click', async (e) => {
    e.stopPropagation();
    const stored = await chrome.storage.local.get('elementSelectors');
    const debugInfo = shadowRoot.querySelector('#tjc-debug-selectors-info');
    if (debugInfo) {
      const selectors = stored.elementSelectors || {};
      debugInfo.innerHTML = Object.keys(elementSelectors)
        .map(key => {
          const val = selectors[key];
          const color = val ? '#10b981' : 'var(--text-muted)';
          const text = val ? val : '[Not Mapped in Storage]';
          return `<span style="color:${color}"><strong>${key}</strong></span>: <span style="word-break:break-all">${text}</span>`;
        })
        .join('<br>') + `<br><br><span style="color:var(--text-muted); font-size:10px;">Loaded directly from chrome.storage.local at ${new Date().toLocaleTimeString()}</span>`;
    }
    showToast("Refreshed storage debugger!");
  });



  // ---------------------------------------------------------
  // Verse Sync Settings Realtime Saving
  // ---------------------------------------------------------
  const verseInputs = [
    { el: shadowRoot.querySelector('#tjc-verse-ip-input'), key: 'h2rVerseIp' },
    { el: shadowRoot.querySelector('#tjc-verse-project-input'), key: 'h2rVerseProject' },
    { el: shadowRoot.querySelector('#tjc-verse-graphic-input'), key: 'h2rVerseGraphicId' },
    { el: shadowRoot.querySelector('#tjc-verse-template-input'), key: 'h2rVerseTemplate' }
  ];

  verseInputs.forEach(item => {
    if (item.el) {
      item.el.addEventListener('input', async () => {
        settings[item.key] = item.el.value;
        await chrome.storage.local.set({ settings });
      });
    }
  });

  // Start the verse observer in the control window too, in case verses are displayed there
  setupVerseObserver();

  // Initial load
  updateMappingBadges();

  // Slide out sidebar on load automatically so they see it
  setTimeout(() => {
    sidebar.classList.remove('collapsed');
  }, 600);

  // ---------------------------------------------------------
  // Verse Sync Observer Logic
  // ---------------------------------------------------------
  function setupVerseObserver() {
    let lastVerseText = "";

    const observer = new MutationObserver(() => {
      const text = document.body.innerText.trim();
      if (text === lastVerseText || !text) return;

      console.log("TJC Automator: RAW OBSERVER TEXT START ==\\n", text, "\\n== RAW OBSERVER TEXT END");

      const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
      console.log("TJC Automator: Number of lines found:", lines.length);

      // We look for a line containing a Bible reference (e.g., 1:1)
      const refIndex = lines.findIndex(l => /[0-9]+:[0-9]+/.test(l));
      console.log("TJC Automator: Reference index found at:", refIndex);

      if (refIndex !== -1 && lines.length >= refIndex + 3) {
        const currentVerse = lines.slice(refIndex, refIndex + 3).join('\n');

        if (currentVerse !== lastVerseText) {
          lastVerseText = currentVerse;
          let reference = lines[refIndex];
          let english = lines[refIndex + 1];
          let chinese = lines[refIndex + 2];

          // Chunking helper to insert line breaks
          const chunkText = (text, maxLength, isEnglish) => {
            if (!text) return "";
            let result = [];
            let current = text.trim();
            while (current.length > maxLength) {
              let splitIndex = maxLength;
              if (isEnglish) {
                // Find last space before the max length to avoid cutting words
                const lastSpace = current.lastIndexOf(' ', maxLength);
                if (lastSpace > 0) splitIndex = lastSpace;
              }
              result.push(current.slice(0, splitIndex).trim());
              current = current.slice(splitIndex).trim();
            }
            if (current.length > 0) result.push(current);
            // We use literal \n so the replacePlaceholders correctly replaces it
            return result.join('\\n');
          };

          chinese = chunkText(chinese, 36, false);
          english = chunkText(english, 80, true);

          console.log("TJC Automator: Detected Verse!", { reference, chinese, english });
          pushVerseToH2R(reference, chinese, english);
        }
      }
    });

    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    console.log("TJC Automator: Verse Observer is running.");
  }

  async function pushVerseToH2R(ref, zh, en) {
    let currentSettings = {
      h2rVerseIp: "http://10.10.1.67:4001",
      h2rVerseProject: "ABCD",
      h2rVerseGraphicId: "",
      h2rVerseTemplate: '{\n  "body": "{reference}\\n{chinese}\\n{english}"\n}'
    };

    try {
      const storedData = await chrome.storage.local.get('settings');
      if (storedData.settings) {
        currentSettings = { ...currentSettings, ...storedData.settings };
      }
    } catch (err) {
      console.warn("TJC Automator: Could not load settings from storage", err);
    }

    if (!currentSettings.h2rVerseGraphicId) {
      console.log("TJC Automator: Skipping H2R push because Verse Graphic ID is not configured.");
      return;
    }

    const ip = currentSettings.h2rVerseIp || "http://10.10.1.67:4001";
    const proj = currentSettings.h2rVerseProject || "ABCD";
    const gid = currentSettings.h2rVerseGraphicId;

    let templateObj;
    try {
      templateObj = JSON.parse(currentSettings.h2rVerseTemplate || '{"body":"{reference}\\n{chinese}\\n{english}"}');
    } catch (e) {
      console.error("TJC Automator: Invalid Verse Template JSON");
      return;
    }

    function replacePlaceholders(obj) {
      if (typeof obj === 'string') {
        return obj
          .replace(/{reference}/g, ref)
          .replace(/{chinese}/g, zh)
          .replace(/{english}/g, en);
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

    const payload = replacePlaceholders(templateObj);
    if (!Array.isArray(payload.cues)) payload.cues = [];

    const updateUrl = `${ip.replace(/\/$/, '')}/api/${proj}/graphic/${gid}/update`;
    const showUrl = `${ip.replace(/\/$/, '')}/api/${proj}/graphic/${gid}/show`;

    try {
      chrome.runtime.sendMessage({
        action: 'PUSH_H2R',
        updateUrl: updateUrl,
        showUrl: showUrl,
        payload: payload
      }, (response) => {
        if (chrome.runtime.lastError) {
          console.error("TJC Automator: Error communicating with background script:", chrome.runtime.lastError);
        } else if (response && response.success) {
          console.log("TJC Automator: Pushed verse to H2R successfully via background script!", ref);
        } else {
          console.error("TJC Automator: Background script failed to push verse to H2R", response?.error);
        }
      });
    } catch (e) {
      console.error("TJC Automator: Failed to push verse to H2R Graphics", e);
    }
  }

})();
