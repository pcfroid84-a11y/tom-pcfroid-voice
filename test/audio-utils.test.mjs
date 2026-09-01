import test from "node:test";
import assert from "node:assert/strict";
import {
  decodeMulawByte,
  encodeMulawSample,
  amplifyMulawBase64,
} from "../audio-utils.mjs";

test("le silence G711 reste du silence", () => {
  assert.equal(decodeMulawByte(0xff), 0);
  assert.equal(encodeMulawSample(0), 0xff);
  assert.equal(amplifyMulawBase64(Buffer.from([0xff, 0xff]).toString("base64"), 1.12), Buffer.from([0xff, 0xff]).toString("base64"));
});

test("le gain augmente une amplitude sans changer le format", () => {
  const originalByte = encodeMulawSample(5000);
  const original = Buffer.from([originalByte]).toString("base64");
  const amplified = amplifyMulawBase64(original, 1.12);
  const amplifiedByte = Buffer.from(amplified, "base64")[0];

  assert.ok(Math.abs(decodeMulawByte(amplifiedByte)) > Math.abs(decodeMulawByte(originalByte)));
});

test("un gain neutre laisse le payload intact", () => {
  const payload = Buffer.from([0xff, 0x7f, 0x00]).toString("base64");
  assert.equal(amplifyMulawBase64(payload, 1), payload);
});
