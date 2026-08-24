import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { E2E_HOST, E2E_PORT, isPortListening, validateSourceContract } from "./e2e-preflight-lib.mjs";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(scriptDirectory, "..");

async function main() {
  const [packageText, referenceSettingsSource, eventModalSource, dissolvedOxygenSource] = await Promise.all([
    fs.readFile(path.join(appRoot, "package.json"), "utf8"),
    fs.readFile(path.join(appRoot, "src", "data", "referenceSettings.js"), "utf8"),
    fs.readFile(path.join(appRoot, "src", "components", "EventModal.jsx"), "utf8"),
    fs.readFile(path.join(appRoot, "src", "domain", "measurements", "dissolvedOxygen.js"), "utf8"),
  ]);
  const referenceSource = [referenceSettingsSource, eventModalSource, dissolvedOxygenSource].join("\n");
  const contract = validateSourceContract({
    cwd: process.cwd(),
    expectedRoot: appRoot,
    packageJson: JSON.parse(packageText),
    referenceSource,
  });

  if (await isPortListening()) {
    throw new Error(
      `E2E_PORT_ALREADY_IN_USE: ${E2E_HOST}:${E2E_PORT}\n` +
        "기존 개발 서버는 구형 작업공간을 제공할 수 있어 재사용하지 않습니다. " +
        "포트 점유 프로세스와 작업경로를 확인해 종료한 뒤 다시 실행하십시오.",
    );
  }

  process.stdout.write(
    `[E2E PREFLIGHT PASS] workspace=${appRoot} version=${contract.version} port=${E2E_HOST}:${E2E_PORT}:free\n`,
  );
}

main().catch((error) => {
  process.stderr.write(`[E2E PREFLIGHT BLOCKED]\n${error.message}\n`);
  process.exitCode = 1;
});
