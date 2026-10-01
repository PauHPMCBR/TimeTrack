import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const frontendDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const docsDir = resolve(frontendDir, "..", "docs");
const publicDir = join(frontendDir, "public");

mkdirSync(publicDir, { recursive: true });

for (const name of ["guide.pdf", "guide_admin.pdf"]) {
    const source = join(docsDir, name);
    if (existsSync(source)) {
        copyFileSync(source, join(publicDir, name));
        console.log(`== ${name}: copied to frontend/public/${name} ==`);
    } else {
        console.warn(`== ${name}: docs/${name} missing — dev guide link hidden ==`);
    }
}
