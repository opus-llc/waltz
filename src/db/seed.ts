/**
 * デモ用サンプルデータ。登場する会社・人物はすべて架空。
 * scripts/seed.ts（npm run setup）と、デモ環境の毎日の初期化（src/lib/demo.ts）から呼ばれる。
 */
import type Database from "better-sqlite3";
import type { DB } from "./connect";
import * as s from "./schema";
import { hashPassword } from "../lib/password";

const TABLES = [
  "notifications", "likes", "comments", "posts", "events", "community_members", "communities",
  "follows", "article_tags", "tags", "articles", "categories", "sessions", "media_files", "settings", "users",
];

/** アプリのデータを空にする（テーブル定義は残す） */
function wipe(sqlite: Database.Database) {
  for (const t of TABLES) sqlite.prepare(`DELETE FROM ${t}`).run();
  sqlite.prepare("DELETE FROM sqlite_sequence").run();
}

export function seedDemo(db: DB, sqlite: Database.Database) {
  const DEMO_PASSWORD = process.env.DEMO_PASSWORD ?? "waltz-demo";
  const now = Date.now();
  const ago = (h: number) => new Date(now - h * 3600_000);
  // 日本時間の「d日後の hour 時」（サーバーのタイムゾーンに左右されない）
  const ahead = (d: number, hour = 19) => {
    const ymd = new Date(now + d * 86400_000 + 9 * 3600_000).toISOString().slice(0, 10);
    return new Date(`${ymd}T${String(hour).padStart(2, "0")}:00:00+09:00`);
  };

  const tx = sqlite.transaction(() => {
    wipe(sqlite);
    /* ── 設定 ── */
    const settings: Record<string, string> = {
      siteName: "バックオフィス・ラボ",
      tagline: "経理・労務・情シスの「ひとりで抱えない」をつくる。",
      description:
        "バックオフィス担当者のための実務メディアとコミュニティ。記事で学び、コミュニティで相談し、勉強会で仲間に会える場所です。",
      accentColor: "#0f766e",
      showPartnerLinks: "1",
      footerNote: "これは waltz のデモサイトです。登場する会社・人物はすべて架空です。",
    };
    for (const [key, value] of Object.entries(settings)) db.insert(s.settings).values({ key, value }).run();

    /* ── ユーザー ── */
    const people = [
      { name: "管理 太郎", handle: "admin", email: "admin@example.com", headline: "編集長 @ バックオフィス・ラボ", role: "admin" as const, color: "#0f766e", bio: "バックオフィス・ラボの編集長。経理10年、いまは「現場の知恵を記事にする」係です。" },
      { name: "森 さくら", handle: "sakura", email: "sakura@example.com", headline: "経理マネージャー @ 架空食品株式会社", role: "editor" as const, color: "#db2777", bio: "月次決算を5営業日から3営業日にした話ならいくらでも。" },
      { name: "高橋 悠", handle: "yu_t", email: "yu@example.com", headline: "労務担当 @ サンプル精工", role: "member" as const, color: "#2563eb", bio: "社員120名の労務をひとりで見ています。" },
      { name: "佐藤 みのり", handle: "minori", email: "minori@example.com", headline: "ひとり情シス @ 例示物流", role: "member" as const, color: "#7c3aed", bio: "PCのキッティングからSaaS選定まで。" },
      { name: "伊藤 健", handle: "ken_ito", email: "ken@example.com", headline: "CFO @ デモテック", role: "member" as const, color: "#ea580c", bio: "シリーズAのスタートアップでCFO。管理部門の立ち上げを担当。" },
      { name: "中村 葵", handle: "aoi", email: "aoi@example.com", headline: "人事・総務 @ 架空デザイン事務所", role: "member" as const, color: "#16a34a", bio: "総務と人事と、たまに経理。" },
      { name: "小林 修", handle: "osamu", email: "osamu@example.com", headline: "税理士 @ 小林会計事務所（架空）", role: "member" as const, color: "#475569", bio: "中小企業の顧問先40社。インボイス対応の相談多め。" },
      { name: "加藤 ひかり", handle: "hikari", email: "hikari@example.com", headline: "経理（入社1年目）@ サンプル商事", role: "member" as const, color: "#0891b2", bio: "簿記2級を勉強中です。" },
    ];
    const uid: Record<string, number> = {};
    people.forEach((p, i) => {
      const r = db
        .insert(s.users)
        .values({
          email: p.email,
          passwordHash: hashPassword(DEMO_PASSWORD),
          name: p.name,
          handle: p.handle,
          headline: p.headline,
          bio: p.bio,
          role: p.role,
          avatarColor: p.color,
          createdAt: ago(24 * (60 - i * 6)),
        })
        .returning({ id: s.users.id })
        .get();
      uid[p.handle] = r.id;
    });

    /* ── カテゴリ・タグ ── */
    const cats = [
      { slug: "accounting", name: "経理・決算", description: "月次決算、経費精算、インボイス対応の実務" },
      { slug: "hr", name: "労務・人事", description: "勤怠、給与、入退社手続き、評価制度" },
      { slug: "it", name: "情シス・ツール", description: "SaaS選定、アカウント管理、セキュリティ" },
    ];
    const cid: Record<string, number> = {};
    cats.forEach((c, i) => {
      cid[c.slug] = db.insert(s.categories).values({ ...c, sort: i }).returning({ id: s.categories.id }).get().id;
    });
    const tagNames: Record<string, string> = {
      "monthly-close": "月次決算",
      invoice: "インボイス",
      saas: "SaaS",
      onboarding: "入社手続き",
      automation: "自動化",
      "small-team": "少人数チーム",
      security: "セキュリティ",
    };
    const tid: Record<string, number> = {};
    for (const [slug, name] of Object.entries(tagNames)) {
      tid[slug] = db.insert(s.tags).values({ slug, name }).returning({ id: s.tags.id }).get().id;
    }

    /* ── 記事 ── */
    type Seed = { slug: string; title: string; excerpt: string; cat: string; tags: string[]; author: string; hoursAgo: number; featured?: boolean; body: string };
    const posts: Seed[] = [
      {
        slug: "monthly-close-3days",
        title: "月次決算を5営業日から3営業日にした、7つの段取り",
        excerpt: "特別なツールは入れていません。変えたのは「締めの前にやること」の順番だけでした。",
        cat: "accounting",
        tags: ["monthly-close", "small-team"],
        author: "sakura",
        hoursAgo: 20,
        featured: true,
        body: `月次決算が遅れる原因は、作業量よりも「待ち時間」にあります。請求書が届かない、経費精算が出てこない、確認の返事が来ない。その待ちを前倒しで潰すだけで、締めは2日縮みました。

  ## 1. 締め日の3営業日前に「未着リスト」を出す

  取引先ごとに、毎月届くはずの請求書を一覧にしておきます。3営業日前の時点で届いていないものを、担当部署に一斉に確認します。

  ## 2. 経費精算の締めを「月末」から「25日」に

  月末に申請が集中すると、承認者がつかまりません。25日締め・月末払いに変えたところ、差し戻しが半分になりました。

  ## 3. 仮計上のルールを先に決めておく

  金額が確定しないものは「見積額で計上し、翌月に差額を調整する」と決めておきます。判断に迷う時間が消えます。

  ## 4. 銀行明細は毎朝取り込む

  月末にまとめて取り込むと、照合で詰まったときに原因が追えません。毎朝5分の取り込みが、締め日の2時間を救います。

  ## 5. 勘定科目の「迷いやすい10件」を表にする

  新人が迷う取引は毎月ほぼ同じです。判断例を表にして共有フォルダに置くだけで、質問が減りました。

  ## 6. 試算表のチェック項目を固定する

  前月比で20%以上動いた科目だけを見る、と決めます。全科目を眺めるのをやめるのがポイントです。

  ## 7. 報告資料は「先月のコピー」から作る

  数字だけ差し替えればよい形にしておけば、報告資料は30分で終わります。

  ---

  **この記事について、コミュニティの「経理の相談室」で感想や自社のやり方を聞かせてください。**`,
      },
      {
        slug: "invoice-checklist",
        title: "インボイス対応、受け取る側が毎月確認すべき4項目",
        excerpt: "登録番号の確認を「全件」やるのは現実的ではありません。リスクの高いところだけ見る方法です。",
        cat: "accounting",
        tags: ["invoice"],
        author: "admin",
        hoursAgo: 70,
        featured: true,
        body: `受け取った請求書がインボイスの要件を満たしているか。毎月全件を確認するのは、少人数の経理には重すぎます。

  ## 確認するのは4項目だけ

  1. 登録番号の記載があるか
  2. 税率ごとの合計と消費税額が分かれているか
  3. 新規取引先の登録番号が公表サイトで有効か
  4. 免税事業者からの仕入れが、経過措置の対象として正しく処理されているか

  ## 新規取引先だけは必ず照会する

  既存の取引先は、登録時に一度確認していれば毎月見る必要はありません。**新規取引先の初回だけ**、国税庁の公表サイトで照会します。

  ## 記録の残し方

  照会した日付と結果を、取引先マスタの備考欄に残しておくと、税務調査のときに説明が楽になります。`,
      },
      {
        slug: "onboarding-paperwork",
        title: "入社手続きを「入社日の1週間前」に終わらせる段取り表",
        excerpt: "社会保険、雇用保険、PCの準備、アカウント発行。入社当日に慌てないための逆算表を公開します。",
        cat: "hr",
        tags: ["onboarding", "small-team"],
        author: "yu_t",
        hoursAgo: 120,
        featured: true,
        body: `入社当日に「PCがまだ届いていない」「メールアドレスが使えない」と言われるのは、本人にも現場にも気まずいものです。

  ## 逆算表

  | 時期 | やること | 担当 |
  |---|---|---|
  | 内定承諾の翌日 | 入社書類の案内を送る | 労務 |
  | 入社2週間前 | PCの発注、アカウント申請 | 情シス |
  | 入社1週間前 | 書類の回収と確認 | 労務 |
  | 入社前日 | PCの初期設定、座席の準備 | 情シス・総務 |
  | 入社日 | 社会保険・雇用保険の届出 | 労務 |

  ## つまずきやすいところ

  - **マイナンバーの回収**: 郵送より、専用の回収フォームを使う方が安全で早いです
  - **前職の源泉徴収票**: 年内入社の場合は年末調整に必要です。入社時に「届いたら出してください」と一言添えます`,
      },
      {
        slug: "saas-account-offboarding",
        title: "退職者のSaaSアカウント、消し忘れをゼロにする台帳の作り方",
        excerpt: "使っているSaaSが30を超えたら、記憶では管理できません。スプレッドシート1枚で始める方法です。",
        cat: "it",
        tags: ["saas", "security"],
        author: "minori",
        hoursAgo: 200,
        body: `退職者のアカウントが残っていると、情報漏えいの入口になります。とはいえ、高価な管理ツールをすぐに入れられる会社ばかりではありません。

  ## 台帳の列はこれだけ

  - サービス名
  - 管理者（社内の誰が契約しているか）
  - ログイン方式（Googleアカウント連携か、個別のIDか）
  - 退職時の手順（削除／停止／所有権の移管）

  ## 「Googleアカウント連携」に寄せる

  個別IDのサービスを減らし、会社のGoogleアカウントでログインする方式に寄せていくと、退職時にGoogleアカウントを止めるだけで大半が使えなくなります。

  ## 退職日の手順

  1. 台帳を上から順に確認する
  2. 共有ドライブの所有権を上長に移す
  3. 最後にGoogleアカウントを停止する`,
      },
      {
        slug: "expense-rules-template",
        title: "経費精算の規程、最初の1枚に書くべきこと",
        excerpt: "長い規程は読まれません。A4一枚にまとめたテンプレートを置いておきます。",
        cat: "accounting",
        tags: ["small-team"],
        author: "sakura",
        hoursAgo: 300,
        body: `経費精算のトラブルは、ルールがないことより「ルールが読まれていない」ことから起きます。

  ## 1枚に書く5項目

  1. 申請の締め日と支払日
  2. 領収書が出ない場合の扱い（出金伝票の書き方）
  3. 交通費の経路の決め方（原則は最安経路）
  4. 接待交際費の上限と、事前申請が要る金額
  5. 立替が難しい人のための仮払いの方法

  ## 迷ったら相談先を書く

  最後に「迷ったら経理の◯◯まで」と、名前を書いておくのが一番効きます。`,
      },
      {
        slug: "attendance-tool-selection",
        title: "勤怠管理ツールを選ぶ前に、社内で決めておく3つのこと",
        excerpt: "ツール比較から始めると失敗します。先に決めるべきは、運用ルールのほうでした。",
        cat: "hr",
        tags: ["saas", "automation"],
        author: "aoi",
        hoursAgo: 420,
        body: `勤怠管理ツールの比較表を作る前に、次の3つを社内で決めておくと、選定が半分の時間で終わります。

  ## 1. 打刻の場所

  オフィスだけか、在宅や直行直帰もあるか。スマホ打刻や位置情報の要否が変わります。

  ## 2. 残業申請の流れ

  事前申請か、事後承認か。承認者は誰か。ここが曖昧なまま導入すると、ツールの設定で必ず詰まります。

  ## 3. 給与計算とのつなぎ方

  勤怠のデータを給与計算にどう渡すか。CSVで渡すのか、連携機能を使うのか。給与側の担当者と先に話しておきます。`,
      },
      {
        slug: "backoffice-automation-first-step",
        title: "バックオフィスの自動化、最初の一歩は「転記」を探すこと",
        excerpt: "どこから自動化すべきか迷ったら、同じ数字を2回入力している場所を探してください。",
        cat: "it",
        tags: ["automation"],
        author: "ken_ito",
        hoursAgo: 520,
        body: `自動化の候補は「転記」にあります。ある画面で見た数字を、別の画面に打ち直している作業です。

  ## 転記を探す質問

  - その数字は、どこから来ましたか？
  - 同じ数字を、ほかのどこに入力していますか？

  ## 小さく始める

  最初の自動化は、月に1時間しか減らないものでも構いません。「自動化しても壊れない」経験を一度積むことが、次の自動化を進める力になります。`,
      },
      {
        slug: "year-end-adjustment-schedule",
        title: "年末調整、11月に終わらせておくと12月が楽になる5つの準備",
        excerpt: "毎年12月に追われる人へ。11月のうちにやっておけることをまとめました。",
        cat: "hr",
        tags: ["small-team"],
        author: "yu_t",
        hoursAgo: 30,
        body: `年末調整は12月の仕事だと思われがちですが、準備の大半は11月にできます。

  ## 11月にやること

  1. 扶養控除等申告書の配布と回収期限の告知
  2. 保険料控除証明書の提出を案内する
  3. 中途入社者の前職の源泉徴収票を回収する
  4. 住宅ローン控除の対象者を確認する
  5. 給与計算ソフトの年末調整機能の設定を確認する

  ## 回収期限は「余裕を持って」

  回収期限は、本当の締めの1週間前に設定します。遅れる人は必ずいます。`,
      },
    ];
    const aid: Record<string, number> = {};
    for (const p of posts) {
      const published = ago(p.hoursAgo);
      const r = db
        .insert(s.articles)
        .values({
          type: "post",
          slug: p.slug,
          title: p.title,
          excerpt: p.excerpt,
          body: p.body,
          categoryId: cid[p.cat],
          authorId: uid[p.author],
          status: "published",
          featured: !!p.featured,
          publishedAt: published,
          createdAt: published,
          updatedAt: published,
        })
        .returning({ id: s.articles.id })
        .get();
      aid[p.slug] = r.id;
      for (const t of p.tags) db.insert(s.articleTags).values({ articleId: r.id, tagId: tid[t] }).run();
    }
    // 下書き1件（管理画面の確認用）
    db.insert(s.articles)
      .values({
        slug: "draft-closing-checklist",
        title: "【下書き】決算前チェックリスト",
        excerpt: "",
        body: "ここに本文を書きます。",
        categoryId: cid.accounting,
        authorId: uid.sakura,
        status: "draft",
      })
      .run();
    // 固定ページ
    db.insert(s.articles)
      .values([
        {
          type: "page",
          slug: "about",
          title: "バックオフィス・ラボについて",
          body: `バックオフィス・ラボは、経理・労務・情シスの担当者のための実務メディアとコミュニティです。

  ## 私たちが大切にしていること

  - **ひとりで抱えない**: 少人数の管理部門ほど、相談できる相手がいません
  - **現場の知恵を残す**: 記事は、コミュニティで交わされた相談から生まれています
  - **すぐ使える**: テンプレートや手順表は、そのまま使ってください

  > これは waltz のデモサイトです。登場する会社・人物はすべて架空です。`,
          status: "published",
          authorId: uid.admin,
          publishedAt: ago(24 * 60),
        },
        {
          type: "page",
          slug: "privacy",
          title: "プライバシーポリシー",
          body: "（サンプル）運営者が取得する情報、利用目的、第三者提供、お問い合わせ先をここに記載します。",
          status: "published",
          authorId: uid.admin,
          publishedAt: ago(24 * 60),
        },
      ])
      .run();

    /* ── コミュニティ ── */
    const comms = [
      { slug: "accounting-room", name: "経理の相談室", icon: "🧾", color: "#0f766e", description: "月次決算、経費精算、インボイス。経理の「これで合ってる？」を気軽に聞ける場所です。", members: ["admin", "sakura", "ken_ito", "osamu", "hikari", "aoi"] },
      { slug: "hr-labor", name: "労務・人事の井戸端", icon: "🤝", color: "#2563eb", description: "勤怠、給与、入退社、評価制度。ひとり労務の悩みを持ち寄りましょう。", members: ["admin", "yu_t", "aoi", "ken_ito"] },
      { slug: "solo-it", name: "ひとり情シス部", icon: "💻", color: "#7c3aed", description: "PC管理からSaaS選定まで。ひとりで情シスを回す人たちの部室です。", members: ["admin", "minori", "ken_ito", "yu_t"] },
      { slug: "newcomers", name: "バックオフィス1年生", icon: "🌱", color: "#ea580c", description: "管理部門に来たばかりの人向け。どんな初歩的な質問も歓迎です。", members: ["admin", "hikari", "sakura", "aoi"] },
    ];
    const comId: Record<string, number> = {};
    comms.forEach((c, i) => {
      const r = db
        .insert(s.communities)
        .values({ slug: c.slug, name: c.name, icon: c.icon, color: c.color, description: c.description, createdBy: uid.admin, createdAt: ago(24 * (55 - i)) })
        .returning({ id: s.communities.id })
        .get();
      comId[c.slug] = r.id;
      c.members.forEach((h, j) =>
        db
          .insert(s.communityMembers)
          .values({ communityId: r.id, userId: uid[h], role: h === "admin" ? "owner" : "member", joinedAt: ago(24 * (50 - j * 3)) })
          .run(),
      );
    });

    /* ── 投稿・コメント・いいね ── */
    type P = { author: string; com?: string; article?: string; kind?: "post" | "question"; h: number; body: string; comments?: Array<[string, string, number]>; likes?: string[] };
    const feedSeed: P[] = [
      { author: "hikari", com: "newcomers", kind: "question", h: 1.5, body: "仮払金と立替金の違いがいまいち分かっていません…。社員が出張前にお金を受け取るのはどちらになりますか？", comments: [["sakura", "出張前に会社から渡すお金は「仮払金」です！精算したら旅費交通費などに振り替えます。立替金は、会社が誰かの代わりに払ったときに使うことが多いですね。", 1.2], ["hikari", "ありがとうございます！すっきりしました🙏", 1]], likes: ["sakura", "aoi", "admin"] },
      { author: "sakura", com: "accounting-room", article: "monthly-close-3days", h: 3, body: "月次決算の段取り、記事にまとめてもらいました。うちは「未着リスト」を出すようにしてから一気に楽になりました。皆さんの会社の工夫も聞きたいです！", comments: [["ken_ito", "未着リスト、真似します。うちは請求書の受け取りをメールに一本化したら少し早くなりました。", 2.5], ["osamu", "顧問先でも、締めが早い会社ほど「待ち」を潰していますね。", 2]], likes: ["ken_ito", "osamu", "hikari", "admin", "aoi"] },
      { author: "minori", com: "solo-it", h: 5, body: "社用スマホの管理、皆さんどうしてますか？30台を超えてきて、スプレッドシートでは限界を感じています。", comments: [["ken_ito", "うちはMDM（端末管理ツール）を入れました。紛失時に遠隔でロックできるのが一番の安心材料でした。", 4]], likes: ["yu_t", "admin"] },
      { author: "yu_t", com: "hr-labor", article: "year-end-adjustment-schedule", h: 8, body: "今年も年末調整の季節。11月中に回収期限を告知しておくのが自分なりのコツです。記事にもしてもらいました。", likes: ["aoi", "admin", "sakura"] },
      { author: "ken_ito", h: 11, body: "管理部門の採用、求人票に「何を任せたいか」より「何を一緒に作りたいか」を書いたら応募が増えた。スタートアップの管理部門は、立ち上げそのものが仕事だと伝えるのが大事なのかも。", likes: ["aoi", "minori", "sakura", "admin"], comments: [["aoi", "すごく分かります。運用より立ち上げに惹かれる人、一定数いますよね。", 10]] },
      { author: "osamu", com: "accounting-room", kind: "question", h: 22, body: "インボイスの経過措置（8割控除）、受け取る側で区分を管理できていない会社が多い印象です。皆さんの会計ソフトでは、どう区分していますか？", comments: [["sakura", "取引先マスタに「適格／免税」のフラグを持たせて、仕訳入力時に自動で税区分が変わるようにしています。", 20]], likes: ["sakura", "hikari"] },
      { author: "aoi", com: "hr-labor", h: 30, body: "評価制度を作り直すことになりました。10人規模の会社で、最初から等級制度まで作るべきか悩み中です。", comments: [["ken_ito", "最初は「期待役割を文章で書く」だけでも十分だと思います。等級は人数が増えてからで。", 28], ["yu_t", "同意です。仕組みより、面談の頻度を決める方が先かもしれません。", 27]], likes: ["ken_ito", "yu_t"] },
      { author: "admin", com: "newcomers", h: 48, body: "ようこそ「バックオフィス1年生」へ！ここではどんな初歩的な質問も歓迎です。まずは自己紹介がてら、いま一番困っていることを書いてみてください🌱", likes: ["hikari", "sakura", "aoi", "yu_t", "minori"] },
      { author: "minori", com: "solo-it", article: "saas-account-offboarding", h: 60, body: "退職者のアカウント台帳、記事にしてもらいました。Googleアカウント連携に寄せていくのが結局いちばん効きます。", likes: ["ken_ito", "admin"] },
      { author: "hikari", h: 72, body: "簿記2級、ようやく工業簿記が分かってきた…！現場で使うのは商業簿記の方が多いけど、原価の考え方は役に立ちそう。", likes: ["sakura", "osamu", "admin"], comments: [["osamu", "原価の考え方は、管理会計で必ず効いてきますよ。応援しています。", 70]] },
    ];
    const postIds: number[] = [];
    for (const p of feedSeed) {
      const r = db
        .insert(s.posts)
        .values({
          authorId: uid[p.author],
          communityId: p.com ? comId[p.com] : null,
          articleId: p.article ? aid[p.article] : null,
          kind: p.kind ?? "post",
          body: p.body,
          createdAt: ago(p.h),
        })
        .returning({ id: s.posts.id })
        .get();
      postIds.push(r.id);
      for (const [h, body, hh] of p.comments ?? []) {
        db.insert(s.comments).values({ postId: r.id, authorId: uid[h], body, createdAt: ago(hh) }).run();
        if (uid[h] !== uid[p.author])
          db.insert(s.notifications).values({ userId: uid[p.author], actorId: uid[h], type: "comment", postId: r.id, createdAt: ago(hh), readAt: p.author === "admin" ? null : ago(hh - 0.5) }).run();
      }
      for (const h of p.likes ?? []) {
        db.insert(s.likes).values({ postId: r.id, userId: uid[h], createdAt: ago(p.h - 0.2) }).run();
        if (uid[h] !== uid[p.author])
          db.insert(s.notifications).values({ userId: uid[p.author], actorId: uid[h], type: "like", postId: r.id, createdAt: ago(p.h - 0.2), readAt: p.author === "admin" ? null : ago(p.h - 0.1) }).run();
      }
    }

    /* ── フォロー ── */
    const followPairs: Array<[string, string]> = [
      ["admin", "sakura"], ["admin", "yu_t"], ["admin", "minori"], ["hikari", "sakura"], ["hikari", "osamu"],
      ["sakura", "osamu"], ["ken_ito", "sakura"], ["ken_ito", "minori"], ["aoi", "yu_t"], ["yu_t", "aoi"], ["minori", "ken_ito"],
    ];
    for (const [a, b] of followPairs) db.insert(s.follows).values({ followerId: uid[a], followeeId: uid[b] }).run();

    /* ── イベント ── */
    db.insert(s.events)
      .values([
        { communityId: comId["accounting-room"], title: "月次決算 早期化もくもく会", description: "各社の締めスケジュールを持ち寄って、詰まりどころを一緒に探します。", startsAt: ahead(6), location: "オンライン", createdBy: uid.sakura },
        { communityId: comId["hr-labor"], title: "年末調整 直前Q&A", description: "今年の変更点と、毎年つまずくポイントを30分で確認します。", startsAt: ahead(10, 12), location: "オンライン", createdBy: uid.yu_t },
        { communityId: comId["solo-it"], title: "ひとり情シス 交流会（東京）", description: "普段は社内にいない「同業者」と話せる場です。", startsAt: ahead(17), location: "東京都内（参加者に別途連絡）", createdBy: uid.minori },
        { communityId: comId.newcomers, title: "はじめての決算書の読み方", description: "貸借対照表と損益計算書の見方を、1時間でざっくり押さえます。", startsAt: ahead(3, 20), location: "オンライン", createdBy: uid.admin },
      ])
      .run();

    // フォロー通知（管理者向け未読）
    db.insert(s.notifications).values({ userId: uid.admin, actorId: uid.hikari, type: "join", communityId: comId.newcomers, createdAt: ago(0.8) }).run();
  });
  tx();
}
