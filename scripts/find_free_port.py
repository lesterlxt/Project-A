import socket
import sys


def main() -> int:
    host = "127.0.0.1"
    start = 8000
    end = 8010

    for port in range(start, end + 1):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            try:
                sock.bind((host, port))
            except OSError:
                continue
            print(port)
            return 0

    print(f"No free local port found in {start}-{end}.", file=sys.stderr)
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
