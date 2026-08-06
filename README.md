# TJC GG Service Flow

Automates service preparation on [service.tjc.org](https://service.tjc.org) and lower thirds on [H2R Graphics](https://h2r.graphics/) from Google Sheets.

## Overview

This repository contains tools and Chrome extensions designed to streamline the weekly service workflow for True Jesus Church:

1. **`tjc-automator/`**: Chrome Extension for `service.tjc.org`
   - Sequential autofilling of sermon details, speakers, and hymns from Google Sheets.
   - Interactive floating action panel with step-by-step guidance.
   - Live synchronization and validation against the service schedule.

2. **`h2r-controller/`**: H2R Graphics Lower Thirds Controller
   - Chrome Extension popup for controlling H2R Graphics lower thirds.
   - CSV data parsing for speakers and service schedule.
   - Quick search and instant graphic population.

## Installation & Setup

### Loading Extensions in Chrome
1. Open Google Chrome and navigate to `chrome://extensions/`.
2. Enable **Developer mode** using the toggle switch in the top-right corner.
3. Click **Load unpacked** and select either the `tjc-automator` or `h2r-controller` directory.

## Project Structure

```
├── tjc-automator/        # TJC Service Flow Chrome Extension (packaged)
│   ├── manifest.json
│   ├── content.js
│   ├── service-worker.js
│   ├── styles.css
│   └── test-harness.html
├── h2r-controller/       # H2R Graphics controller popup
│   ├── manifest.json
│   ├── popup.html
│   ├── popup.js
│   ├── popup.css
│   └── data.csv
├── content.js            # Root content script
├── manifest.json         # Root extension manifest
├── service-worker.js     # Root service worker
├── styles.css            # Root styles
└── test-harness.html     # Testing & mockup environment
```
