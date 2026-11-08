#!/usr/bin/env python3
"""
The Hundred, Acts II–V (stages 11–80): compact authoring spec → src/data/hundred/NNN.json.
Slow unveiling (GDD §18): each stage introduces at most one new idea, shown alone before it is combined.
Par is not authored here: `npm run solve` derives it and writes the witness; run tools/stages/apply_pars.py after.
Wave rows are nearest-first; `z` is the absolute row of the nearest row. Run: python3 tools/stages/author.py
"""
import json, os

OUT = os.path.join(os.path.dirname(__file__), "..", "..", "src", "data", "hundred")
F4 = ["XXXXXXX"] * 4
F3 = ["XXXXXXX"] * 3
STAGES = []

def st(i, name, waves, obj, ground=F4, player=(3, 1), crumble=0, sky=None, beacons=None, last_stand=False, tick=None):
    act = 2 if i <= 25 else 3 if i <= 45 else 4 if i <= 65 else 5
    o = {"type": obj[0]}
    if obj[0] == "exit": o["z"] = obj[1]
    if obj[0] == "survive": o["ticks"] = obj[1]
    d = {"id": i, "name": name, "act": act, "ground": ground, "player": list(player), "crumble": crumble,
         "waves": [{"at": a, "z": z, "rows": r} for (a, z, r) in waves], "objective": o, "par": 0}
    if sky: d["skyfall"] = [{"at": a, "x": x, "z": z, **({"type": t} if t else {})} for (a, x, z, t) in sky]
    if beacons: d["beacons"] = [{"at": a, "x": x, "z": z} for (a, x, z) in beacons]
    if last_stand: d["lastStand"] = True
    if tick: d["tick"] = tick
    STAGES.append(d)

# ── Act II · Restraint (11–25): Forbidden, Scars, Crumble, Advantage + Blast ────────────────────────────────
st(11, "Do Not Touch", [(1, 9, ["...F..."]), (5, 10, ["..F.F.."])], ("survive", 18))
st(12, "Let It Pass", [(1, 9, ["..S.S..", "...F..."]), (6, 10, ["...S...", "...S...", "...S..."])], ("exit", 6))
st(13, "Glyph", [(1, 9, ["...A..."]), (7, 12, ["..SSS..", "..SSS.."])], ("clear",))
st(14, "Breath", [(1, 8, ["...A..."]), (5, 11, ["..SSS..", "..SSS..", "..SSS.."])], ("clear",))
st(15, "Scar", [(1, 9, ["..SFS..", "...S..."]), (6, 11, ["...S...", "...S...", "...S...", "..S.S.."])], ("exit", 7), crumble=8)
st(16, "Narrow Gate", [(1, 9, ["F.S.S.F", "...S..."]), (6, 11, [".F.S.F.", "...S...", "...S..."])], ("exit", 7))
st(17, "Restraint", [(1, 9, ["S.F.F.S", "..S.S.."]), (6, 11, ["SF...FS", "...S..."])], ("clear",))
st(18, "Glyph Bank", [(1, 9, ["A.....A"]), (6, 11, ["..SSS..", "..SSS..", "S.....S"])], ("clear",))
st(19, "Ledge", [(1, 9, ["..S.S..", "...S..."]), (5, 10, ["...S...", "..S.S.."]), (10, 12, ["...S...", "...S..."]), (15, 14, ["..S.S.."])], ("survive", 24), crumble=6)
st(20, "Hold the Line", [(1, 9, ["S.SFS.S", "...A..."]), (7, 12, ["..SSS..", ".F...F.", "..S.S.."])], ("clear",))
st(21, "Forward Light", [(1, 9, ["...S...", "..S.S..", "...S..."]), (6, 11, ["...S...", "...F...", "...S..."]), (11, 14, ["...S...", "...S..."])], ("exit", 8), beacons=[(4, 3, 9)], crumble=8)
st(22, "Two Glyphs", [(1, 9, ["A.....A", "...S..."]), (6, 11, ["SSS.SSS", "SSS.SSS"])], ("clear",))
st(23, "Pressure Point", [(1, 9, ["..S.S..", ".F...F."]), (5, 11, ["...S...", "..S.S.."]), (10, 13, ["S.F.F.S", "...S..."])], ("survive", 24), crumble=6)
st(24, "Bridge of Kings", [(1, 9, ["...S...", "...S...", "..SAS.."]), (7, 12, ["...S...", "...F...", "...S...", "...S..."]), (13, 16, ["...S...", "...S..."])], ("exit", 10), crumble=7)
st(25, "The Veil", [(1, 9, ["..S.S..", "F..S..F"]), (6, 11, ["...A...", "..SSS..", "..SSS.."]), (13, 15, ["...S...", "...S...", "...S...", "...S...", "..S.S.."])], ("exit", 11), crumble=7)

# ── Act III · Material (26–45): Glass, Iron + raised Reach, Skyfall ─────────────────────────────────────────
st(26, "Glass", [(1, 9, ["...G..."]), (5, 10, ["..G.G.."])], ("clear",))
st(27, "Temporary", [(1, 9, ["...G...", "...G..."]), (5, 11, ["...S...", "...S..."])], ("exit", 6))
st(28, "Shatter Line", [(1, 9, ["G.G.G.G", "...S..."]), (6, 11, [".G.S.G.", "..S.S.."])], ("clear",))
st(29, "Glass and Restraint", [(1, 9, ["..G.G..", "...F..."]), (6, 11, ["...S...", "...S...", "..G.G..", "...S..."])], ("exit", 6))
st(30, "Fragile Crossing", [(1, 9, ["...G...", "...S...", "..G.G.."]), (6, 12, ["...S...", "...G...", "...S..."]), (12, 15, ["..S.S.."]), (15, 17, ["...S...", "...S..."])], ("exit", 9), crumble=7)
st(31, "Iron", [(1, 8, ["...I..."])], ("clear",))
st(32, "High Ground", [(1, 9, ["...I..."]), (7, 12, ["S.....S", "S.....S"])], ("clear",))
st(33, "Anvils", [(1, 9, ["..I.I..", "...S..."]), (7, 12, ["..S.S..", "...S..."])], ("clear",))
st(34, "Iron and Glass", [(1, 9, ["...I...", "..G.G.."]), (7, 12, ["...S...", "...G...", "...S...", "...S...", "...S..."])], ("exit", 7))
st(35, "Blast the Iron", [(1, 8, ["...A..."]), (5, 11, [".SIS...", ".SIS..."])], ("clear",))
st(36, "Forge", [(1, 9, ["S..I..S", ".F...F."]), (7, 12, ["..SAS..", "...S..."])], ("clear",))
st(37, "Material Crossing", [(1, 9, ["...I...", "..S.S.."]), (6, 11, ["...G...", "...S...", "..G.G.."]), (12, 14, ["...S...", "...S...", "...S...", "...S..."])], ("exit", 9), crumble=7)
st(38, "Watch the Sky", [(2, 10, ["...S..."])], ("survive", 14), sky=[(2, 2, 2, None), (6, 4, 2, None), (9, 3, 3, None)])
st(39, "Pre-mark", [(1, 10, ["...S..."])], ("clear",), sky=[(2, 3, 5, None), (6, 2, 5, None), (9, 4, 5, None)])
st(40, "Rain", [(1, 9, ["..S.S..", "...S..."])], ("clear",), sky=[(3, 1, 5, None), (5, 5, 5, None), (8, 3, 6, None)])
st(41, "Glass Rain", [(1, 9, ["...S..."])], ("exit", 6), sky=[(2, 3, 5, "glass"), (4, 3, 6, None), (6, 2, 5, None)])
st(42, "Iron Sky", [(1, 10, ["..S.S.."])], ("clear",), sky=[(2, 3, 6, "iron"), (7, 1, 5, None), (9, 5, 5, None)])
st(43, "Sky and Restraint", [(1, 9, ["...F...", "..S.S.."]), (7, 12, ["...S..."])], ("clear",), sky=[(4, 1, 5, None), (8, 5, 5, None)])
st(44, "Storm Front", [(1, 9, ["..S.S..", "...G..."]), (6, 11, ["...I...", "..S.S.."])], ("survive", 22), crumble=7, sky=[(4, 2, 4, None), (10, 4, 4, None), (14, 3, 5, None)])
st(45, "Material", [(1, 9, ["...S...", "..G.G..", "...S..."]), (6, 12, ["...I...", "...S...", "..SAS.."]), (13, 16, ["...S...", "...S...", "...S...", "...S..."])], ("exit", 10), crumble=7, sky=[(9, 3, 6, None)])

# ── Act IV · Phase (46–65): Phase cubes, multi-mark timing, Last Stand ──────────────────────────────────────
st(46, "Two Halves", [(1, 8, ["..PP..."])], ("clear",))
st(47, "Tether", [(1, 9, ["..PP...", "S.....S"]), (6, 11, ["...PP.."])], ("clear",))
st(48, "Split", [(1, 9, [".PP.PP."]), (7, 12, ["...S...", "...S...", "...S..."])], ("exit", 6))
st(49, "Timing", [(1, 9, ["..PP...", "...I..."]), (7, 12, ["...PP..", "..S.S.."])], ("clear",))
st(50, "Phase and Restraint", [(1, 9, ["F.PP..F", "...S..."]), (7, 12, ["...PP..", ".F...F."])], ("clear",))
st(51, "Phase Bridge", [(1, 9, ["...PP..", "...S...", "...S..."]), (7, 12, ["..PP...", "...S..."])], ("exit", 8), crumble=8)
st(52, "Last Stand", [(1, 7, ["F.....F", "...S..."]), (4, 9, ["..S.S..", "...S...", ".F...F."]), (9, 12, ["..SSS..", "...S..."])], ("survive", 22), ground=["XXXXXXX", "XXXXXXX"], player=(3, 0), last_stand=True)
st(53, "Hold On", [(1, 7, ["...F...", "..S.S.."]), (5, 9, [".F.S.F.", "...S..."]), (10, 12, ["..S.S..", "..SSS.."])], ("survive", 24), ground=["XXXXXXX", "XXXXXXX"], player=(3, 0), last_stand=True)
st(54, "Purify", [(1, 7, ["S.....S", "..F.F.."]), (4, 9, ["..SSS..", "S.....S"]), (9, 12, ["..SAS..", ".S...S.", "...S..."])], ("survive", 26), ground=["XXXXXXX", "XXXXXXX"], player=(3, 0), last_stand=True)
st(55, "Phase Storm", [(1, 9, [".PP.PP.", "...S..."]), (8, 13, ["..PP...", "..S.S..", "...PP.."])], ("clear",))
st(56, "Glass Tether", [(1, 9, ["..PP...", "..G.G.."]), (7, 12, ["...PP..", "...G..."])], ("exit", 6))
st(57, "Iron Tether", [(1, 9, ["..PP...", "...I..."]), (8, 13, ["...PP..", "..S.S.."])], ("clear",))
st(58, "Phase Sky", [(1, 9, ["..PP..."]), (7, 12, ["...PP.."])], ("clear",), sky=[(3, 1, 5, None), (6, 5, 5, None)])
st(59, "Last Phase", [(1, 7, ["..PP...", "F.....F"]), (5, 10, ["...PP..", "..S.S.."]), (10, 13, ["S.F.F.S"])], ("survive", 22), ground=["XXXXXXX", "XXXXXXX"], player=(3, 0), last_stand=True)
st(60, "Pressure of Two", [(1, 9, ["..PP...", "...S..."]), (6, 11, ["...PP..", "..S.S.."]), (11, 14, [".PP.PP."])], ("survive", 24), crumble=6)
st(61, "Phase Crossing", [(1, 9, ["...PP..", "...S...", "...S..."]), (7, 12, ["..PP...", "...S...", "...S..."]), (13, 16, ["...S..."])], ("exit", 9), crumble=7)
st(62, "Twin Glyphs", [(1, 9, ["A.PP..A"]), (7, 12, ["..SSS..", "..SPP..", "..SSS.."])], ("clear",))
st(63, "Restless", [(1, 9, ["F.PP.F.", "..S.S.."]), (7, 12, [".F.PP.F", "...S..."])], ("clear",), sky=[(5, 3, 5, None)])
st(64, "Hold Together", [(1, 7, ["..PP...", "..F.F.."]), (5, 10, ["..SSS..", "...PP.."]), (11, 14, ["S.....S", "..S.S.."])], ("survive", 24), ground=["XXXXXXX", "XXXXXXX"], player=(3, 0), last_stand=True)
st(65, "Phase", [(1, 9, ["...PP..", "...S...", "..SAS.."]), (7, 13, ["..PP...", "...I...", "...S..."]), (14, 17, ["...S...", "...S...", "...S...", "..S.S.."])], ("exit", 10), crumble=7)

# ── Act V · Mastery (66–80): combinations, par-tight crossings ──────────────────────────────────────────────
st(66, "Every Lesson", [(1, 9, ["..SFS..", "...A..."]), (7, 12, ["..SSS..", "..SIS.."])], ("clear",))
st(67, "Glass Bridge", [(1, 9, ["...G...", "...G...", "...G..."]), (6, 12, ["...S...", "...S..."])], ("exit", 7))
st(68, "Long Shadow", [(1, 9, ["..S.S.."])], ("clear",), sky=[(2, 3, 5, None), (4, 1, 6, None), (6, 5, 6, None), (8, 3, 6, "iron")])
st(69, "Iron Will", [(1, 9, [".I...I.", "...S..."]), (8, 13, ["...I...", "..S.S.."])], ("clear",))
st(70, "Seventy", [(1, 9, ["..PP...", ".F...F.", "...S..."]), (7, 12, ["..SAS..", "...PP.."]), (13, 16, ["...S...", "...S...", "...S...", "..S.S.."])], ("exit", 9), crumble=7)
st(71, "Small Ground", [(1, 7, ["...S...", "..F.F.."]), (5, 10, ["..S.S..", "...S..."]), (10, 13, ["...S...", "..S.S.."])], ("survive", 22), ground=["XXXXXXX", "XXXXXXX"], player=(3, 0), crumble=8, last_stand=True)
st(72, "Glass Gauntlet", [(1, 9, ["G.G.G.G", ".G.G.G."]), (7, 12, ["...S...", "..S.S.."])], ("clear",))
st(73, "Three Ways", [(1, 9, ["S..S..S", ".F...F."]), (6, 11, ["S..S..S", "...F..."]), (11, 14, ["S..S..S"])], ("survive", 24), crumble=6)
st(74, "Blast Chain", [(1, 8, ["A.....A"]), (5, 11, ["SSS.SSS", "SSS.SSS", "SSS.SSS"])], ("clear",))
st(75, "Skyfall Crossing", [(1, 9, ["...S...", "...S...", "...S..."]), (7, 13, ["...S...", "...S..."])], ("exit", 8), crumble=8, sky=[(5, 2, 5, None), (9, 4, 6, None)])
st(76, "Tethered Iron", [(1, 9, ["..PP...", "..I.I.."]), (8, 13, ["...PP..", "...S..."])], ("clear",))
st(77, "Veil of Glass", [(1, 9, ["F.G.G.F", "...S..."]), (7, 12, [".F.G.F.", "...S...", "...S..."])], ("exit", 7))
st(78, "Depth", [(1, 9, ["...S...", "..S.S..", "...A..."]), (6, 12, ["...S...", "...I...", "...S..."]), (12, 16, ["..PP...", "...S...", "...S...", "...S...", "...S..."])], ("exit", 11), crumble=7)
st(79, "Restraint Absolute", [(1, 9, ["SF.S.FS", ".F...F."]), (7, 12, ["F..S..F", ".S.F.S."]), (13, 16, ["...S..."])], ("clear",))
st(80, "Mastery", [(1, 9, ["...S...", "..G.G..", "...A..."]), (6, 12, ["...PP..", "...I...", ".F...F."]), (13, 17, ["..SSS..", "...S...", "...S...", "...S...", "...S...", "...S...", "...S...", "...S..."])], ("exit", 12), crumble=7, sky=[(10, 2, 7, None)])

assert [s["id"] for s in STAGES] == list(range(11, 81)), "stage ids must be 11..80"
for s in STAGES:
    with open(os.path.join(OUT, f"{s['id']:03d}.json"), "w") as f:
        json.dump(s, f, indent=1)
        f.write("\n")
print(f"wrote {len(STAGES)} stages")
