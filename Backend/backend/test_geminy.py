import asyncio
import sys
import os

sys.path.append(os.getcwd())
from dotenv import load_dotenv
load_dotenv()

from services.gemini_service import explain_alert

async def main():
    try:
        res = await explain_alert('dc-1008', 'Probiotic Capsules', 'Supplements', 10, 25, 40)
        print("AI RESPONSE:", res)
    except Exception as e:
        print("EXCEPTION:", str(e))

if __name__ == '__main__':
    asyncio.run(main())
