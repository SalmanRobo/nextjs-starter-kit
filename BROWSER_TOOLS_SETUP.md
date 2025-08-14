# BrowserTools MCP Chrome Extension Setup

## Overview
To complete the BrowserTools MCP integration, you need to install the Chrome extension that enables browser automation.

## Installation Steps

### 1. Download the Extension
```bash
git clone https://github.com/AgentDeskAI/browser-tools-mcp.git
cd browser-tools-mcp
```

### 2. Install Chrome Extension
1. Open Google Chrome
2. Navigate to `chrome://extensions/`
3. Enable "Developer mode" (toggle in top right)
4. Click "Load unpacked"
5. Select the `browser-tools-mcp` folder you just cloned

### 3. Start the Browser Server
In a separate terminal, run:
```bash
npx @agentdeskai/browser-tools-server@1.2.0
```

Keep this server running while using browser automation features.

## Verification
- The Chrome extension should appear in your extensions list
- The browser server should start on a port (typically 3025-3035)
- Claude Code will automatically connect to the MCP server when you restart it

## Usage
Once set up, you can use browser automation commands through Claude Code such as:
- Navigate to web pages
- Fill forms
- Click buttons
- Take screenshots
- Extract content

## Troubleshooting
- Ensure Chrome is installed and accessible
- Make sure the browser server is running before using automation features
- Restart Claude Code after installation to load the new MCP server