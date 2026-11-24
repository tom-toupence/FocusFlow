"use client";
// Canal sûr : transport + scellement AES-GCM + anti-rejeu (lot 7). Les deux côtés
// (ordinateur et téléphone) ne parlent qu'à travers lui.
import { openTransport, transportKind, type RemoteTransport } from "./transport";
import { channelName, cryptoReady, sealKey, seal, unseal } from "./crypto";
import { makeMessage, ReplayGuard, SKEW_WARN_MS, type RemoteMessage, type RemoteMessageBody } from "./protocol";

export class SecureChannel {
  private guard: ReplayGuard;

  /** `challenge` (téléphone) : défi du hello, seul moyen de caler l'horloge. */
  private constructor(private t: RemoteTransport, private key: CryptoKey, private challenge: string | null) {
    // L'ordinateur est la référence d'horloge ; le téléphone s'y cale.
    this.guard = new ReplayGuard(undefined, challenge ? null : 0);
  }

  /** null : pas de transport ici, ou WebCrypto absent (page servie hors https). */
  static async open(code: string, secret: string, opts: { challenge?: string } = {}): Promise<SecureChannel | null> {
    const challenge = opts.challenge ?? null;
    if (!transportKind() || !cryptoReady()) return null;
    const [name, key] = await Promise.all([channelName(code, secret), sealKey(code, secret)]);
    const t = openTransport(name);
    return t ? new SecureChannel(t, key, challenge) : null;
  }

  /** Décalage estimé (téléphone − ordinateur), null avant la réponse au défi. */
  get offset(): number | null { return this.guard.offset; }
  get skewed(): boolean { return this.guard.offset != null && Math.abs(this.guard.offset) > SKEW_WARN_MS; }

  /**
   * Envoie un message scellé, daté à l'heure de l'ordinateur. `sign` complète
   * le message (signature de l'appareil) une fois l'enveloppe posée.
   * false : trop gros, ou pas parti.
   */
  async send(body: RemoteMessageBody, sign?: (m: RemoteMessage) => Promise<RemoteMessage>): Promise<boolean> {
    let msg = makeMessage(body, Date.now() - (this.guard.offset ?? 0)) as RemoteMessage;
    if (sign) msg = await sign(msg);
    const sealed = await seal(this.key, msg);
    return sealed ? this.t.send(sealed) : false;
  }

  /** Seuls les messages authentiques (GCM), valides et neufs arrivent au récepteur. */
  onMessage(cb: (m: RemoteMessage) => void): () => void {
    return this.t.onMessage((raw) => {
      void unseal(this.key, raw).then((data) => {
        if (data == null) return;
        const now = Date.now();
        if (this.challenge) this.guard.calibrate(data, this.challenge, now);
        const m = this.guard.accept(data, now);
        if (m) cb(m);
      });
    });
  }

  close() { this.t.close(); }
}
