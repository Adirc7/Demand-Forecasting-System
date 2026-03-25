import asyncio
import os
import sys

sys.path.append(os.getcwd())
# pyre-ignore[21]
from dotenv import load_dotenv
load_dotenv()
# pyre-ignore[21]
from google import genai

async def test():
    try:
        client = genai.Client()
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents='Say hi'
        )
        print("Success:", response.text)
    except Exception as e:
        import traceback
        traceback.print_exc()
        print("Error details:", str(e))

if __name__ == '__main__':
    asyncio.run(test())
