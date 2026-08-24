import net from "node:net";
import path from "node:path";

export const E2E_HOST = "127.0.0.1";
export const E2E_PORT = 5173;

const VERSION_SOURCE_MARKERS = {
  "0.7.2": ["additionModelProfiles", "createLiteratureAdditionProfile"],
  "0.7.3": ["additionModelProfiles", "createLiteratureAdditionProfile", "OptionalDissolvedOxygenSection", "not_recorded"],
};

export function validateSourceContract({ cwd, expectedRoot, packageJson, referenceSource }) {
  const actualRoot = path.resolve(cwd);
  const requiredRoot = path.resolve(expectedRoot);
  if (actualRoot !== requiredRoot) {
    throw new Error(`E2E_WORKSPACE_MISMATCH: expected=${requiredRoot} actual=${actualRoot}`);
  }
  if (packageJson?.name !== "bof-endpoint-coach") {
    throw new Error(`E2E_PACKAGE_MISMATCH: name=${packageJson?.name ?? "missing"}`);
  }
  const markers = VERSION_SOURCE_MARKERS[packageJson.version];
  if (!markers) {
    throw new Error(`E2E_SOURCE_CONTRACT_MISSING: version=${packageJson.version ?? "missing"}`);
  }
  const missing = markers.filter((marker) => !referenceSource.includes(marker));
  if (missing.length) {
    throw new Error(`E2E_SOURCE_MARKER_MISSING: version=${packageJson.version} markers=${missing.join(",")}`);
  }
  return { appName: packageJson.name, version: packageJson.version, markers };
}

export function isPortListening({ host = E2E_HOST, port = E2E_PORT, timeoutMs = 700 } = {}) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host, port });
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(result);
    };
    socket.setTimeout(timeoutMs);
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false));
    socket.once("error", (error) => {
      if (error.code === "ECONNREFUSED" || error.code === "EHOSTUNREACH") finish(false);
      else reject(error);
    });
  });
}
