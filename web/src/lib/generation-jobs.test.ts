import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { afterEach, describe, expect, it } from "vitest";
import { assertAllowedModel, buildMvpArguments, createGenerationJob, resetJobsForTests } from "./generation-jobs";

afterEach(() => resetJobsForTests());

function fakeSpawn() {
  const child = new EventEmitter() as EventEmitter & { stdout: PassThrough; stderr: PassThrough };
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  return child;
}

describe("génération sécurisée", () => {
  it("construit des arguments séparés", () => {
    const args = buildMvpArguments('bonjour"; rm -rf', true);
    expect(args.at(-2)).toBe('bonjour"; rm -rf');
    expect(args.at(-1)).toBe("--force");
  });
  it("refuse un modèle non autorisé", () => expect(() => assertAllowedModel("cloud:paid")).toThrow("Modèle non autorisé"));
  it("limite à une génération active", () => {
    const spawn = (() => fakeSpawn()) as unknown as typeof import("node:child_process").spawn;
    createGenerationJob({ query: "première", model: "qwen3:14b", force: false }, spawn);
    expect(() => createGenerationJob({ query: "seconde", model: "qwen3:14b", force: false }, spawn)).toThrow("déjà active");
  });
});
