from fastapi import APIRouter, Depends, BackgroundTasks
from firebase.client import get_db
from firebase.cache import get_cached_collection
from routers.auth import get_current_user, require_admin, require_role
from services.forecast_service import run_forecast_generation
from services.retrain_service import trigger_retrain

router = APIRouter(prefix='/forecast', tags=['Forecast'])

@router.get('/categories')
async def get_all_forecasts(user=Depends(require_role(['forecast_manager']))):
    return [d.to_dict() for d in get_cached_collection('forecasts')]

@router.get('/categories/{category}')
async def get_category_forecast(category:str, user=Depends(require_role(['forecast_manager']))):
    docs = get_cached_collection('forecasts')
    return [d.to_dict() for d in docs if d.to_dict().get('category') == category]

@router.post('/retrain')
async def retrain(background: BackgroundTasks, user=Depends(require_role(['forecast_manager']))):
    background.add_task(trigger_retrain)
    return {'status': 'retrain started', 'message': 'Will complete in background'}
