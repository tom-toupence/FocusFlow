import { describe, expect, it } from "vitest";
import { parseIcsBusy, zonedToEpoch } from "./icsRead";

const wrap = (...events: string[]) =>
  ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Google Inc//Google Calendar 70.9054//EN", ...events, "END:VCALENDAR"].join("\r\n");
const ev = (...lines: string[]) => ["BEGIN:VEVENT", ...lines, "END:VEVENT"].join("\r\n");

const from = Date.UTC(2026, 5, 10, 0, 0); // mer. 10 juin 2026 00:00Z
const to = from + 2 * 86400_000;
const TZ = { timeZone: "Europe/Paris" };
// 10 juin 2026 : Paris = UTC+2 (heure d'été)
const paris = (d: number, h: number, m = 0) => Date.UTC(2026, 5, d, h - 2, m);

describe("zonedToEpoch", () => {
  it("été et hiver à Paris", () => {
    expect(zonedToEpoch(Date.UTC(2026, 5, 10, 15), "Europe/Paris")).toBe(Date.UTC(2026, 5, 10, 13));
    expect(zonedToEpoch(Date.UTC(2026, 0, 10, 15), "Europe/Paris")).toBe(Date.UTC(2026, 0, 10, 14));
  });
  it("New York", () => {
    expect(zonedToEpoch(Date.UTC(2026, 5, 10, 9), "America/New_York")).toBe(Date.UTC(2026, 5, 10, 13));
  });
});

describe("parseIcsBusy", () => {
  it("TZID Europe/Paris", () => {
    const ics = wrap(
      ev(
        "DTSTART;TZID=Europe/Paris:20260610T150000",
        "DTEND;TZID=Europe/Paris:20260610T160000",
        "SUMMARY:Point équipe",
        "TRANSP:OPAQUE",
        "STATUS:CONFIRMED",
      ),
    );
    expect(parseIcsBusy(ics, from, to)).toEqual([{ start: paris(10, 15), end: paris(10, 16), title: "Point équipe" }]);
  });

  it("UTC (Z)", () => {
    const ics = wrap(ev("DTSTART:20260610T130000Z", "DTEND:20260610T140000Z", "SUMMARY:Call"));
    expect(parseIcsBusy(ics, from, to)).toEqual([
      { start: Date.UTC(2026, 5, 10, 13), end: Date.UTC(2026, 5, 10, 14), title: "Call" },
    ]);
  });

  it("date flottante : fuseau fourni", () => {
    const ics = wrap(ev("DTSTART:20260610T150000", "DTEND:20260610T153000"));
    expect(parseIcsBusy(ics, from, to, TZ)).toEqual([{ start: paris(10, 15), end: paris(10, 15, 30) }]);
  });

  it("dépliage des lignes (RFC 5545)", () => {
    const ics = wrap(
      "BEGIN:VEVENT\r\nDTSTART:20260610T130000Z\r\nDTEND:20260610T140000Z\r\nSUMMARY:Revue du trimestre avec\r\n  toute l'équipe\\, finance incluse\r\nEND:VEVENT",
    );
    const r = parseIcsBusy(ics, from, to);
    expect(r[0].title).toBe("Revue du trimestre avec toute l'équipe, finance incluse");
  });

  it("journée entière ignorée", () => {
    const ics = wrap(ev("DTSTART;VALUE=DATE:20260610", "DTEND;VALUE=DATE:20260611", "SUMMARY:Férié"));
    expect(parseIcsBusy(ics, from, to)).toEqual([]);
  });

  it("DURATION sans DTEND", () => {
    const ics = wrap(ev("DTSTART:20260610T130000Z", "DURATION:PT1H30M"));
    const r = parseIcsBusy(ics, from, to);
    expect(r[0].end - r[0].start).toBe(90 * 60_000);
  });

  it("TRANSPARENT et CANCELLED ignorés", () => {
    const ics = wrap(
      ev("DTSTART:20260610T130000Z", "DTEND:20260610T140000Z", "TRANSP:TRANSPARENT"),
      ev("DTSTART:20260610T150000Z", "DTEND:20260610T160000Z", "STATUS:CANCELLED"),
      ev("DTSTART:20260610T170000Z", "DTEND:20260610T180000Z"),
    );
    expect(parseIcsBusy(ics, from, to)).toHaveLength(1);
  });

  it("hors intervalle ignoré, chevauchement conservé", () => {
    const ics = wrap(
      ev("DTSTART:20260609T220000Z", "DTEND:20260610T010000Z", "SUMMARY:Veille"),
      ev("DTSTART:20260609T100000Z", "DTEND:20260609T110000Z", "SUMMARY:Hier"),
      ev("DTSTART:20260620T100000Z", "DTEND:20260620T110000Z", "SUMMARY:Plus tard"),
    );
    expect(parseIcsBusy(ics, from, to).map((e) => e.title)).toEqual(["Veille"]);
  });

  it("horizon limité à 2 jours", () => {
    const ics = wrap(ev("DTSTART:20260614T100000Z", "DTEND:20260614T110000Z"));
    expect(parseIcsBusy(ics, from, from + 10 * 86400_000)).toEqual([]);
  });

  it("RRULE WEEKLY BYDAY avec TZID, commencée il y a des semaines", () => {
    // stand-up lun/mer/ven 09:30-09:45 depuis le 5 janvier 2026
    const ics = wrap(
      ev(
        "DTSTART;TZID=Europe/Paris:20260105T093000",
        "DTEND;TZID=Europe/Paris:20260105T094500",
        "RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR",
        "SUMMARY:Stand-up",
      ),
    );
    const r = parseIcsBusy(ics, from, to, TZ);
    // 10 juin = mercredi, 11 = jeudi : une seule occurrence, à 09:30 heure d'été
    expect(r).toEqual([{ start: paris(10, 9, 30), end: paris(10, 9, 45), title: "Stand-up" }]);
  });

  it("RRULE WEEKLY INTERVAL=2", () => {
    // mercredi, toutes les 2 semaines à partir du 27 mai : 27/5, 10/6 OK
    const a = wrap(ev("DTSTART:20260527T100000Z", "DTEND:20260527T110000Z", "RRULE:FREQ=WEEKLY;INTERVAL=2"));
    expect(parseIcsBusy(a, from, to)).toHaveLength(1);
    // à partir du 3 juin : 3/6, 17/6 -> rien le 10
    const b = wrap(ev("DTSTART:20260603T100000Z", "DTEND:20260603T110000Z", "RRULE:FREQ=WEEKLY;INTERVAL=2"));
    expect(parseIcsBusy(b, from, to)).toHaveLength(0);
  });

  it("RRULE DAILY avec COUNT épuisé / non épuisé", () => {
    const base = ["DTSTART:20260608T100000Z", "DTEND:20260608T110000Z"];
    // 8, 9, 10 -> COUNT=3 inclut le 10
    expect(parseIcsBusy(wrap(ev(...base, "RRULE:FREQ=DAILY;COUNT=3")), from, to)).toHaveLength(1);
    // COUNT=2 : 8 et 9 seulement
    expect(parseIcsBusy(wrap(ev(...base, "RRULE:FREQ=DAILY;COUNT=2")), from, to)).toHaveLength(0);
  });

  it("RRULE DAILY : 2 jours dans l'horizon", () => {
    const ics = wrap(ev("DTSTART:20260601T100000Z", "DTEND:20260601T103000Z", "RRULE:FREQ=DAILY"));
    expect(parseIcsBusy(ics, from, to)).toHaveLength(2);
  });

  it("RRULE UNTIL", () => {
    const base = ["DTSTART:20260601T100000Z", "DTEND:20260601T103000Z"];
    expect(parseIcsBusy(wrap(ev(...base, "RRULE:FREQ=DAILY;UNTIL=20260609T235959Z")), from, to)).toHaveLength(0);
    expect(parseIcsBusy(wrap(ev(...base, "RRULE:FREQ=DAILY;UNTIL=20260610T120000Z")), from, to)).toHaveLength(1);
    expect(parseIcsBusy(wrap(ev(...base, "RRULE:FREQ=DAILY;UNTIL=20260610")), from, to)).toHaveLength(1);
  });

  it("EXDATE retire une occurrence", () => {
    const ics = wrap(
      ev(
        "DTSTART;TZID=Europe/Paris:20260101T140000",
        "DTEND;TZID=Europe/Paris:20260101T150000",
        "RRULE:FREQ=DAILY",
        "EXDATE;TZID=Europe/Paris:20260610T140000",
      ),
    );
    const r = parseIcsBusy(ics, from, to, TZ);
    expect(r).toHaveLength(1);
    expect(r[0].start).toBe(paris(11, 14));
  });

  it("instance modifiée (RECURRENCE-ID) remplace l'originale", () => {
    const ics = wrap(
      ev(
        "UID:abc@google.com",
        "DTSTART;TZID=Europe/Paris:20260603T140000",
        "DTEND;TZID=Europe/Paris:20260603T150000",
        "RRULE:FREQ=WEEKLY",
        "SUMMARY:Hebdo",
      ),
      ev(
        "UID:abc@google.com",
        "RECURRENCE-ID;TZID=Europe/Paris:20260610T140000",
        "DTSTART;TZID=Europe/Paris:20260610T160000",
        "DTEND;TZID=Europe/Paris:20260610T170000",
        "SUMMARY:Hebdo (décalé)",
      ),
    );
    const r = parseIcsBusy(ics, from, to, TZ);
    expect(r).toEqual([{ start: paris(10, 16), end: paris(10, 17), title: "Hebdo (décalé)" }]);
  });

  it("occurrence récurrente à l'heure d'hiver convertie correctement", () => {
    const w = Date.UTC(2026, 0, 14, 0); // mercredi en hiver
    const ics = wrap(
      ev("DTSTART;TZID=Europe/Paris:20251001T100000", "DTEND;TZID=Europe/Paris:20251001T110000", "RRULE:FREQ=WEEKLY"),
    );
    const r = parseIcsBusy(ics, w, w + 86400_000, TZ);
    expect(r[0].start).toBe(Date.UTC(2026, 0, 14, 9)); // 10:00 Paris = 09:00Z
  });

  it("fixture Google Calendar réaliste", () => {
    const ics = [
      "BEGIN:VCALENDAR",
      "PRODID:-//Google Inc//Google Calendar 70.9054//EN",
      "VERSION:2.0",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "X-WR-TIMEZONE:Europe/Paris",
      "BEGIN:VTIMEZONE",
      "TZID:Europe/Paris",
      "BEGIN:DAYLIGHT",
      "TZOFFSETFROM:+0100",
      "TZOFFSETTO:+0200",
      "TZNAME:CEST",
      "DTSTART:19700329T020000",
      "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU",
      "END:DAYLIGHT",
      "END:VTIMEZONE",
      "BEGIN:VEVENT",
      "DTSTART;TZID=Europe/Paris:20260610T110000",
      "DTEND;TZID=Europe/Paris:20260610T120000",
      "DTSTAMP:20260601T080000Z",
      "UID:1@google.com",
      "SEQUENCE:0",
      "STATUS:CONFIRMED",
      "SUMMARY:Rendez-vous médecin",
      "TRANSP:OPAQUE",
      "END:VEVENT",
      "BEGIN:VEVENT",
      "DTSTART;VALUE=DATE:20260610",
      "DTEND;VALUE=DATE:20260611",
      "UID:2@google.com",
      "SUMMARY:Anniversaire Paul",
      "TRANSP:TRANSPARENT",
      "END:VEVENT",
      "END:VCALENDAR",
      "",
    ].join("\r\n");
    const r = parseIcsBusy(ics, from, to);
    expect(r).toEqual([{ start: paris(10, 11), end: paris(10, 12), title: "Rendez-vous médecin" }]);
  });

  it("entrée vide ou invalide", () => {
    expect(parseIcsBusy("", from, to)).toEqual([]);
    expect(parseIcsBusy("n'importe quoi", from, to)).toEqual([]);
  });

  it("TZID inconnu : repli sur le fuseau par défaut sans planter", () => {
    const ics = wrap(ev("DTSTART;TZID=W. Europe Standard Time:20260610T150000", "DTEND;TZID=W. Europe Standard Time:20260610T160000"));
    expect(parseIcsBusy(ics, from, to, TZ)).toEqual([{ start: paris(10, 15), end: paris(10, 16) }]);
  });
});
