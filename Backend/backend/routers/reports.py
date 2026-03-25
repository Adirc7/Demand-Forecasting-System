from fastapi import APIRouter, Depends
from firebase.client import get_db
from routers.auth import get_current_user, require_role
from services.report_service import generate_report, compute_accuracy, compute_business_metrics, compute_historical_metrics, export_training_csv
from fastapi.responses import Response

router = APIRouter(prefix='/reports', tags=['Reports'])

@router.get('/')
async def list_reports(user=Depends(get_current_user)):
    docs = get_db().collection('reports').order_by('created_at', direction='DESCENDING').stream()
    return [d.to_dict() for d in docs]

@router.get('/accuracy/metrics')
async def get_accuracy(user=Depends(get_current_user)):
    return await compute_accuracy()

@router.get('/business-metrics')
async def get_business_metrics_data(user=Depends(get_current_user)):
    return await compute_business_metrics()

@router.get('/historical')
async def get_historical_data(user=Depends(get_current_user)):
    return await compute_historical_metrics()

@router.get('/export-csv')
async def export_csv_dataset(user=Depends(require_role(['report_analyst']))):
    csv_string, month_str = await export_training_csv()
    
    # Format a beautiful native filename (e.g. march_2026_smart_inventory.csv)
    month_names = {'01':'january','02':'february','03':'march','04':'april','05':'may','06':'june','07':'july','08':'august','09':'september','10':'october','11':'november','12':'december'}
    m = month_names.get(month_str[5:7], 'current')
    y = month_str[:4]
    filename = f"{m}_{y}_smart_inventory.csv"
    
    return Response(
        content=csv_string,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

@router.get('/{report_id}')
async def get_report(report_id:str, user=Depends(get_current_user)):
    doc = get_db().collection('reports').document(report_id).get()
    return doc.to_dict() if doc.exists else {}

@router.delete('/{report_id}')
async def delete_report(report_id:str, user=Depends(require_role(['report_analyst']))):
    get_db().collection('reports').document(report_id).delete()
    return {'status': 'deleted'}

@router.post('/')
async def save_report_config(config:dict, user=Depends(require_role(['report_analyst']))):
    ref = get_db().collection('reports').document()
    ref.set({**config, 'id':ref.id, 'created_by':user['email']})
    return {'id': ref.id}

@router.post('/generate')
async def generate_on_the_fly(params:dict, user=Depends(require_role(['report_analyst']))):
    return await generate_report(params)
