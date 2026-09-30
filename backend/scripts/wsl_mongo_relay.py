"""Make the MongoDB running inside WSL reachable from Windows at 127.0.0.1:27017.

WSL's own localhost forwarding (wslrelay) stops working on this machine a few
seconds after WSL starts — Docker inside WSL breaks it. This relay doesn't use
WSL networking at all: each Windows connection is piped through `wsl.exe` to a
tiny Python bridge inside WSL that talks to mongod on WSL's 127.0.0.1:27017.

Run on Windows and leave it open (Ctrl+C stops it):
    python backend\\scripts\\wsl_mongo_relay.py
"""

from __future__ import annotations

import asyncio
import sys

LISTEN_HOST = "127.0.0.1"
PORT = 27017
DISTRO = "Ubuntu"
CHUNK = 65536

# Runs inside WSL: stdin -> mongod, mongod -> stdout, raw bytes both ways.
BRIDGE = r"""
import os, socket, threading
s = socket.create_connection(("127.0.0.1", %d))
def up():
    while True:
        b = os.read(0, %d)
        if not b:
            break
        s.sendall(b)
    try:
        s.shutdown(socket.SHUT_WR)
    except OSError:
        pass
threading.Thread(target=up, daemon=True).start()
while True:
    b = s.recv(%d)
    if not b:
        break
    while b:
        b = b[os.write(1, b):]
""" % (PORT, CHUNK, CHUNK)


async def pump(reader: asyncio.StreamReader, write, close) -> None:
    try:
        while data := await reader.read(CHUNK):
            await write(data)
    except (ConnectionError, OSError):
        pass
    finally:
        await close()


async def handle(client_r: asyncio.StreamReader, client_w: asyncio.StreamWriter) -> None:
    proc = await asyncio.create_subprocess_exec(
        "wsl.exe", "-d", DISTRO, "-e", "python3", "-c", BRIDGE,
        stdin=asyncio.subprocess.PIPE,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.DEVNULL,
    )

    async def to_wsl(data: bytes) -> None:
        proc.stdin.write(data)
        await proc.stdin.drain()

    async def close_wsl() -> None:
        if not proc.stdin.is_closing():
            proc.stdin.close()

    async def to_client(data: bytes) -> None:
        client_w.write(data)
        await client_w.drain()

    async def close_client() -> None:
        client_w.close()

    await asyncio.gather(
        pump(client_r, to_wsl, close_wsl),
        pump(proc.stdout, to_client, close_client),
    )
    if proc.returncode is None:
        proc.kill()
    await proc.wait()


async def main() -> None:
    try:
        server = await asyncio.start_server(handle, LISTEN_HOST, PORT)
    except OSError as e:
        sys.exit(f"cannot listen on {LISTEN_HOST}:{PORT} ({e}) — is something else already on it?")
    print(f"relaying {LISTEN_HOST}:{PORT} -> WSL {DISTRO} mongod (Ctrl+C to stop)", flush=True)
    async with server:
        await server.serve_forever()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass
