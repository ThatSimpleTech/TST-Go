#!/usr/bin/env bash
# Drives TST Go on an emulator through the two reported bugs:
#   1. after a while (app killed, reopened) the pin jumped back to New York
#   2. no way to stop the fake GPS
# Writes report.md and screenshots to $OUT. Exits 1 if any check fails.
set -u
PKG=com.thatsimpletech.tstgo
APK="${APK:?set APK}"
OUT="${OUT:?set OUT}"
HERE="$(cd "$(dirname "$0")" && pwd)"
mkdir -p "$OUT"
REPORT="$OUT/report.md"
: > "$REPORT"
fails=0

log() { echo "$*" | tee -a "$REPORT"; }
ok() { log "- PASS: $1"; }
bad() { log "- FAIL: $1"; fails=$((fails + 1)); }
shot() { adb exec-out screencap -p > "$OUT/$1.png" 2>/dev/null || true; }
dump() {
  local i
  rm -f "$OUT/ui.xml"
  for i in 1 2 3; do
    adb shell rm -f /sdcard/ui.xml >/dev/null 2>&1
    adb shell uiautomator dump /sdcard/ui.xml >/dev/null 2>&1
    adb pull /sdcard/ui.xml "$OUT/ui.xml" >/dev/null 2>&1 && return 0
    sleep 2
  done
  return 1
}
ui() { dump; python3 "$HERE/ui.py" "$OUT/ui.xml" "$1" "$2"; }
tap() {
  local xy
  xy=$(ui center "$1") || { bad "could not find '$1' on screen"; return 1; }
  adb shell input tap $xy
}
hud() { ui text id:hudCoords; }
button() { ui text id:broadcastBtn; }
svc_running() { adb shell dumpsys activity services "$PKG" | grep -q "MockLocationService"; }
gps_shows() { adb shell dumpsys location | grep -q "$1"; }
open_app() { adb shell am start -W -n "$PKG/.MainActivity" >/dev/null 2>&1; sleep 4; }

adb root >/dev/null 2>&1 || true
sleep 3
log "## Android $(adb shell getprop ro.build.version.release | tr -d '\r') (API $(adb shell getprop ro.build.version.sdk | tr -d '\r'))"
log ""

adb install -r -g "$APK" >/dev/null || { bad "APK did not install"; exit 1; }
adb shell appops set "$PKG" android:mock_location allow
adb shell cmd appops set "$PKG" POST_NOTIFICATION allow >/dev/null 2>&1 || true

log "### 1. Fresh install"
open_app
shot 01-fresh-install
title=$(ui text id:appTitle)
[[ "$title" == *1.0.10* ]] && ok "header shows the version: $title" || bad "header shows '$title', expected 1.0.10"
[ "$(button)" = "Start GPS" ] && ok "does not start fake GPS before you pick a spot" || bad "button says '$(button)' on a fresh install"
svc_running && bad "GPS service already running before a spot was picked" || ok "phone keeps its real GPS until you pick a spot"

log "### 2. Pick Chicago"
tap id:search && adb shell input text "41.8781,-87.6298"
sleep 1
tap id:searchGo
sleep 5
shot 02-picked-chicago
coords=$(hud)
[[ "$coords" == 41.878100* ]] && ok "pin moved to Chicago ($coords)" || bad "pin shows '$coords' after search"
[ "$(button)" = "Stop GPS" ] && ok "main screen shows a Stop GPS button" || bad "button says '$(button)' while live"
svc_running && ok "GPS service running" || bad "GPS service not running after the jump"
gps_shows "41.8781" && ok "phone GPS reports Chicago" || bad "phone GPS does not report Chicago"
adb shell dumpsys notification --noredact | grep -q "Stop GPS" && ok "notification has a Stop GPS button" || bad "notification has no Stop GPS button"
adb shell dumpsys shortcut | grep -q "stop_gps" && ok "long-press icon shortcut Stop GPS is registered" || bad "Stop GPS shortcut missing"
adb shell dumpsys appwidget | grep -q "StopWidget" && ok "home screen widget is available" || bad "stop widget missing"

log "### 3. Android kills the app in the background"
adb shell input keyevent KEYCODE_HOME
sleep 2
pid=$(adb shell pidof "$PKG" | tr -d '\r')
if [ -n "$pid" ]; then
  adb shell kill -9 "$pid" >/dev/null 2>&1 || adb shell run-as "$PKG" kill -9 "$pid" >/dev/null 2>&1 || true
fi
sleep 15
if svc_running; then
  ok "Android restarted the GPS service on its own"
  gps_shows "41.8781" && ok "restarted service still broadcasts Chicago" || bad "restarted service lost Chicago"
else
  log "- NOTE: Android did not restart the service within 15 s (fine; reopening the app resumes it)"
fi
open_app
shot 03-reopen-after-kill
coords=$(hud)
[[ "$coords" == 41.878100* ]] && ok "reopened at Chicago, not New York ($coords)" || bad "reopened at '$coords'"

log "### 4. Swipe away / reboot (force stop), then reopen"
adb shell am force-stop "$PKG"
sleep 2
open_app
shot 04-reopen-after-force-stop
coords=$(hud)
[[ "$coords" == 41.878100* ]] && ok "reopened at Chicago, not New York ($coords)" || bad "reopened at '$coords'"
[ "$(button)" = "Stop GPS" ] && ok "fake GPS resumed at the saved spot" || bad "button says '$(button)' after reopening"
sleep 2
gps_shows "41.8781" && ok "phone GPS reports Chicago again" || bad "phone GPS does not report Chicago after reopening"

log "### 5. Stop GPS from the main screen"
tap id:broadcastBtn
sleep 4
shot 05-stopped-from-app
svc_running && bad "GPS service still running after tapping Stop GPS" || ok "Stop GPS button on the main screen turns fake GPS off"
[ "$(button)" = "Start GPS" ] && ok "button switches back to Start GPS" || bad "button says '$(button)' after stopping"

log "### 6. Stop GPS from the notification"
tap id:broadcastBtn
sleep 4
svc_running || bad "Start GPS did not restart the service"
adb shell cmd statusbar expand-notifications
sleep 3
shot 06-notification
if tap contains:"Stop GPS"; then
  sleep 4
  svc_running && bad "GPS service still running after notification Stop GPS" || ok "notification Stop GPS turns fake GPS off"
fi
adb shell cmd statusbar collapse >/dev/null 2>&1 || true
sleep 2
shot 07-after-notification-stop
[ "$(button)" = "Start GPS" ] && ok "app screen updates after stopping from the notification" || bad "app button says '$(button)' after notification stop"

log "### 7. Stop GPS from the long-press shortcut"
tap id:broadcastBtn
sleep 4
adb shell am start -n "$PKG/.StopActivity" >/dev/null 2>&1
sleep 4
svc_running && bad "GPS service still running after the shortcut" || ok "Stop GPS shortcut turns fake GPS off"

log "### 8. Still remembers Chicago after all that"
adb shell am force-stop "$PKG"
open_app
shot 08-final-reopen
coords=$(hud)
[[ "$coords" == 41.878100* ]] && ok "still Chicago ($coords)" || bad "final reopen shows '$coords'"

log "### 9. Search a street address (uses the live map and US Census services)"
tap id:search
adb shell input keyevent KEYCODE_MOVE_END
for _ in $(seq 1 40); do adb shell input keyevent KEYCODE_DEL; done
adb shell input text "4600%sSilver%sHill%sRd%sApt%s2,%sWashington,%sDC%s20233"
sleep 1
tap id:searchGo
sleep 12
shot 09-address-search
coords=$(hud)
label=$(ui text id:hudLabel)
[[ "$coords" == 38.84* ]] && ok "found the address: $label ($coords)" || bad "address search landed on '$label' ($coords)"

log "### Never broadcast New York"
adb shell dumpsys location > "$OUT/dumpsys-location.txt" 2>&1
grep -q "40.758000" "$OUT/dumpsys-location.txt" && bad "Times Square (40.758) shows up in the phone's location log" || ok "Times Square never reached the phone's GPS"

adb logcat -d > "$OUT/logcat.txt" 2>&1 || true
grep -E "FATAL EXCEPTION|AndroidRuntime: (FATAL|Process: $PKG)" "$OUT/logcat.txt" > "$OUT/crashes.txt" || true
[ -s "$OUT/crashes.txt" ] && bad "app crashed (see crashes.txt)" || ok "no crashes in the log"

log ""
log "**$fails failed check(s)**"
[ "$fails" -eq 0 ]
