import { copyFile, mkdir, readFile, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(scriptDirectory, "..");
const { version } = JSON.parse(await readFile(resolve(appRoot, "package.json"), "utf8"));
const source = resolve(appRoot, "dist", "standalone", "index.html");
const releaseDirectory = resolve(appRoot, "..", "release");
const destination = resolve(releaseDirectory, `BOF_Endpoint_Coach_v${version}.html`);

await mkdir(releaseDirectory, { recursive: true });
await copyFile(source, destination);
const info = await stat(destination);
console.log(`Prepared standalone release: ${destination} (${info.size} bytes)`);
