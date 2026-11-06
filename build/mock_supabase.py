#!/usr/bin/env python3
"""A small in-memory imitation of the parts of Supabase (PostgREST + Auth + Storage) that the site uses.
It exists ONLY to test js/store.js's remote adapter without a live project. It is NOT a replacement for the real
row-level-security policies in supabase/schema.sql, which must be tested on a real Supabase project."""
import json, re, threading, uuid, os, copy
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs, unquote
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
seed = json.load(open(os.path.join(ROOT, "data/seed.json")))
T = {"brands": copy.deepcopy(seed["brands"]), "products": [], "product_images": [], "homepage_slides": copy.deepcopy(seed["slides"]), "lookbook_images": copy.deepcopy(seed["lookbook"]),
     "site_settings": [{"key": k, "value": v} for k, v in seed["settings"].items()], "orders": [], "order_items": [], "admins": [{"user_id": "u-admin"}]}
for p in seed["products"]:
    imgs = p.pop("images"); T["products"].append(p)
    for im in imgs: T["product_images"].append({**im, "product_id": p["id"]})
SEQ = [1000]; FILES = {}; LOG = []
USERS = {"admin@example.com": ("goodpass", "u-admin"), "shopper@example.com": ("shopperpass", "u-shopper")}
TOKENS = {"tok-u-admin": "u-admin", "tok-u-shopper": "u-shopper"}
def is_admin(uid): return any(a["user_id"] == uid for a in T["admins"])
def pk(t): return "key" if t == "site_settings" else ("user_id" if t == "admins" else "id")
class Err(Exception):
    def __init__(s, code, msg): s.code, s.msg = code, msg
def visible(table, row, admin):
    if admin: return True
    b = {x["id"]: x for x in T["brands"]}
    if table == "brands": return row["visible"]
    if table == "products": return row["published"] and b.get(row["brand_id"], {}).get("visible")
    if table == "product_images": return any(p["id"] == row["product_id"] and p["published"] for p in T["products"])
    if table in ("homepage_slides", "lookbook_images"): return row["visible"]
    if table == "site_settings": return True
    return False                       # orders, order_items, admins: admin only
def place_order(c, items):
    name, phone, addr = (c.get("name") or "").strip(), (c.get("phone") or "").strip(), (c.get("address") or "").strip()
    if len(name) < 2: raise Err(400, "Please enter your full name")
    if not re.fullmatch(r"[0-9+() \-]{7,20}", phone): raise Err(400, "Please enter a valid phone number")
    if len(addr) < 4: raise Err(400, "Please enter a delivery address")
    if not isinstance(items, list) or not items: raise Err(400, "Your bag is empty")
    SEQ[0] += 1; oid = str(uuid.uuid4()); lines = []; sub = 0.0; stock = {}
    brands = {x["id"]: x for x in T["brands"]}
    for it in items:
        p = next((x for x in T["products"] if x["id"] == it.get("product_id")), None); q = int(it.get("quantity", 0))
        if not p or not p["published"] or not brands[p["brand_id"]]["visible"] or brands[p["brand_id"]]["coming_soon"] or p["availability"] != "available": raise Err(400, "An item in your bag is no longer available")
        if not 1 <= q <= 50: raise Err(400, "Invalid quantity")
        if p["sizes"] and it.get("size") not in p["sizes"]: raise Err(400, "Please choose a size for " + p["name"])
        if p["stock"] is not None:
            stock[p["id"]] = stock.get(p["id"], p["stock"]) - q
            if stock[p["id"]] < 0: raise Err(400, "Not enough stock for " + p["name"])
        lines.append({"id": str(uuid.uuid4()), "order_id": oid, "product_id": p["id"], "brand_id": p["brand_id"], "product_name": p["name"], "size": it.get("size") or None, "unit_price": p["price"], "quantity": q, "line_total": round(p["price"] * q, 2)}); sub += p["price"] * q
    for pid, s in stock.items(): next(x for x in T["products"] if x["id"] == pid)["stock"] = s
    T["orders"].insert(0, {"id": oid, "order_number": f"ORD-{SEQ[0]}", "status": "pending", "payment_status": "unpaid", "payment_reference": None, "customer_name": name, "phone": phone, "email": c.get("email") or None, "address": addr, "notes": c.get("notes") or None, "subtotal": round(sub, 2), "total": round(sub, 2), "created_at": "2026-11-04T12:00:00+00:00"})
    T["order_items"] += lines; return {"order_number": f"ORD-{SEQ[0]}", "total": round(sub, 2)}
class H(BaseHTTPRequestHandler):
    def log_message(s, *a): pass
    def cors(s): s.send_header("Access-Control-Allow-Origin", "*"); s.send_header("Access-Control-Allow-Headers", "*"); s.send_header("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS"); s.send_header("Access-Control-Expose-Headers", "*")
    def out(s, code, body=None, ctype="application/json"):
        data = b"" if body is None else (body if isinstance(body, bytes) else json.dumps(body).encode()); s.send_response(code); s.cors(); s.send_header("Content-Type", ctype); s.send_header("Content-Length", str(len(data))); s.end_headers(); s.wfile.write(data)
    def user(s):
        a = s.headers.get("Authorization", ""); t = a.replace("Bearer ", ""); return TOKENS.get(t)
    def do_OPTIONS(s): s.send_response(204); s.cors(); s.end_headers()
    def body(s): n = int(s.headers.get("Content-Length") or 0); return s.rfile.read(n) if n else b""
    def do_GET(s): s.go("GET")
    def do_POST(s): s.go("POST")
    def do_PATCH(s): s.go("PATCH")
    def do_DELETE(s): s.go("DELETE")
    def go(s, m):
        try: s.route(m)
        except Err as e: s.out(e.code, {"message": e.msg})
        except Exception as e: s.out(500, {"message": "mock error: " + repr(e)})
    def route(s, m):
        u = urlparse(s.path); q = {k: v[0] for k, v in parse_qs(u.query, keep_blank_values=True).items()}; path = unquote(u.path); LOG.append((m, path))
        if s.headers.get("apikey") != "anon-key" and not path.startswith("/storage/v1/object/public/"): raise Err(401, "No API key found in request")   # public bucket URLs need no key
        if path == "/auth/v1/token":
            b = json.loads(s.body() or b"{}")
            if q.get("grant_type") == "password":
                e = USERS.get(b.get("email"))
                if not e or e[0] != b.get("password"): return s.out(400, {"error_description": "Invalid login credentials"})
                return s.out(200, {"access_token": "tok-" + e[1], "refresh_token": "ref-" + e[1], "expires_in": 3600, "user": {"id": e[1], "email": b["email"]}})
            if q.get("grant_type") == "refresh_token": return s.out(200, {"access_token": "tok-u-admin", "refresh_token": "ref-u-admin", "expires_in": 3600})
        uid = s.user(); admin = bool(uid) and is_admin(uid)
        mm = re.match(r"/storage/v1/object/(public/)?site-media/(.+)", path)
        if mm:
            if m == "GET": return s.out(200, FILES[mm.group(2)][1], FILES[mm.group(2)][0]) if mm.group(2) in FILES else s.out(404, {"message": "not found"})
            if not admin: raise Err(403, "new row violates row-level security policy")
            ct = s.headers.get("Content-Type", "")
            if ct not in ("image/jpeg", "image/png", "image/webp"): raise Err(415, "mime type not supported")
            FILES[mm.group(2)] = (ct, s.body()); return s.out(200, {"Key": "site-media/" + mm.group(2)})
        if path == "/rest/v1/rpc/place_order": b = json.loads(s.body()); return s.out(200, place_order(b["p_customer"], b["p_items"]))
        mt = re.match(r"/rest/v1/(\w+)$", path)
        if not mt or mt.group(1) not in T: raise Err(404, "relation does not exist")
        t = mt.group(1); rows = T[t]; flt = {k: v for k, v in q.items() if k not in ("select", "order", "limit", "on_conflict") and v.startswith("eq.")}
        def match(r): return all(str(r.get(k)) == v[3:] for k, v in flt.items())
        if m == "GET":
            out = [copy.deepcopy(r) for r in rows if match(r) and visible(t, r, admin)]
            if q.get("order"): col, d = q["order"].split("."); out.sort(key=lambda r: (r.get(col) is None, r.get(col)), reverse=(d == "desc"))
            sel = q.get("select", "*")
            if "product_images(" in sel:
                for r in out: r["product_images"] = [{k: i[k] for k in ("id", "url", "position")} for i in T["product_images"] if i["product_id"] == r["id"] and visible("product_images", i, admin)]
            if "order_items(" in sel:
                for r in out: r["order_items"] = [i for i in T["order_items"] if i["order_id"] == r["id"]]
            if q.get("limit"): out = out[:int(q["limit"])]
            return s.out(200, out)
        if not admin: raise Err(401 if not uid else 403, "new row violates row-level security policy for table \"" + t + "\"")
        body = json.loads(s.body() or b"null"); prefer = s.headers.get("Prefer", "")
        if m == "POST":
            lst = body if isinstance(body, list) else [body]; res = []
            for r in lst:
                key = pk(t); ex = next((x for x in rows if key in r and x.get(key) == r[key]), None) if "on_conflict" in q else None
                if ex is not None:
                    if "merge-duplicates" not in prefer: raise Err(409, "duplicate key")
                    ex.update(r); res.append(copy.deepcopy(ex))
                else: rows.append(dict(r)); res.append(copy.deepcopy(r))
            return s.out(201, res if "return=representation" in prefer else None)
        if m == "PATCH":
            for r in rows:
                if match(r): r.update(body)
            return s.out(204)
        if m == "DELETE":
            if not flt: raise Err(400, "DELETE requires a filter")
            T[t][:] = [r for r in rows if not match(r)]
            if t == "products": T["product_images"][:] = [i for i in T["product_images"] if any(p["id"] == i["product_id"] for p in T["products"])]
            return s.out(204)
if __name__ == "__main__": ThreadingHTTPServer(("0.0.0.0", 54321), H).serve_forever()
