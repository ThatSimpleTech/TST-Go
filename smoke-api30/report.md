## Android 11 (API 30)

### 1. Fresh install
- PASS: header shows the version: TST Go 1.0.10
- PASS: does not start fake GPS before you pick a spot
- PASS: phone keeps its real GPS until you pick a spot
### 2. Pick Chicago
- PASS: pin moved to Chicago (41.878100, -87.629800)
- PASS: main screen shows a Stop GPS button
- PASS: GPS service running
- PASS: phone GPS reports Chicago
- PASS: notification has a Stop GPS button
- PASS: long-press icon shortcut Stop GPS is registered
- PASS: home screen widget is available
### 3. Android kills the app in the background
- NOTE: Android did not restart the service within 15 s (fine; reopening the app resumes it)
- PASS: reopened at Chicago, not New York (41.878100, -87.629800)
### 4. Swipe away / reboot (force stop), then reopen
- PASS: reopened at Chicago, not New York (41.878100, -87.629800)
- PASS: fake GPS resumed at the saved spot
- PASS: phone GPS reports Chicago again
### 5. Stop GPS from the main screen
- PASS: Stop GPS button on the main screen turns fake GPS off
- PASS: button switches back to Start GPS
### 6. Stop GPS from the notification
- PASS: notification Stop GPS turns fake GPS off
- PASS: app screen updates after stopping from the notification
### 7. Stop GPS from the long-press shortcut
- PASS: Stop GPS shortcut turns fake GPS off
### 8. Still remembers Chicago after all that
- PASS: still Chicago (41.878100, -87.629800)
### 9. Search a street address (uses the live map and US Census services)
- PASS: found the address: 4600 Silver Hill Rd (38.845056, -76.928366)
### Never broadcast New York
- PASS: Times Square never reached the phone's GPS
- PASS: no crashes in the log

**0 failed check(s)**
