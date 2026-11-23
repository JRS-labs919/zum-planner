#!/usr/bin/env python3
"""Build one-line-symbols.js, the symbol bundle for the Zum one-line drawing.

Dev-time tool. Python 3 standard library only. Never runs at app runtime.

    python tools/build_one_line_symbols.py            # write one-line-symbols.js
    python tools/build_one_line_symbols.py --check    # validate, and confirm the file on disk is current

Input : the symbol library (symbols/*.svg, library.json, generator/draw.py).
        Default: jrs/software-engineering/inputs-2026-11-23/symbol-library
Output: one-line-symbols.js at the repo root (generated; never hand-edit).

The bundle ships a subset of the library (every symbol used by a ZUM*/CEN-* part or by
any part string quoted in the app sources), the pre-drawn symbols for parts the library
lacks, and the generic family symbols for unknown part numbers. The build is
deterministic and fails above BUDGET_BYTES or on any validation error.

The library generator (draw.py) is third-party code: it is imported by path from the
library folder and nothing is ever written there (bytecode writing is switched off).
"""
import argparse
import hashlib
import importlib.util
import json
import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

sys.dont_write_bytecode = True  # never drop __pycache__ into the library folder

REPO = Path(__file__).resolve().parent.parent
DEFAULT_LIBRARY = REPO / "jrs" / "software-engineering" / "inputs-2026-11-23" / "symbol-library"
DEFAULT_OUT = REPO / "one-line-symbols.js"
BUDGET_BYTES = 150_000
COMMAND = "python tools/build_one_line_symbols.py"
SOURCES = ["app.js", "catalog.js", "configurator.js", "wired-demo.js", "takeoff-wiring.js"]
SUBSET_PREFIX = re.compile(r"^(ZUM|CEN-)")
QUOTED = re.compile(r"""["']([A-Z0-9][A-Z0-9.\-]*[A-Z0-9])["']""")
PART_LIKE = re.compile(r"^(ZUM|CEN-|CBL-|CSA-|SW-|GLA-DT|GLS-)")
GUARANTEED = {  # id -> viewBox, from the technical plan's contract
    "zum-hub4": "0 0 320 60",
    "cen-swpoe-5ac": "0 0 180 80",
    "zumnet-jbox-16a-lv": "0 0 140 158",
    "zumlink-jbox-16a-lv": "0 0 140 158",
    "gla-dt-quattro-com1-24": "0 0 140 128",
}
# part-like strings in the app sources that are deliberately not drawn
NOT_DRAWN = {
    "SW-HUB4-PROG": "library symbol is null: a programming line item, not a drawn device",
    "GLS-PLS": "link-source label in app.js sample link data, not a model option",
}
NOPORTS = {"net": 0, "link": 0, "eth": 0, "dmx": 0, "dc": 0}


def ports(**kw):
    p = dict(NOPORTS)
    p.update(kw)
    return p


def feat(p=None, lv=(), line=(), leads=()):
    return {"ports": p or ports(), "lv": [list(x) for x in lv], "line": [list(x) for x in line],
            "leads": list(leads), "mods": None, "width_mm": None}


class BuildError(Exception):
    pass


# ----------------------------------------------------------------------------- library
def load_draw(library):
    path = library / "generator" / "draw.py"
    spec = importlib.util.spec_from_file_location("zum_symbol_draw", str(path))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def num(x):
    f = float(x)
    return int(f) if f == int(f) else f


def parse_viewbox(vb):
    parts = vb.replace(",", " ").split()
    if len(parts) != 4:
        raise BuildError(f"viewBox does not have four numbers: {vb!r}")
    nums = [float(x) for x in parts]
    if nums[2] <= 0 or nums[3] <= 0:
        raise BuildError(f"viewBox has a non-positive size: {vb!r}")
    return nums


SVG_RE = re.compile(r"^\s*(?:<\?xml[^>]*\?>\s*)?(?:<!DOCTYPE[^>]*>\s*)?<svg\b([^>]*)>(.*)</svg>\s*$", re.S)


def strip_svg(text, name):
    """Return (viewBox, inner markup) of a library file. Geometry is not touched."""
    m = SVG_RE.match(text)
    if not m:
        raise BuildError(f"{name}: not a single <svg> document")
    attrs, body = m.group(1), m.group(2)
    vb = re.search(r'\bviewBox="([^"]+)"', attrs)
    if not vb:
        raise BuildError(f"{name}: no viewBox")
    body = re.sub(r"<!--.*?-->", "", body, flags=re.S)
    body = re.sub(r"<metadata\b.*?</metadata>", "", body, flags=re.S)
    return vb.group(1), body


def prefix_ids(sym_id, body):
    """Prefix any id inside a body so ids cannot collide across symbols."""
    ids = re.findall(r'\bid="([^"]*)"', body)
    if not ids:
        return body, []
    pre = sym_id + "--"
    for i in ids:
        body = body.replace(f'id="{i}"', f'id="{pre}{i}"')
        body = body.replace(f"url(#{i})", f"url(#{pre}{i})")
        body = body.replace(f'href="#{i}"', f'href="#{pre}{i}"')
    return body, ids


FORBIDDEN = [
    (r"<image\b", "raster <image>"), (r"<script\b", "<script>"), (r"<foreignObject\b", "<foreignObject>"),
    (r"<style\b", "<style>"), (r"<use\b", "<use>"), (r"<!--", "comment"), (r"<\?xml", "XML prolog"),
    (r"<metadata\b", "metadata"), (r"c2pa", "c2pa"), (r"\bdata:", "data: URI"), (r"javascript:", "javascript:"),
    (r"https?:", "external URL"), (r"\bxmlns", "xmlns attribute"), (r"\son[a-zA-Z]+\s*=", "event attribute"),
]


def scan_body(sym_id, body):
    """Forbidden-content scan. Internal fragment refs to ids of the same body are the only href/url() allowed."""
    errs = []
    for pat, label in FORBIDDEN:
        if re.search(pat, body, re.I):
            errs.append(f"{sym_id}: contains {label}")
    own = set(re.findall(r'\bid="([^"]*)"', body))
    for h in re.findall(r"\b(?:xlink:)?href\s*=\s*\"([^\"]*)\"", body):
        if not (h.startswith("#") and h[1:] in own):
            errs.append(f"{sym_id}: href {h!r} is not an internal reference")
    for u in re.findall(r"url\(([^)]*)\)", body):
        if not (u.startswith("#") and u[1:] in own):
            errs.append(f"{sym_id}: url({u}) is not an internal reference")
    try:
        ET.fromstring('<svg xmlns="http://www.w3.org/2000/svg">' + body + "</svg>")
    except ET.ParseError as e:
        errs.append(f"{sym_id}: markup is not well-formed ({e})")
    return errs


# ----------------------------------------------------------------------------- recipes
# Absent parts. kind "draw" = drawn with draw.py; "alias" = mapped to an existing library symbol.
# Every entry lists the parts it serves and the basis (FACT / ASSUMPTION), recorded in the data.
def lead_colors(body):
    return re.findall(r'stroke="(#[0-9a-fA-F]{3,6})" stroke-width="2" stroke-linecap="round"', body)


def sibling_leads(lib_files, library_json, sibling_part):
    """(name, colour) leads of a library part: names from library.json, colours from its symbol file."""
    prod = next(p for p in library_json["products"] if p["part"] == sibling_part)
    names = prod["features"]["leads"]
    vb, body = lib_files[prod["symbol"][:-4]]
    cols = lead_colors(body)
    if len(cols) != len(names):
        raise BuildError(f"{sibling_part}: {len(names)} leads but {len(cols)} lead colours found in its symbol")
    return list(zip(names, cols))


def drawn_templates(D, lib_files, lj):
    L16 = sibling_leads(lib_files, lj, "ZUMLINK-JBOX-16A-LV")
    L20 = sibling_leads(lib_files, lj, "ZUMLINK-JBOX-20A-PLUG")
    LKP = sibling_leads(lib_files, lj, "ZUMMESH-KP")
    nobody = lambda **kw: feat(**kw)
    return [
        dict(id="cen-swpoe-5ac", family="bridge", f=feat(ports(eth=5)), kw=dict(w=180),
             parts=["CEN-SWPOE-5AC"],
             basis="FACT: bridge template with 5 Ethernet ports, per spec section 6 and the reference render_one_line.py"),
        dict(id="cen-swpoe-26", family="bridge", f=feat(), kw=dict(w=180),
             parts=["CEN-SWPOE-26"],
             basis="ASSUMPTION: bridge shape only; port count not stated in the spec, library or catalog (TBD)"),
        dict(id="zumlink-us-oneway-dls", family="ceiling", f=feat(ports(link=2)), kw=dict(shape="round"),
             parts=["ZUMLINK-US-ONEWAY-DLS"],
             basis="ASSUMPTION: ceiling (round) with 2 Zum Link ports, as every ZUMLINK-*-DLS in library.json has Link x2; shape from build.py classify (not HALLWAY or QUATTRO)"),
        dict(id="zummesh-jbox-16a-lv", family="jbox", f=feat(leads=L16), kw={},
             parts=["ZUMMESH-JBOX-16A-LV", "ZUMMESH-JBOX-16A-LV-EM", "ZUMMESH-JBOX-5A-LV"],
             basis="ASSUMPTION: jbox, no wired ports (Zum Mesh is RF), leads L,N,LOAD,0-10+,0-10- copied from ZUMLINK-JBOX-16A-LV"),
        dict(id="zummesh-jbox-20a-plug", family="jbox", f=feat(leads=L20), kw={},
             parts=["ZUMMESH-JBOX-20A-PLUG", "ZUMMESH-JBOX-20A-SW"],
             basis="ASSUMPTION: jbox, no wired ports, leads L,N,LOAD copied from ZUMLINK-JBOX-20A-PLUG"),
        dict(id="zummesh-kp10a", family="wallbox", f=feat(leads=LKP), kw=dict(kind="keypad", btn=4, intl=False),
             parts=["ZUMMESH-KP10A", "ZUMMESH-KP10B"],
             basis="ASSUMPTION: keypad wallbox, 4 buttons (build.py keypad rule), leads L,N,GND copied from ZUMMESH-KP"),
    ]


ALIASED = [  # part -> (existing library symbol id, basis)
    *[(f"ZUMLINK-BTN{n}", "button-rocker",
       "ASSUMPTION: maps to the ZUMLINK-BTN symbol (spec section 7: button caps of the same size share one symbol)")
      for n in (2, 4, 6, 8)],
    *[(f"ZUMMESH-KP10{c}BATT", "zummesh-kpbatt",
       "ASSUMPTION: look-alike of ZUMMESH-KPBATT (spec section 7); library draws every keypad with 4 buttons")
      for c in "ABCD"],
    ("ZUMMESH-PIR-OCC-BATT", "gls-oir-csm-ex-batt",
     "FACT: catalog.js alias of ZUMMESH-PIR-OCCUPANCY-BATT, which uses this library symbol"),
    ("ZUMMESH-PIR-VAC-BATT", "gls-oir-csm-ex-batt",
     "ASSUMPTION: abbreviation of ZUMMESH-PIR-VACANCY-BATT, which uses this library symbol"),
]

# Generic rules for unknown part numbers. Entry matches when (re == "" or /re/i.test(part)) and
# (category == null or category == the catalog category of the part). First match wins.
# Port counts are ASSUMPTIONS: only what the part-number prefix implies (spec section 2 table).
GENERIC_SYMBOLS = [  # (id, family, features, kwargs, basis)
    ("generic-zumnet-jbox", "jbox", feat(ports(net=2, link=2)), {}, "rule 1 ZUMNET-*: jbox, Net x2 and Link x2 (port counts ASSUMED from the part prefix)"),
    ("generic-link-sensor", "ceiling", feat(ports(link=2)), dict(shape="round"), "rules 2a/2b ZUMLINK sensor: ceiling, Link x2 (count ASSUMED)"),
    ("generic-link-keypad", "wallbox", feat(ports(link=2)), dict(kind="keypad", btn=4, intl=False), "rules 3a/3b ZUMLINK keypad: wallbox keypad, Link x2 (count ASSUMED)"),
    ("generic-link-jbox", "jbox", feat(ports(link=2)), {}, "rule 4 ZUMLINK-*: jbox, Link x2 (count ASSUMED)"),
    ("generic-processor", "processor", feat(), {}, "rule 5 HUB: processor, no ports"),
    ("generic-switch", "bridge", feat(), dict(w=180), "rule 6 switch: bridge, no ports"),
    ("generic-sensor", "ceiling", feat(), dict(shape="round"), "rules 7a/7b sensor: ceiling, no ports"),
    ("generic-keypad", "wallbox", feat(), dict(kind="keypad", btn=4, intl=False), "rules 8a/8b keypad: wallbox keypad, no ports"),
    ("generic-jbox", "jbox", feat(), {}, "rule 9 JBOX: jbox, no ports"),
    ("generic-din", "din", feat(), {}, "rule 10 DIN: DIN module, no ports"),
    ("generic-device", "bridge", feat(), {}, "rule 11 catch-all: bridge template (status LEDs), never a bare rectangle"),
]
GENERIC_RULES = [  # (re, category, symbol id)
    ("^ZUMNET-", None, "generic-zumnet-jbox"),
    ("^ZUMLINK-.*(DLS|PIR|OCC|VAC)", None, "generic-link-sensor"),
    ("^ZUMLINK-", "sensor", "generic-link-sensor"),
    ("^ZUMLINK-.*(KP|BTN)", None, "generic-link-keypad"),
    ("^ZUMLINK-", "keypad", "generic-link-keypad"),
    ("^ZUMLINK-", None, "generic-link-jbox"),
    ("HUB", None, "generic-processor"),
    ("^CEN-SW|SWPOE", None, "generic-switch"),
    ("SENS|PIR|OCC|VAC|PHOTO", None, "generic-sensor"),
    ("", "sensor", "generic-sensor"),
    ("KP", None, "generic-keypad"),
    ("", "keypad", "generic-keypad"),
    ("JBOX", None, "generic-jbox"),
    ("DIN", None, "generic-din"),
    ("", None, "generic-device"),
]


def resolve(data, part, category=None):
    """Python mirror of the documented lookup rules; used by the self-check."""
    key = (part or "").strip().upper()
    if key in data["parts"]:
        return data["parts"][key], False
    for g in data["generic"]:
        if (g["re"] == "" or re.search(g["re"], key, re.I)) and (g["category"] is None or g["category"] == category):
            return g["id"], True
    raise BuildError("generic[] has no catch-all")


# ----------------------------------------------------------------------------- build
def read_sources():
    quoted, texts = set(), {}
    for name in SOURCES:
        t = (REPO / name).read_text(encoding="utf-8")
        texts[name] = t
        quoted |= set(QUOTED.findall(t))
    cat = json.loads(texts["catalog.js"].split("=", 1)[1].strip().rstrip(";"))
    return quoted, cat["products"]


def build(library):
    D = load_draw(library)
    lj_bytes = (library / "library.json").read_bytes()
    lj = json.loads(lj_bytes.decode("utf-8"))
    quoted, catalog = read_sources()

    lib_parts = {p["part"].upper(): p["symbol"][:-4] for p in lj["products"] if p["symbol"]}
    needed = {stem for part, stem in lib_parts.items() if SUBSET_PREFIX.match(part) or part in quoted}
    needed |= {sid for _, sid, _ in ALIASED} | {"zum-hub4", "zumnet-jbox-16a-lv", "zumlink-jbox-16a-lv", "gla-dt-quattro-com1-24"}

    # every library symbol file, read once (needed for lead colours); only `needed` ones ship
    files = {}
    for f in sorted((library / "symbols").glob("*.svg")):
        vb, body = strip_svg(f.read_text(encoding="utf-8"), f.name)
        files[f.stem] = (vb, body)
    missing = sorted(n for n in needed if n not in files)
    if missing:
        raise BuildError(f"symbol files missing from the library: {missing}")

    # fidelity self-test: draw.py reproduces two shipped library symbols exactly, so the templates are called correctly
    pj = next(p for p in lj["products"] if p["part"] == "ZUMLINK-JBOX-16A-LV")
    fj = feat(ports(**{k: v for k, v in pj["features"]["ports"].items() if k != "dc"}),
              lv=pj["features"]["lv"], leads=sibling_leads(files, lj, "ZUMLINK-JBOX-16A-LV"))
    if D.jbox(fj) != files["zumlink-jbox-16a-lv"]:
        raise BuildError("draw.py jbox does not reproduce zumlink-jbox-16a-lv: generator and library disagree")
    fk = feat(leads=sibling_leads(files, lj, "ZUMMESH-KP"))
    if D.wallbox(fk, kind="rocker", intl=False) != files["zummesh-kp"]:  # the library draws ZUMMESH-KP as a rocker wallbox
        raise BuildError("draw.py wallbox does not reproduce zummesh-kp: generator and library disagree")

    symbols, assumptions, notes = {}, {}, []
    for sid in sorted(needed):
        vb, body = files[sid]
        body, ids = prefix_ids(sid, body)
        if ids:
            notes.append(f"{sid}: ids {ids} prefixed")
        symbols[sid] = (vb, body, "library")
    fam = {p["symbol"][:-4]: p["family"] for p in lj["products"] if p["symbol"]}
    families = {sid: fam.get(sid, "") for sid in symbols}

    parts = {part: stem for part, stem in sorted(lib_parts.items()) if stem in needed}

    by_body = {}  # (vb, body) -> id, so identical drawings are stored once
    for sid, (vb, body, _) in symbols.items():
        by_body.setdefault((vb, body), sid)

    def add_drawn(t, origin, aid=None):
        vb, body = getattr(D, t["family"])(t["f"], **t["kw"])
        body, ids = prefix_ids(t["id"], body)
        sid = t["id"]
        same = by_body.get((vb, body))
        if same and same != sid:
            notes.append(f"{sid}: identical drawing to {same}, shares it")
            return same
        symbols[sid] = (vb, body, origin)
        families[sid] = t["family"]
        by_body[(vb, body)] = sid
        return sid

    for t in drawn_templates(D, files, lj):
        sid = add_drawn(t, "template")
        for p in t["parts"]:
            if p in parts:
                raise BuildError(f"{p} is in the library; it should not be pre-drawn")
            parts[p] = sid
            assumptions[p] = t["basis"] + ("" if sid == t["id"] else f" (stored as {sid})")
    for part, sid, basis in ALIASED:
        if part in parts:
            raise BuildError(f"{part} is in the library; it should not be aliased")
        parts[part] = sid
        assumptions[part] = basis

    # catalog aliases resolve to their model's symbol (FACT: catalog.js)
    for prod in catalog:
        model = prod["model"].upper()
        for a in prod.get("aliases", []):
            a = a.upper()
            if a not in parts and model in parts:
                parts[a] = parts[model]
                assumptions[a] = f"FACT: catalog.js alias of {model}"
    # SW-HUB4-PROG etc. are deliberately not drawn
    for p, why in NOT_DRAWN.items():
        assumptions[p] = "NOT DRAWN: " + why

    generic_ids = {}
    for gid, family, f, kw, basis in GENERIC_SYMBOLS:
        sid = add_drawn(dict(id=gid, family=family, f=f, kw=kw), "generic")
        generic_ids[gid] = sid
        assumptions[gid] = "ASSUMPTION: " + basis + ("" if sid == gid else f" (stored as {sid})")
    generic = [{"re": r, "category": c, "id": generic_ids[g]} for r, c, g in GENERIC_RULES]
    # alias ids that were folded into another symbol still have to exist: they point at the shared id

    sym_out = {}
    for sid in sorted(symbols):
        vb, body, origin = symbols[sid]
        n = parse_viewbox(vb)
        sym_out[sid] = {"viewBox": vb, "w": num(n[2]), "h": num(n[3]), "family": families.get(sid, ""),
                        "origin": origin, "body": body}
    data = {
        "version": lj["generated"],
        "source": {"librarySha256": hashlib.sha256(lj_bytes).hexdigest(), "command": COMMAND},
        "symbols": sym_out,
        "parts": dict(sorted(parts.items())),
        "generic": generic,
        "assumptions": dict(sorted(assumptions.items())),
    }
    return data, quoted, catalog, notes


def render_js(data):
    n_lib = sum(1 for s in data["symbols"].values() if s["origin"] == "library")
    head = f"""/* one-line-symbols.js - GENERATED FILE, DO NOT EDIT BY HAND.
 *
 * Symbol bundle for the Zum Wiring One-Line drawing (spec rev 2, sections 6 and 7).
 * Generated by tools/build_one_line_symbols.py from the Crestron device symbol library
 * (library.json generated {data["version"]}, sha256 {data["source"]["librarySha256"]}).
 * Rebuild (from the repo root, needs the library under jrs/software-engineering/inputs-2026-11-23/symbol-library):
 *     {COMMAND}
 * Check without writing:  {COMMAND} --check
 *
 * Contents: {len(data["symbols"])} symbols ({n_lib} from the library, the rest pre-drawn with the library generator),
 * {len(data["parts"])} part numbers, {len(data["generic"])} generic rules, {len(data["assumptions"])} recorded bases.
 *
 * Lookup: key = part.trim().toUpperCase(); parts[key] if present (a catalog alias resolves through
 * CRESTRON_CATALOG first, then parts[]); otherwise the first generic[] entry for which
 * (re === "" || new RegExp(re, "i").test(key)) && (category === null || category === the catalog category).
 * Symbol bodies are the library SVG inner markup, geometry untouched. The library's outer <svg> carries
 * font-family "Helvetica Neue, Helvetica, Arial, sans-serif", which the drawing's root <svg> must also set.
 * assumptions values start with FACT, ASSUMPTION or NOT DRAWN and give the basis for each pre-drawn symbol.
 */
"use strict";
"""
    j = lambda v: json.dumps(v, ensure_ascii=False, separators=(",", ":"))
    lines = ["const ONE_LINE_SYMBOLS = Object.freeze({",
             f'  "version": {j(data["version"])},',
             f'  "source": {j(data["source"])},',
             '  "symbols": {']
    items = list(data["symbols"].items())
    for i, (k, v) in enumerate(items):
        lines.append(f"    {j(k)}: {j(v)}" + ("," if i < len(items) - 1 else ""))
    lines.append("  },")
    pr = list(data["parts"].items())
    lines.append('  "parts": {')
    for i, (k, v) in enumerate(pr):
        lines.append(f"    {j(k)}: {j(v)}" + ("," if i < len(pr) - 1 else ""))
    lines.append("  },")
    lines.append('  "generic": [')
    for i, g in enumerate(data["generic"]):
        lines.append(f"    {j(g)}" + ("," if i < len(data["generic"]) - 1 else ""))
    lines.append("  ],")
    ass = list(data["assumptions"].items())
    lines.append('  "assumptions": {')
    for i, (k, v) in enumerate(ass):
        lines.append(f"    {j(k)}: {j(v)}" + ("," if i < len(ass) - 1 else ""))
    lines.append("  }")
    lines.append("});")
    return (head + "\n".join(lines) + "\n").encode("utf-8")


# ----------------------------------------------------------------------------- checks
def validate(data, quoted, catalog):
    errs = []
    syms = data["symbols"]
    for sid, s in syms.items():
        if not re.fullmatch(r"[a-z0-9-]+", sid):
            errs.append(f"{sid}: id is not [a-z0-9-]+")
        try:
            n = parse_viewbox(s["viewBox"])
            if (s["w"], s["h"]) != (num(n[2]), num(n[3])):
                errs.append(f"{sid}: w/h do not match viewBox")
        except (BuildError, ValueError) as e:
            errs.append(f"{sid}: {e}")
        errs += scan_body(sid, s["body"])
        if not s["body"].strip():
            errs.append(f"{sid}: empty body")
    # ids inside bodies must not collide across symbols
    seen = {}
    for sid, s in syms.items():
        for i in re.findall(r'\bid="([^"]*)"', s["body"]):
            if i in seen and seen[i] != sid:
                errs.append(f"id {i!r} appears in both {seen[i]} and {sid}")
            seen[i] = sid
    for gid, vb in GUARANTEED.items():
        if gid not in syms:
            errs.append(f"guaranteed symbol {gid} is missing")
        elif syms[gid]["viewBox"] != vb:
            errs.append(f"{gid}: viewBox {syms[gid]['viewBox']} != contract {vb}")
    for part, sid in data["parts"].items():
        if part != part.upper():
            errs.append(f"parts key {part} is not upper case")
        if sid not in syms:
            errs.append(f"part {part} -> {sid}: no such symbol")
    for g in data["generic"]:
        if g["id"] not in syms:
            errs.append(f"generic rule {g['re']!r}: no such symbol {g['id']}")
        try:
            re.compile(g["re"])
        except re.error as e:
            errs.append(f"generic regex {g['re']!r} does not compile: {e}")
    if data["generic"][-1] != {"re": "", "category": None, "id": data["generic"][-1]["id"]}:
        errs.append("last generic rule is not the catch-all")
    # every part string the app can produce resolves to a shipped, non-generic symbol
    drawn = {}
    for prod in catalog:
        drawn[prod["model"].upper()] = prod["category"]
        for a in prod.get("aliases", []):
            drawn[a.upper()] = prod["category"]
    for q in sorted(quoted):
        if q in NOT_DRAWN:
            continue
        if PART_LIKE.match(q) or q in drawn:
            sid, generic = resolve(data, q, drawn.get(q))
            if generic or sid not in syms:
                errs.append(f"app part {q} resolves to {'a generic' if generic else 'nothing'}; expected a mapped symbol")
    # sample lookups for the generic rules
    samples = [("ZZZ-OTHER", None, "generic-device"), ("", None, "generic-device"), ("Other", None, "generic-device"),
               ("ZUMNET-FOO", None, "generic-zumnet-jbox"), ("ZUMLINK-FOO-DLS", None, "generic-link-sensor"),
               ("ZUMLINK-FOO", "sensor", "generic-link-sensor"), ("ZUMLINK-FOO-KP", None, "generic-link-keypad"),
               ("ZUMLINK-FOO", "keypad", "generic-link-keypad"), ("ZUMLINK-FOO", None, "generic-link-jbox"),
               ("XX-HUB9", None, "generic-processor"), ("CEN-SW-9", None, "generic-switch"),
               ("XX-OCC", None, "generic-sensor"), ("QQ", "sensor", "generic-sensor"), ("XX-KP9", None, "generic-keypad"),
               ("QQ", "keypad", "generic-keypad"), ("XX-JBOX", None, "generic-jbox"), ("XX-DIN-9", None, "generic-din")]
    for part, cat, want in samples:
        try:
            got = resolve(data, part, cat)[0]
        except BuildError as e:
            errs.append(str(e))
            continue
        # compare through the rule table (ids may have been folded into an identical drawing)
        want_id = dict((r[2], g["id"]) for r, g in zip(GENERIC_RULES, data["generic"]))[want]
        if got != want_id:
            errs.append(f"lookup({part!r},{cat!r}) = {got}, expected {want_id}")
    for k in data["assumptions"]:
        if not (k in data["parts"] or k in NOT_DRAWN or k.startswith("generic-")):
            errs.append(f"assumptions key {k} is not a part or generic id")
    return errs


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--library", type=Path, default=DEFAULT_LIBRARY)
    ap.add_argument("--out", type=Path, default=DEFAULT_OUT)
    ap.add_argument("--check", action="store_true", help="validate and compare with the file on disk; write nothing")
    a = ap.parse_args()
    try:
        data, quoted, catalog, notes = build(a.library.resolve())
        errs = validate(data, quoted, catalog)
        out = render_js(data)
    except (BuildError, OSError, KeyError, ValueError) as e:
        print(f"BUILD FAILED: {e}", file=sys.stderr)
        return 1
    if len(out) > BUDGET_BYTES:
        errs.append(f"size {len(out)} bytes exceeds the {BUDGET_BYTES} byte budget")
    if errs:
        print("BUILD FAILED:", file=sys.stderr)
        for e in errs:
            print("  - " + e, file=sys.stderr)
        return 1
    syms = data["symbols"]
    by_origin = {o: sum(1 for s in syms.values() if s["origin"] == o) for o in ("library", "template", "generic")}
    n_ass = sum(1 for v in data["assumptions"].values() if v.startswith("ASSUMPTION"))
    print(f"symbols shipped : {len(syms)} (library {by_origin['library']}, template {by_origin['template']}, generic {by_origin['generic']})")
    print(f"symbol markup   : {sum(len(s['body'].encode('utf-8')) for s in syms.values())} bytes")
    print(f"file size       : {len(out)} bytes of {BUDGET_BYTES} budget ({len(out) * 100 // BUDGET_BYTES}%)")
    print(f"parts mapped    : {len(data['parts'])}; generic rules: {len(data['generic'])}")
    print(f"assumptions     : {n_ass} ASSUMPTION entries of {len(data['assumptions'])} recorded bases")
    for n in notes:
        print("note            : " + n)
    print(f"sha256          : {hashlib.sha256(out).hexdigest()}")
    if a.check:
        if not a.out.exists() or a.out.read_bytes() != out:
            print(f"CHECK FAILED: {a.out} is missing or stale; rebuild with: {COMMAND}", file=sys.stderr)
            return 1
        print("CHECK OK: validations pass and the file on disk is current")
        return 0
    a.out.write_bytes(out)
    print(f"wrote {a.out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
