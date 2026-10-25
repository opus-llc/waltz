import dns from "node:dns";
import http from "node:http";
import https from "node:https";
import net from "node:net";
import { MAX_IMAGE_BYTES, sniffImage } from "../image-sniff";

/**
 * 元サイトから画像を取得する。取り込みファイルに書かれた URL は信用できないため、
 * サーバー内部への到達（SSRF）を次の方法で防ぐ。
 * - http / https のみ。ユーザー名・パスワード付き URL と 80/443 以外のポートは拒否
 * - 接続先 IP を名前解決の時点で検査し、検査した IP にそのまま接続する（DNS rebinding 対策）
 * - リダイレクトは3回まで、毎回同じ検査をやり直す
 * - 5MB を超えた時点で打ち切る。15秒で打ち切る
 */
export type FetchedImage = { buf: Buffer; ext: string; mime: string };
export class ImageFetchError extends Error {}

const MAX_REDIRECTS = 3;
const TIMEOUT_MS = 15_000;
const UA = "waltz-wp-import/0.1 (+https://github.com/opus-llc/waltz)";

/** 外へ出てよいアドレスか。ループバック・プライベート・リンクローカル（クラウドのメタデータ 169.254.169.254 を含む）などを拒否 */
export function isPublicAddress(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b, c] = ip.split(".").map(Number);
    if (a === 0 || a === 10 || a === 127) return false;
    if (a === 100 && b >= 64 && b <= 127) return false; // CGNAT
    if (a === 169 && b === 254) return false; // リンクローカル・メタデータ
    if (a === 172 && b >= 16 && b <= 31) return false;
    if (a === 192 && b === 168) return false;
    if (a === 192 && b === 0 && (c === 0 || c === 2)) return false;
    if (a === 198 && (b === 18 || b === 19)) return false;
    if (a === 198 && b === 51 && c === 100) return false;
    if (a === 203 && b === 0 && c === 113) return false;
    if (a >= 224) return false; // マルチキャスト・予約
    return true;
  }
  if (net.isIPv6(ip)) {
    const v = ip.toLowerCase();
    const mapped = v.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPublicAddress(mapped[1]);
    if (/^::ffff:[0-9a-f]{1,4}:[0-9a-f]{1,4}$/.test(v)) {
      const [hi, lo] = v.slice(7).split(":").map((h) => Number.parseInt(h, 16));
      return isPublicAddress(`${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`);
    }
    if (v === "::" || v === "::1") return false;
    const first = Number.parseInt(v.split(":")[0] || "0", 16);
    if ((first & 0xfe00) === 0xfc00) return false; // fc00::/7 ユニークローカル
    if ((first & 0xffc0) === 0xfe80) return false; // fe80::/10 リンクローカル
    if ((first & 0xff00) === 0xff00) return false; // マルチキャスト
    if (v.startsWith("64:ff9b:") || v.startsWith("2001:db8:") || v.startsWith("2002:")) return false;
    return true;
  }
  return false;
}

/** 名前解決の結果を検査してから返す lookup。接続はここで返した IP に対して行われる */
const guardedLookup: net.LookupFunction = (hostname, options, callback) => {
  dns.lookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) return callback(err, "", 0);
    const list = addresses as dns.LookupAddress[];
    const bad = list.find((a) => !isPublicAddress(a.address));
    if (bad || list.length === 0) {
      return callback(Object.assign(new Error("内部ネットワークのアドレスには接続しません"), { code: "EBLOCKED" }), "", 0);
    }
    if ((options as dns.LookupOptions).all) return (callback as unknown as (e: null, a: dns.LookupAddress[]) => void)(null, list);
    callback(null, list[0].address, list[0].family);
  });
};

export function checkImageUrl(raw: string): URL {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new ImageFetchError("URL が正しくありません");
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") throw new ImageFetchError("http / https 以外の URL です");
  if (u.username || u.password) throw new ImageFetchError("認証情報付きの URL です");
  if (u.port && u.port !== "80" && u.port !== "443") throw new ImageFetchError("80/443 以外のポートです");
  const host = u.hostname.replace(/^\[|\]$/g, "");
  if (net.isIP(host) && !isPublicAddress(host)) throw new ImageFetchError("内部ネットワークのアドレスです");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal") || host.endsWith(".local"))
    throw new ImageFetchError("内部ネットワークのホスト名です");
  return u;
}

function getOnce(u: URL): Promise<{ status: number; location?: string; buf?: Buffer }> {
  return new Promise((resolve, reject) => {
    const mod = u.protocol === "https:" ? https : http;
    const req = mod.get(
      u,
      { lookup: guardedLookup, headers: { "User-Agent": UA, Accept: "image/*" }, timeout: TIMEOUT_MS },
      (res) => {
        const status = res.statusCode ?? 0;
        if (status >= 300 && status < 400) {
          res.resume();
          return resolve({ status, location: res.headers.location });
        }
        if (status !== 200) {
          res.resume();
          return resolve({ status });
        }
        const declared = Number(res.headers["content-length"] ?? 0);
        if (declared > MAX_IMAGE_BYTES) {
          res.destroy();
          return reject(new ImageFetchError("5MB を超えています"));
        }
        const chunks: Buffer[] = [];
        let size = 0;
        res.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > MAX_IMAGE_BYTES) {
            res.destroy();
            reject(new ImageFetchError("5MB を超えています"));
            return;
          }
          chunks.push(chunk);
        });
        res.on("end", () => resolve({ status, buf: Buffer.concat(chunks) }));
        res.on("error", reject);
      },
    );
    req.on("timeout", () => req.destroy(new ImageFetchError("15秒以内に応答がありません")));
    req.on("error", (e) => reject(e instanceof ImageFetchError ? e : new ImageFetchError((e as NodeJS.ErrnoException).code === "EBLOCKED" ? e.message : `取得できません（${(e as NodeJS.ErrnoException).code ?? e.message}）`)));
  });
}

export async function fetchImage(raw: string): Promise<FetchedImage> {
  let u = checkImageUrl(raw);
  for (let i = 0; i <= MAX_REDIRECTS; i++) {
    const r = await getOnce(u);
    if (r.location) {
      if (i === MAX_REDIRECTS) throw new ImageFetchError("リダイレクトが多すぎます");
      u = checkImageUrl(new URL(r.location, u).toString());
      continue;
    }
    if (!r.buf) throw new ImageFetchError(`HTTP ${r.status}`);
    const kind = sniffImage(r.buf);
    if (!kind) throw new ImageFetchError("jpg / png / webp / gif の画像ではありません");
    return { buf: r.buf, ...kind };
  }
  throw new ImageFetchError("リダイレクトが多すぎます");
}
