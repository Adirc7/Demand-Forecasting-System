import asyncio
import os
import sys

sys.path.append(os.getcwd())
from dotenv import load_dotenv
load_dotenv()

from services.gemini_service import explain_alert

async def main():
    print("Testing explain_alert exclusively:")
    res = await explain_alert('DC-1008', 'Probiotic Capsules', 'Supplements', 0, 50, 7.0)
    print("Result:", res)

if __name__ == "__main__":
    asyncio.run(main())
