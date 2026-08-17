# TJC GG Service Flow

Automates service preparation on [service.tjc.org](https://service.tjc.org) and lower thirds on [H2R Graphics](https://h2r.graphics/) from Google Sheets.

## Overview

This repository contains a unified Chrome Extension designed to streamline the weekly service workflow for True Jesus Church.

The extension integrates the previously standalone `tjc-automator` and `h2r-controller` into a single, seamless tool:
- **Service.tjc.org Autofill**: Sequential autofilling of sermon details, speakers, and hymns directly from Google Sheets via an interactive floating sidebar.
- **H2R Graphics Integration**: A one-click workflow that takes the autofilled sermon data and pushes it to an H2R Graphics lower third on your local network.
- **Live Background Verse Sync**: A background observer that listens for Bible verses pushed to `service.tjc.org` and seamlessly relays them to an H2R Graphics instance.

## Installation & Setup

### Loading the Extension in Chrome
1. Open Google Chrome and navigate to `chrome://extensions/`.
2. Enable **Developer mode** using the toggle switch in the top-right corner.
3. Click **Load unpacked** and select the root directory of this repository (`tjcgg-service-flow`).

## Usage
1. Pin the extension and ensure it is active when navigating to `service.tjc.org`.
2. Open the floating sidebar (the blue wand icon) on `service.tjc.org`.
3. In the **Schedule** tab, paste your Google Sheet URL and click **Load Schedule Data**.
4. Select the service you wish to prepare.
5. Click **Auto-Fill & Push to H2R** to automatically fill the web form and push the corresponding graphic payload to your H2R Graphics server.

*Note: You can configure the IP address, Port, and specific JSON Payload mappings for H2R Graphics under the **Settings** tab.*
