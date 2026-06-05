import asyncio
from services.report_service import compute_accuracy

async def main():
    res = await compute_accuracy()
    print("ACCURACY_RESULT:")
    print(res)

if __name__ == "__main__":
    asyncio.run(main())
