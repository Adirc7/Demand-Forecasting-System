# pyre-ignore-all-errors
# type: ignore
from firebase.client import get_db
from firebase.cache import get_cached_collection
from datetime import datetime, date
import math
from typing import Dict, List, Tuple, Any

def _add_floats(a: float, b: float) -> float:
    return float(a) + float(b)

def _round_float(val: float, ndigits: int = 2) -> float:
    factor = 10 ** ndigits
    return float(int(float(val) * factor + 0.5)) / factor

async def generate_report(params: dict):
    db = get_db()
    products = [d.to_dict() for d in get_cached_collection('products')]
    inventory = {d.id:d.to_dict() for d in get_cached_collection('inventory')}
    forecasts = [d.to_dict() for d in get_cached_collection('forecasts')]
    
    low_stock = [{'sku':p['sku'], 'product_name':p.get('product_name',''), 
                  'stock':inventory.get(p['sku'],{}).get('current_stock',0)}
                 for p in products 
                 if inventory.get(p['sku'],{}).get('current_stock',0) <= 0]
                 
    report = {
        'id':               '',
        'created_at':       str(datetime.now()),
        'date_range':       params.get('date_range', 'last 30 days'),
        'total_skus':       len(products),
        'low_stock_count':  len(low_stock),
        'low_stock_skus':   low_stock,
        'cold_start_count': sum(1 for p in products if p.get('cold_start')),
        'total_forecasts':  len(forecasts),
    }
    
    ref = db.collection('reports').document()
    report['id'] = ref.id
    ref.set(report)
    return report

async def compute_accuracy():
    db = get_db()
    forecasts = [d.to_dict() for d in get_cached_collection('forecasts')]
    errors = []
    
    all_sales = [s.to_dict() for s in get_cached_collection('sales')]
    
    # 1. Dynamically target the final operational month
    latest_month = "0000-00"
    for s in all_sales:
        d = s.get('date', '')
        if d and d[:7] > latest_month:
            latest_month = d[:7]
            
    sales_target_month: Dict[str, float] = {}
    for sale in all_sales:
        sku = sale.get('sku')
        d = sale.get('date', '')
        if sku and d.startswith(latest_month):
            sales_target_month[sku] = sales_target_month.get(sku, 0) + float(sale.get('quantity', 0))
            
    # 2. Backtest cross-validation based exactly on the last 30-day target chunk
    for f in forecasts:
        sku = f.get('sku')
        predicted_demand = float(f.get('forecast_30d', f.get('forecast', 0)))
        
        if sku and predicted_demand > 0:
            actual_demand = sales_target_month.get(sku, 0)
            if actual_demand > 0:
                # Direct 1:1 comparison against latest 30-day historical window
                errors.append(abs(actual_demand - predicted_demand))
            
    n = len(errors)
    if n == 0:
        return {'MAE': 'Pending', 'RMSE': 'Pending', 'n': 0, 'date': str(date.today())}
    
    return {
        'MAE':  _round_float(float(sum(errors)/n if n else 0.0), 3),
        'RMSE': _round_float(float(math.sqrt(sum(e**2 for e in errors)/n) if n else 0.0), 3),
        'n': n,
        'date': str(date.today())
    }

async def compute_business_metrics():
    db = get_db()
    
    products = {p.id: p.to_dict() for p in get_cached_collection('products')}
    inventory = {i.id: i.to_dict() for i in get_cached_collection('inventory')}
    
    # Calculate Total Inventory Value
    total_inventory_value: float = 0.0
    for sku, inv_data in inventory.items():
        stock = float(inv_data.get('current_stock', 0))
        price = float(products.get(sku, {}).get('price', 0))
        if stock > 0:
            total_inventory_value = _add_floats(total_inventory_value, stock * price)
            
    # Calculate Revenue and Sales Volume
    sales_volume_latest: Dict[str, float] = {}
    sales_volume_all: Dict[str, float] = {}
    total_revenue: float = 0.0
    all_sales = [s.to_dict() for s in get_cached_collection('sales')]
    
    # Find latest month
    latest_month = "0000-00"
    for s in all_sales:
        d = s.get('date', '')
        if d and d[:7] > latest_month:
            latest_month = d[:7]
            
    for sale in all_sales:
        qty = float(sale.get('quantity', 0))
        sku = sale.get('sku')
        if not sku: continue
        
        price = float(sale.get('price', 0) or products.get(sku, {}).get('price', 0))
        total_revenue += qty * price
        
        date_str = sale.get('date', '')
        if date_str.startswith(latest_month):
            sales_volume_latest[sku] = sales_volume_latest.get(sku, 0) + qty
        sales_volume_all[sku] = sales_volume_all.get(sku, 0) + qty
        
    # Top 5 Fast Movers (Based strictly on the latest operational month)
    sorted_movers: List[Tuple[str, float]] = sorted(sales_volume_latest.items(), key=lambda x: x[1], reverse=True)
    fast_movers: List[Dict[str, Any]] = []
    
    count_limit = 0
    for sku, float_qty in sorted_movers:
        if count_limit >= 5: break
        count_limit += 1
        qty = float(float_qty)
        prod_data = products.get(sku, {})
        fast_movers.append({
            'sku': sku,
            'name': prod_data.get('product_name', 'Unknown'),
            'qty_sold': int(qty),
            'revenue': _round_float(qty * float(prod_data.get('price', 0)), 2)
        })
        
    # Dead Stock (in stock but 0 sales in the latest month)
    dead_stock: List[Dict[str, Any]] = []
    for sku, p in products.items():
        if sku not in sales_volume_latest:
            stock = float(inventory.get(sku, {}).get('current_stock', 0))
            if stock > 0:
                dead_stock.append({
                    'sku': sku,
                    'name': p.get('product_name', 'Unknown'),
                    'stock': int(stock),
                    'tied_up_value': _round_float(stock * float(p.get('price', 0)), 2)
                })
                
    # Sort dead stock by tied up value descending, limit to 5
    sorted_dead_stock: List[Dict[str, Any]] = sorted(dead_stock, key=lambda x: x['tied_up_value'], reverse=True)
    dead_stock = []
    for i in range(min(5, len(sorted_dead_stock))):
        dead_stock.append(sorted_dead_stock[i])
                
    # Estimated Restock Cost
    est_restock_cost: float = 0.0
    forecasts_ref = db.collection('forecasts').stream()
    for f in forecasts_ref:
        fc = f.to_dict()
        sku = fc.get('sku')
        if not sku: continue
        
        demand = float(fc.get('forecast', 0))
        stock = float(inventory.get(sku, {}).get('current_stock', 0))
        if demand > stock:
            shortage = demand - stock
            price = float(products.get(sku, {}).get('price', 0))
            est_restock_cost = _add_floats(est_restock_cost, shortage * price)
            
    return {
        # pyre-ignore
        'total_revenue': round(total_revenue, 2),
        # pyre-ignore
        'total_inventory_value': round(total_inventory_value, 2),
        # pyre-ignore
        'est_restock_cost': round(est_restock_cost, 2),
        'fast_movers': fast_movers,
        'dead_stock': dead_stock
    }

async def compute_historical_metrics():
    db = get_db()
    
    # 1. Fetch current product state
    products_ref = db.collection('products').stream()
    products = {p.id: p.to_dict() for p in products_ref}
    
    # 2. Compute sales volumes and revenue per month
    revenue_by_month: Dict[str, float] = {}
    sales_by_sku_month: Dict[str, Dict[str, float]] = {} # {sku: {month: qty_sold}}
    
    sales_ref = db.collection('sales').stream()
    for s in sales_ref:
        sale = s.to_dict()
        if not sale.get('date'): continue
        
        month = sale['date'][:7] # YYYY-MM
        qty = float(sale.get('quantity', 0))
        price = float(sale.get('price', 0) or sale.get('unit_price', 0) or 0)
        rev = float(sale.get('revenue', 0) or sale.get('amount', 0) or sale.get('Amount', 0) or 0)
        if rev == 0: rev = qty * price
        
        revenue_by_month[month] = revenue_by_month.get(month, 0) + rev
        
        sku = sale.get('sku')
        if sku:
            if sku not in sales_by_sku_month: sales_by_sku_month[sku] = {}
            sales_by_sku_month[sku][month] = sales_by_sku_month[sku].get(month, 0) + qty

    # We want at least 6 months of history visually, even if sales data only covers 2.
    if not revenue_by_month:
        return {'revenue_chart': [], 'inventory_chart': [], 'sku_chart': [], 'top_skus': []}
        
    sorted_months = sorted(list(revenue_by_month.keys()))
    latest_month_str = sorted_months[-1] # e.g. '2026-03'
    
    y, m = map(int, latest_month_str.split('-'))
    last_6_months = []
    for i in range(5, -1, -1):
        target_m = m - i
        target_y = y
        while target_m <= 0:
            target_m += 12
            target_y -= 1
        last_6_months.append(f"{target_y:04d}-{target_m:02d}")
        
    # Reconstruct SKU stock backwards
    sku_stock_history = {} 
    for sku, pdata in products.items():
        current_stock = float(pdata.get('current_stock', 0))
        sku_stock_history[sku] = {}
        
        # Loop backwards from latest to earliest
        running_stock = current_stock
        for month in reversed(last_6_months):
            sku_stock_history[sku][month] = running_stock
            # Add this month's sales back to get stock at start of month (which acts as end of previous)
            month_sales = sales_by_sku_month.get(sku, {}).get(month, 0)
            running_stock += month_sales

    # Calculate Inventory Value per month
    inventory_val_by_month = {m: 0.0 for m in last_6_months}
    for m in last_6_months:
        total_val: float = 0.0
        for sku, hist in sku_stock_history.items():
            stock = hist.get(m, 0)
            price = float(products.get(sku, {}).get('price', 0))
            if stock > 0 and price > 0:
                total_val = _add_floats(total_val, stock * price)
        inventory_val_by_month[m] = total_val

    # Fill empty revenue months
    for m in last_6_months:
        if m not in revenue_by_month:
            revenue_by_month[m] = 0.0

    month_names = {'01':'Jan','02':'Feb','03':'Mar','04':'Apr','05':'May','06':'Jun','07':'Jul','08':'Aug','09':'Sep','10':'Oct','11':'Nov','12':'Dec'}
    def format_month(m_str):
        return f"{month_names.get(m_str[5:7], '')} {m_str[:4]}"

    revenue_chart = [{'name': format_month(m), 'revenue': _round_float(revenue_by_month[m], 0)} for m in last_6_months]
    inventory_chart = [{'name': format_month(m), 'value': _round_float(inventory_val_by_month[m], 0)} for m in last_6_months]

    # Top 5 SKUs
    total_sales_vol: Dict[str, float] = {}
    for sku, m_dict in sales_by_sku_month.items():
        total_sales_vol[sku] = float(sum(m_dict.values()))
        
    sorted_sales_vols: List[Tuple[str, float]] = sorted(total_sales_vol.items(), key=lambda x: x[1], reverse=True)
    top_5_skus = []
    for idx_tuple in range(min(5, len(sorted_sales_vols))):
        top_5_skus.append(sorted_sales_vols[idx_tuple][0])
    
    sku_chart: List[Dict[str, Any]] = []
    for m in last_6_months:
        entry: Dict[str, Any] = {'name': format_month(m)}
        for sku in top_5_skus:
            entry[sku] = int(sku_stock_history.get(sku, {}).get(m, 0))
        sku_chart.append(entry)

    return {
        'revenue_chart': revenue_chart,
        'inventory_chart': inventory_chart,
        'sku_chart': sku_chart,
        'top_skus': top_5_skus
    }

async def export_training_csv():
    import io, csv, random
    from datetime import datetime
    db = get_db()
    
    products = {p.id: p.to_dict() for p in db.collection('products').stream()}
    inventory = {i.id: i.to_dict() for i in db.collection('inventory').stream()}
    thresholds = {t.id: t.to_dict() for t in db.collection('thresholds').stream()}
    
    sales_ref = db.collection('sales').stream()
    all_sales = [s.to_dict() for s in sales_ref]
    
    latest_month = "0000-00"
    for s in all_sales:
        d = s.get('date', '')
        if d and d[:7] > latest_month:
            latest_month = d[:7]
            
    target_sales = [s for s in all_sales if s.get('date', '').startswith(latest_month)]
    
    output = io.StringIO()
    writer = csv.writer(output)
    
    headers = [
        'date', 'sku', 'product_name', 'category', 'quantity', 'amount', 'status',
        'order_id', 'created_by', 'current_stock', 'lead_time_days', 'service_level',
        'avg_daily_sales_sku', 'demand_std_sku', 'safety_stock', 'reorder_point',
        'reorder_flag', 'stock_cover_days'
    ]
    writer.writerow(headers)
    
    for sale in target_sales:
        sku = sale.get('sku', '')
        p = products.get(sku, {})
        i = inventory.get(sku, {})
        t = thresholds.get(sku, {})
        
        current_stock = float(p.get('current_stock', 0))
        reorder_point = float(t.get('reorder_point', p.get('reorder_point', 20)))
        reorder_flag = 1 if current_stock < reorder_point else 0
        
        avg_daily = sale.get('quantity', 0) / 30.0 if sale.get('quantity', 0) > 0 else 0.5
        demand_std = avg_daily * 0.2
        safety_stock = reorder_point / 2.0
        stock_cover = current_stock / avg_daily if avg_daily > 0 else 999
        order_id = sale.get('id', f"SYS-{random.randint(10000, 99999)}")
        
        row = [
            sale.get('date', ''),
            sku,
            p.get('product_name', ''),
            p.get('category', ''),
            sale.get('quantity', 0),
            sale.get('price', p.get('price', 0)),
            'Completed',
            order_id,
            sale.get('recorded_by', 'System'),
            int(current_stock),
            int(p.get('lead_time_days', 5)),
            float(p.get('service_level', 0.95)),
            _round_float(float(avg_daily), 0),
            _round_float(float(demand_std), 0),
            _round_float(float(safety_stock), 0),
            _round_float(float(reorder_point), 0),
            reorder_flag,
            _round_float(float(stock_cover), 0)
        ]
        writer.writerow(row)
        
    return output.getvalue(), latest_month
