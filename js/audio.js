/**
 * audio.js — 効果音
 *
 * 音声ファイルを持たず、WebAudio のオシレーターだけで鳴らす。
 * 素材の著作権を気にしなくてよく、リポジトリも軽いまま。
 *
 * 注意:AudioContext はユーザー操作なしに作ると suspended になることがあるが、
 * このアプリは「カメラ許可」という操作を必ず経由するため実用上問題ない。
 * 万一鳴らせなくてもゲーム進行には影響させない(try/catch で握りつぶす)。
 */

let ctx = null;

/**
 * 単音を1つ鳴らす(三角波)。
 * @param {number} freq - 周波数 Hz
 * @param {number} dur - 長さ 秒
 * @param {number} vol - 音量 0〜1
 */
function tone(freq, dur = 0.12, vol = 0.15) {
  try {
    ctx ??= new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.value = freq;
    // 短い減衰(指数)をかけると「ピッ」ではなく「ポン」という太鼓っぽい音になる
    gain.gain.setValueAtTime(vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + dur);
  } catch {
    /* 音が出なくても勝負は続く */
  }
}

/** 「じゃん」「けん」の拍子木 */
export function seChant() { tone(440); }

/** 「ぽん!」の張り扇 */
export function sePon() { tone(880, 0.25, 0.2); }

/** 当機勝利のファンファーレ(2音) */
export function seWin() {
  tone(1320, 0.3, 0.18);
  setTimeout(() => tone(1760, 0.35, 0.18), 90);
}

/** 反則のブブー(低い2音) */
export function seFoul() {
  tone(220, 0.35, 0.22);
  setTimeout(() => tone(165, 0.5, 0.22), 120);
}
