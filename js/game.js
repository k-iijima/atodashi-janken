/**
 * game.js — ゲーム進行の状態機械
 *
 * 状態遷移:
 *
 *   idle ──手を検出──▶ chant(じゃん・けん・ぽん!)
 *                         │ ぽん!
 *                         ▼
 *                       judge(手を読む)──読めた──▶ result(当機が後出しして勝つ)
 *                         │ タイムアウト                │
 *                         ▼                            │ 手替えを検出 → 反則宣告(result継続)
 *                       result(不成立)                 │
 *                         │                            │
 *                         └──手が見えていれば chant へ / いなければ idle へ
 *
 * このファイルは「毎フレームの観測結果」を受け取って状態を進めるだけで、
 * DOM には触らない(演出は ui.js に依頼する)。
 */

import { TIMING, FRAMES } from "./config.js";
import { BEATS } from "./gesture.js";
import * as ui from "./ui.js";
import * as se from "./audio.js";

/* ---------------- 内部状態 ---------------- */

let state = "idle"; // idle | chant | judge | result

// 手のデバウンス:同じ判定が何フレーム続いたか
let candidate = null;      // 直近の生判定(rock/scissors/paper/null)
let candidateCount = 0;    // それが連続したフレーム数
let candidateSince = 0;    // その手を最初に観測した時刻(後出し時間の起点)

// 手の在・不在
let presentCount = 0; // 手が連続で見えているフレーム数
let missCount = 0;    // 手を連続で見失っているフレーム数

// 勝負ごとの記録
let ponAt = 0;          // 「ぽん!」を宣言した時刻
let judgedHand = null;  // この勝負で挑戦者が出したと判定した手(nullなら不成立)
let judgeTimer = 0;
let resultTimer = 0;

// 戦績
const stats = { rounds: 0, wins: 0, fouls: 0 };
const reactTimes = []; // 後出し時間の履歴(平均計算用)

/* ---------------- 進行 ---------------- */

/** 「じゃん、けん、ぽん!」を開始する */
function startChant() {
  state = "chant";
  ui.resetBoard();
  ui.aiPump();
  ui.setStatus("");

  ui.chant("じゃん");
  se.seChant();
  setTimeout(() => { ui.chant("けん"); se.seChant(); }, TIMING.CHANT_BEAT);
  setTimeout(() => {
    ui.chant("ぽん!", "pon");
    se.sePon();
    state = "judge";
    ponAt = performance.now();
    // ぽん!より前に出していた手を拾わないよう、デバウンスを仕切り直す
    candidate = null;
    candidateCount = 0;
    judgeTimer = setTimeout(onJudgeTimeout, TIMING.JUDGE_TIMEOUT);
  }, TIMING.CHANT_BEAT * 2);
}

/** ぽん!のあと時間内に手が読めなかった:不成立として仕切り直す */
function onJudgeTimeout() {
  if (state !== "judge") return;
  state = "result";
  judgedHand = null; // 不成立ラウンド:このあと手を出しても後出し扱いにしない
  ui.aiConfused();
  resultTimer = setTimeout(nextRoundOrIdle, TIMING.RETRY_MS);
}

/** 挑戦者の手が確定した:当機が後出しして勝つ */
function aiPlay(userHand) {
  clearTimeout(judgeTimer);
  state = "result";
  judgedHand = userHand;

  // 後出し時間 = 「手が見え始めてから当機が出すまで」。
  // ただし ぽん! より前から出しっぱなしの手は ぽん! を起点にする
  // (でないと後出し時間がマイナスになり自慢にならない)
  const reaction = performance.now() - Math.max(ponAt, candidateSince);

  ui.aiReveal(BEATS[userHand], userHand);
  ui.verdict("当機の勝ち!!");
  se.seWin();

  stats.rounds++;
  stats.wins++;
  reactTimes.push(reaction);
  ui.updateScore({
    ...stats,
    reaction,
    reactionAvg: reactTimes.reduce((a, b) => a + b, 0) / reactTimes.length,
  });

  // 手を出し続けていれば自動で次の勝負へ(この間の手替えは後出しとして検出する)
  resultTimer = setTimeout(nextRoundOrIdle, TIMING.RESULT_MS);
}

/** 結果表示中に挑戦者が手を変えた:後出しにつき反則負け */
function foul(newHand) {
  clearTimeout(resultTimer);
  judgedHand = newHand; // さらに変えたら、また検出する(何度でも)

  ui.chant("後出し!", "foul");
  ui.aiCallFoul(newHand);
  ui.verdict("貴殿の反則負け!!", true);
  se.seFoul();

  // 反則も当機の勝ち。勝率100%は揺るがない
  stats.rounds++;
  stats.wins++;
  stats.fouls++;
  ui.updateScore(stats);

  resultTimer = setTimeout(nextRoundOrIdle, TIMING.RESULT_MS);
}

/** 結果表示が終わった:手が見えていれば次の勝負、いなければ待機に戻る */
function nextRoundOrIdle() {
  if (presentCount > 0) {
    startChant();
  } else {
    state = "idle";
    ui.resetBoard();
  }
}

/* ---------------- 毎フレームの入口 ---------------- */

/**
 * 認識結果を1フレームぶん受け取り、状態を進める。
 * main.js の MediaPipe コールバックから毎フレーム呼ばれる。
 *
 * @param {"rock"|"scissors"|"paper"|null} raw - このフレームの生判定
 * @param {boolean} present - このフレームで手が見えているか
 */
export function onFrame(raw, present) {
  // --- 手の在・不在を数える ---
  if (present) {
    presentCount++;
    missCount = 0;
  } else {
    presentCount = 0;
    missCount++;
  }

  // --- 待機中:手が見えたら開戦 ---
  if (state === "idle") {
    ui.setStatus(present ? "" : "手をカメラに向けると勝負開始");
    if (presentCount >= FRAMES.PRESENT) startChant();
    return;
  }

  // --- デバウンス:同じ判定が連続した回数を数える ---
  // 1フレームの誤認識で当機が誤爆しないための核心部分。
  if (present) {
    if (raw !== candidate) {
      candidate = raw;
      candidateCount = 1;
      candidateSince = performance.now();
    } else if (raw !== null) {
      candidateCount++;
    }
  }

  // --- 判定中:手が安定したら当機が後出しする ---
  if (state === "judge" && candidate !== null && candidateCount >= FRAMES.STABLE) {
    aiPlay(candidate);
    return;
  }

  // --- 結果表示中:手替え(貴殿の後出し)を監視する ---
  // 条件をすべて満たしたときだけ反則:
  //   ・成立した勝負である(judgedHand がある)
  //   ・判定した手と違う有効な手に変わった
  //   ・通常より厳しいフレーム数だけ連続した(冤罪防止)
  // なお手を引っ込めるだけ(candidate が null)はセーフ。
  if (state === "result" && judgedHand !== null &&
      candidate !== null && candidate !== judgedHand &&
      candidateCount >= FRAMES.FOUL) {
    foul(candidate);
  }
}
