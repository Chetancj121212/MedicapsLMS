"""Landing page banner and HTML templates for Medicaps LMS backend."""

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

PLAIN_TEXT_RESPONSE = f"""{ASCII_BANNER}

========================================================================================
                             {MAINTAINED_BY}
========================================================================================

  [+] Status:         SERVER ALIVE (200 OK)
  [+] Project:        Medi-Caps University ECE LMS API
  [+] Institution:    Medi-Caps University, Indore
  [+] Department:     Electronics & Communication Engineering
  [+] Documentation:  /docs  |  /redoc
  [+] Health Check:   /api/health
  [+] Maintainer:     @chetancj (https://github.com/Chetancj121212)
"""


def get_landing_html(host_url: str = "") -> str:
    """Generate modern dark-mode terminal landing page."""
    curl_command = f"curl -s {host_url or 'http://localhost:8000'}/"
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Server Alive — Medi-Caps University ECE LMS Backend</title>
  <meta name="description" content="Backend API Server Alive - Maintained by @chetancj - Department of Electronics Engineering, Medi-Caps University">
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='42' fill='%230b0f19' stroke='%2310b981' stroke-width='8'/><circle cx='50' cy='50' r='20' fill='%2310b981'/></svg>">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;600;700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    :root {{
      --bg: #07090e;
      --card-bg: rgba(13, 17, 24, 0.85);
      --card-border: rgba(255, 255, 255, 0.08);
      --emerald: #10b981;
      --emerald-glow: rgba(16, 185, 129, 0.45);
      --cyan: #06b6d4;
      --cyan-glow: rgba(6, 182, 212, 0.4);
      --text-main: #f1f5f9;
      --text-muted: #94a3b8;
      --text-dim: #64748b;
      --accent-gradient: linear-gradient(135deg, #10b981 0%, #06b6d4 100%);
    }}

    * {{
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }}

    body {{
      background-color: var(--bg);
      color: var(--text-main);
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 24px 16px;
      position: relative;
      overflow-x: hidden;
    }}

    /* Subtle background grid & glowing orb */
    body::before {{
      content: '';
      position: fixed;
      inset: 0;
      background-image: 
        radial-gradient(circle at 50% 10%, rgba(16, 185, 129, 0.12) 0%, transparent 60%),
        radial-gradient(circle at 80% 90%, rgba(6, 182, 212, 0.08) 0%, transparent 50%),
        linear-gradient(rgba(255, 255, 255, 0.015) 1px, transparent 1px),
        linear-gradient(90deg, rgba(255, 255, 255, 0.015) 1px, transparent 1px);
      background-size: 100% 100%, 100% 100%, 32px 32px, 32px 32px;
      pointer-events: none;
      z-index: 0;
    }}

    .container {{
      width: 100%;
      max-width: 920px;
      position: relative;
      z-index: 1;
      display: flex;
      flex-direction: column;
      gap: 20px;
    }}

    /* Terminal Window Card */
    .terminal-card {{
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 16px;
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      box-shadow: 0 25px 60px -15px rgba(0, 0, 0, 0.7), 0 0 40px -10px var(--emerald-glow);
      overflow: hidden;
      transition: transform 0.25s ease, box-shadow 0.25s ease;
    }}

    .terminal-header {{
      background: rgba(18, 24, 38, 0.9);
      border-bottom: 1px solid var(--card-border);
      padding: 14px 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }}

    .window-controls {{
      display: flex;
      gap: 8px;
      align-items: center;
    }}

    .window-dot {{
      width: 12px;
      height: 12px;
      border-radius: 50%;
      display: inline-block;
    }}

    .dot-red {{ background: #ef4444; }}
    .dot-yellow {{ background: #f59e0b; }}
    .dot-green {{ background: #10b981; }}

    .terminal-title {{
      font-family: 'Fira Code', monospace;
      font-size: 13px;
      color: var(--text-muted);
      letter-spacing: 0.5px;
      display: flex;
      align-items: center;
      gap: 8px;
    }}

    .live-badge {{
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: rgba(16, 185, 129, 0.15);
      border: 1px solid rgba(16, 185, 129, 0.35);
      color: #34d399;
      padding: 4px 10px;
      border-radius: 20px;
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.5px;
      text-transform: uppercase;
    }}

    .live-pulse {{
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: #10b981;
      box-shadow: 0 0 10px #10b981;
      animation: pulse 1.8s infinite;
    }}

    @keyframes pulse {{
      0%, 100% {{ transform: scale(1); opacity: 1; }}
      50% {{ transform: scale(1.4); opacity: 0.5; }}
    }}

    .terminal-body {{
      padding: 32px 28px 24px;
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
    }}

    /* ASCII Artwork Wrapper */
    .ascii-wrapper {{
      width: 100%;
      overflow-x: auto;
      padding: 12px 0 20px;
      scrollbar-width: thin;
      scrollbar-color: rgba(16, 185, 129, 0.3) transparent;
    }}

    .ascii-art {{
      font-family: 'Fira Code', 'Courier New', monospace;
      font-size: clamp(7px, 1.4vw, 13px);
      font-weight: 700;
      line-height: 1.15;
      color: var(--emerald);
      text-shadow: 0 0 20px var(--emerald-glow), 0 0 40px rgba(16, 185, 129, 0.2);
      white-space: pre;
      margin: 0 auto;
      display: inline-block;
      user-select: all;
    }}

    /* Maintainer Divider */
    .maintainer-section {{
      margin: 16px 0 24px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
    }}

    .maintainer-badge {{
      display: inline-flex;
      align-items: center;
      gap: 10px;
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.1);
      padding: 8px 18px;
      border-radius: 9999px;
      font-family: 'Fira Code', monospace;
      font-size: 14px;
      color: #e2e8f0;
      transition: all 0.2s ease;
      text-decoration: none;
    }}

    .maintainer-badge:hover {{
      background: rgba(16, 185, 129, 0.1);
      border-color: rgba(16, 185, 129, 0.4);
      transform: translateY(-2px);
      box-shadow: 0 4px 15px rgba(16, 185, 129, 0.2);
    }}

    .maintainer-tag {{
      color: var(--text-dim);
    }}

    .maintainer-name {{
      color: #38bdf8;
      font-weight: 600;
    }}

    /* Info Grid */
    .info-grid {{
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 12px;
      width: 100%;
      margin: 16px 0 28px;
      text-align: left;
    }}

    .info-card {{
      background: rgba(15, 23, 42, 0.6);
      border: 1px solid var(--card-border);
      border-radius: 10px;
      padding: 14px 16px;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }}

    .info-label {{
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      color: var(--text-dim);
      font-weight: 600;
    }}

    .info-value {{
      font-size: 13px;
      color: var(--text-main);
      font-weight: 500;
    }}

    .info-value.highlight {{
      color: var(--emerald);
      font-family: 'Fira Code', monospace;
      font-weight: 600;
    }}

    /* Action Buttons */
    .button-row {{
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      justify-content: center;
      width: 100%;
    }}

    .btn {{
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 10px 20px;
      border-radius: 10px;
      font-size: 13px;
      font-weight: 600;
      text-decoration: none;
      transition: all 0.2s ease;
      cursor: pointer;
      border: none;
    }}

    .btn-primary {{
      background: var(--accent-gradient);
      color: #04100c;
      box-shadow: 0 4px 15px var(--emerald-glow);
    }}

    .btn-primary:hover {{
      transform: translateY(-2px);
      box-shadow: 0 8px 25px rgba(16, 185, 129, 0.5);
    }}

    .btn-secondary {{
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid var(--card-border);
      color: var(--text-main);
    }}

    .btn-secondary:hover {{
      background: rgba(255, 255, 255, 0.1);
      border-color: rgba(255, 255, 255, 0.2);
      transform: translateY(-2px);
    }}

    /* Curl Snippet */
    .curl-box {{
      width: 100%;
      background: rgba(7, 10, 15, 0.8);
      border: 1px solid var(--card-border);
      border-radius: 10px;
      padding: 10px 14px;
      margin-top: 18px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      font-family: 'Fira Code', monospace;
      font-size: 12px;
    }}

    .curl-text {{
      color: var(--cyan);
      overflow-x: auto;
      white-space: nowrap;
    }}

    .copy-btn {{
      background: rgba(255, 255, 255, 0.08);
      border: 1px solid rgba(255, 255, 255, 0.12);
      color: var(--text-muted);
      border-radius: 6px;
      padding: 4px 10px;
      font-size: 11px;
      cursor: pointer;
      transition: all 0.2s ease;
      flex-shrink: 0;
    }}

    .copy-btn:hover {{
      background: rgba(16, 185, 129, 0.2);
      color: var(--emerald);
      border-color: var(--emerald);
    }}

    footer {{
      font-size: 12px;
      color: var(--text-dim);
      text-align: center;
      margin-top: 10px;
    }}

    footer a {{
      color: var(--text-muted);
      text-decoration: none;
    }}

    footer a:hover {{
      color: var(--cyan);
    }}
  </style>
</head>
<body>
  <div class="container">
    <div class="terminal-card">
      <div class="terminal-header">
        <div class="window-controls">
          <span class="window-dot dot-red"></span>
          <span class="window-dot dot-yellow"></span>
          <span class="window-dot dot-green"></span>
        </div>
        <div class="terminal-title">
          <span>api.medicapslms ~ server node</span>
        </div>
        <div class="live-badge">
          <span class="live-pulse"></span>
          <span>Online</span>
        </div>
      </div>

      <div class="terminal-body">
        <div class="ascii-wrapper">
          <pre class="ascii-art">{ASCII_BANNER}</pre>
        </div>

        <div class="maintainer-section">
          <a href="https://github.com/Chetancj121212" target="_blank" rel="noopener noreferrer" class="maintainer-badge" title="Maintained by @chetancj">
            <span class="maintainer-tag">...maintained by</span>
            <span class="maintainer-name">@chetancj</span>
          </a>
        </div>

        <div class="info-grid">
          <div class="info-card">
            <span class="info-label">System Status</span>
            <span class="info-value highlight">🟢 200 OK • SERVER ALIVE</span>
          </div>
          <div class="info-card">
            <span class="info-label">Institution</span>
            <span class="info-value">Medi-Caps University</span>
          </div>
          <div class="info-card">
            <span class="info-label">Department</span>
            <span class="info-value">Electronics & Communication</span>
          </div>
          <div class="info-card">
            <span class="info-label">Framework</span>
            <span class="info-value">FastAPI + Python 3.13</span>
          </div>
        </div>

        <div class="button-row">
          <a href="/docs" class="btn btn-primary">
            <span>⚡ Interactive API Docs</span>
          </a>
          <a href="/redoc" class="btn btn-secondary">
            <span>📖 ReDoc Reference</span>
          </a>
          <a href="/api/health" class="btn btn-secondary">
            <span>💚 Health Endpoint</span>
          </a>
          <a href="https://github.com/Chetancj121212" target="_blank" rel="noopener noreferrer" class="btn btn-secondary">
            <span>🐙 GitHub Profile</span>
          </a>
        </div>

        <div class="curl-box">
          <span class="curl-text" id="curlCmd">{curl_command}</span>
          <button class="copy-btn" onclick="copyCurl()" id="copyBtn">Copy</button>
        </div>
      </div>
    </div>

    <footer>
      Medicaps University ECE LMS Backend • Designed & Developed by <a href="https://github.com/Chetancj121212" target="_blank" rel="noopener noreferrer">@chetancj</a>
    </footer>
  </div>

  <script>
    function copyCurl() {{
      const text = document.getElementById('curlCmd').innerText;
      navigator.clipboard.writeText(text).then(() => {{
        const btn = document.getElementById('copyBtn');
        btn.innerText = 'Copied!';
        btn.style.borderColor = '#10b981';
        btn.style.color = '#10b981';
        setTimeout(() => {{
          btn.innerText = 'Copy';
          btn.style.borderColor = '';
          btn.style.color = '';
        }}, 2000);
      }}).catch(() => {{
        const btn = document.getElementById('copyBtn');
        btn.innerText = 'Failed';
      }});
    }}
  </script>
</body>
</html>
"""
