#!/usr/bin/env python3
"""Look up a view in a `uiautomator dump` file.

usage: ui.py DUMP.xml (center|text) (id:NAME | text:EXACT | contains:PART)
Prints the view's tap point ("x y") or its text. Exits 1 if not found.
"""
import re
import sys
import xml.etree.ElementTree as ET

path, mode, query = sys.argv[1:4]
kind, _, value = query.partition(":")
try:
    root = ET.parse(path).getroot()
except Exception:
    sys.exit(1)

for node in root.iter("node"):
    rid = node.get("resource-id", "")
    text = node.get("text", "")
    desc = node.get("content-desc", "")
    if kind == "id":
        hit = rid.endswith(":id/" + value)
    elif kind == "text":
        hit = text == value
    else:
        hit = value.lower() in text.lower() or value.lower() in desc.lower()
    if not hit:
        continue
    if mode == "text":
        print(text)
        sys.exit(0)
    m = re.match(r"\[(\d+),(\d+)\]\[(\d+),(\d+)\]", node.get("bounds", ""))
    if not m:
        continue
    x1, y1, x2, y2 = map(int, m.groups())
    print((x1 + x2) // 2, (y1 + y2) // 2)
    sys.exit(0)
sys.exit(1)
