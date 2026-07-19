/**
 * main.js — エントリポイント:MediaPipe とゲームの配線
 *
 * 役割は3つだけ:
 *   1. MediaPipe Hands(手の認識)を初期化する
 *   2. カメラの毎フレームを Hands に流し込む
 *   3. 認識結果を gesture.js で分類し、game.js に渡す
 *
 * Hands / Camera は CDN のグローバルスクリプトが window に生やすクラス。
 * ES module 側からは「グローバルにあるもの」としてそのまま使う。
 */

import { HANDS_OPTIONS, CAMERA_SIZE } from "./config.js";
import { classify } from "./gesture.js";
import * as game from "./game.js";
import * as ui from "./ui.js";

const video = document.getElementById("video");

/** 推論レイテンシ計測用:フレームを送った時刻(send→onResults は直列なので変数1つでよい) */
let sendTime = 0;

/** 認識結果が返ってくるたびに呼ばれる(≒毎フレーム) */
function onResults(results) {
  ui.updateInferLatency(performance.now() - sendTime);

  // maxNumHands: 1 なので手は高々1つ
  const landmarks = results.multiHandLandmarks?.[0] ?? null;

  ui.drawSkeleton(landmarks);
  game.onFrame(landmarks ? classify(landmarks) : null, landmarks !== null);
}

/* ---- MediaPipe Hands のセットアップ ---- */

const hands = new Hands({
  // モデル(WASM/バイナリ)の取得先。認識自体はブラウザ内で完結し、映像は送信されない
  locateFile: (f) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${f}`,
});
hands.setOptions(HANDS_OPTIONS);
hands.onResults(onResults);

/* ---- カメラ起動 ---- */

new Camera(video, {
  onFrame: async () => {
    sendTime = performance.now();
    await hands.send({ image: video });
  },
  ...CAMERA_SIZE,
})
  .start()
  .then(() => ui.setStatus("手をカメラに向けると勝負開始"))
  .catch((e) => {
    ui.setStatus(
      `カメラを起動できません: ${e.message}(README のローカルサーバ手順をお試しください)`
    );
  });
