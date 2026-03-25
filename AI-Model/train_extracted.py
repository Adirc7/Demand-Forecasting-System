import pandas as pd  # type: ignore
import numpy as np  # type: ignore
import matplotlib.pyplot as plt  # type: ignore
import matplotlib.gridspec as gridspec  # type: ignore
import warnings, os, json
import joblib  # type: ignore
from datetime import datetime, timedelta

from sklearn.ensemble      import RandomForestRegressor, GradientBoostingRegressor  # type: ignore
from sklearn.linear_model  import Ridge  # type: ignore
from sklearn.preprocessing import LabelEncoder  # type: ignore
from sklearn.metrics       import mean_absolute_error, mean_squared_error, r2_score  # type: ignore
from sklearn.model_selection import TimeSeriesSplit  # type: ignore

warnings.filterwarnings('ignore')
pd.set_option('display.float_format', '{:.2f}'.format)
pd.set_option('display.width', 130)

OUTPUT_DIR = 'dropex_output_v3'
os.makedirs(OUTPUT_DIR, exist_ok=True)

print("=" * 70)
print("  DROPEX SMART INVENTORY — PIPELINE v3")
print("  Priority Actions: +4 months | MAPE removed | SKU-level | Reorder standalone")
print("=" * 70)
print("\n▶  ACTION 1 — Load 7 Months of Data")
print("─" * 50)

files = {
    'August 2025':    'Data sets/August_2025_Smart_Inventory.csv',
    'September 2025': 'Data sets/September_2025_Smart_Inventory.csv',
    'October 2025':   'Data sets/October_2025_Smart_Inventory.csv',
    'November 2025':  'Data sets/November_2025_Smart_Inventory.csv',
    'December 2025':  'Data sets/December_2025_Smart_Inventory.csv',
    'January 2026':   'Data sets/January_2026_Smart_Inventory.csv',
    'February 2026':  'Data sets/Clean_February_Sales.csv',
}

dfs = []
for month, fname in files.items():
    try:
        df_m = pd.read_csv(fname)
        df_m['month_label'] = month
        dfs.append(df_m)
        print(f"  ✅ {month}: {len(df_m):,} rows | SKUs: {df_m['sku'].nunique()}")
    except FileNotFoundError:
        print(f"  ❌ {month}: file not found — {fname}")

df_raw = pd.concat(dfs, ignore_index=True)
df_raw['date'] = pd.to_datetime(df_raw['date'])

# SKU continuity check
sku_month_counts = df_raw.groupby('sku')['month_label'].nunique()
print(f"\n  Total raw records    : {len(df_raw):,}")
print(f"  Unique SKUs          : {df_raw['sku'].nunique()}")
print(f"  Date range           : {df_raw['date'].min().date()} → {df_raw['date'].max().date()}")
print(f"  Calendar days        : {(df_raw['date'].max()-df_raw['date'].min()).days}")
print(f"  SKUs in all 7 months : {(sku_month_counts==7).sum()}")  # type: ignore
print(f"  SKUs in 6+ months    : {(sku_month_counts>=6).sum()}")
print("\n▶  STEP 2 — Clean & Standardise")
print("─" * 50)

returns_df = df_raw[df_raw['status'] == 'Return'].copy()
completed  = df_raw[df_raw['status'].isin(['Packed','Shipped','Delivered'])].copy()
completed['stock_cover_days'] = completed['stock_cover_days'].clip(upper=90)
completed = completed.sort_values(['sku','date']).reset_index(drop=True)

print(f"  Completed orders  : {len(completed):,}")
print(f"  Return rows       : {len(returns_df)}")
print(f"  Status breakdown  :\n{completed['status'].value_counts().to_string()}")
print("\n▶  ACTION 3 — SKU-Level Feature Engineering")
print("─" * 50)

# Daily sales per SKU (not per category)
daily_sku = (completed
    .groupby(['sku','date'], as_index=False)['quantity']
    .sum()
    .rename(columns={'quantity':'total_quantity'}))

# Attach product_name and category
meta = completed[['sku','product_name','category']].drop_duplicates('sku')
daily_sku = daily_sku.merge(meta, on='sku', how='left')

# Fill missing calendar days per SKU with 0
full_range = pd.date_range(completed['date'].min(), completed['date'].max())
records = []
for sku, grp in daily_sku.groupby('sku'):
    qty  = grp.set_index('date')['total_quantity'].reindex(full_range, fill_value=0)
    cat  = grp['category'].iloc[0]
    prod = grp['product_name'].iloc[0]
    records.append(pd.DataFrame({
        'date': qty.index, 'total_quantity': qty.values,
        'sku': sku, 'category': cat, 'product_name': prod
    }))

daily_sku_filled = pd.concat(records).reset_index(drop=True)
daily_sku_filled = daily_sku_filled.sort_values(['sku','date']).reset_index(drop=True)

print(f"  SKU-level daily rows (filled) : {len(daily_sku_filled):,}")
print(f"  Unique SKUs                   : {daily_sku_filled['sku'].nunique()}")
print(f"  Avg daily rows per SKU        : {len(daily_sku_filled)/daily_sku_filled['sku'].nunique():.0f}")
print(f"  Zero-demand days              : {(daily_sku_filled['total_quantity']==0).sum():,} "  # type: ignore
      f"({100*(daily_sku_filled['total_quantity']==0).mean():.1f}%)")  # type: ignore

print("\n▶  STEP 3 — EDA")
print("─" * 50)

cat_stats = (daily_sku_filled.groupby('category')['total_quantity']
             .agg(['mean','std','min','max']).round(2))
print(f"\n  Per-SKU daily demand stats by category:")
print(cat_stats.to_string())

fig = plt.figure(figsize=(16, 12))
fig.suptitle('Dropex v3 — EDA Dashboard (7 Months)', fontsize=16, fontweight='bold')
gs = gridspec.GridSpec(2, 3, figure=fig, hspace=0.4, wspace=0.35)

# Plot 1: Total daily demand trend
ax1 = fig.add_subplot(gs[0, :2])
total_daily = daily_sku_filled.groupby('date')['total_quantity'].sum()
ax1.plot(total_daily.index, total_daily.values, linewidth=1, color='steelblue', alpha=0.8)
ax1.fill_between(total_daily.index, total_daily.values, alpha=0.15, color='steelblue')
for month_start, color, label in [
    ('2025-09-01','orange','Sep'), ('2025-10-01','green','Oct'),
    ('2025-11-01','purple','Nov'), ('2025-12-01','red','Dec'),
    ('2026-01-01','brown','Jan'),  ('2026-02-01','teal','Feb'),
]:
    ax1.axvline(pd.Timestamp(month_start), color=color, ls='--', alpha=0.6, label=label)
ax1.axvline(pd.Timestamp('2025-11-28'), color='black', ls=':', alpha=0.8, label='Black Friday')
ax1.set_title('Total Daily Demand — All SKUs (7 Months)'); ax1.legend(fontsize=7)
ax1.set_xlabel('Date'); ax1.set_ylabel('Total Units'); ax1.grid(alpha=0.3)

# Plot 2: Monthly totals by category
ax2 = fig.add_subplot(gs[0, 2])
completed['month_short'] = completed['date'].dt.strftime('%b %y')
month_order = ['Aug 25','Sep 25','Oct 25','Nov 25','Dec 25','Jan 26', 'Feb 26']
mcat = (completed.groupby(['month_short','category'])['quantity']
        .sum().unstack(fill_value=0))
mcat = mcat.reindex([m for m in month_order if m in mcat.index])
mcat.plot(kind='bar', ax=ax2, width=0.85, legend=False)
ax2.set_title('Monthly Demand\nby Category')
ax2.set_xlabel(''); ax2.tick_params(axis='x', rotation=45)
ax2.grid(alpha=0.3, axis='y')

# Plot 3: SKU demand distribution
ax3 = fig.add_subplot(gs[1, 0])
sku_totals = completed.groupby('sku')['quantity'].sum().sort_values(ascending=False)
ax3.bar(range(len(sku_totals)), sku_totals.values, color='steelblue', alpha=0.7)
ax3.set_title('SKU Demand Distribution\n(sorted)')
ax3.set_xlabel('SKU rank'); ax3.set_ylabel('Total units sold'); ax3.grid(alpha=0.3, axis='y')

# Plot 4: Category reorder rate
ax4 = fig.add_subplot(gs[1, 1])
rr = completed.groupby('category')['reorder_flag'].mean().sort_values(ascending=False)*100
rr.plot(kind='bar', ax=ax4, color='tomato', edgecolor='black')
ax4.set_title('Reorder Flag Rate\nby Category (%)'); ax4.tick_params(axis='x',rotation=45)
ax4.grid(alpha=0.3,axis='y')

# Plot 5: Demand by day of week
ax5 = fig.add_subplot(gs[1, 2])
completed['dow'] = completed['date'].dt.day_name()
dow_order = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']
dow_demand = completed.groupby('dow')['quantity'].mean().reindex(dow_order)
dow_demand.plot(kind='bar', ax=ax5, color='mediumseagreen', edgecolor='black')
ax5.set_title('Avg Demand by\nDay of Week'); ax5.tick_params(axis='x',rotation=45)
ax5.grid(alpha=0.3,axis='y')

plt.savefig(f'{OUTPUT_DIR}/01_eda_dashboard.png', dpi=150, bbox_inches='tight')
plt.close()
print(f"  📊 EDA chart saved → {OUTPUT_DIR}/01_eda_dashboard.png")


print("\n▶  STEP 4 — Feature Engineering (SKU-level)")
print("─" * 50)

le = LabelEncoder()
le.fit(daily_sku_filled['category'])

def create_sku_features(df):
    df = df.copy().sort_values(['sku','date']).reset_index(drop=True)
    g  = df.groupby('sku')['total_quantity']

    # Lag features — true calendar lags (dates already filled)
    df['lag_7']  = g.transform(lambda x: x.shift(7))
    df['lag_14'] = g.transform(lambda x: x.shift(14))
    df['lag_30'] = g.transform(lambda x: x.shift(30))

    # Rolling features
    df['rolling_mean_7']  = g.transform(lambda x: x.rolling(7,  min_periods=3).mean())
    df['rolling_mean_14'] = g.transform(lambda x: x.rolling(14, min_periods=5).mean())
    df['rolling_mean_30'] = g.transform(lambda x: x.rolling(30, min_periods=10).mean())
    df['rolling_std_7']   = g.transform(lambda x: x.rolling(7,  min_periods=3).std().fillna(0))
    df['rolling_max_7']   = g.transform(lambda x: x.rolling(7,  min_periods=3).max())

    # Calendar features
    df['month']           = df['date'].dt.month
    df['day']             = df['date'].dt.day
    df['dayofweek']       = df['date'].dt.dayofweek
    df['is_weekend']      = (df['dayofweek'] >= 5).astype(int)
    df['week_of_year']    = df['date'].dt.isocalendar().week.astype(int)
    df['is_black_friday'] = ((df['date'].dt.month==11)&(df['date'].dt.day==28)).astype(int)  # type: ignore
    df['days_since_start']= (df['date'] - df['date'].min()).dt.days

    # Category encoding
    df['category_encoded']= le.transform(df['category'])

    return df

print("  Building SKU-level features …")
daily_fe = create_sku_features(daily_sku_filled)

before = len(daily_fe)
daily_fe = daily_fe.dropna(subset=['lag_30','rolling_mean_30']).reset_index(drop=True)
after  = len(daily_fe)

print(f"  Rows before lag_30 dropna : {before:,}")
print(f"  Rows after  lag_30 dropna : {after:,}  (dropped {before-after:,} warmup rows)")
print(f"  Improvement vs v1: was 496 rows → now {after:,} rows ({after//496:.1f}x more)")

feature_cols = [
    'lag_7','lag_14','lag_30',
    'rolling_mean_7','rolling_mean_14','rolling_mean_30',
    'rolling_std_7','rolling_max_7',
    'month','day','dayofweek','is_weekend','week_of_year',
    'is_black_friday','category_encoded','days_since_start',
]
target_col = 'total_quantity'

nan_check = daily_fe[feature_cols].isnull().sum().sum()
print(f"  NaNs in features: {nan_check}")
assert nan_check == 0, "NaNs found — check feature engineering"
print(f"  ✅ {len(feature_cols)} features, 0 NaNs")


print("\n▶  STEP 5 — Train / Val / Test Split (70/15/15)")
print("─" * 50)

# Sort by date for temporal split
ds = daily_fe.sort_values('date').reset_index(drop=True)
n  = len(ds)
t1, t2 = int(n*0.70), int(n*0.85)

train = ds.iloc[:t1].copy()
val   = ds.iloc[t1:t2].copy()
test  = ds.iloc[t2:].copy()

print(f"  Train : {train['date'].min().date()} → {train['date'].max().date()} | "
      f"{len(train):,} rows | {train['date'].nunique()} unique dates")
print(f"  Val   : {val['date'].min().date()} → {val['date'].max().date()}   | "
      f"{len(val):,} rows | {val['date'].nunique()} unique dates")
print(f"  Test  : {test['date'].min().date()} → {test['date'].max().date()}  | "
      f"{len(test):,} rows | {test['date'].nunique()} unique dates")
print(f"\n  vs v1: train had 347 rows / 44 dates → now {len(train):,} rows / {train['date'].nunique()} dates")

X_train, y_train = train[feature_cols], train[target_col]
X_val,   y_val   = val[feature_cols],   val[target_col]
X_test,  y_test  = test[feature_cols],  test[target_col]

# ACTION 2 — REMOVE MAPE, USE WAPE INSTEAD
# MAPE explodes when actuals are near 0 (gives 214% on sparse demand)
# WAPE = sum(|actual-pred|) / sum(actual) — stable, used by Amazon/Walmart
# ══════════════════════════════════════════════════════════════════════════════
def evaluate(name, y_true, y_pred):
    """
    Metrics used:
    - MAE  : average absolute error in units — most interpretable
    - RMSE : penalises large errors more — good for stockout risk
    - R²   : % variance explained — model quality indicator
    - WAPE : Weighted Absolute Percentage Error — correct for sparse demand
             WAPE = sum(|actual-pred|) / sum(actual) × 100
             Unlike MAPE, WAPE does NOT blow up when actuals are near 0
    ❌ MAPE : REMOVED — mathematically unstable for low-count demand
    """
    mae  = mean_absolute_error(y_true, y_pred)
    rmse = np.sqrt(mean_squared_error(y_true, y_pred))
    r2   = r2_score(y_true, y_pred)
    # WAPE — safe for zero/near-zero actuals
    total_actual = y_true.sum()
    wape = (np.abs(y_true - y_pred).sum() / total_actual * 100) if total_actual > 0 else 0
    return {'model': name, 'MAE': mae, 'RMSE': rmse, 'R2': r2, 'WAPE(%)': wape}

print("\n▶  STEP 6 — Model Training")
print("─" * 50)

models = {
    'Ridge': Ridge(alpha=1.0),
    'RandomForest': RandomForestRegressor(
        n_estimators=300, max_depth=8, min_samples_leaf=10,
        max_features='sqrt', random_state=42, n_jobs=-1),
    'GradientBoosting': GradientBoostingRegressor(
        n_estimators=300, max_depth=5, learning_rate=0.05,
        subsample=0.8, min_samples_leaf=10, random_state=42),
}

val_results = []
for name, m in models.items():
    m.fit(X_train, y_train)
    r = evaluate(name, y_val, m.predict(X_val))
    val_results.append(r)
    print(f"  {name:<22} Val MAE={r['MAE']:.2f}  RMSE={r['RMSE']:.2f}  "
          f"R²={r['R2']:.4f}  WAPE={r['WAPE(%)']:.1f}%")

best_name  = min(val_results, key=lambda x: x['MAE'])['model']  # type: ignore
best_model = models[best_name]
print(f"\n  ✅ Best model: {best_name}")

# TimeSeriesSplit CV
print(f"\n  TimeSeriesSplit CV (5 folds) …")
X_tv = pd.concat([X_train, X_val])
y_tv = pd.concat([y_train, y_val])
tscv = TimeSeriesSplit(n_splits=5)
cv_r2s, cv_maes, cv_wapes = [], [], []
for fold, (tr_i, va_i) in enumerate(tscv.split(X_tv), 1):
    m_cv = GradientBoostingRegressor(n_estimators=200, max_depth=5,
           learning_rate=0.05, subsample=0.8, min_samples_leaf=10, random_state=42)
    m_cv.fit(X_tv.iloc[tr_i], y_tv.iloc[tr_i])
    p    = m_cv.predict(X_tv.iloc[va_i])
    r2   = r2_score(y_tv.iloc[va_i], p)
    mae  = mean_absolute_error(y_tv.iloc[va_i], p)
    tot  = y_tv.iloc[va_i].sum()
    wape = np.abs(y_tv.iloc[va_i].values - p).sum() / tot * 100 if tot > 0 else 0
    cv_r2s.append(r2); cv_maes.append(mae); cv_wapes.append(wape)
    n_dates = pd.Series(X_tv.index[va_i]).nunique() if hasattr(X_tv.index[va_i],'nunique') else '?'
    print(f"    Fold {fold}: MAE={mae:.2f}  R²={r2:.4f}  WAPE={wape:.1f}%  "
          f"| val rows={len(va_i)}")

print(f"  CV Mean — MAE={np.mean(cv_maes):.2f} ± {np.std(cv_maes):.2f}  "
      f"R²={np.mean(cv_r2s):.4f} ± {np.std(cv_r2s):.4f}  "
      f"WAPE={np.mean(cv_wapes):.1f}%")


print("\n▶  STEP 7 — Evaluation (MAPE removed)")
print("─" * 50)

test_results = []
print(f"\n  {'Model':<22} {'MAE':>7} {'RMSE':>7} {'R²':>8} {'WAPE%':>8}")
print("  " + "─"*55)
for name, m in models.items():
    r = evaluate(name, y_test, m.predict(X_test))
    test_results.append(r)
    tag = " ◀" if name == best_name else ""
    print(f"  {name:<22} {r['MAE']:>7.2f} {r['RMSE']:>7.2f} {r['R2']:>8.4f} {r['WAPE(%)']:>8.1f}{tag}")

best_test = next(r for r in test_results if r['model']==best_name)

# Baseline comparison
naive_pred = np.full(len(y_test), y_train.mean())
naive_mae  = mean_absolute_error(y_test, naive_pred)
naive_r2   = r2_score(y_test, naive_pred)
print(f"\n  Naive (predict mean) : MAE={naive_mae:.2f}  R²={naive_r2:.4f}")
print(f"  {best_name} beats naive by : {naive_mae - best_test['MAE']:.2f} MAE units")

# Feature importance
y_pred_test = best_model.predict(X_test)
if hasattr(best_model, 'feature_importances_'):
    fi = pd.DataFrame({'feature':feature_cols,
                       'importance':best_model.feature_importances_})\
           .sort_values('importance', ascending=False)
    print(f"\n  Feature Importance ({best_name}):")
    print(fi.to_string(index=False))

# Evaluation charts
fig, axes = plt.subplots(2, 2, figsize=(14, 10))
fig.suptitle(f'Dropex v3 — Model Evaluation: {best_name} (SKU-Level, 7 Months)',
             fontsize=14, fontweight='bold')

# Actual vs Predicted
axes[0,0].scatter(y_test, y_pred_test, alpha=0.3, s=8, color='steelblue')
mn, mx = 0, max(y_test.max(), y_pred_test.max())
axes[0,0].plot([mn,mx],[mn,mx],'r--', lw=1.5, label='Perfect')
axes[0,0].set_title('Actual vs Predicted (Test)')
axes[0,0].set_xlabel('Actual'); axes[0,0].set_ylabel('Predicted')
axes[0,0].legend(); axes[0,0].grid(alpha=0.3)

# Residuals
residuals = y_test.values - y_pred_test
axes[0,1].scatter(y_pred_test, residuals, alpha=0.3, s=8, color='tomato')
axes[0,1].axhline(0, color='black', lw=1.5, ls='--')
axes[0,1].set_title('Residuals')
axes[0,1].set_xlabel('Predicted'); axes[0,1].set_ylabel('Residual')
axes[0,1].grid(alpha=0.3)

# Metric comparison across models
ax = axes[1,0]
model_names = [r['model'] for r in test_results]
maes  = [r['MAE']  for r in test_results]
rmses = [r['RMSE'] for r in test_results]
x = np.arange(len(model_names))
ax.bar(x-0.2, maes,  0.35, label='MAE',  color='steelblue')
ax.bar(x+0.2, rmses, 0.35, label='RMSE', color='tomato')
ax.set_xticks(x); ax.set_xticklabels(model_names)
ax.set_title('Model Comparison — MAE & RMSE (Test Set)')
ax.legend(); ax.grid(alpha=0.3, axis='y')

# Feature importance
ax = axes[1,1]
if hasattr(best_model,'feature_importances_'):
    fi_top = fi.head(10)
    ax.barh(fi_top['feature'], fi_top['importance'], color='mediumseagreen', edgecolor='black')
    ax.set_title(f'Top 10 Feature Importances ({best_name})')
    ax.invert_yaxis(); ax.grid(alpha=0.3, axis='x')

plt.tight_layout()
plt.savefig(f'{OUTPUT_DIR}/02_model_evaluation.png', dpi=150, bbox_inches='tight')
plt.close()
print(f"\n  📊 Evaluation chart saved → {OUTPUT_DIR}/02_model_evaluation.png")

# ACTION 4 — REORDER MODULE: STANDALONE, PRODUCTION-READY
# Completely independent of model quality
# Runs daily, calculates per-SKU reorder needs, explains WHY in plain English
# ══════════════════════════════════════════════════════════════════════════════
print("\n▶  ACTION 4 — Reorder Module (Standalone Production)")
print("─" * 50)

def run_reorder_module(completed_df, lookback_days=30, forecast_days=7,
                       service_level_z=1.645):
    """
    STANDALONE reorder intelligence — no ML model required.
    Runs daily from raw completed transaction data.

    Logic:
    1. For each SKU compute avg_daily_demand & demand_std from last 30 days
    2. safety_stock  = Z × std × √lead_time
    3. reorder_point = avg_daily × lead_time + safety_stock
    4. projected_stock = current_stock - avg_daily × forecast_days
    5. reorder_flag = 1 if projected_stock ≤ reorder_point
    6. reorder_qty  = qty to bring stock to 30-day supply
    7. plain-English reason for dashboard display

    Returns: DataFrame sorted by urgency (days_of_stock ascending)
    """
    cutoff = completed_df['date'].max() - pd.Timedelta(days=lookback_days)
    recent = completed_df[completed_df['date'] >= cutoff].copy()

    # Per-SKU aggregation
    sku_agg = (recent.groupby('sku').agg(
        product_name   = ('product_name','first'),
        category       = ('category',    'first'),
        current_stock  = ('current_stock','last'),
        lead_time_days = ('lead_time_days','first'),
        total_qty      = ('quantity',     'sum'),
        tx_count       = ('quantity',     'count'),
    ).reset_index())

    # Demand std per SKU
    sku_std = recent.groupby('sku')['quantity'].std().fillna(0).rename('demand_std')
    sku_agg = sku_agg.merge(sku_std, on='sku', how='left')
    sku_agg['demand_std'] = sku_agg['demand_std'].fillna(0)

    results = []
    for _, row in sku_agg.iterrows():
        avg_daily = round(row['total_qty'] / lookback_days, 3)
        avg_daily = max(avg_daily, 0.01)   # guard zero-division

        lt  = int(row['lead_time_days'])
        std = row['demand_std']
        cs  = int(row['current_stock'])

        ss   = round(float(service_level_z * std * np.sqrt(lt)), 2)  # type: ignore
        rp   = round(float(avg_daily * lt + ss), 2)  # type: ignore
        proj = round(float(cs - avg_daily * forecast_days), 2)  # type: ignore
        flag = int(proj <= rp)
        reorder_qty = max(0, round(float(avg_daily * 30 - cs), 0)) if flag else 0  # type: ignore
        days_left   = round(float(cs / avg_daily), 1)  # type: ignore

        # Urgency level
        if flag and days_left <= lt:
            urgency = '🔴 CRITICAL'
            reason  = (f"Stock will run out IN lead time window! "
                       f"Only {days_left:.0f}d left, lead={lt}d. "
                       f"Order {reorder_qty:.0f} units IMMEDIATELY.")
        elif flag and days_left <= lt * 2:
            urgency = '🟡 URGENT'
            reason  = (f"Reorder soon — {days_left:.0f} days stock left, "
                       f"lead time={lt}d, ROP={rp:.0f}. "
                       f"Order {reorder_qty:.0f} units this week.")
        elif flag:
            urgency = '🟠 REORDER'
            reason  = (f"Stock projected below ROP after {forecast_days}d. "
                       f"Avg demand={avg_daily:.1f}/day, "
                       f"order {reorder_qty:.0f} units.")
        else:
            urgency = '✅ OK'
            reason  = (f"Stock sufficient. {days_left:.0f} days supply remaining. "
                       f"ROP={rp:.0f}, projected={proj:.0f}.")

        results.append({
            'urgency':         urgency,
            'sku':             row['sku'],
            'product_name':    row['product_name'],
            'category':        row['category'],
            'current_stock':   cs,
            'avg_daily_demand':round(float(avg_daily), 2),  # type: ignore
            'demand_std':      round(std, 2),
            'safety_stock':    ss,
            'reorder_point':   rp,
            'projected_stock': proj,
            'days_of_stock':   days_left,
            'lead_time_days':  lt,
            'reorder_flag':    flag,
            'reorder_qty':     reorder_qty,
            'reason':          reason,
        })

    df_out = pd.DataFrame(results)
    # Sort by urgency: critical first, then by days_of_stock ascending
    urgency_order = {'🔴 CRITICAL':0, '🟡 URGENT':1, '🟠 REORDER':2, '✅ OK':3}
    df_out['urgency_rank'] = df_out['urgency'].map(urgency_order)
    df_out = df_out.sort_values(['urgency_rank','days_of_stock']).reset_index(drop=True)
    df_out = df_out.drop(columns='urgency_rank')
    return df_out

reorder_df = run_reorder_module(completed)
flagged    = reorder_df[reorder_df['reorder_flag']==1]
critical   = reorder_df[reorder_df['urgency']=='🔴 CRITICAL']
urgent     = reorder_df[reorder_df['urgency']=='🟡 URGENT']

print(f"\n  {'─'*60}")
print(f"  REORDER DASHBOARD  (as of {completed['date'].max().date()})")
print(f"  {'─'*60}")
print(f"  Total SKUs analysed : {len(reorder_df)}")
print(f"  🔴 CRITICAL         : {len(critical)}")
print(f"  🟡 URGENT           : {len(urgent)}")
print(f"  🟠 Reorder needed   : {len(flagged)} ({100*len(flagged)/len(reorder_df):.1f}%)")
print(f"  ✅ Stock OK         : {len(reorder_df)-len(flagged)}")

print(f"\n  {'─'*60}")
print(f"  TOP ALERTS — requires immediate action:")
print(f"  {'─'*60}")
cols = ['urgency','sku','product_name','current_stock','days_of_stock','reorder_qty','reason']
print(flagged[cols].head(12).to_string(index=False))

print(f"\n  Category reorder summary:")
cat_sum = (flagged.groupby('category')
    .agg(skus_to_reorder=('sku','count'),
         total_units_needed=('reorder_qty','sum'),
         critical_skus=('urgency', lambda x:(x=='🔴 CRITICAL').sum()))  # type: ignore
    .sort_values('skus_to_reorder', ascending=False))
print(cat_sum.to_string())

reorder_df.to_csv(f'{OUTPUT_DIR}/reorder_report_v3.csv', index=False)
print(f"\n  💾 Full reorder report → {OUTPUT_DIR}/reorder_report_v3.csv")

# Reorder charts
fig, axes = plt.subplots(1, 3, figsize=(18, 6))
fig.suptitle('Dropex v3 — Reorder Intelligence Dashboard', fontsize=14, fontweight='bold')

# Urgency breakdown pie
ax = axes[0]
urgency_counts = reorder_df['urgency'].value_counts()
colors_map = {'🔴 CRITICAL':'#e74c3c','🟡 URGENT':'#f39c12',
              '🟠 REORDER':'#e67e22','✅ OK':'#27ae60'}
colors = [colors_map.get(k,'grey') for k in urgency_counts.index]
ax.pie(urgency_counts.values, labels=urgency_counts.index, colors=colors,
       autopct='%1.0f%%', startangle=140)
ax.set_title('SKU Reorder Status')

# SKUs to reorder by category
ax = axes[1]
if len(cat_sum) > 0:
    cat_sum['skus_to_reorder'].plot(kind='bar', ax=ax, color='tomato', edgecolor='black')
ax.set_title('SKUs Needing Reorder\nby Category')
ax.set_xlabel(''); ax.tick_params(axis='x', rotation=45); ax.grid(alpha=0.3, axis='y')

# Top SKUs by days of stock remaining (critical ones)
ax = axes[2]
if len(flagged) > 0:
    top_critical = flagged.nsmallest(12, 'days_of_stock')[['sku','days_of_stock','lead_time_days']]
    top_critical = top_critical.set_index('sku')
    top_critical['days_of_stock'].plot(kind='barh', ax=ax, color='steelblue', edgecolor='black')
    # Draw lead time line
    if len(top_critical) > 0:
        lt_vals = top_critical['lead_time_days']
        for i, (idx, row_v) in enumerate(top_critical.iterrows()):
            ax.plot(row_v['lead_time_days'], i, 'r|', markersize=12, markeredgewidth=2)
ax.set_title('Days of Stock Remaining\n(red line = lead time)')
ax.set_xlabel('Days of stock'); ax.grid(alpha=0.3, axis='x')

plt.tight_layout()
plt.savefig(f'{OUTPUT_DIR}/03_reorder_dashboard.png', dpi=150, bbox_inches='tight')
plt.close()
print(f"  📊 Reorder chart → {OUTPUT_DIR}/03_reorder_dashboard.png")

# STEP 8 — SAVE ARTEFACTS
# ══════════════════════════════════════════════════════════════════════════════
print("\n▶  STEP 8 — Save Artefacts")
print("─" * 50)

joblib.dump(best_model, f'{OUTPUT_DIR}/forecast_model_v3.pkl')

le_mapping = {cls: int(code) for code, cls in enumerate(le.classes_)}
with open(f'{OUTPUT_DIR}/label_encoder_v3.json','w') as f:
    json.dump({'classes': list(le.classes_), 'mapping': le_mapping}, f, indent=2)

with open(f'{OUTPUT_DIR}/feature_cols.txt','w') as f:
    f.write('\n'.join(feature_cols))

metadata = {
    'model':            best_name,
    'data_months':      7,
    'date_range':       f"{df_raw['date'].min().date()} → {df_raw['date'].max().date()}",
    'forecasting_level':'SKU',
    'test_MAE':         round(best_test['MAE'],4),
    'test_RMSE':        round(best_test['RMSE'],4),
    'test_R2':          round(best_test['R2'],4),
    'test_WAPE_pct':    round(best_test['WAPE(%)'],2),
    'mape_removed':     True,
    'cv_mean_R2':       round(np.mean(cv_r2s),4),
    'cv_std_R2':        round(np.std(cv_r2s),4),
    'cv_mean_MAE':      round(np.mean(cv_maes),4),
    'train_rows':       len(train),
    'train_unique_dates':train['date'].nunique(),
    'feature_count':    len(feature_cols),
    'unique_skus':      daily_sku_filled['sku'].nunique(),
}
with open(f'{OUTPUT_DIR}/model_metadata_v3.json','w') as f:
    json.dump(metadata, f, indent=2)

print(f"  💾 forecast_model_v3.pkl")
print(f"  💾 label_encoder_v3.json")
print(f"  💾 feature_cols.txt")
print(f"  💾 model_metadata_v3.json")
print(f"  💾 reorder_report_v3.csv")


# FINAL SUMMARY — compare v1 vs v3
# ══════════════════════════════════════════════════════════════════════════════
print("\n" + "=" * 70)
print("  PIPELINE v3 COMPLETE — PRIORITY ACTIONS RESULTS")
print("=" * 70)

print(f"""
  ┌──────────────────────────────┬──────────────────┬──────────────────┐
  │ Metric                       │   v1 (before)    │   v3 (after)     │
  ├──────────────────────────────┼──────────────────┼──────────────────┤
  │ Data months                  │   3 months       │   7 months       │
  │ Forecasting level            │   Category       │   SKU            │
  │ Training rows                │   347            │   {len(train):,}           │
  │ Training unique dates        │   44             │   {train['date'].nunique()}            │
  │ Test MAE                     │   8.77 units     │   {best_test['MAE']:.2f} units      │
  │ Test RMSE                    │   11.17 units    │   {best_test['RMSE']:.2f} units     │
  │ Test R²                      │   0.2160         │   {best_test['R2']:.4f}         │
  │ CV Mean R²                   │  -0.2322         │   {np.mean(cv_r2s):.4f}         │
  │ MAPE (broken metric)         │   214.30%        │   REMOVED ✅     │
  │ WAPE (correct metric)        │   N/A            │   {best_test['WAPE(%)']:.1f}%          │
  │ Reorder module standalone    │   No             │   Yes ✅         │
  │ Urgency levels in reorder    │   No             │   Yes ✅         │
  └──────────────────────────────┴──────────────────┴──────────────────┘

  Action 1 ✅ 7 months data   → {train['date'].nunique()} training dates (was 44)
  Action 2 ✅ MAPE removed    → Replaced with WAPE={best_test['WAPE(%)']:.1f}% (stable metric)
  Action 3 ✅ SKU-level       → {len(train):,} training rows (was 347), {daily_sku_filled['sku'].nunique()} SKUs
  Action 4 ✅ Reorder standalone → 3 urgency levels, plain-English reasons, daily-ready

  Reorder alerts today:
    🔴 CRITICAL : {len(critical)} SKUs
    🟡 URGENT   : {len(urgent)} SKUs
    🟠 REORDER  : {len(flagged)} total SKUs need reordering
""")