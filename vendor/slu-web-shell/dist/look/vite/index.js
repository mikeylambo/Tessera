const SAFE_FILE = /^[\w.-]+\.json$/;
export function sluTuning(options = {}) {
    const route = options.route ?? "/__slu/tuning";
    return {
        name: "slu-tuning",
        apply: "serve",
        async configureServer(server) {
            const nodeFs = "node:fs/promises";
            const nodePath = "node:path";
            const fs = await import(/* @vite-ignore */ nodeFs);
            const path = await import(/* @vite-ignore */ nodePath);
            const dir = path.resolve(server.config.root, options.dir ?? "tuning");
            const send = (res, status, body) => {
                res.statusCode = status;
                res.setHeader("content-type", "application/json");
                res.end(JSON.stringify(body));
            };
            server.middlewares.use(async (req, res, next) => {
                if (!req.url?.startsWith(route))
                    return next();
                const url = new URL(req.url, "http://localhost");
                try {
                    if (url.pathname === `${route}/list`) {
                        await fs.mkdir(dir, { recursive: true });
                        return send(res, 200, (await fs.readdir(dir)).filter((f) => SAFE_FILE.test(f)).sort());
                    }
                    if (url.pathname === `${route}/file`) {
                        const name = url.searchParams.get("name") ?? "";
                        if (!SAFE_FILE.test(name))
                            return send(res, 400, { error: "bad name" });
                        return send(res, 200, JSON.parse(await fs.readFile(path.join(dir, name), "utf8")));
                    }
                    if (url.pathname === `${route}/save` && req.method === "POST") {
                        let raw = "";
                        await new Promise((resolve) => { req.on("data", (c) => { raw += String(c); }); req.on("end", () => resolve()); });
                        const { file, preset } = JSON.parse(raw);
                        if (!SAFE_FILE.test(file))
                            return send(res, 400, { error: "bad file" });
                        await fs.mkdir(dir, { recursive: true });
                        await fs.writeFile(path.join(dir, file), JSON.stringify(preset, null, 2) + "\n");
                        return send(res, 200, { ok: true, file });
                    }
                    return send(res, 404, { error: "unknown" });
                }
                catch (error) {
                    return send(res, 500, { error: String(error) });
                }
            });
        }
    };
}
