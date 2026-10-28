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
- **WordPress から移行**: 標準のエクスポートファイル（XML）から記事・固定ページ・カテゴリ・タグ・画像を取り込み、旧 URL を 301 で転送

**公式サイト**: https://waltz.sonata-ai.app ／ **デモ**: https://waltz.sonata-ai.app/demo （毎朝4時にサンプルデータへ初期化。ログイン情報はログイン画面に表示）

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

## WordPress から移行する

WordPress の管理画面「ツール → エクスポート」で「すべてのコンテンツ」を書き出した XML ファイル（WXR）を取り込めます。
取り込みのあいだ、画像を取得するため **元の WordPress サイトは公開したままにしておいてください。**

### 管理画面から

管理者で「WordPress から移行」（`/admin/import`）を開き、XML ファイルを選びます（50MB まで）。

1. **内容を確認する** — 何も書き込まずに、取り込む件数・新しい URL・「要確認」の箇所を一覧にします
2. **取り込み方を決める** — 同じスラッグの記事があるときの扱い（飛ばす／別のスラッグで取り込む。既存記事は上書きしません）、投稿者の紐付け（既存ユーザー／ログインできない編集者として作成）、画像の取得、コメントを移すか
3. **取り込む** — 全体を1つのトランザクションで書き込みます。途中で失敗したら何も残りません（取得した画像も消します）

### コマンドで（大きなファイル・Docker）

```bash
npm run import:wordpress -- export.xml          # 確認だけ（書き込まない）
npm run import:wordpress -- export.xml --run    # 取り込む
```

| オプション | 説明 |
|---|---|
| `--on-conflict=skip\|rename` | 同じスラッグの記事があるとき（既定 `skip`） |
| `--assign-to=<メール>` | すべての記事を既存ユーザーに紐付ける |
| `--comments=<コミュニティのスラッグ>` | 承認済みコメントをコミュニティへ移す（既定は移さない） |
| `--no-images` | 画像を取得しない |
| `--draft-if-issues` | 「要確認」がある記事を下書きで取り込む |
| `--json` | 結果を JSON で出す |

Docker では、ファイルをデータ用ボリュームに置いてからコンテナ内で実行します。

```bash
docker cp export.xml <コンテナ名>:/data/export.xml
docker exec <コンテナ名> node import-wordpress.cjs /data/export.xml --run
```

### 移すもの

| WordPress | waltz |
|---|---|
| 投稿・固定ページ | 記事・固定ページ（公開→公開、下書き・レビュー待ち・非公開→下書き、予約投稿→予約公開） |
| 本文（クラシックエディタ・ブロックエディタ） | Markdown（見出し・段落・リスト・表・引用・コード・画像・リンク） |
| スラッグ・タイトル・抜粋・公開日・先頭に固定 | そのまま（日本語のスラッグは半角英数字のスラッグに付け替えます） |
| カテゴリ・タグ | 最初のカテゴリを記事のカテゴリに、残りのカテゴリとタグはタグに |
| アイキャッチ・本文中の画像 | 元サイトから取得して保存し、URL を書き換え（取得できなかった画像は元の URL のまま一覧に出します） |
| Yoast SEO / All in One SEO のタイトル・説明文 | SEO タイトル・メタディスクリプション |
| 承認済みコメント（任意） | コミュニティへ「記事を共有した投稿＋コメント」として。名前と日時を残し、メールアドレス・IP は保存しません |
| 旧 URL（`/2024/05/slug/`・`/?p=123`・`/category/〇〇/`） | 新しい URL へ 301 で転送。本文中の内部リンクも新しい URL に書き換え |

### 自動では移せないもの

- **ページビルダー**（Elementor・Divi・WPBakery など）で作ったレイアウト。文章と画像は残りますが、段組みや装飾は失われます
- **ショートコード**（`[contact-form-7]` など）。本文に文字のまま残るので、確認画面の「要確認」を見て直してください
- **カスタムフィールド**と、それを使うテーマの表示
- **プラグインの機能**（問い合わせフォーム、会員制、EC、予約など）、テーマのデザイン、メニュー、ウィジェット
- 埋め込み（iframe）はリンクに、`<script>` は削除して取り込みます

移しきれない部分の手直しや移行作業の代行は、下の「商用サポート」からご相談いただけます。

### 安全のための制限

取り込むファイルは信用できない入力として扱います。XML の DOCTYPE・外部実体は受け付けません。画像は http/https だけを取得し、サーバー内部のアドレス（localhost・プライベート IP・クラウドのメタデータ）へは接続しません（名前解決後の IP で判定）。リダイレクトは3回、1枚5MB、15秒までです。取り込んだ本文は、表示時に通常の記事と同じ無害化を通ります。公開デモ（`DEMO_MODE=1`）では使えません。

## 外部ツールとつなぐ（concerto・sonata）

waltz は WordPress の REST API（`/wp-json/wp/v2/posts`）と、opus connector プラグイン（`/wp-json/opus/v1`）と同じ形の口を持ちます。WordPress 向けに作られたツールから、waltz を「WordPress のサイト」として扱えます。設定は管理画面の「外部連携」（管理者のみ）。

| 口 | 認証 | 用途 |
|---|---|---|
| `GET /wp-json/wp/v2/posts`（`page`・`per_page`・`_fields`・`search`・`slug`）・`GET /wp-json/wp/v2/posts/{id}` | 不要（公開記事だけ） | 記事の取り込み。件数は `X-WP-Total`・`X-WP-TotalPages` |
| `GET /wp-json/opus/v1/ping` | `X-Opus-Token` | 接続テスト |
| `GET /wp-json/opus/v1/posts/{id}` | `X-Opus-Token` | 今の本文（Markdown）と指紋 `content_hash`（sha256）。下書きも読める |
| `POST /wp-json/opus/v1/posts/{id}` | `X-Opus-Token` | 本文の差し替え。`expected_hash` が今の本文と違えば 409。`content` は HTML（`content_format: "markdown"` も可）。`title`・`excerpt`・`status` なども受け付ける |
| `POST /wp-json/opus/v1/posts` | `X-Opus-Token` | 記事の新規作成。`title`・`content` 必須、既定は下書き（`status: "publish"` で公開）。`tags`・`category`・`slug`・`seo_title`・`seo_description`・`featured_image_url` |

- **接続トークン**は「外部連携」で接続先ごとに発行します。平文は発行した画面で一度だけ表示し、DB にはハッシュだけを保存します。失効させるとすぐ使えなくなります。認証の失敗が続く送信元は10分止めます
- **concerto**: メディアを「WordPress」で登録し、接続トークンを貼ると、記事の取り込み・評価・改善の反映まで動きます。concerto の計測タグは「外部連携」にコードを貼ると全ページに入ります
- HTML で送られた本文は Markdown に戻して保存します（自サイトの絶対 URL はサイト内のパスへ、script・iframe・フォームは除去）。日本語の太字・斜体で Markdown にすると崩れる箇所（`**結論：**締め` など）は HTML タグのまま残します
- 固定ページ・カテゴリ・メディアの API はありません。公開デモ（`DEMO_MODE=1`）では書き込みの口を止めています

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
  lib/wp-import/    WordPress（WXR）の取り込み
  proxy.ts          旧 URL の 301 転送と末尾スラッシュの除去
scripts/seed.ts     サンプルデータ
scripts/import-wordpress.ts  WordPress 取り込みのコマンド
```

## 開発

```bash
npm run typecheck
npm run lint
npm run db:generate   # schema.ts を変えたらマイグレーションを作る（起動時に自動適用）
npm run test:wp-import  # WordPress 取り込みの確認（ネットワーク不要）
npm run test:integrations  # 外部連携の口の確認（ネットワーク不要）
```

## 次に作るもの

ダイレクトメッセージ、通報、画像付き投稿、メンション、非公開コミュニティ、Webhook（CRM/MA 連携）、OAuth ログイン。

## 商用サポート

waltz は [opus合同会社](https://opus-inc.jp/) が開発しています。デザインの作り込み、会員機能の追加、既存システムとの連携などのカスタマイズ開発や、記事づくりの支援（[sonata](https://sonata-ai.app/)）のご相談は opus までどうぞ。

## ライセンス

[MIT](LICENSE)
