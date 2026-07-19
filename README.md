# 絶対負けない後出しじゃんけん番所

## 作ったもの(1行)

「じゃん、けん、ぽん!」の掛け声演出つきで、Webカメラの手をブラウザ内ML(MediaPipe Hands)で認識し、人間の視覚反応(約200ms)より速く勝つ手を後出しするじゃんけんマシン。勝率100%(SLA保証)。

**禁じ手ルール:** 当機が手を出した後にあなたが手を変えると「後出し検出→貴殿の反則負け」。自分は後出しするくせに、人の後出しは1フレーム単位で検出して許さない。

## 動かし方

ES module 構成のため **`file://` では動かない**。ローカルサーバを1本立てる:

```
cd atodashi-janken
python -m http.server 8000
# → http://localhost:8000 を Chrome/Edge で開く
```

MediaPipe のモデルとフォントは CDN から読むのでネット接続は必要。ただし**映像は一切外部送信されない**(推論は WASM でローカル完結)。

## GitHub Pages で公開する

このフォルダを1つのリポジトリとして push すれば、[.github/workflows/deploy.yml](.github/workflows/deploy.yml) が main への push のたびに自動公開する。

```
cd atodashi-janken
git init -b main
git add -A
git commit -m "絶対負けない後出しじゃんけん番所"
gh repo create atodashi-janken --public --source=. --push
```

初回のみ、リポジトリの **Settings → Pages → Source を「GitHub Actions」に変更**する(CLIなら `gh api repos/{owner}/atodashi-janken/pages -X POST -f build_type=workflow`)。以後は push するだけで `https://<ユーザー名>.github.io/atodashi-janken/` に反映される。

ワークフローはビルドなし静的サイトの最短形(checkout → upload-pages-artifact → deploy-pages の3手)。カメラは HTTPS 必須だが、GitHub Pages は常時 HTTPS なのでそのまま動く。

## 構成(読む順)

| ファイル | 役割 |
|---|---|
| [index.html](index.html) | 構造のみ。看板・土俵・掲示板 |
| [css/style.css](css/style.css) | デザイン(下記「デザイン方針」参照) |
| [js/config.js](js/config.js) | タイミング・しきい値などの調整パラメータ集約 |
| [js/gesture.js](js/gesture.js) | ランドマーク21点→グーチョキパー分類(幾何のみ、ML分類器なし) |
| [js/audio.js](js/audio.js) | 効果音。WebAudioのオシレーターのみで素材ファイルなし |
| [js/ui.js](js/ui.js) | DOM演出。状態は持たない |
| [js/game.js](js/game.js) | 状態機械(idle→chant→judge→result)。反則判定もここ |
| [js/main.js](js/main.js) | MediaPipeとゲームの配線・起動 |

## デザイン方針(AIっぽさの脱却)

参考:[AIっぽいデザインの脱却ガイド](https://nextage-tech.com/blog/2026/06/08/post-7030/)

AI生成デザインの典型(紫グラデ・過剰な光彩・丸カード・無個性フォント)を全部やめて、**昭和の駄菓子屋ゲーセン×漫画**に振り切った:

- 生成り紙の背景+SVG `feTurbulence` によるノイズテクスチャ(画像ファイル不要)
- 光彩(glow)の代わりに**漫画の集中線**(`repeating-conic-gradient` を放射マスクで抜く)
- 丸カードの代わりに角ばった黒枠+ぼかさない「ベタ落ち影」+わずかな傾き(手貼り感)
- フォントは筆文字(Yuji Syuku)・レトロ見出し(RocknRoll One)・電光掲示板(DotGothic16)の混植
- 勝敗は朱色の**ハンコ**(「勝」「反則負け」)をドンと捺す

## 技術的面白ポイント(3行)

- オンデバイスML:MediaPipe Hands(WASM)でブラウザ完結。API不要・映像の外部送信なし
- 指の伸展判定は関節角度ではなく「手首からの距離比(tip vs pip)」。手の回転・傾きに強い
- 誤認識対策のNフレーム一致(デバウンス)と「後出し時間」のトレードオフが、掲示板の ms 表示でそのまま可視化される

## ハマった所(1つ)

グー→パーの遷移中に一瞬「チョキ」と誤認識され、当機が手を出し直す(**後出しの後出し**)。安定化フレーム数を増やすと直るが、今度は反応が遅れて人間に「後出し感」がバレる。現状は3フレーム(約100ms)で妥協。

反則検出も同じトレードオフの裏返しで、勝負判定より厳しめの5フレーム一致にしないと、手を引っ込める途中の誤認識で無実の人が反則負けになる。手を引っ込めるだけならセーフ(変更のみ検出)。

## 過剰版への拡張余地

勝敗判定は `BEATS[相手の手]` を引くだけの1行だが、ネタ帳J1(じゃんけんマイクロサービス)に接続すれば、グー・チョキ・パーを別サービス化して勝敗判定サービスをボトルネックにできる。後出し時間が3桁msに悪化して人間にバレるようになるのが分散システムの学び。
