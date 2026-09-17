#!/usr/bin/env python3
"""
build.py — assemble one self-contained dashboard.html from the template.

Usage:
    python3 build.py --config config.js --data data.json [--logo logo.png] [--out dashboard.html]

Inputs:
    config.js   the per-dataset CONFIG (must define `const CONFIG = {...}`)
    data.json   tidy rows: [{period, path[], value, unit, flow}, ...]
    logo.png    optional; injected as base64 into CONFIG.brand.logoDataUri
Output:
    dashboard.html   single portable file (Chart.js + fonts load from CDN)
"""
import argparse, base64, json, re, sys, pathlib

def read(p): return pathlib.Path(p).read_text(encoding="utf-8")

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--config", required=True)
    ap.add_argument("--data", required=True)
    ap.add_argument("--logo", default=None)
    ap.add_argument("--engine", default="engine.js")
    ap.add_argument("--shell", default="shell.html")
    ap.add_argument("--out", default="dashboard.html")
    a = ap.parse_args()

    here = pathlib.Path(__file__).parent
    config_js = read(a.config)
    engine_js = read(here / a.engine)
    shell     = read(here / a.shell)

    # data -> compact columnar JS const (series catalog once + aligned value arrays).
    # ~20x smaller than tidy rows for large datasets; engine accepts either.
    data = json.loads(read(a.data))
    if isinstance(data, list):
        periods = sorted({r["period"] for r in data})
        pidx = {p:i for i,p in enumerate(periods)}
        series = {}
        for r in data:
            k = tuple(r["path"])
            if k not in series:
                series[k] = {"path":list(r["path"]), "unit":r["unit"], "flow":bool(r.get("flow",False)),
                             "v":[None]*len(periods)}
            series[k]["v"][pidx[r["period"]]] = r["value"]
        compact = {"periods":periods, "series":list(series.values())}
    else:
        compact = data   # already compact
    data_js = "const DATA=" + json.dumps(compact, separators=(",",":"), ensure_ascii=False) + ";"

    # logo -> data URI, injected into CONFIG (so engine + PNG + header share it)
    logo_uri = ""
    if a.logo:
        b64 = base64.b64encode(pathlib.Path(a.logo).read_bytes()).decode()
        logo_uri = "data:image/png;base64," + b64
    logo_js = "const LOGO_DATA_URI=" + json.dumps(logo_uri) + ";"

    # pull a few values out of config for the shell (font, ids)
    def cfg_val(key, default=""):
        m = re.search(r"%s\s*:\s*\"([^\"]*)\"" % re.escape(key), config_js)
        return m.group(1) if m else default
    font   = cfg_val("font", "Poppins") or "Poppins"
    ga4    = cfg_val("ga4MeasurementId")
    sacct  = cfg_val("senderAccountId")
    sform  = cfg_val("senderFormId")

    # config -> JS (ensure it defines CONFIG at top level; strip trailing semicolon dupes ok)
    config_block = config_js
    if "const CONFIG" not in config_block:
        sys.exit("config file must define `const CONFIG = {...}`")

    # assemble engine: replace injection markers
    engine_full = (engine_js
        .replace("__CONFIG__", config_block)
        .replace("__DATA__", data_js)
        .replace("__LOGO__", logo_js))

    # conditional head snippets
    ga4_head = ""
    if ga4:
        ga4_head = (
            '<script async src="https://www.googletagmanager.com/gtag/js?id=%s"></script>\n'
            '<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}'
            "gtag('js',new Date());gtag('config','%s');</script>" % (ga4, ga4))
    sender_head = ""
    gate_modal = ""
    if sacct and sform:
        sender_head = (
            "<script>(function(s,e,n,d,er){s['Sender']=er;s[er]=s[er]||function(){(s[er].q=s[er].q||[]).push(arguments)},"
            "s[er].l=1*new Date();s[er].on=function(ev,cb){s[er].listeners=s[er].listeners||{};(s[er].listeners[ev]=s[er].listeners[ev]||[]).push(cb);};"
            "var a=e.createElement(n),m=e.getElementsByTagName(n)[0];a.async=1;a.src=d;m.parentNode.insertBefore(a,m)})"
            "(window,document,'script','https://cdn.sender.net/accounts_resources/universal.js','sender');sender('%s')</script>" % sacct)
        gate_modal = (
            '<div id="gateOverlay" class="gate-overlay" style="display:none">'
            '<div class="gate-card" role="dialog" aria-modal="true">'
            '<button class="gate-close" id="gateClose" aria-label="Close">×</button>'
            '<div style="text-align:left" class="sender-form-field" data-sender-form-id="%s"></div>'
            '<button class="gate-continue" id="gateContinue">Close</button>'
            '</div></div>' % sform)

    logo_img = '<img id="brandLogo" class="brand-logo" alt="logo">' if a.logo else ""

    html = (shell
        .replace("__FONT__", font)
        .replace("__GA4_HEAD__", ga4_head)
        .replace("__SENDER_HEAD__", sender_head)
        .replace("__GATE_MODAL__", gate_modal)
        .replace("__LOGO_IMG__", logo_img)
        .replace("__ENGINE__", engine_full))

    pathlib.Path(a.out).write_text(html, encoding="utf-8")
    print("Wrote %s (%d bytes)" % (a.out, len(html)))
    print("  data rows:", len(data), "| ga4:", bool(ga4), "| gate:", bool(sacct and sform), "| logo:", bool(a.logo))

if __name__ == "__main__":
    main()
