"""The HTTP/WebSocket shell around ``sim_core``.

This package imports ``sim_core``; ``sim_core`` never imports this. The server owns real-time
concerns only — session lifecycle, the tick timer, action ingestion, and wire framing — while
all simulation logic stays in the pure core.
"""
