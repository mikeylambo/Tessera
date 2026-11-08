#!/usr/bin/env python3
"""Copy solver-derived par (tests/witness/NNN.json marks) into src/data/hundred/NNN.json."""
import json, glob, os, re
root = os.path.join(os.path.dirname(__file__), "..", "..")
n = 0
for f in sorted(glob.glob(os.path.join(root, "tests", "witness", "*.json"))):
    w = json.load(open(f))
    p = os.path.join(root, "src", "data", "hundred", f"{w['stage']:03d}.json")
    s = open(p).read()
    s2 = re.sub(r'"par": \d+', f'"par": {w["marks"]}', s, count=1)
    if s2 != s: open(p, "w").write(s2); n += 1
print(f"updated {n} pars")
