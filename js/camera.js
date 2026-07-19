/**
 * camera.js — カメラの起動・停止・列挙
 *
 * MediaPipe 付属の Camera ユーティリティは使うカメラ(deviceId)を
 * 指定できないため、getUserMedia を直接叩く。フレームを認識に送る
 * ループは main.js 側の責務(ここはデバイスの面倒だけを見る)。
 *
 * 注意:enumerateDevices() のカメラ名(label)は、一度カメラ許可を
 * 得るまで空文字になるブラウザが多い。そのため「起動してから列挙」
 * の順で呼ぶこと。
 */

/** いま使っているストリーム(切り替え時に止めるために保持) */
let currentStream = null;

/**
 * カメラを起動して video 要素に流し込む。
 *
 * @param {HTMLVideoElement} video
 * @param {string|null} deviceId - 使うカメラ。null なら OS の既定
 * @param {{width:number, height:number}} size - 希望解像度(ideal 指定)
 */
export async function startCamera(video, deviceId, size) {
  // 前のストリームを止める(止めないとカメラのLEDが点きっぱなしになる)
  stopCamera();

  const constraints = {
    audio: false,
    video: {
      width: { ideal: size.width },
      height: { ideal: size.height },
      // exact 指定:そのカメラが使えないなら素直に失敗させ、
      // 呼び出し側で既定カメラにフォールバックする
      ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
    },
  };

  const stream = await navigator.mediaDevices.getUserMedia(constraints);
  currentStream = stream;
  video.srcObject = stream;
  await video.play();
  return stream;
}

/** カメラを止める */
export function stopCamera() {
  currentStream?.getTracks().forEach((t) => t.stop());
  currentStream = null;
}

/** いま使っているカメラの deviceId(プルダウンの初期選択用) */
export function currentDeviceId() {
  return currentStream?.getVideoTracks()[0]?.getSettings().deviceId ?? null;
}

/** 接続されているカメラの一覧 */
export async function listCameras() {
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices.filter((d) => d.kind === "videoinput");
}

/** カメラの抜き差しを監視する(一覧の作り直し用) */
export function onDeviceChange(handler) {
  navigator.mediaDevices.addEventListener("devicechange", handler);
}
