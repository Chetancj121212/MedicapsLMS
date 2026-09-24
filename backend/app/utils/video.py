"""Video utilities for metadata extraction."""

import struct
from typing import Optional, Tuple
from urllib.parse import parse_qs, urlparse


def detect_video_source(url: str) -> Tuple[str, str]:
    """Return (source_type, file/video id) for supported hosted video URLs."""
    try:
        parsed = urlparse(url.strip())
    except ValueError as exc:
        raise ValueError("Enter a valid YouTube or Google Drive video URL") from exc

    host = parsed.netloc.lower().removeprefix("www.")
    path = [part for part in parsed.path.split("/") if part]
    if host in {"youtube.com", "m.youtube.com"}:
        video_id = parse_qs(parsed.query).get("v", [None])[0]
        if not video_id and len(path) >= 2 and path[0] == "embed":
            video_id = path[1]
        if video_id and len(video_id) == 11:
            return "youtube", video_id
    elif host == "youtu.be" and path and len(path[0]) == 11:
        return "youtube", path[0]

    if host == "drive.google.com":
        file_id = None
        if len(path) >= 3 and path[0] == "file" and path[1] == "d":
            file_id = path[2]
        elif path and path[0] == "open":
            file_id = parse_qs(parsed.query).get("id", [None])[0]
        if file_id:
            return "google_drive", file_id

    raise ValueError("Unsupported video URL. Use a YouTube or Google Drive file URL")


def get_mp4_duration(filepath: str) -> Optional[float]:
    """
    Directly extract duration in seconds from an MP4 video file
    by reading the ISO base media file format 'mvhd' atom without external tools.
    """
    try:
        with open(filepath, "rb") as f:
            while True:
                header = f.read(8)
                if len(header) < 8:
                    break
                size, atom_type = struct.unpack(">I4s", header)
                if size == 1:
                    ext_size = f.read(8)
                    if len(ext_size) < 8:
                        break
                    size = struct.unpack(">Q", ext_size)[0] - 8
                elif size == 0:
                    break

                if atom_type == b"moov":
                    sub_bytes = f.read(size - 8)
                    pos = 0
                    while pos < len(sub_bytes) - 8:
                        sub_size, sub_type = struct.unpack(">I4s", sub_bytes[pos : pos + 8])
                        if sub_size == 1:
                            sub_size = struct.unpack(">Q", sub_bytes[pos + 8 : pos + 16])[0]
                            header_len = 16
                        else:
                            header_len = 8

                        if sub_type == b"mvhd":
                            mvhd_data = sub_bytes[pos + header_len : pos + sub_size]
                            version = mvhd_data[0]
                            if version == 0:
                                timescale, dur = struct.unpack(">II", mvhd_data[12:20])
                            elif version == 1:
                                timescale, dur = struct.unpack(">IQ", mvhd_data[20:32])
                            else:
                                return None
                            if timescale > 0:
                                return round(dur / timescale, 2)
                            return None

                        if sub_size <= 0:
                            break
                        pos += sub_size
                    break
                else:
                    f.seek(size - 8, 1)
    except Exception:
        return None
    return None
