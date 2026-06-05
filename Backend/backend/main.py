from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from apscheduler.schedulers.asyncio import AsyncIOScheduler
import os
from dotenv import load_dotenv
load_dotenv()

from routers import auth, admin, products, categories, sales, inventory, forecast, reports
from services.retrain_service import trigger_retrain

app = FastAPI(title='Dropex Smart Inventory API', version='3.1')
app.add_middleware(CORSMiddleware,
    allow_origin_regex=r'^http://localhost:\d+$',
    allow_credentials=True, allow_methods=['*'], allow_headers=['*'])

app.include_router(admin.router, prefix='/api/v1')
app.include_router(products.router, prefix='/api/v1')
app.include_router(categories.router, prefix='/api/v1')
app.include_router(sales.router, prefix='/api/v1')
app.include_router(inventory.router, prefix='/api/v1')
app.include_router(forecast.router, prefix='/api/v1')
app.include_router(reports.router, prefix='/api/v1')

scheduler = AsyncIOScheduler()
@app.on_event('startup')
async def startup():
    scheduler.add_job(trigger_retrain, 'cron', day_of_week='mon', hour=2, minute=0)
    scheduler.start()
    print('Dropex backend started on port 8000')

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    # Ensure unhandled exceptions (like Firestore Quota errors) return nicely with CORS headers
    return JSONResponse(
        status_code=500,
        content={"detail": f"Internal Server Error: {str(exc)}"}
    )

@app.get('/health')
async def health(): return {'status':'ok','version':'3.1'}
