from fastapi import FastAPI, HTTPException  # type: ignore
import joblib  # type: ignore
import pandas as pd  # type: ignore
import numpy as np  # type: ignore
import uvicorn  # type: ignore
import sys, os, json
from datetime import datetime, timedelta

# Attach backend to access Firebase
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../Backend/backend")))
from firebase.client import get_db  # type: ignore

with open(os.path.join(os.path.dirname(__file__), 'label_encoder_v3.json'), 'r') as f:
    ENCODER = json.load(f).get('mapping', {})

app = FastAPI(title="Dropex AI Model API")

# Load model on startup
try:
    model = joblib.load("forecast_model_v3.pkl")
    print("Model loaded successfully")
except Exception as e:
    print(f"Error loading model: {e}")
    model = None

@app.get("/health")
def health():
    return {"status": "ok", "model_loaded": model is not None}

@app.post("/register-sku")
def register_sku(data: dict):
    # Dummy endpoint to satisfy backend POST
    return {"status": "sku registered", "sku": data.get("sku")}

@app.post("/stock-advice")
def stock_advice(data: dict):
    # Dummy logic to return a recommendation
    # Typically this would involve running inference on the 'model' object
    # using the provided data (e.g., category, lead_time_days).
    category = data.get("category", "")
    lead_time_days = data.get("lead_time_days", 5)
    
    # Simple proxy logic as a placeholder
    rec = 100 if category == "Electronics" else 200
    proxy_price = 49.99 if category == "Electronics" else (19.99 if category == "Home Goods" else 29.99)
    proxy_lead_time = 7 if category == "Electronics" else 5
    
    return {
        "recommended": rec,
        "recommended_price": proxy_price,
        "recommended_lead_time": proxy_lead_time,
        "confidence": "LOW (category proxy)",
        "reorder_point": int(rec * 0.3),
        "avg_daily_demand": 5.0
    }

@app.post("/warmup-tick")
def warmup_tick(data: dict):
    return {"status": "warmup logged", "sku": data.get("sku")}

@app.post("/forecast/batch")
def forecast_batch(data: dict):
    skus = data.get("skus", [])
    results = []
    db = get_db()
    
    today = datetime.now()
    cutoff_30 = today - timedelta(days=30)
    
    # Pre-fetch all sales in the last 30 days to avoid N+1 queries
    # For a giant DB we'd filter, but here we can just query recent
    sales_docs = list(db.collection('sales')
                        .where('date', '>=', cutoff_30.strftime('%Y-%m-%d'))
                        .stream())
                        
    # Build a DataFrame of all recent sales
    sales_list = []
    for doc in sales_docs:
        d = doc.to_dict()
        sales_list.append({'sku': d.get('sku'), 'date': d.get('date'), 'quantity': d.get('quantity', 0)})
        
    df_sales = pd.DataFrame(sales_list) if sales_list else pd.DataFrame(columns=['sku', 'date', 'quantity'])
    if not df_sales.empty:
        df_sales['date'] = pd.to_datetime(df_sales['date'])

    for item in skus:
        sku_id = item.get("sku") if isinstance(item, dict) else item
        category = item.get("category", "") if isinstance(item, dict) else ""
        
        # 1. Isolate SKU sales
        if not df_sales.empty:
            sku_sales = df_sales[df_sales['sku'] == sku_id]
        else:
            sku_sales = pd.DataFrame(columns=['date', 'quantity'])
            
        # 2. Fill missing days
        date_range = pd.date_range(cutoff_30.date(), today.date())
        if not sku_sales.empty:
            daily = sku_sales.groupby('date')['quantity'].sum().reindex(date_range, fill_value=0)
        else:
            daily = pd.Series(0, index=date_range)
            
        # 3. Calculate metrics
        history_30 = daily.values[-30:] if len(daily) >= 30 else np.zeros(30)
        lag_7 = history_30[-7] if len(history_30)>=7 else 0
        lag_14 = history_30[-14] if len(history_30)>=14 else 0
        lag_30 = history_30[0] if len(history_30)>=30 else 0
        
        rm_7 = np.mean(history_30[-7:])
        rm_14 = np.mean(history_30[-14:])
        rm_30 = np.mean(history_30)
        
        rstd_7 = np.std(history_30[-7:])
        rmax_7 = np.max(history_30[-7:])
        
        cat_encoded = ENCODER.get(category, 3) # default generic
        
        # 1-day prediction feature vector
        features = pd.DataFrame([{
            'lag_7': lag_7, 'lag_14': lag_14, 'lag_30': lag_30,
            'rolling_mean_7': rm_7, 'rolling_mean_14': rm_14, 'rolling_mean_30': rm_30,
            'rolling_std_7': rstd_7, 'rolling_max_7': rmax_7,
            'month': today.month, 'day': today.day, 'dayofweek': today.weekday(),
            'is_weekend': int(today.weekday() >= 5),
            'week_of_year': today.isocalendar()[1],
            'is_black_friday': int(today.month == 11 and today.day == 28),
            'category_encoded': cat_encoded,
            'days_since_start': (today - datetime(2025, 8, 1)).days
        }])
        
        if model:
            try:
                pred_1d = max(0, model.predict(features)[0])
            except Exception as e:
                print("Prediction error:", e)
                pred_1d = 0
        else:
            pred_1d = 0
            
        # Simple Multi-Horizon strategy: Constant demand assumption for stable goods
        pred_7d = int(round(pred_1d * 7))
        pred_30d = int(round(pred_1d * 30))

        # Dynamically calculate Local Feature Importance proxy based on mathematically derived history
        base_momentum = float(round((rm_7 - rm_30), 2))
        volatility_penalty = float(round(-(rstd_7 * 0.2), 2))
        weekend_boost = float(round((rm_7 * 0.15), 2) if today.weekday() >= 5 else round(-(rm_7 * 0.05), 2))
        historical_base = float(round(rm_30, 2))

        results.append({
            "sku": str(sku_id),
            "forecast_7d": int(pred_7d),
            "forecast_30d": int(pred_30d),
            "confidence": "HIGH" if bool(sum(history_30) > 5) else "LOW (Cold Start)",
            "is_cold": bool(sum(history_30) <= 5),
            "shap_factors": [
                {"feature": "Historical Baseline", "impact": historical_base},
                {"feature": "Recent Momentum", "impact": base_momentum},
                {"feature": "Demand Volatility", "impact": volatility_penalty},
                {"feature": "Weekend Factor", "impact": weekend_boost}
            ]
        })
    return results

@app.post("/forecast/retrain")
def forecast_retrain():
    global model, ENCODER
    try:
        from sklearn.ensemble import GradientBoostingRegressor  # type: ignore
        from sklearn.preprocessing import LabelEncoder  # type: ignore
        import joblib, os  # type: ignore
        import pandas as pd  # type: ignore
        import numpy as np  # type: ignore

        print("Starting Dynamic Retraining from Firebase...")
        db = get_db()
        
        # 1. Fetch raw data
        sales = [s.to_dict() for s in db.collection('sales').stream()]
        prods = {p.id: p.to_dict() for p in db.collection('products').stream()}
        
        if not sales or not prods:
            return {"status": "error", "msg": "Not enough data to train."}
            
        df = pd.DataFrame(sales)
        if 'status' not in df.columns: df['status'] = 'Completed'
        df = df[df['status'].isin(['Packed','Shipped','Delivered','Completed'])].copy()
        
        df['date'] = pd.to_datetime(df['date'])
        df = df.sort_values(['sku','date']).reset_index(drop=True)
        
        # 2. Build Daily Aggregates
        daily_sku = df.groupby(['sku','date'], as_index=False)['quantity'].sum().rename(columns={'quantity':'total_quantity'})
        
        # Attach Category
        daily_sku['category'] = daily_sku['sku'].map(lambda x: prods.get(x, {}).get('category', 'Generic'))
        
        # Fill zero-demand calendar holes
        full_range = pd.date_range(daily_sku['date'].min(), daily_sku['date'].max())
        records = []
        for sku, grp in daily_sku.groupby('sku'):
            qty = grp.set_index('date')['total_quantity'].reindex(full_range, fill_value=0)
            cat = grp['category'].iloc[0]
            records.append(pd.DataFrame({'date': qty.index, 'total_quantity': qty.values, 'sku': sku, 'category': cat}))
            
        daily_filled = pd.concat(records).sort_values(['sku','date']).reset_index(drop=True)
        
        # 3. Encoding
        le = LabelEncoder()
        daily_filled['category_encoded'] = le.fit_transform(daily_filled['category'])
        
        # 4. Feature Engineering
        def create_feats(df):
            g = df.groupby('sku')['total_quantity']
            df['lag_7']  = g.transform(lambda x: x.shift(7))
            df['lag_14'] = g.transform(lambda x: x.shift(14))
            df['lag_30'] = g.transform(lambda x: x.shift(30))
            df['rolling_mean_7']  = g.transform(lambda x: x.rolling(7, min_periods=3).mean())
            df['rolling_mean_14'] = g.transform(lambda x: x.rolling(14, min_periods=5).mean())
            df['rolling_mean_30'] = g.transform(lambda x: x.rolling(30, min_periods=10).mean())
            df['rolling_std_7']   = g.transform(lambda x: x.rolling(7, min_periods=3).std().fillna(0))
            df['rolling_max_7']   = g.transform(lambda x: x.rolling(7, min_periods=3).max())
            df['month'] = df['date'].dt.month
            df['day'] = df['date'].dt.day
            df['dayofweek'] = df['date'].dt.dayofweek
            df['is_weekend'] = (df['dayofweek'] >= 5).astype(int)  # type: ignore
            df['week_of_year'] = df['date'].dt.isocalendar().week.astype(int)
            df['is_black_friday'] = ((df['date'].dt.month==11)&(df['date'].dt.day==28)).astype(int)  # type: ignore
            df['days_since_start'] = (df['date'] - df['date'].min()).dt.days
            return df
            
        daily_fe = create_feats(daily_filled).fillna(0).reset_index(drop=True)
        
        feats = ['lag_7','lag_14','lag_30','rolling_mean_7','rolling_mean_14','rolling_mean_30',
                 'rolling_std_7','rolling_max_7','month','day','dayofweek','is_weekend','week_of_year',
                 'is_black_friday','category_encoded','days_since_start']
                 
        X = daily_fe[feats]
        y = daily_fe['total_quantity']
        
        # 5. Train Model
        print(f"Training on {len(X)} rows...")
        m = GradientBoostingRegressor(n_estimators=300, max_depth=5, learning_rate=0.05, subsample=0.8, min_samples_leaf=10, random_state=42)
        m.fit(X, y)
        
        # 6. Save & Reload
        model_path = os.path.join(os.path.dirname(__file__), "forecast_model_v3.pkl")
        enc_path = os.path.join(os.path.dirname(__file__), "label_encoder_v3.json")
        
        joblib.dump(m, model_path)
        
        import json
        le_mapping = {cls: int(code) for code, cls in enumerate(le.classes_)}
        with open(enc_path, 'w') as f:
            json.dump({'classes': list(le.classes_), 'mapping': le_mapping}, f, indent=2)
            
        # Update Global State
        model = m
        ENCODER = le_mapping
        
        print("Training Complete! Dynamic Model Reloaded.")
        return {"status": "success", "rows_trained": len(X), "features": len(feats)}
    except Exception as e:
        print(f"Retrain Error: {e}")
        return {"status": "error", "message": str(e)}


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8001, reload=True)
