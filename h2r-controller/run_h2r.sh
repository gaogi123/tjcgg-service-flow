#!/bin/bash

# Source NVM to ensure we have the correct node version
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# Run the Node.js script
node "/Users/gaogi/Documents/Antigravity/TJCGG Service Flow/h2r-controller/trigger_h2r.js"
