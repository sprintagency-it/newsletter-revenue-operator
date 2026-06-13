import { cp, mkdir, rm } from "node:fs/promises";

const dist = new URL("./dist/", import.meta.url);
const files = [
  "index.html",
  "thank-you.html",
  "00_preview-hub.html",
  "_headers",
  "robots.txt",
  "sitemap.xml",
  "llms.txt"
];
const directories = [
  "assets",
  "checkout",
  "cookie-policy",
  "newsletter-revenue-system",
  "privacy-policy"
];

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });

for (const file of files) {
  await cp(new URL(file, import.meta.url), new URL(file, dist));
}

for (const directory of directories) {
  await cp(new URL(`${directory}/`, import.meta.url), new URL(`${directory}/`, dist), {
    recursive: true
  });
}
