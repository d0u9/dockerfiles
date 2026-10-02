"""Shared code of the ops commands: the DigitalOcean and Cloudflare APIs.

The commands talk to both APIs over HTTPS directly instead of driving doctl,
so a refusal arrives as a status code and an error id rather than as text to
match, and an action is followed by its id until DigitalOcean reports it done.
doctl stays in the image for everything these commands do not cover.
"""

import ipaddress
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

PROG = os.path.basename(sys.argv[0])


class Failure(Exception):
    """A problem to report on one line and exit 1 for."""


def die(message):
    raise Failure(message)


def warn(message):
    print(f"warning: {message}", file=sys.stderr)


def note(message):
    print(message, file=sys.stderr)


def run(main):
    """Run a command's main(): failures print one line, Ctrl-C exits 130."""
    try:
        sys.exit(main(sys.argv[1:]) or 0)
    except Failure as e:
        print(f"{PROG}: {e}", file=sys.stderr)
        sys.exit(1)
    except APIError as e:
        print(f"{PROG}: API refused: {e}", file=sys.stderr)
        sys.exit(1)
    except KeyboardInterrupt:
        print(file=sys.stderr)
        sys.exit(130)


def confirm(prompt, assume_yes=False):
    if assume_yes:
        return True
    try:
        return input(f"{prompt} [y/N] ").strip().lower() in ("y", "yes")
    except EOFError:
        return False


def canonical_ip(text):
    """Return (version, RFC 5952 text) for any spelling of an address.

    DigitalOcean and Cloudflare need not print one IPv6 address the same way
    (leading zeros, where "::" goes, case), so addresses are compared in this
    form only.
    """
    try:
        addr = ipaddress.ip_address(text.strip())
    except ValueError:
        die(f"not an IP address: {text}")
    return addr.version, addr.compressed


def same_ip(a, b):
    try:
        return ipaddress.ip_address(a.strip()) == ipaddress.ip_address(b.strip())
    except ValueError:
        return False


class APIError(Exception):
    def __init__(self, status, code, message):
        super().__init__(f"{status} {code}: {message}")
        self.status = status
        self.code = code
        self.message = message


def _request(url, method, token, body=None):
    data = None if body is None else json.dumps(body).encode()
    req = urllib.request.Request(url, data=data, method=method, headers={
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "Accept": "application/json",
        "User-Agent": "ops-toolbox",
    })
    # Rate limiting and server errors are waited out; other refusals return
    # to the caller, which decides what is temporary.
    for attempt in range(6):
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                raw = resp.read()
                return resp.status, (json.loads(raw) if raw else {})
        except urllib.error.HTTPError as e:
            raw = e.read()
            try:
                payload = json.loads(raw) if raw else {}
            except ValueError:
                payload = {"message": raw.decode(errors="replace")[:200]}
            if (e.code == 429 or e.code >= 500) and attempt < 5:
                time.sleep(min(2 ** attempt, 20))
                continue
            return e.code, payload
        except (urllib.error.URLError, TimeoutError) as e:
            if attempt < 5:
                time.sleep(min(2 ** attempt, 20))
                continue
            die(f"cannot reach {urllib.parse.urlsplit(url).netloc}: {e}")
    raise AssertionError("unreachable")


# ---------------------------------------------------------------- DigitalOcean

class DigitalOcean:
    """The reserved IP and droplet calls the commands need.

    IPv4 and IPv6 reserved addresses are separate resources with differently
    named fields: /v2/reserved_ips with "region": {"slug"} and "reserved_ip",
    /v2/reserved_ipv6 with "region_slug" and "reserved_ipv6". Both are exposed
    here as plain dicts {ip, region, droplet_id, droplet_name}.
    """

    API = "https://api.digitalocean.com/v2"

    def __init__(self):
        self.token = os.environ.get("DIGITALOCEAN_ACCESS_TOKEN", "")
        if not self.token:
            die("locked; run ops-unlock first")

    def call(self, method, path, body=None):
        status, payload = _request(self.API + path, method, self.token, body)
        if status >= 400:
            raise APIError(status, payload.get("id", ""), payload.get("message", ""))
        return payload

    def pages(self, path, key):
        sep = "&" if "?" in path else "?"
        url = f"{path}{sep}per_page=200"
        out = []
        while url:
            payload = self.call("GET", url)
            out.extend(payload.get(key) or [])
            nxt = (payload.get("links") or {}).get("pages", {}).get("next")
            url = nxt[len(self.API):] if nxt else None
        return out

    # droplets

    def droplets(self):
        return [{
            "id": d["id"],
            "name": d["name"],
            "region": d["region"]["slug"],
            "status": d["status"],
            "ipv6": bool(d.get("networks", {}).get("v6")),
            "public_v4": next((n["ip_address"] for n in d.get("networks", {}).get("v4", [])
                               if n.get("type") == "public"), ""),
            "public_v6": next((n["ip_address"] for n in d.get("networks", {}).get("v6", [])
                               if n.get("type") == "public"), ""),
        } for d in self.pages("/droplets", "droplets")]

    def find_droplet(self, target):
        droplets = self.droplets()
        if target.isdigit():
            match = [d for d in droplets if d["id"] == int(target)]
        else:
            match = [d for d in droplets if d["name"] == target]
        if not match:
            die(f"no droplet {target}")
        if len(match) > 1:
            die(f"several droplets are named {target}; use its ID")
        return match[0]

    # reserved addresses

    @staticmethod
    def _base(version):
        return "/reserved_ipv6" if version == 6 else "/reserved_ips"

    @classmethod
    def _path(cls, ip, suffix=""):
        """The resource path of an address, spelled as given.

        The address goes into the URL exactly as DigitalOcean printed it, with
        its colons unescaped as doctl sends them: the API is not known to
        accept another spelling of the same IPv6 address.
        """
        version, _ = canonical_ip(ip)
        return f"{cls._base(version)}/{urllib.parse.quote(ip.strip(), safe=':')}{suffix}"

    @staticmethod
    def _plain(r):
        d = r.get("droplet") or {}
        return {
            "ip": r["ip"],
            "region": r.get("region_slug") or (r.get("region") or {}).get("slug", ""),
            "droplet_id": d.get("id"),
            "droplet_name": d.get("name", ""),
        }

    def reserved(self, version):
        key = "reserved_ipv6s" if version == 6 else "reserved_ips"
        return [self._plain(r) for r in self.pages(self._base(version), key)]

    def get_reserved(self, ip):
        """Look an address up in any spelling; the result carries DigitalOcean's."""
        version, canon = canonical_ip(ip)
        for r in self.reserved(version):
            if same_ip(r["ip"], canon):
                ip = r["ip"]
                break
        else:
            die(f"no reserved IP {canon}")
        key = "reserved_ipv6" if version == 6 else "reserved_ip"
        try:
            payload = self.call("GET", self._path(ip))
        except APIError as e:
            if e.status == 404:
                die(f"no reserved IP {ip}")
            raise
        return self._plain(payload[key])

    def held_by(self, version, droplet_id):
        """The addresses of one family on a droplet, spelled as DigitalOcean does."""
        return [r["ip"] for r in self.reserved(version) if r["droplet_id"] == droplet_id]

    def create_reserved(self, version, region):
        if version == 6:
            payload = self.call("POST", "/reserved_ipv6", {"region_slug": region})
            return self._plain(payload["reserved_ipv6"])["ip"]
        payload = self.call("POST", "/reserved_ips", {"region": region})
        return self._plain(payload["reserved_ip"])["ip"]

    def delete_reserved(self, ip):
        self.call("DELETE", self._path(ip))

    def assign(self, ip, droplet_id):
        self._act(ip, {"type": "assign", "droplet_id": droplet_id})

    def unassign(self, ip):
        self._act(ip, {"type": "unassign"})

    def _act(self, ip, body, settle=120, finish=180):
        """Start an assign or unassign and wait until its action completes.

        The address can show the new droplet before the droplet's own event is
        over, and the next request is then refused with 422 "pending event";
        an address created moments ago can still be unknown to the actions
        endpoint (404). Both are retried for `settle` seconds. The action is
        then polled until it is "completed"; "errored" or no end within
        `finish` seconds is a failure.
        """
        path = self._path(ip, "/actions")
        deadline = time.monotonic() + settle
        told = False
        while True:
            try:
                action = self.call("POST", path, body)["action"]
                break
            except APIError as e:
                temporary = e.status == 404 or (e.status == 422 and "pending" in e.message.lower())
                if not temporary or time.monotonic() > deadline:
                    raise
                if not told:
                    note("DigitalOcean not ready yet, retrying...")
                    told = True
                time.sleep(4)
        self.wait(action["id"], finish)

    def wait(self, action_id, finish=180):
        deadline = time.monotonic() + finish
        while True:
            status = self.call("GET", f"/actions/{action_id}")["action"]["status"]
            if status == "completed":
                return
            if status == "errored":
                die(f"action {action_id} errored; check: doctl compute action get {action_id}")
            if time.monotonic() > deadline:
                die(f"action {action_id} did not finish within {finish}s; "
                    f"check: doctl compute action get {action_id}")
            time.sleep(3)


# ------------------------------------------------------------------ Cloudflare

class Cloudflare:
    API = "https://api.cloudflare.com/client/v4"

    def __init__(self):
        self.token = os.environ.get("CLOUDFLARE_API_TOKEN", "")
        if not self.token:
            die("no CLOUDFLARE_API_TOKEN; run ops-unlock, or ops-paste with a Cloudflare token")

    def call(self, method, path, body=None):
        status, payload = _request(self.API + path, method, self.token, body)
        if status >= 400 or not payload.get("success", False):
            errors = payload.get("errors") or [{"code": status, "message": "request failed"}]
            first = errors[0]
            raise APIError(status, first.get("code", ""), "; ".join(
                f"{e.get('code')} {e.get('message')}" for e in errors))
        return payload

    def zones(self):
        out, page = [], 1
        while True:
            payload = self.call("GET", f"/zones?per_page=50&page={page}")
            out.extend({"id": z["id"], "name": z["name"]} for z in payload["result"])
            if page >= (payload.get("result_info") or {}).get("total_pages", 1):
                return out
            page += 1

    def records(self, zone_id, rtype):
        out, page = [], 1
        while True:
            payload = self.call("GET", f"/zones/{zone_id}/dns_records?type={rtype}&per_page=1000&page={page}")
            out.extend(payload["result"])
            if page >= (payload.get("result_info") or {}).get("total_pages", 1):
                return out
            page += 1

    def find(self, ip):
        """All A or AAAA records, in every zone the token sees, naming `ip`.

        Every record of the family is fetched and compared as an address, so
        another spelling of the same IPv6 address still matches.
        """
        version, ip = canonical_ip(ip)
        rtype = "AAAA" if version == 6 else "A"
        zones = self.zones()
        if not zones:
            die("the token cannot see any zone; it needs Zone: Read")
        found = []
        for z in zones:
            for r in self.records(z["id"], rtype):
                if same_ip(r["content"], ip):
                    found.append({"zone_id": z["id"], "zone": z["name"], "id": r["id"],
                                  "name": r["name"], "type": rtype, "proxied": r.get("proxied", False)})
        return zones, found

    def repoint(self, record, ip):
        self.call("PATCH", f"/zones/{record['zone_id']}/dns_records/{record['id']}",
                  {"type": record["type"], "content": ip})


# ------------------------------------------------------------- shared steps

def parse(argv, help_text, flags):
    """Split argv into (set of flags given, positional args).

    -h/--help prints help_text and exits 0; an unknown option prints a hint
    and exits 2. `flags` lists the options the command accepts.
    """
    given, args = set(), []
    for a in argv:
        if a in ("-h", "--help"):
            print(help_text.strip("\n"))
            sys.exit(0)
        if a.startswith("-") and len(a) > 1:
            if a not in flags:
                print(f"{PROG}: unknown option {a}; see {PROG} --help", file=sys.stderr)
                sys.exit(2)
            given.add(a)
        else:
            args.append(a)
    return given, args


def usage_error(help_text):
    print(help_text.strip("\n"), file=sys.stderr)
    sys.exit(2)


def repoint_dns(old, new=None, assume_yes=False):
    """List the records naming `old`; with `new`, confirm and repoint them.

    Returns the number of records that failed to update.
    """
    cf = Cloudflare()
    old_v, old = canonical_ip(old)
    if new is not None:
        new_v, new = canonical_ip(new)
        if new_v != old_v:
            die(f"{old} and {new} are not the same IP family")
    zones, records = cf.find(old)
    rtype = "AAAA" if old_v == 6 else "A"
    if not records:
        print(f"no {rtype} record points at {old} in {len(zones)} zone(s)")
        return 0
    print(f"{rtype} records pointing at {old}:")
    for r in records:
        print(f"  {r['name']:<40} {'proxied' if r['proxied'] else 'dns-only'}")
    if new is None:
        return 0
    if not confirm(f"Change them to {new}?", assume_yes):
        die("cancelled")
    failed = 0
    for r in records:
        try:
            cf.repoint(r, new)
            print(f"updated {r['name']}")
        except APIError as e:
            print(f"FAILED  {r['name']}: cloudflare {e.message}", file=sys.stderr)
            failed += 1
    if failed:
        note(f"{failed} record(s) not updated; run again: ops-dns {old} {new}")
    else:
        print("done. Clients see the change after the record's TTL; proxied records change at once.")
    return failed
