"""Developer test: screenshots of every public page. Run:  python3 build/shots.py  (needs `pip install playwright` and a Chromium)"""
import time, subprocess, os
from playwright.sync_api import sync_playwright
EXE = os.environ.get("CHROME", "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell")
OUT = os.environ.get("OUT", "/tmp/shots"); os.makedirs(OUT, exist_ok=True)
srv = subprocess.Popen(["python3", "-m", "http.server", "8077"], cwd=os.path.dirname(os.path.dirname(os.path.abspath(__file__))), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1)
errs = []
try:
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path=EXE, args=["--no-sandbox"])
        for name, vp in (("d", dict(width=1440, height=900)), ("m", dict(width=390, height=844))):
            ctx = b.new_context(viewport=vp, has_touch=(name == "m"), is_mobile=(name == "m")); pg = ctx.new_page()
            pg.on("console", lambda m: errs.append((name, m.type, m.text[:160])) if m.type in ("error", "warning") else None)
            pg.on("pageerror", lambda e: errs.append((name, "pageerror", str(e)[:200])))
            for slug, url, wait in (("home", "index.html", 1800), ("lfg", "lads-from-ghana.html", 1200), ("hd", "her-district.html", 1200), ("pdp", "product.html?p=her-district-sleeveless-top", 1200), ("look", "lookbook.html", 1200)):
                pg.goto("http://localhost:8077/" + url); pg.wait_for_timeout(wait); pg.screenshot(path=f"{OUT}/{name}_{slug}.png")
            ctx.close()
        b.close()
finally:
    srv.terminate()
print("console issues:", errs[:12])
