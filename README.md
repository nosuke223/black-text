# BLACK TEXT

生成AIを利用する選択式テキストホラーゲームのMVPです。現在は、固定文章でゲームループを検証する段階Aを進めています。

## 必要な環境

- Node.js 24 LTS
- npm 11

## セットアップ

```bash
npm install
npm run dev
```

ブラウザで`http://localhost:3000`を開きます。

## 確認コマンド

| コマンド | 内容 |
|---|---|
| `npm run build` | 本番用ビルド |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScriptの型チェック |
| `npm run test` | Vitestの監視実行 |
| `npm run test:run` | Vitestの単発実行 |
| `npm run test:e2e` | PlaywrightのChromiumテスト |

## 依存関係の補足

Next.js 16.2.10が推移的依存として固定しているPostCSS 8.4.31は、`npm audit`で`GHSA-qx2v-qp2m-jg93`の対象として検出される。そのため、`package.json`の`overrides`で修正版の8.5.19へ固定している。Next.js側が修正版を含むようになった時点で、`overrides`を削除し、依存関係監査とすべての確認コマンドが成功することを確認する。

ゲーム仕様は`docs/04_MVP仕様.md`、段階Aの実装順は`docs/05_段階A実装計画.md`を参照してください。
