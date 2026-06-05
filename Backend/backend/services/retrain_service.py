from services.forecast_service import run_forecast_generation
import httpx, os

AI_URL = os.getenv('AI_MODEL_URL', 'http://localhost:8001')

async def trigger_retrain():
    async with httpx.AsyncClient(timeout=300.0) as client:
        await client.post(f'{AI_URL}/forecast/retrain')
    await run_forecast_generation()
