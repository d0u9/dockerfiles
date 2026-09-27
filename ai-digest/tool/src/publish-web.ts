// publish-web: copy the page files from the image into the web root.
//
// Everything under the web root except `data/` is replaced, so pages from an
// older release do not linger. `index.html` goes last: until it is replaced,
// the old page keeps loading its old assets, which are removed only after.

import fs from "node:fs";
import path from "node:path";
import { Failure, dirs, log } from "./common.ts";

export function run(): void {
  const source = dirs.appWeb;
  if (!fs.existsSync(path.join(source, "index.html"))) throw new Failure(`no pages in ${source}`);
  fs.mkdirSync(dirs.web, { recursive: true });
  const shipped = new Set(fs.readdirSync(source));
  for (const name of [...shipped].filter((n) => n !== "index.html").sort()) {
    fs.cpSync(path.join(source, name), path.join(dirs.web, name), { recursive: true, force: true });
  }
  const tmp = path.join(dirs.web, ".index.html.tmp");
  fs.copyFileSync(path.join(source, "index.html"), tmp);
  fs.renameSync(tmp, path.join(dirs.web, "index.html"));
  for (const name of fs.readdirSync(dirs.web)) {
    if (!shipped.has(name) && name !== "data" && !name.startsWith(".")) {
      fs.rmSync(path.join(dirs.web, name), { recursive: true, force: true });
    }
  }
  log("publish-web", `published ${shipped.size} entries to ${dirs.web}`);
}
