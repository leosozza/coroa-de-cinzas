#!/bin/zsh
# Instala o Reel automático em ~/ArcaneChessReels e agenda no launchd (de hora em hora).
# Uso: tools/reels/instalar.sh            instala/atualiza e liga o agendamento
#      tools/reels/instalar.sh --parar    desliga o agendamento (os arquivos ficam)
set -e
DEST="$HOME/ArcaneChessReels"
LABEL="com.arcanechess.reels"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
NODE="$(command -v node)"

if [[ "$1" == "--parar" ]]; then
  launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
  rm -f "$PLIST"
  echo "Reel automático desligado."
  exit 0
fi

SRC="${0:A:h}"
mkdir -p "$DEST"
cp "$SRC/reel_auto.mjs" "$SRC/legendas.mjs" "$SRC/package.json" "$DEST/"
(cd "$DEST" && npm i --no-audit --no-fund --silent)

mkdir -p "$HOME/Library/LaunchAgents"
cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key>
  <array><string>$NODE</string><string>$DEST/reel_auto.mjs</string></array>
  <key>WorkingDirectory</key><string>$DEST</string>
  <key>StartInterval</key><integer>3600</integer>
  <key>RunAtLoad</key><false/>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key><string>${NODE:h}:/usr/bin:/bin:/usr/sbin:/sbin</string>
    <key>HOME</key><string>$HOME</string>
    <key>USER</key><string>$USER</string>
  </dict>
  <key>StandardOutPath</key><string>$DEST/launchd.out.log</string>
  <key>StandardErrorPath</key><string>$DEST/launchd.err.log</string>
</dict>
</plist>
EOF
launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST"
echo "Reel automático instalado em $DEST e agendado de hora em hora ($LABEL)."
