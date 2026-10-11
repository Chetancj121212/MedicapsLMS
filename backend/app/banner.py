"""Minimal black and white landing page and ASCII banner for Medicaps LMS backend."""

ASCII_ART = r"""
   _____ ______ ____  _    __ ______ ____          ___     __     ______ _    __ ______
  / ___// ____// __ \| |  / // ____// __ \        /   |   / /    /  _/  | |  / // ____/
  \__ \/ __/  / /_/ /| | / // __/  / /_/ /       / /| |  / /     / /    | | / // __/   
 ___/ // /___ / _, _/ | |/ // /___ / _, _/       / ___ | / /___ _/ /     | |/ // /___   
/____//_____//_/ |_|  |___//_____//_/ |_|       /_/  |_|/_____//___/     |___//_____/   
"""

ASCII_BANNER = ASCII_ART.strip("\r\n")
MAINTAINED_BY = "...maintained by @chetancj"
MAINTAINED_BY_ALT = "...mainted by @chetancj"


def get_plain_text_response(db_status: str = "ONLINE") -> str:
    """Generate minimal black and white plain text response for CLI / curl."""
    return f"""{ASCII_BANNER}

SERVER ALIVE
DATABASE: {db_status}

Designed & Developed by @chetancj
{MAINTAINED_BY} (https://github.com/Chetancj121212)
Docs: /docs
"""


PLAIN_TEXT_RESPONSE = get_plain_text_response("ONLINE")


def get_landing_html(db_status: str = "ONLINE", host_url: str = "") -> str:
    """Generate minimal black and white root page."""
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Server Alive - Medi-Caps University</title>
  <meta name="description" content="Server Alive - Designed & Developed by @chetancj">
  <style>
    * {{ box-sizing: border-box; margin: 0; padding: 0; }}
    body {{
      background-color: #000000;
      color: #ffffff;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 32px 16px;
      text-align: center;
    }}
    pre {{
      font-size: clamp(8px, 1.4vw, 14px);
      line-height: 1.2;
      margin-bottom: 28px;
      overflow-x: auto;
      max-width: 100%;
      color: #ffffff;
      user-select: all;
    }}
    .status {{
      font-size: 14px;
      letter-spacing: 1.5px;
      font-weight: 700;
      margin-bottom: 16px;
      color: #ffffff;
    }}
    .attribution {{
      font-size: 13px;
      color: #aaaaaa;
      margin-bottom: 22px;
    }}
    .attribution a {{
      color: #ffffff;
      text-decoration: underline;
      text-underline-offset: 3px;
    }}
    .attribution a:hover {{
      color: #888888;
    }}
    .subtext {{
      font-size: 11px;
      color: #555555;
      margin-top: 5px;
    }}
    .docs {{
      font-size: 12px;
      letter-spacing: 0.5px;
    }}
    .docs a {{
      color: #888888;
      text-decoration: none;
      padding: 5px 12px;
      border: 1px solid #333333;
      border-radius: 4px;
      transition: all 0.2s ease;
    }}
    .docs a:hover {{
      color: #ffffff;
      border-color: #ffffff;
    }}
  </style>
</head>
<body>
  <pre>{ASCII_BANNER}</pre>
  <div class="status">
    DATABASE: {db_status}
  </div>
  <div class="attribution">
    Designed &amp; Developed by <a href="https://github.com/Chetancj121212" target="_blank" rel="noopener noreferrer">@chetancj</a>
    <div class="subtext">{MAINTAINED_BY}</div>
  </div>
  <div class="docs">
    <a href="/docs">[ API Docs ]</a>
  </div>
</body>
</html>
"""
