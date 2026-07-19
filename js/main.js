/**
 * main.js — エントリポイント:MediaPipe・カメラ・ゲームの配線
 *
 * 役割は4つ:
 *   1. MediaPipe Hands(手の認識)を初期化する
 *   2. カメラを起動し、毎フレームを Hands に流し込む
 *   3. 認識結果を gesture.js で分類し、game.js に渡す
 *   4. カメラのプルダウン(選択・切り替え・記憶)を面倒みる
 *
 * Hands は CDN のグローバルスクリプトが window に生やすクラス。
 * ES module 側からは「グローバルにあるもの」としてそのまま使う。
 */

import { HANDS_OPTIONS, CAMERA_SIZE } from "./config.js";
import { classify } from "./gesture.js";
import * as cam from "./camera.js";
import * as game from "./game.js";
import * as ui from "./ui.js";

const video = document.getElementById("video");

/** 選んだカメラを覚えておく localStorage のキー */
const CAMERA_KEY = "atodashi-camera-id";

/* ---- MediaPipe Hands のセットアップ ---- */

/** 推論レイテンシ計測用:フレームを送った時刻(send→onResults は直列なので変数1つでよい) */
let sendTime = 0;

/** 最後に認識結果が届いた時刻(ウォッチドッグが見張る) */
let lastResultAt = performance.now();

/** 認識結果が返ってくるたびに呼ばれる(≒毎フレーム) */
function onResults(results) {
  lastResultAt = performance.now();
  ui.updateInferLatency(lastResultAt - sendTime);

  // maxNumHands: 1 なので手は高々1つ
  const landmarks = results.multiHandLandmarks?.[0] ?? null;

  ui.drawSkeleton(landmarks);
  game.onFrame(landmarks ? classify(landmarks) : null, landmarks !== null);
}

/**
 * Hands は使い捨てにできる作りにしておく。
 * WASM 側は長時間動かすと稀に例外を投げたり沈黙したりする
 * (実測:十数戦で手を見失ったまま戻らないことがあった)ので、
 * 異常を検知したら作り直して立て直す。
 */
let hands = null;

function createHands() {
  hands = new Hands({
    // モデル(WASM/バイナリ)の取得先。認識自体はブラウザ内で完結し、映像は送信されない
    locateFile: (f) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${f}`,
  });
  hands.setOptions(HANDS_OPTIONS);
  hands.onResults(onResults);
}
createHands();

/** 認識エンジンを作り直して復帰する(原因は捨てて前に進む) */
function rebuildHands() {
  try { hands.close(); } catch { /* 壊れていて閉じられなくても構わない */ }
  createHands();
  lastResultAt = performance.now(); // 監視タイマーも仕切り直す
  startPump();
}

/* ---- フレーム送りループ ---- */

/**
 * カメラを切り替えるたびに +1 する世代番号。
 * 古いループは自分の世代が過去のものになったことに気付いて自然に止まる
 * (切り替えや再起動のたびにループが二重三重に走るのを防ぐ)。
 */
let generation = 0;

/** send の連続失敗回数。かさんだら認識エンジンごと作り直す */
let sendErrors = 0;

function startPump() {
  const myGen = ++generation;
  const pump = async () => {
    if (myGen !== generation) return; // 新しいループに世代交代した

    // 切り替え直後は映像がまだ来ていないことがある(readyState < 2)
    if (video.readyState >= 2) {
      try {
        sendTime = performance.now();
        await hands.send({ image: video });
        sendErrors = 0;
      } catch {
        // ここで投げっぱなしにするとループごと死んで「手が検出されない」
        // 状態が永遠に続く。失敗はループを続けながら数え、かさんだら再起動
        if (++sendErrors >= 3) {
          sendErrors = 0;
          rebuildHands(); // 新世代のループが立つので、この世代は次で止まる
        }
      }
    }
    requestAnimationFrame(pump);
  };
  requestAnimationFrame(pump);
}

/**
 * ウォッチドッグ:send が「失敗もせず結果も返さず」黙り込むケースの保険。
 * 結果が10秒途絶えたら認識エンジンを作り直す。
 * タブが裏に回ると rAF ごと止まって沈黙と区別できないため、表のときだけ見る。
 */
setInterval(() => {
  if (document.visibilityState === "visible" &&
      video.readyState >= 2 &&
      performance.now() - lastResultAt > 10_000) {
    rebuildHands();
  }
}, 5_000);

/* ---- カメラの起動・切り替え ---- */

/**
 * カメラを起動する。指定カメラが使えなければ既定カメラでやり直す
 * (前回選んだカメラが抜かれていた、などのケース)。
 */
async function boot(deviceId) {
  try {
    await cam.startCamera(video, deviceId, CAMERA_SIZE);
  } catch (e) {
    if (deviceId) {
      localStorage.removeItem(CAMERA_KEY);
      return boot(null); // 既定カメラでリトライ
    }
    ui.setStatus(`カメラを起動できません: ${e.message}(README のローカルサーバ手順をお試しください)`);
    return;
  }
  ui.setStatus("手をカメラに向けると勝負開始");
  startPump();
  await refreshCameraList();
}

/** プルダウンの中身を現状に合わせて作り直す */
async function refreshCameraList() {
  ui.populateCameras(await cam.listCameras(), cam.currentDeviceId());
}

// プルダウンで選ばれたら、そのカメラで再起動して選択を記憶する
ui.onCameraChange((deviceId) => {
  localStorage.setItem(CAMERA_KEY, deviceId);
  boot(deviceId);
});

// カメラの抜き差しで一覧を作り直す
cam.onDeviceChange(refreshCameraList);

// 前回選んだカメラがあればそれで開始
boot(localStorage.getItem(CAMERA_KEY));
