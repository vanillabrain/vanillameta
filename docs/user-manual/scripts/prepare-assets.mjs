import { copyFile, mkdir, readdir, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const source = new URL("../images/", import.meta.url);
const generated = new URL("../.vitepress/public/", import.meta.url);
// This directory is generated and ignored; never copy other documentation trees.
await rm(generated, { recursive: true, force: true });
const images = new URL("images/", generated);
await mkdir(images, { recursive: true });
const names = (await readdir(source)).filter((name) => name.endsWith(".png"));
for (const name of names)
  await copyFile(new URL(name, source), new URL(name, images));
console.log(
  `Prepared ${names.length} public guide captures in ${fileURLToPath(images)}`
);
