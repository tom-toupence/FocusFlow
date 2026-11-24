"use client";
// Canal sûr : transport + signature HMAC + anti-rejeu (lot 7). Les deux côtés
// (ordinateur et téléphone) ne parlent qu'à travers lui.
import { openTransport, transportKind, type RemoteTransport } from "./transport";
import { channelName, cryptoReady, hmacKey, seal, unseal } from "./crypto";
import { makeMessage, ReplayGuard, SKEW_WARN_MS, type RemoteMessage, type RemoteMessageBody } from "./protocol";

export class SecureChannel {
  private guard: ReplayGuard;

  private constructor(private t: RemoteTransport, private key: CryptoKey, calibrate: boolean) {
    // L'ordinateur est la référence d'horloge ; le téléphone s'y cale.
    this.guard = new ReplayGuard(undefined, calibrate ? null : 0);
  }

  /** null : pas de transport ici, ou WebCrypto absent (page servie hors https). */
  static async open(code: string, secret: string, role: "host" | "phone"): Promise<SecureChannel | null> {
    if (!transportKind() || !cryptoReady()) return null;
    const [name, key] = await Promise.all([channelName(code, secret), hmacKey(code, secret)]);
    const t = openTransport(name);
    return t ? new SecureChannel(t, key, role === "phone") : null;
  }

  /** Décalage estimé (téléphone − ordinateur), null avant le premier message signé. */
  get offset(): number | null { return this.guard.offset; }
  get skewed(): boolean { return this.guard.offset != null && Math.abs(this.guard.offset) > SKEW_WARN_MS; }

  /** Envoie un message signé, daté à l'heure de l'ordinateur. */
  async send(body: RemoteMessageBody): Promise<boolean> {
    const msg = makeMessage(body, Date.now() - (this.guard.offset ?? 0));
    return this.t.send(await seal(this.key, msg));
  }

  /** Seuls les messages signés, valides et neufs arrivent au récepteur. */
  onMessage(cb: (m: RemoteMessage) => void): () => void {
    return this.t.onMessage((raw) => {
      void unseal(this.key, raw).then((data) => {
        if (data == null) return;
        const now = Date.now();
        this.guard.calibrate(data, now);
        const m = this.guard.accept(data, now);
        if (m) cb(m);
      });
    });
  }

  close() { this.t.close(); }
}
