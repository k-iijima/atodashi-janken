/**
 * ui.js — DOM演出
 *
 * 画面への反映だけを担当する。ゲームの状態は一切持たない
 * (状態は game.js、数値は config.js に集約)。
 *
 * CSSアニメーションの再生は「クラスを外す → reflow を挟む → 付け直す」
 * という定石で行う。reflow(offsetWidth の読み取り)を挟まないと、
 * 同じクラスを付け直してもブラウザはアニメーションを再始動してくれない。
 */

import { HAND_EMOJI, HAND_NAME } from "./gesture.js";

const $ = (id) => document.getElementById(id);

/** クラスを付け直してCSSアニメーションを頭から再生する */
function replay(el, ...classes) {
  el.classList.remove("say", "pon", "foul", "count", "show", "go", "on", "reveal");
  void el.offsetWidth; // ← reflow を強制(アニメーション再始動のおまじない)
  el.classList.add(...classes);
}

/* ---------------- 状態表示 ---------------- */

export function setStatus(text) {
  $("status").textContent = text;
}

/* ---------------- 掛け声・集中線 ---------------- */

/**
 * 掛け声を1語表示する。
 * @param {string} word - 表示する語
 * @param {"say"|"pon"|"foul"|"count"} style
 *   通常 / ぽん!(朱・集中線つき) / 反則(朱) / カウントダウン(控えめ)
 */
export function chant(word, style = "say") {
  const el = $("chantText");
  el.textContent = word;
  replay(el, style);
  if (style === "pon") replay($("burst"), "go"); // 集中線は「ぽん!」の瞬間だけ
}

/* ---------------- 当機の手 ---------------- */

/** 待機時に見せるブリキロボ(絵文字🤖はAIっぽいので自前のSVGを使う) */
const ROBOT_HTML =
  '<img class="robot-img" src="assets/robot.svg" alt="当機(ブリキロボット)">';

/** 当機をロボットの姿に戻す。puzzled=true で首をかしげる */
function showRobot(puzzled = false) {
  const el = $("aiHand");
  el.innerHTML = ROBOT_HTML;
  el.classList.toggle("puzzled", puzzled);
}

/** じゃん・けん の間:拳を上下に振る */
export function aiPump() {
  const el = $("aiHand");
  el.textContent = HAND_EMOJI.rock;
  el.classList.remove("reveal", "puzzled");
  el.classList.add("pumping");
}

/** 当機が手を出す(ぽん!の後) */
export function aiReveal(aiHand, userHand) {
  const el = $("aiHand");
  el.classList.remove("pumping", "puzzled");
  el.textContent = HAND_EMOJI[aiHand];
  replay(el, "reveal");
  $("aiLabel").textContent =
    `${HAND_NAME[aiHand]}!(貴殿の${HAND_NAME[userHand]}に勝ち)`;
  replay($("aiStamp"), "on"); // 「勝」のハンコを捺す
}

/** 手が読めなかったとき:ロボが首をかしげる */
export function aiConfused() {
  $("aiHand").classList.remove("pumping");
  showRobot(true);
  $("aiLabel").textContent = "手が読めませんでした。もう一度!";
}

/** 反則(貴殿の後出し)を宣告する */
export function aiCallFoul(newHand) {
  $("aiLabel").textContent =
    `${HAND_NAME[newHand]}への変更を検出。後出しは反則です(当機を除く)`;
  replay($("userStamp"), "on"); // 挑戦者側に「反則負け」のハンコ
}

/** 次の勝負に向けて盤面を初期状態へ戻す(判定写真も外す) */
export function resetBoard() {
  $("aiHand").classList.remove("pumping", "reveal");
  showRobot();
  $("aiLabel").textContent = "";
  $("aiStamp").classList.remove("on");
  $("userStamp").classList.remove("on");
  unfreeze();
}

/* ---------------- 勝敗の札 ---------------- */

/**
 * @param {string} text - 札に書く文言
 * @param {boolean} isFoul - 反則宣告なら朱色の札にする
 */
export function verdict(text, isFoul = false) {
  const el = $("verdict");
  el.textContent = text;
  el.classList.toggle("foul-v", isFoul);
  replay(el, "show", ...(isFoul ? ["foul-v"] : []));
}

/* ---------------- 場内掲示板(戦績) ---------------- */

/**
 * @param {{rounds:number, wins:number, fouls:number, reaction?:number, reactionAvg?:number}} s
 */
export function updateScore(s) {
  $("rounds").textContent = s.rounds;
  $("wins").textContent = s.wins;
  $("rate").textContent = s.rounds ? (s.wins / s.rounds * 100).toFixed(1) + "%" : "---";
  $("fouls").textContent = s.fouls;
  if (s.reaction != null) $("react").textContent = s.reaction.toFixed(0) + "ms";
  if (s.reactionAvg != null) $("reactAvg").textContent = s.reactionAvg.toFixed(0) + "ms";
}

/** 推論レイテンシ(毎フレーム更新なので個別関数にしている) */
export function updateInferLatency(ms) {
  $("infer").textContent = ms.toFixed(0) + "ms";
}

/* ---------------- 判定写真(フレーム凍結) ---------------- */

const freezeCanvas = $("freeze");
const fctx = freezeCanvas.getContext("2d");

/**
 * いまのカメラ映像+骨格を判定写真として焼き付け、ライブ映像の上に被せる。
 * 以降、画面上の挑戦者は「判定の瞬間」で止まって見える
 * (裏ではカメラも認識も動き続けている。止まるのは表示だけ)。
 *
 * @param {string} tagText - 写真に貼る札の文言(「判定写真」「犯行写真」)
 */
export function freezeFrame(tagText) {
  const video = document.getElementById("video");
  fctx.drawImage(video, 0, 0, freezeCanvas.width, freezeCanvas.height);
  fctx.drawImage(canvas, 0, 0); // 骨格の線ごと写真に残す
  freezeCanvas.classList.add("on");
  const tag = $("photoTag");
  tag.textContent = tagText;
  tag.classList.add("on");
}

/** 判定写真を外してライブ映像に戻す */
export function unfreeze() {
  freezeCanvas.classList.remove("on");
  $("photoTag").classList.remove("on");
}

/* ---------------- カウントダウン ---------------- */

/** 次の勝負までの数字を1つ表示する */
export function countdown(n) {
  chant(String(n), "count");
}

/* ---------------- 骨格描画 ---------------- */

const canvas = $("skeleton");
const cctx = canvas.getContext("2d");

/**
 * 手の骨格をビデオに重ねて描く(GIF映え担当)。
 * drawConnectors / drawLandmarks / HAND_CONNECTIONS は
 * @mediapipe/drawing_utils がグローバルに生やす関数をそのまま使う。
 */
export function drawSkeleton(landmarks) {
  cctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!landmarks) return;
  drawConnectors(cctx, landmarks, HAND_CONNECTIONS, { color: "#274a78", lineWidth: 3 });
  drawLandmarks(cctx, landmarks, { color: "#c73e2d", radius: 4 });
}
