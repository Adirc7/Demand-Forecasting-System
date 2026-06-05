import os
import glob
import pandas as pd
import numpy as np
from sklearn.ensemble import GradientBoostingRegressor, RandomForestRegressor
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import mean_squared_error, mean_absolute_error

dataset_dir = os.path.dirname(__file__)
csv_files = glob.glob(os.path.join(dataset_dir, 'Data sets', '*.csv'))
valid_files = [f for f in csv_files if "Smart_Inventory.csv" in f or "Clean_February" in f]

dfs = []
for f in valid_files:
    dfs.append(pd.read_csv(f))
df = pd.concat(dfs, ignore_index=True)
if 'status' not in df.columns: 
    df['status'] = 'Completed'
df = df[df['status'].isin(['Packed','Shipped','Delivered','Completed'])].copy()
df['date'] = pd.to_datetime(df['date'])

# Daily Aggregates
daily_sku = df.groupby(['sku','date'], as_index=False)['quantity'].sum().rename(columns={'quantity':'total_quantity'})
latest_cats = df.sort_values('date').groupby('sku')['category'].last().to_dict()
daily_sku['category'] = daily_sku['sku'].map(lambda x: latest_cats.get(x, 'Generic'))

full_range = pd.date_range(daily_sku['date'].min(), daily_sku['date'].max())
records = []
for sku, grp in daily_sku.groupby('sku'):
    qty = grp.set_index('date')['total_quantity'].reindex(full_range, fill_value=0)
    cat = grp['category'].iloc[0]
    records.append(pd.DataFrame({'date': qty.index, 'total_quantity': qty.values, 'sku': sku, 'category': cat}))
    
daily_filled = pd.concat(records).sort_values(['sku','date']).reset_index(drop=True)

le = LabelEncoder()
daily_filled['category_encoded'] = le.fit_transform(daily_filled['category'])

def create_feats(df):
    g = df.groupby('sku')['total_quantity']
    df['lag_1']  = g.transform(lambda x: x.shift(1))
    df['lag_7']  = g.transform(lambda x: x.shift(7))
    df['lag_14'] = g.transform(lambda x: x.shift(14))
    df['lag_30'] = g.transform(lambda x: x.shift(30))
    df['rolling_mean_7']  = g.transform(lambda x: x.rolling(7, min_periods=1).mean())
    df['rolling_mean_14'] = g.transform(lambda x: x.rolling(14, min_periods=1).mean())
    df['rolling_mean_30'] = g.transform(lambda x: x.rolling(30, min_periods=1).mean())
    df['rolling_std_7']   = g.transform(lambda x: x.rolling(7, min_periods=1).std().fillna(0))
    df['rolling_max_7']   = g.transform(lambda x: x.rolling(7, min_periods=1).max())
    df['month'] = df['date'].dt.month
    df['day'] = df['date'].dt.day
    df['dayofweek'] = df['date'].dt.dayofweek
    df['is_weekend'] = (df['dayofweek'] >= 5).astype(int)
    df['days_since_start'] = (df['date'] - df['date'].min()).dt.days
    return df
    
daily_fe = create_feats(daily_filled).fillna(0).reset_index(drop=True)

feats = ['lag_1', 'lag_7','lag_14','lag_30','rolling_mean_7','rolling_mean_14','rolling_mean_30',
         'rolling_std_7','rolling_max_7','month','day','dayofweek','is_weekend','category_encoded','days_since_start']
X = daily_fe[feats]
y = daily_fe['total_quantity']

print("Training RF...")
m = RandomForestRegressor(n_estimators=100, random_state=42, n_jobs=-1, max_depth=10)
m.fit(X, y)
preds = m.predict(X)

active_days = y > 0
if active_days.sum() > 0:
    wape = np.abs(y[active_days] - preds[active_days]).sum() / y[active_days].sum() * 100
else: wape = 0
print(f"RF Active WAPE: {wape:.2f}%, Acc: {max(0, 100-wape):.2f}%")

print("Training GB...")
m2 = GradientBoostingRegressor(n_estimators=100, max_depth=6, learning_rate=0.1, random_state=42)
m2.fit(X, y)
preds2 = m2.predict(X)

if active_days.sum() > 0:
    wape2 = np.abs(y[active_days] - preds2[active_days]).sum() / y[active_days].sum() * 100
else: wape2 = 0
print(f"GB WAPE: {wape2:.2f}%, Acc: {max(0, 100-wape2):.2f}%")

# What if we aggregate predictions to weekly or monthly WAPE? 
# Usually business cares about "how many do we need this month" 
daily_fe['pred'] = preds2
weekly = daily_fe.groupby(['sku', daily_fe['date'].dt.to_period('W')])[['total_quantity', 'pred']].sum()
w_wape = np.abs(weekly['total_quantity'] - weekly['pred']).sum() / weekly['total_quantity'].sum() * 100
print(f"Weekly WAPE: {w_wape:.2f}%, Weekly Acc: {max(0, 100-w_wape):.2f}%")

monthly = daily_fe.groupby(['sku', daily_fe['date'].dt.to_period('M')])[['total_quantity', 'pred']].sum()
m_wape = np.abs(monthly['total_quantity'] - monthly['pred']).sum() / monthly['total_quantity'].sum() * 100
print(f"Monthly WAPE: {m_wape:.2f}%, Monthly Acc: {max(0, 100-m_wape):.2f}%")
