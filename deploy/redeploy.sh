#!/usr/bin/env bash
# Run this ON THE SERVER (devteam02@bundlekit.mpctrades.com's host) to ship a new
# version of bundlekit-web after new commits have been pushed to main.
set -euo pipefail

cd ~/apps/bundlekit
git pull

sudo cp bundlekit-web/index.html /var/www/bundlekit/index.html
sudo chown root:root /var/www/bundlekit/index.html

sudo nginx -t
sudo systemctl reload nginx

echo "Deployed. Verify with: curl -I https://bundlekit.mpctrades.com/"
