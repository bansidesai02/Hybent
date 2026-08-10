import socket

# Monkeypatch socket.getaddrinfo to force IPv4 resolution.
# This prevents '[Errno 101] Network is unreachable' errors on Render/Docker environments
# that lack outbound IPv6 routing.
orig_getaddrinfo = socket.getaddrinfo
def getaddrinfo_ipv4(*args, **kwargs):
    responses = orig_getaddrinfo(*args, **kwargs)
    return [r for r in responses if r[0] == socket.AF_INET]
socket.getaddrinfo = getaddrinfo_ipv4
