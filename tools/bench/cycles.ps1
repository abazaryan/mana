# CPU cycles of processes (Windows QueryProcessCycleTime), for workerd-cpu.ts: Windows CPU times
# advance in steps of about 15.6 ms, cycle counters do not.
# Reads commands from stdin, one per line, answers one JSON line each:
#   calibrate      -> {"cyclesPerMicro": n}   (a busy loop of this thread against the wall clock)
#   sample <pids>  -> {"<pid>": cycles, ...}
#   threads <pid>  -> {"<tid>": cycles} for every thread of the process
#   tids <tids>    -> {"<tid>": cycles} for these threads
#   quit
$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public static class ManaCycles {
  [DllImport("kernel32.dll")] public static extern IntPtr OpenProcess(int access, bool inherit, int id);
  [DllImport("kernel32.dll")] public static extern IntPtr OpenThread(int access, bool inherit, int id);
  [DllImport("kernel32.dll")] public static extern bool QueryProcessCycleTime(IntPtr h, out ulong cycles);
  [DllImport("kernel32.dll")] public static extern bool QueryThreadCycleTime(IntPtr h, out ulong cycles);
  [DllImport("kernel32.dll")] public static extern IntPtr GetCurrentThread();
  public static ulong Busy(int micros) {
    var sw = System.Diagnostics.Stopwatch.StartNew();
    ulong c0; QueryThreadCycleTime(GetCurrentThread(), out c0);
    double x = 0; long ticks = (long)(micros * (System.Diagnostics.Stopwatch.Frequency / 1e6));
    while (sw.ElapsedTicks < ticks) { x += Math.Sqrt(x + 1); }
    ulong c1; QueryThreadCycleTime(GetCurrentThread(), out c1);
    return c1 - c0;
  }
}
"@
$QUERY_LIMITED = 0x1000
$handles = @{}
while ($true) {
  $line = [Console]::In.ReadLine()
  if ($line -eq $null -or $line -eq 'quit') { break }
  if ($line -eq 'calibrate') {
    $best = 0
    for ($i = 0; $i -lt 5; $i++) {
      $c = [ManaCycles]::Busy(50000)
      if ($c -gt $best) { $best = $c }
    }
    [Console]::Out.WriteLine((@{ cyclesPerMicro = $best / 50000.0 } | ConvertTo-Json -Compress))
    continue
  }
  if ($line.StartsWith('threads ')) {
    # threads <pid> -> {"<tid>": cycles} for every thread of the process (handles kept open)
    $procId = [int]($line.Substring(8))
    $out = @{}
    foreach ($t in (Get-Process -Id $procId).Threads) {
      $key = "t$($t.Id)"
      if (-not $handles.ContainsKey($key)) { $handles[$key] = [ManaCycles]::OpenThread(0x0800, $false, $t.Id) }
      $cycles = [uint64]0
      [void][ManaCycles]::QueryThreadCycleTime($handles[$key], [ref]$cycles)
      $out["$($t.Id)"] = $cycles
    }
    [Console]::Out.WriteLine(($out | ConvertTo-Json -Compress))
    continue
  }
  if ($line.StartsWith('tids ')) {
    # tids <tid> <tid> ... -> {"<tid>": cycles} for these threads only (fast: no process listing)
    $out = @{}
    foreach ($tid in $line.Substring(5).Split(' ', [StringSplitOptions]::RemoveEmptyEntries)) {
      $key = "t$tid"
      if (-not $handles.ContainsKey($key)) { $handles[$key] = [ManaCycles]::OpenThread(0x0800, $false, [int]$tid) }
      $cycles = [uint64]0
      [void][ManaCycles]::QueryThreadCycleTime($handles[$key], [ref]$cycles)
      $out["$tid"] = $cycles
    }
    [Console]::Out.WriteLine(($out | ConvertTo-Json -Compress))
    continue
  }
  $out = @{}
  foreach ($p in ($line -replace '^sample\s*', '').Split(' ', [StringSplitOptions]::RemoveEmptyEntries)) {
    $procId = [int]$p
    if (-not $handles.ContainsKey($procId)) { $handles[$procId] = [ManaCycles]::OpenProcess($QUERY_LIMITED, $false, $procId) }
    $cycles = [uint64]0
    [void][ManaCycles]::QueryProcessCycleTime($handles[$procId], [ref]$cycles)
    $out["$procId"] = $cycles
  }
  [Console]::Out.WriteLine(($out | ConvertTo-Json -Compress))
}
