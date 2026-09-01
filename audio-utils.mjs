const MULAW_BIAS = 0x84;
const MULAW_CLIP = 32635;

export function decodeMulawByte(byte) {
  const value = (~Number(byte)) & 0xff;
  const sign = value & 0x80;
  const exponent = (value >> 4) & 0x07;
  const mantissa = value & 0x0f;

  let sample = ((mantissa << 3) + MULAW_BIAS) << exponent;
  sample -= MULAW_BIAS;
  return sign ? -sample : sample;
}

export function encodeMulawSample(sample) {
  let pcm = Math.round(Number(sample) || 0);
  let sign = 0;

  if (pcm < 0) {
    sign = 0x80;
    pcm = -pcm;
  }

  pcm = Math.min(pcm, MULAW_CLIP) + MULAW_BIAS;

  let exponent = 7;
  for (let mask = 0x4000; exponent > 0 && (pcm & mask) === 0; mask >>= 1) {
    exponent -= 1;
  }

  const mantissa = (pcm >> (exponent + 3)) & 0x0f;
  return (~(sign | (exponent << 4) | mantissa)) & 0xff;
}

export function amplifyMulawBase64(payload, gain = 1.12) {
  const source = String(payload || "");
  const numericGain = Number(gain);

  if (!source || !Number.isFinite(numericGain) || numericGain <= 1) {
    return source;
  }

  const audio = Buffer.from(source, "base64");
  for (let i = 0; i < audio.length; i += 1) {
    const sample = decodeMulawByte(audio[i]);
    const amplified = Math.max(-MULAW_CLIP, Math.min(MULAW_CLIP, sample * numericGain));
    audio[i] = encodeMulawSample(amplified);
  }

  return audio.toString("base64");
}
