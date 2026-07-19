/**
 * gesture.js — 手のランドマーク(21点)からグー・チョキ・パーを分類する
 *
 * MediaPipe Hands は手の関節21点の3D座標(画像内の正規化座標)を返す。
 * ここでは機械学習の分類器を追加せず、幾何学だけで判定する:
 *
 *   「指が伸びている」= 指先(tip)が第二関節(pip)より手首から遠い
 *
 * 関節の角度ではなく「手首からの距離比」を使うのがポイント。
 * 手を回転させたり傾けたりしても、距離の比はほぼ変わらないため頑健になる。
 * (y座標の上下比較で判定すると、手を横に向けた瞬間に壊れる)
 */

import { EXTENSION_MARGIN } from "./config.js";

/** じゃんけんの手の定義。表示絵文字と日本語名 */
export const HAND_EMOJI = { rock: "✊", scissors: "✌️", paper: "✋" };
export const HAND_NAME = { rock: "グー", scissors: "チョキ", paper: "パー" };

/** 相手の手 → それに勝つ手。当機の強さの根源(1行) */
export const BEATS = { rock: "paper", scissors: "rock", paper: "scissors" };

/**
 * ランドマーク番号(MediaPipe Hands 準拠)
 * 0 = 手首。指はそれぞれ [指先(tip), 第二関節(pip)] のペア。
 * 親指は構造上この方法で安定判定できないため、あえて使わない。
 */
const WRIST = 0;
const FINGERS = [
  [8, 6],   // 人差し指
  [12, 10], // 中指
  [16, 14], // 薬指
  [20, 18], // 小指
];

/** 2点間のユークリッド距離(z も含めて3Dで測る) */
function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y, (a.z ?? 0) - (b.z ?? 0));
}

/**
 * 21点のランドマークから手を分類する。
 *
 * @param {Array<{x:number, y:number, z:number}>} landmarks - MediaPipe の multiHandLandmarks[0]
 * @returns {"rock"|"scissors"|"paper"|null} 判定結果。遷移中などで判定不能なら null
 */
export function classify(landmarks) {
  const wrist = landmarks[WRIST];

  // 4本の指それぞれについて「伸びているか」を調べる
  const extended = FINGERS.map(([tip, pip]) =>
    dist(landmarks[tip], wrist) > dist(landmarks[pip], wrist) * EXTENSION_MARGIN
  );
  const count = extended.filter(Boolean).length;

  if (count === 0) return "rock";
  // チョキは「本数2」だけでなく「人差し指+中指」であることまで確認する
  // (薬指+小指の2本をチョキと呼ぶ人はいない)
  if (count === 2 && extended[0] && extended[1]) return "scissors";
  if (count >= 4) return "paper";

  // 1本や3本は グー→パー の遷移途中である可能性が高いので判定しない。
  // ここで無理に判定すると「AIが手を出し直す(後出しの後出し)」事故が起きる。
  return null;
}
