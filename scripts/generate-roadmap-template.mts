import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildCourse30Template } from "../lib/roadmap/templates/course30";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const targets = [
  join(root, "public/docs/roadmap-course-30.template.json"),
  join(root, "docs/roadmap-course-30.template.json"),
];

const json = `${JSON.stringify(buildCourse30Template(), null, 2)}\n`;

for (const target of targets) {
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, json, "utf8");
}

console.log(`Wrote ${targets.length} template files.`);
