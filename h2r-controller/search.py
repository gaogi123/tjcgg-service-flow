import urllib.request
import urllib.parse
import json
import ssl

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

query = urllib.parse.quote("Cannot read properties of undefined (reading 'cues') H2R Graphics API")
url = f"https://html.duckduckgo.com/html/?q={query}"
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
try:
    html = urllib.request.urlopen(req, context=ctx).read().decode('utf-8')
    import re
    snippets = re.findall(r'<a class="result__snippet[^>]*>(.*?)</a>', html, re.IGNORECASE | re.DOTALL)
    for i, s in enumerate(snippets[:5]):
        print(f"Result {i+1}: {re.sub('<[^<]+>', '', s).strip()}")
except Exception as e:
    print(e)
