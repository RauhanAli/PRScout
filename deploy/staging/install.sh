#!/usr/bin/env bash
# One-time setup of the auto-updating PRScout staging preview on this box.
#   deploy/staging/install.sh           install + start the 1-minute timer
#   deploy/staging/install.sh --no-timer  install only (run preview.sh by hand)
#
# - copies preview.sh, ../edge.sh and ../swap.sh to ~/.local/share/prscout-staging/bin/ (the
#   timer runs that copy, so a PR can't change the loop; re-run install.sh to
#   update it)
# - writes the systemd --user units prscout-stage.service / prscout-stage.timer,
#   and prscout-stage-smoke.service, the smoke run that prscout-stage.service
#   starts once a build is live (it has no timer of its own)
# It does not route the site: https://$STAGING_HOST (default
# staging.gitprscout.com) reaches the stack's port through a Cloudflare tunnel,
# and that config is hand-managed (deploy/README.md, "The public route").
# No sudo. Needs linger for the timer to run while logged out
# (`loginctl show-user $USER -p Linger`).
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
STATE="${PRSCOUT_STAGE_HOME:-$HOME/.local/share/prscout-staging}"
PORT="${PRSCOUT_STAGE_PORT:-9110}"
UNITS="$HOME/.config/systemd/user"

mkdir -p "$STATE/bin" "$UNITS"
install -m 755 "$here/preview.sh" "$STATE/bin/preview.sh"
install -m 644 "$here/../edge.sh" "$STATE/bin/edge.sh"
install -m 644 "$here/../swap.sh" "$STATE/bin/swap.sh"

cat > "$UNITS/prscout-stage.service" <<UNIT
[Unit]
Description=PRScout staging preview: rebuild the staging site when origin changes
After=network-online.target docker.service

[Service]
Type=oneshot
ExecStart=$STATE/bin/preview.sh
Environment=PRSCOUT_STAGE_SMOKE_UNIT=prscout-stage-smoke.service
Nice=10
IOSchedulingClass=idle
TimeoutStartSec=2h
UNIT

cat > "$UNITS/prscout-stage-smoke.service" <<UNIT
[Unit]
Description=PRScout staging preview: smoke tests against the live build

[Service]
Type=oneshot
ExecStart=$STATE/bin/preview.sh --smoke
Nice=10
TimeoutStartSec=30min
UNIT

cat > "$UNITS/prscout-stage.timer" <<UNIT
[Unit]
Description=Check for PRScout staging changes every minute

[Timer]
OnBootSec=2min
OnUnitInactiveSec=1min
AccuracySec=15s

[Install]
WantedBy=timers.target
UNIT

systemctl --user daemon-reload
echo "the stack listens on 127.0.0.1:$PORT; the tunnel routes the staging host to it (deploy/README.md)"
if [[ "${1:-}" != "--no-timer" ]]; then
    systemctl --user enable --now prscout-stage.timer
    systemctl --user list-timers prscout-stage.timer --no-pager
fi
