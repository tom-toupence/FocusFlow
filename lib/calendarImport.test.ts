import { describe, it, expect } from "vitest";
import { normalizeIcalUrl, ICAL_URL_MAX } from "./icalUrl";
import {
  isBlockedAddress,
  hostProblem,
  pickPublicAddress,
  redirectTarget,
  fetchIcsText,
  expandIPv6,
  rateLimiter,
  sameOrigin,
  ImportError,
  type FetchDeps,
  type RawResponse,
} from "./calendarImport";

const ICS = "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nEND:VCALENDAR\r\n";

describe("normalizeIcalUrl", () => {
  it("accepte https et convertit webcal en https", () => {
    expect(normalizeIcalUrl(" https://calendar.google.com/calendar/ical/x/basic.ics ")).toEqual({
      ok: true,
      url: "https://calendar.google.com/calendar/ical/x/basic.ics",
    });
    expect(normalizeIcalUrl("webcal://p01-caldav.icloud.com/published/2/abc")).toEqual({
      ok: true,
      url: "https://p01-caldav.icloud.com/published/2/abc",
    });
    expect(normalizeIcalUrl("WEBCAL://outlook.office365.com/owa/calendar/a/b/calendar.ics").ok).toBe(true);
  });

  it("refuse http, ftp, file, javascript, le vide et le texte libre", () => {
    for (const u of ["http://example.com/a.ics", "ftp://example.com/a.ics", "file:///etc/passwd", "javascript:alert(1)", "", "   ", "pas une adresse"]) {
      expect(normalizeIcalUrl(u).ok).toBe(false);
    }
  });

  it("refuse les identifiants, les ports exotiques et les adresses trop longues", () => {
    expect(normalizeIcalUrl("https://user:pass@example.com/a.ics").ok).toBe(false);
    expect(normalizeIcalUrl("https://example.com:8080/a.ics").ok).toBe(false);
    expect(normalizeIcalUrl("https://example.com:443/a.ics").ok).toBe(true);
    expect(normalizeIcalUrl("https://example.com/" + "a".repeat(ICAL_URL_MAX)).ok).toBe(false);
  });

  it("retire le fragment", () => {
    expect(normalizeIcalUrl("https://example.com/a.ics#x")).toEqual({ ok: true, url: "https://example.com/a.ics" });
  });
});

describe("anti-SSRF : adresses", () => {
  it("refuse les IPv4 privées, locales et réservées", () => {
    for (const ip of [
      "127.0.0.1", "10.1.2.3", "172.16.0.1", "172.31.255.255", "192.168.1.1", "169.254.169.254",
      "0.0.0.0", "100.64.0.1", "224.0.0.1", "255.255.255.255", "198.18.0.1", "192.0.2.10",
    ]) expect(isBlockedAddress(ip), ip).toBe(true);
  });

  it("accepte les IPv4 publiques", () => {
    for (const ip of ["8.8.8.8", "142.250.74.14", "172.32.0.1", "1.1.1.1"]) expect(isBlockedAddress(ip), ip).toBe(false);
  });

  it("refuse les IPv6 locales, privées, mappées sur une IPv4 privée", () => {
    for (const ip of [
      "::1", "::", "fe80::1", "fc00::1", "fd12:3456::1", "ff02::1", "::ffff:127.0.0.1", "::ffff:10.0.0.1",
      "::ffff:7f00:1", "::ffff:0:127.0.0.1", "::ffff:0:10.0.0.1", "::ffff:0:a9fe:a9fe", "64:ff9b::a00:1", "2001:db8::1", "2002:c0a8:101::1", "fec0::1",
    ]) expect(isBlockedAddress(ip), ip).toBe(true);
  });

  it("accepte les IPv6 publiques (et une IPv4 publique mappée)", () => {
    for (const ip of ["2a00:1450:4007:80c::200e", "2606:4700:4700::1111", "::ffff:8.8.8.8", "::ffff:0:8.8.8.8"]) {
      expect(isBlockedAddress(ip), ip).toBe(false);
    }
  });

  it("refuse ce qui n'est pas une adresse", () => {
    expect(isBlockedAddress("example.com")).toBe(true);
    expect(isBlockedAddress("")).toBe(true);
  });

  it("développe les IPv6 abrégées", () => {
    expect(expandIPv6("::1")).toEqual([0, 0, 0, 0, 0, 0, 0, 1]);
    expect(expandIPv6("::ffff:1.2.3.4")).toEqual([0, 0, 0, 0, 0, 0xffff, 0x0102, 0x0304]);
    expect(expandIPv6("1::2::3")).toBeNull();
  });
});

describe("anti-SSRF : hôtes", () => {
  it("refuse les hôtes sans point et les noms locaux", () => {
    for (const h of ["localhost", "intranet", "metadata", "foo.localhost", "nas.local", "db.internal", "box.lan", "router.home.arpa"]) {
      expect(hostProblem(h), h).toBe("blocked_host");
    }
  });

  it("refuse les IP littérales privées, accepte les publiques et les noms ordinaires", () => {
    expect(hostProblem("127.0.0.1")).toBe("blocked_host");
    expect(hostProblem("[::1]")).toBe("blocked_host");
    expect(hostProblem("8.8.8.8")).toBeNull();
    expect(hostProblem("calendar.google.com")).toBeNull();
    expect(hostProblem("calendar.google.com.")).toBeNull();
  });

  it("une seule adresse DNS privée suffit à refuser l'hôte", () => {
    expect(() => pickPublicAddress([{ address: "8.8.8.8", family: 4 }, { address: "10.0.0.1", family: 4 }])).toThrow(ImportError);
    expect(() => pickPublicAddress([])).toThrow(ImportError);
    expect(pickPublicAddress([{ address: "8.8.8.8", family: 4 }])).toEqual({ address: "8.8.8.8", family: 4 });
  });

  it("redirections : relatives résolues, http et ports exotiques refusés", () => {
    expect(redirectTarget("https://a.example.com/x/y.ics", "/z.ics")).toBe("https://a.example.com/z.ics");
    expect(() => redirectTarget("https://a.example.com/", "http://b.example.com/")).toThrow(ImportError);
    expect(() => redirectTarget("https://a.example.com/", "https://b.example.com:22/")).toThrow(ImportError);
    expect(() => redirectTarget("https://a.example.com/", undefined)).toThrow(ImportError);
  });
});

/** Faux transport : DNS et réponses par URL. */
function fakeDeps(dns: Record<string, string[]>, responses: Record<string, RawResponse | (() => Promise<RawResponse>)>, extra: Partial<FetchDeps> = {}) {
  const calls: { url: string; address: string }[] = [];
  const deps: FetchDeps = {
    resolve: async (h) => {
      if (!dns[h]) throw new Error("ENOTFOUND");
      return dns[h].map((address) => ({ address, family: address.includes(":") ? 6 : 4 }));
    },
    requestOnce: async (url, address) => {
      calls.push({ url, address: address.address });
      const r = responses[url];
      if (!r) throw new Error("ECONNREFUSED");
      return typeof r === "function" ? r() : r;
    },
    ...extra,
  };
  return { deps, calls };
}

const code = async (p: Promise<unknown>) => {
  try {
    await p;
    return "ok";
  } catch (e) {
    return e instanceof ImportError ? e.code : "other";
  }
};

describe("fetchIcsText", () => {
  it("lit un flux public et se connecte à l'adresse vérifiée", async () => {
    const { deps, calls } = fakeDeps({ "cal.example.com": ["93.184.216.34"] }, { "https://cal.example.com/a.ics": { status: 200, body: ICS } });
    await expect(fetchIcsText("webcal://cal.example.com/a.ics", deps)).resolves.toBe(ICS);
    expect(calls).toEqual([{ url: "https://cal.example.com/a.ics", address: "93.184.216.34" }]);
  });

  it("refuse un hôte qui résout vers une adresse privée (sans jamais s'y connecter)", async () => {
    const { deps, calls } = fakeDeps({ "evil.example.com": ["127.0.0.1"] }, {});
    expect(await code(fetchIcsText("https://evil.example.com/a.ics", deps))).toBe("blocked_host");
    expect(calls).toHaveLength(0);
  });

  it("revérifie chaque redirection : vers une IP privée, refusé", async () => {
    const { deps, calls } = fakeDeps(
      { "cal.example.com": ["93.184.216.34"], "inside.example.com": ["10.0.0.5"] },
      { "https://cal.example.com/a.ics": { status: 302, location: "https://inside.example.com/secret" } },
    );
    expect(await code(fetchIcsText("https://cal.example.com/a.ics", deps))).toBe("blocked_host");
    expect(calls).toHaveLength(1);
  });

  it("redirection vers http ou vers 169.254.169.254 : refusée", async () => {
    const a = fakeDeps({ "cal.example.com": ["93.184.216.34"] }, { "https://cal.example.com/a.ics": { status: 301, location: "http://cal.example.com/a.ics" } });
    expect(await code(fetchIcsText("https://cal.example.com/a.ics", a.deps))).toBe("blocked_host");
    const b = fakeDeps({ "cal.example.com": ["93.184.216.34"] }, { "https://cal.example.com/a.ics": { status: 307, location: "https://169.254.169.254/latest/meta-data" } });
    expect(await code(fetchIcsText("https://cal.example.com/a.ics", b.deps))).toBe("blocked_host");
  });

  it("au plus 3 redirections", async () => {
    const r = (n: number): RawResponse => ({ status: 302, location: `https://cal.example.com/${n}` });
    const ok = fakeDeps(
      { "cal.example.com": ["93.184.216.34"] },
      { "https://cal.example.com/0": r(1), "https://cal.example.com/1": r(2), "https://cal.example.com/2": r(3), "https://cal.example.com/3": { status: 200, body: ICS } },
    );
    await expect(fetchIcsText("https://cal.example.com/0", ok.deps)).resolves.toBe(ICS);
    const tooMany = fakeDeps(
      { "cal.example.com": ["93.184.216.34"] },
      { "https://cal.example.com/0": r(1), "https://cal.example.com/1": r(2), "https://cal.example.com/2": r(3), "https://cal.example.com/3": r(4) },
    );
    expect(await code(fetchIcsText("https://cal.example.com/0", tooMany.deps))).toBe("too_many_redirects");
  });

  it("erreurs lisibles : 401/404 refusé, 500, pas un agenda, hôte inconnu, adresse invalide", async () => {
    const d = fakeDeps(
      { "cal.example.com": ["93.184.216.34"] },
      {
        "https://cal.example.com/401": { status: 401 },
        "https://cal.example.com/404": { status: 404 },
        "https://cal.example.com/500": { status: 500 },
        "https://cal.example.com/html": { status: 200, body: "<html>login</html>" },
      },
    );
    expect(await code(fetchIcsText("https://cal.example.com/401", d.deps))).toBe("refused");
    expect(await code(fetchIcsText("https://cal.example.com/404", d.deps))).toBe("refused");
    expect(await code(fetchIcsText("https://cal.example.com/500", d.deps))).toBe("upstream");
    expect(await code(fetchIcsText("https://cal.example.com/html", d.deps))).toBe("not_ics");
    expect(await code(fetchIcsText("https://nowhere.example.com/a.ics", d.deps))).toBe("dns");
    expect(await code(fetchIcsText("http://cal.example.com/a.ics", d.deps))).toBe("invalid_url");
    expect(await code(fetchIcsText("https://localhost/a.ics", d.deps))).toBe("blocked_host");
    expect(new ImportError("refused").message).toBe("Adresse refusée par l'agenda.");
  });

  it("délai dépassé : timeout", async () => {
    const d = fakeDeps(
      { "cal.example.com": ["93.184.216.34"] },
      { "https://cal.example.com/slow": () => new Promise<RawResponse>(() => {}) },
      { timeoutMs: 30 },
    );
    expect(await code(fetchIcsText("https://cal.example.com/slow", d.deps))).toBe("timeout");
  });
});

describe("garde-fous de la route", () => {
  it("limite de débit : 20 par minute et par IP", () => {
    let t = 0;
    const allow = rateLimiter(20, 60_000, () => t);
    for (let i = 0; i < 20; i++) expect(allow("1.2.3.4")).toBe(true);
    expect(allow("1.2.3.4")).toBe(false);
    expect(allow("5.6.7.8")).toBe(true);
    t = 60_001;
    expect(allow("1.2.3.4")).toBe(true);
  });

  it("même origine quand l'en-tête est présent", () => {
    const self = "https://focusflow.app";
    expect(sameOrigin(null, null, self, "focusflow.app")).toBe(true);
    expect(sameOrigin("https://focusflow.app", null, self, "focusflow.app")).toBe(true);
    expect(sameOrigin(null, "https://focusflow.app/session", self, "focusflow.app")).toBe(true);
    expect(sameOrigin("https://evil.example.com", null, self, "focusflow.app")).toBe(false);
    expect(sameOrigin(null, "https://evil.example.com/x", self, "focusflow.app")).toBe(false);
    expect(sameOrigin("null", null, self, "focusflow.app")).toBe(false);
    // Derrière un proxy, l'origine interne diffère : l'hôte annoncé fait foi.
    expect(sameOrigin("http://localhost:3107", null, "http://0.0.0.0:3107", "localhost:3107")).toBe(true);
  });
});
