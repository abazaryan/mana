# Single operations of the push in workerd (probe-worker.js, workerd-cpu.ts --probe), served like
# replay.capnp by the workerd binary of wrangler on 127.0.0.1:8787.
using Workerd = import "/workerd/workerd.capnp";

const config :Workerd.Config = (
  services = [ (name = "main", worker = .probe) ],
  sockets = [ (name = "http", address = "127.0.0.1:8787", http = (), service = "main") ],
);

const probe :Workerd.Worker = (
  modules = [
    (name = "probe-worker.js", esModule = embed "probe-worker.js"),
  ],
  compatibilityDate = "2026-10-19",
);
