# The bench's Worker for workerd-cpu.ts, served by the workerd binary of wrangler directly
# (workerd serve): the Mana Worker's bundle with recorded D1 answers (replay-worker.js), on
# 127.0.0.1:8787, without wrangler dev's own layers (they cost several ms per request).
# compatibilityDate: the newest this workerd knows (the Worker's own is 2026-10-20).
using Workerd = import "/workerd/workerd.capnp";

const config :Workerd.Config = (
  services = [ (name = "main", worker = .replay) ],
  sockets = [ (name = "http", address = "127.0.0.1:8787", http = (), service = "main") ],
);

const replay :Workerd.Worker = (
  modules = [
    (name = "replay-worker.js", esModule = embed "replay-worker.js"),
    (name = ".out/worker/index.js", esModule = embed ".out/worker/index.js"),
  ],
  compatibilityDate = "2026-10-19",
);
