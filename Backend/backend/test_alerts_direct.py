import asyncio
import os
import sys
from dotenv import load_dotenv

load_dotenv()
sys.path.append(os.getcwd())

from services.alert_service import generate_alerts

async def main():
    print("Running generate_alerts...")
    alerts = await generate_alerts()
    print("Done. Generated", len(alerts), "alerts.")
    for a in alerts:
        print(f"SKU: {a['sku']}, Explanation: {a['explanation']}")

if __name__ == "__main__":
    asyncio.run(main())
