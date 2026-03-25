import asyncio
import os
import sys

sys.path.append(os.getcwd())
from dotenv import load_dotenv
load_dotenv()
from services.alert_service import generate_alerts

async def test():
    alerts = await generate_alerts()
    for a in alerts:
        if '1008' in a['sku']:
            print(f"DC-1008 expl: {a['explanation']}")

if __name__ == '__main__':
    asyncio.run(test())
