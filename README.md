# waltz（ワルツ）

**オウンドメディアとコミュニティを、ひとつに。**

記事を読んだ人が、そのまま同じサイトで質問し、つながり、イベントに来る。
waltz は、簡易 CMS と会員コミュニティを1つのアプリで持てる、セルフホスト型のオープンソース基盤です。

- **メディア**: 記事・固定ページ・カテゴリ・タグ、Markdown エディタ、画像アップロード、.md 取り込み、予約公開
- **コミュニティ**: カード型タイムライン、テーマ別コミュニティ、イベント、肩書き付きプロフィール、フォロー・いいね・コメント・通知
- **記事 ⇄ コミュニティ**: 記事ページから一言を添えてコミュニティへ共有。記事の下に「この記事について話す」
- **SEO / AIO**: sitemap.xml・robots.txt・RSS・**llms.txt** を自動生成。記事ごとに構造化データ（JSON-LD）と OGP
- **計測**: GA4 測定ID・外部タグURLを管理画面から設定
- **運用が軽い**: データベースは SQLite のファイル1つ。外部サービスの契約は不要

**デモ**: https://waltz-demo-1064284533004.asia-northeast1.run.app （毎朝4時にサンプルデータへ初期化。ログイン情報はログイン画面に表示）

要件定義は [docs/requirements.md](docs/requirements.md) にあります。

## はじめかた（3手順）

Node.js 22 以上が必要です。

```bash
npm install
npm run setup   # データベースを作り、サンプルデータを入れる
npm run dev     # http://localhost:3000
```

サンプルデータのログイン（パスワードはすべて `waltz-demo`。`DEMO_PASSWORD` で変更可）:

| メール | 権限 |
|---|---|
| admin@example.com | 管理者 |
| sakura@example.com | 編集者 |
| hikari@example.com | メンバー |

サンプルデータを入れずに始める場合は `npm run setup` を飛ばしてください。開発環境（`npm run dev`）では、最初に登録したユーザーが管理者になります。

サンプルデータを入れ直す: `npm run seed -- --force`（既存データは消えます）

## 本番で動かす

### Node.js で

```bash
npm ci
npm run build
SITE_URL=https://example.com ADMIN_EMAIL=you@example.com DATA_DIR=/var/lib/waltz node .next/standalone/server.js
```

`.next/standalone` を使う場合は、`.next/static`・`public`・`drizzle` を同じ階層にコピーしてください（Dockerfile と同じ構成）。

### Docker で

```bash
docker build -t waltz .
docker run -p 3000:3000 -v waltz-data:/data -e SITE_URL=https://example.com -e ADMIN_EMAIL=you@example.com waltz
```

空の DB にサンプルデータを入れるときは `-e SEED_DEMO=1` を付けます。誰でも触れる公開デモにするときは `-e DEMO_MODE=1` を付けます（毎朝4時に初期化され、計測タグの設定は無効になります）。

### 最初の管理者

本番では、**環境変数 `ADMIN_EMAIL` と同じメールアドレスで登録した人だけが管理者になります。** 未設定のまま公開すると、誰も管理者になれません（公開直後に第三者が先に登録してサイトを乗っ取るのを防ぐため）。

### サブディレクトリに置く

`https://example.com/media` のように配下へ置く場合は、ビルド時に `NEXT_PUBLIC_BASE_PATH=/media` を指定します（Docker では `--build-arg`）。別ドメインの中継サーバー越しに使う場合は、そのドメインを `SERVER_ACTIONS_ALLOWED_ORIGINS` に入れてください（フォーム送信の送信元確認に使います）。

### バックアップ

`DATA_DIR`（既定 `./data`）の中身がすべてです。`waltz.db`（記事・会員・投稿）と `uploads/`（画像）をコピーしてください。

## 設定（環境変数）

| 変数 | 説明 |
|---|---|
| `SITE_URL` | 公開URL。sitemap・RSS・llms.txt・OGP に使う |
| `ADMIN_EMAIL` | このメールで登録した人を管理者にする（本番では必須） |
| `DATA_DIR` | データ保存先（既定 `./data`） |
| `NEXT_PUBLIC_BASE_PATH` | サブディレクトリに置くときの接頭辞（ビルド時） |
| `SERVER_ACTIONS_ALLOWED_ORIGINS` | 中継サーバーのドメイン（カンマ区切り・ビルド時） |
| `DEMO_PASSWORD` | サンプルデータのパスワード |
| `DEMO_MODE` | `1` で公開デモ用の動きにする（毎朝4時にサンプルデータへ初期化・計測タグ無効・検索エンジン除外・ログイン画面にデモ用アカウントを表示） |

サイト名・テーマカラー・計測IDなどは管理画面の「サイト設定」から変えられます。

## 構成

| 層 | 採用 |
|---|---|
| フレームワーク | Next.js（App Router）＋ TypeScript |
| DB | SQLite（better-sqlite3）＋ Drizzle ORM |
| スタイル | Tailwind CSS |
| Markdown | marked ＋ sanitize-html |
| 認証 | メール＋パスワード（scrypt）、DB セッション |

```
src/
  app/(media)/      公開側（トップ・記事・カテゴリ・タグ・固定ページ）
  app/community/    コミュニティ
  app/admin/        管理画面
  app/actions/      サーバー側の処理（権限確認はここで行う）
  db/schema.ts      テーブル定義（変更したら npm run db:generate）
  lib/              認証・設定・Markdown・データ取得
  lib/partners.ts   管理画面に出す相談先（フォークして差し替え可）
scripts/seed.ts     サンプルデータ
```

## 開発

```bash
npm run typecheck
npm run lint
npm run db:generate   # schema.ts を変えたらマイグレーションを作る（起動時に自動適用）
```

## 次に作るもの

ダイレクトメッセージ、通報、画像付き投稿、メンション、非公開コミュニティ、記事の取り込み API、Webhook（CRM/MA 連携）、OAuth ログイン。

## 商用サポート

waltz は [opus合同会社](https://opus-inc.jp/) が開発しています。デザインの作り込み、会員機能の追加、既存システムとの連携などのカスタマイズ開発や、記事づくりの支援（[sonata](https://sonata-ai.app/)）のご相談は opus までどうぞ。

## ライセンス

[MIT](LICENSE)
