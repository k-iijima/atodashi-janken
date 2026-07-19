/**
 * config.js — 調整パラメータ集約
 *
 * ゲームの「体感」を決める数値はすべてここに集める。
 * チューニングするときにロジックのファイルを触らなくて済むようにするのが目的。
 */

/** 掛け声・進行のタイミング(ミリ秒) */
export const TIMING = {
  CHANT_BEAT: 650,     // 「じゃん」「けん」の1拍
  JUDGE_TIMEOUT: 2000, // 「ぽん!」後、手が読めるまで待つ上限
  RESULT_MS: 2200,     // 結果表示時間。この間の手替えは「後出し」として検出する
  RETRY_MS: 1200,      // 手が読めなかったときの仕切り直しまでの時間
};

/**
 * フレーム数しきい値
 *
 * カメラは約30fpsなので「3フレーム=約100ms」。
 * すべて「誤認識のチラつき」と「反応の速さ」のトレードオフで決まる:
 * 増やすほど誤動作は減るが、後出しが遅くなって人間にバレる。
 */
export const FRAMES = {
  STABLE: 3,   // 同じ手がこのフレーム数連続したら「出した」と確定
  FOUL: 5,     // 結果表示中の手替え(反則)は少し厳しめに確定(冤罪防止)
  PRESENT: 10, // 手がこのフレーム数連続で見えたら勝負開始
  MISS: 8,     // このフレーム数連続で見失ったら「手を引っ込めた」とみなす
};

/**
 * 指の伸展判定のマージン。
 * 指先が第二関節より「この倍率以上」手首から遠ければ伸びているとみなす。
 * 1.0 に近づけるほど敏感になるが、半端に曲げた指を拾ってしまう。
 */
export const EXTENSION_MARGIN = 1.1;

/** MediaPipe Hands の設定。後出しは速さが正義なので軽量モデル(complexity 0)を使う */
export const HANDS_OPTIONS = {
  maxNumHands: 1,
  modelComplexity: 0,
  minDetectionConfidence: 0.6,
  minTrackingConfidence: 0.5,
};

/** カメラ解像度。上げると認識は安定するが推論が遅くなる */
export const CAMERA_SIZE = { width: 640, height: 480 };
