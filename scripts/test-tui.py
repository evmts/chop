"""Drive the bundled TUI in a terminal, including account regeneration and compilation."""

import errno
import fcntl
import os
import pty
import re
import select
import struct
import subprocess
import tempfile
import termios
import time
from pathlib import Path


CSI = re.compile(rb"\x1b\[[0-?]*[ -/]*[@-~]")


def expect(master, expected):
    output = b""
    deadline = time.monotonic() + 15
    while expected not in CSI.sub(b"", output) and time.monotonic() < deadline:
        if not select.select([master], [], [], 0.1)[0]:
            continue
        try:
            output += os.read(master, 65536)
        except OSError as error:
            if error.errno != errno.EIO:
                raise
            break
    if expected not in CSI.sub(b"", output):
        clean = CSI.sub(b"", output)
        clean = re.sub(rb" {2,}", b" ", clean)
        raise AssertionError(f"Expected terminal to display {expected!r}. Output: {clean[-2000:]!r}")


def check_tui(directory):
    cli = Path(__file__).resolve().parents[1] / "dist/bin/chop.js"
    master, slave = pty.openpty()
    fcntl.ioctl(slave, termios.TIOCSWINSZ, struct.pack("HHHH", 40, 160, 0, 0))
    child = subprocess.Popen(
        ["bun", str(cli)],
        cwd=directory,
        stdin=slave,
        stdout=slave,
        stderr=slave,
        env={**os.environ, "TERM": "xterm-256color"},
    )
    os.close(slave)
    try:
        expect(master, b"Chain ID")
        for key, text in [
            (b"7", b"Regenerate accounts"),
            (b"g", b"invalidate snapshots"),
            (b"y", b"10 funded"),
            (b"9", b"Counter.sol"),
            # The bytecode pane is newly drawn. Status lines are incremental.
            (b"\r", b"0x60806040"),
        ]:
            os.write(master, key)
            expect(master, text)
        os.write(master, b"q")
        # Drain final redraws and terminal restoration while the process exits.
        deadline = time.monotonic() + 10
        while child.poll() is None and time.monotonic() < deadline:
            if select.select([master], [], [], 0.1)[0]:
                try:
                    os.read(master, 65536)
                except OSError as error:
                    if error.errno != errno.EIO:
                        raise
                    break
        if child.wait(timeout=1) != 0:
            raise AssertionError("The TUI did not exit cleanly")
    finally:
        if child.poll() is None:
            child.kill()
            child.wait(timeout=5)
        os.close(master)


with tempfile.TemporaryDirectory(prefix="chop-tui-") as directory:
    (Path(directory) / "Counter.sol").write_text(
        "// SPDX-License-Identifier: MIT\npragma solidity ^0.8.0; contract Counter {}",
        encoding="utf-8",
    )
    check_tui(directory)
print("PASS: packaged TUI account regeneration and Solidity compilation")
