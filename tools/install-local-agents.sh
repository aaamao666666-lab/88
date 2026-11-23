#!/usr/bin/env bash
set -euo pipefail
# Browser Use open-source local browser agent
python3 -m pip install --user -r tools/requirements-browser-use.txt
# Open Interpreter current official standalone CLI
curl -fsSL https://www.openinterpreter.com/install | sh
printf '\nInstalled. Restart your shell, then run: interpreter --version\n'
printf 'Browser Use CLI: browser-use --help\n'
