import { access, copyFile, mkdir, rename, rm, writeFile } from "node:fs/promises";

const outputDirectory = new URL("../dist/client/", import.meta.url);
const pagesBasePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

if (pagesBasePath) {
  const prefixedAssetDirectory = new URL(
    `.${pagesBasePath}/_next/`,
    outputDirectory,
  );
  const rootAssetDirectory = new URL("_next/", outputDirectory);
  await rm(rootAssetDirectory, { recursive: true, force: true });
  await rename(prefixedAssetDirectory, rootAssetDirectory);
  await rm(new URL(`.${pagesBasePath}/`, outputDirectory), {
    recursive: true,
    force: true,
  });
}

for (const route of ["game", "memes"]) {
  const routeDirectory = new URL(`${route}/`, outputDirectory);
  await mkdir(routeDirectory, { recursive: true });
  await copyFile(
    new URL(`${route}.html`, outputDirectory),
    new URL("index.html", routeDirectory),
  );
}

const noJekyllFile = new URL(".nojekyll", outputDirectory);
try {
  await access(noJekyllFile);
} catch {
  await writeFile(noJekyllFile, "");
}
