import { copyFile, mkdir, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(scriptDirectory, "..");
const source = resolve(appRoot, "dist", "standalone", "index.html");
const releaseDirectory = resolve(appRoot, "..", "release");
const destination = resolve(releaseDirectory, "BOF_Endpoint_Coach_v0.1.0.html");

await mkdir(releaseDirectory, { recursive: true });
await copyFile(source, destination);
const info = await stat(destination);
console.log(`Prepared standalone release: ${destination} (${info.size} bytes)`);
