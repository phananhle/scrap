#!/usr/bin/env bash
# Install a cron job to remind you to run the 7-day recap if you haven't in POKE_REMIND_DAYS (default 3).
# Usage: ./install_cron.sh [install]
#   With no args: prints the crontab line so you can add it yourself.
#   With "install": appends the line to your crontab (runs at 9:00 AM daily).

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PYTHON="${PYTHON:-python3}"
CRON_LINE="0 9 * * * cd $SCRIPT_DIR && $PYTHON get_primer.py --check-reminder >> $SCRIPT_DIR/cron.log 2>&1"

if [[ "${1:-}" == "install" ]]; then
  (crontab -l 2>/dev/null | grep -v "get_primer.py --check-reminder"; echo "$CRON_LINE") | crontab -
  echo "Installed. Cron will run at 9:00 AM daily. Logs: $SCRIPT_DIR/cron.log"
else
  echo "Add this line to your crontab (crontab -e):"
  echo ""
  echo "  $CRON_LINE"
  echo ""
  echo "Or run: $0 install"
fi
