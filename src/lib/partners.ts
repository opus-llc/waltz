/**
 * 管理画面に出す「困ったときの相談先」。
 * 設定 > パートナー導線 で非表示にできる。フォークして自社の窓口に差し替えても構わない。
 */
export const PARTNERS = {
  content: {
    label: "記事を書く時間がない",
    action: "sonata で下書きを作る",
    description: "取材の録音や資料から、記事の下書きを生成します。書き出した Markdown はこの画面で取り込めます。",
    url: "https://sonata-ai.app/?utm_source=ensemble&utm_medium=admin&utm_campaign=editor",
  },
  diagnose: {
    label: "AIに引用されているか知りたい",
    action: "無料でAI引用診断",
    description: "公開した記事が生成AIの回答に引用されやすいかを診断します。",
    url: "https://analyse.sonata-ai.app/?utm_source=ensemble&utm_medium=admin&utm_campaign=dashboard",
  },
  measure: {
    label: "読者の動きを測りたい",
    action: "concerto を見る",
    description: "記事を読んだ人の関心を計測し、コミュニティやイベントの参加とつなげます。",
    url: "https://concerto.sonata-ai.app/?utm_source=ensemble&utm_medium=admin&utm_campaign=settings",
  },
  custom: {
    label: "自社向けに改造したい",
    action: "カスタマイズ開発の相談",
    description: "デザインの作り込み、会員機能の追加、既存システムとの連携を開発します。",
    url: "https://opus-inc.jp/?utm_source=ensemble&utm_medium=admin&utm_campaign=custom",
  },
} as const;
