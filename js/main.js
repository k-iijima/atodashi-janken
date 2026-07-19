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

/** 認識結果が返ってくるたびに呼ばれる(≒毎フレーム) */
function onResults(results) {
  ui.updateInferLatency(performance.now() - sendTime);

  // maxNumHands: 1 なので手は高々1つ
  const landmarks = results.multiHandLandmarks?.[0] ?? null;

  ui.drawSkeleton(landmarks);
  game.onFrame(landmarks ? classify(landmarks) : null, landmarks !== null);
}

const hands = new Hands({
  // モデル(WASM/バイナリ)の取得先。認識自体はブラウザ内で完結し、映像は送信されない
  locateFile: (f) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${f}`,
});
hands.setOptions(HANDS_OPTIONS);
hands.onResults(onResults);

/* ---- フレーム送りループ ---- */

/**
 * カメラを切り替えるたびに +1 する世代番号。
 * 古いループは自分の世代が過去のものになったことに気付いて自然に止まる
 * (切り替えのたびにループが二重三重に走るのを防ぐ)。
 */
let generation = 0;

function startPump() {
  const myGen = ++generation;
  const pump = async () => {
    if (myGen !== generation) return; // 新しいカメラのループに世代交代した
    // 切り替え直後は映像がまだ来ていないことがある(readyState < 2)
    if (video.readyState >= 2) {
      sendTime = performance.now();
      await hands.send({ image: video });
    }
    requestAnimationFrame(pump);
  };
  requestAnimationFrame(pump);
}

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
