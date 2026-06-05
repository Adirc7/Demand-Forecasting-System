import sys, traceback, asyncio
sys.path.append(r'c:\Users\ASUS\Desktop\Smart_Inventory_AI_System\Backend\backend')
from services.alert_service import generate_alerts

async def test():
    try:
        res = await generate_alerts()
        print('Alerts returned:', len(res))
    except Exception as e:
        print('Exception caught!')
        traceback.print_exc()

asyncio.run(test())
