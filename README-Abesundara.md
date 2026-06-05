# Abesundara — Product Management & AI Model

This branch contains the product-management features and AI model integration work contributed by Abesundara.

## Summary

A focused snapshot of the Demand Forecasting System covering:
- Frontend: product management UIs (Add Product, Inventory, Reports, Dashboard, User Management).
- Backend: FastAPI routes and services for products, categories, inventory, sales, and reports.
- AI Model: forecasting model, label encoder, metadata, and a lightweight ML API for stock advice.

## Key Features

### Product Management (Frontend)
- `AddProduct.jsx`: add new products with SKU, category, price, stock and lead time.
- `Inventory.jsx`: view and manage inventory levels.
- `Reports.jsx`: generate sales and inventory reports.
- `Dashboard.jsx`: high-level metrics and summaries.
- `UserManagement.jsx`: user administration UI.
- Frontend connects to backend APIs via `Frontend/frontend/src/services/api.js` and requests ML advice for stock recommendations.

### Backend (API)
- FastAPI app entry: `Backend/backend/main.py`.
- Routers in `Backend/backend/routers/`:
  - `products.py`, `categories.py`, `inventory.py`, `sales.py`, `reports.py`.
- Services in `Backend/backend/services/` support business logic, alerts, reporting and retraining triggers.
- Scheduler triggers retraining jobs (see `retrain_service`).

### AI Model
- API entry: `AI-Model/main.py` serves the model and lightweight endpoints:
  - `/health` — model and service health
  - `/register-sku` — register new SKUs (used by frontend/backend)
  - `/stock-advice` — returns category + lead-time based stock recommendations
- Model and metadata in `AI-Model/`:
  - `forecast_model_v3.pkl`, `label_encoder_v3.json`, `model_metadata_v3.json`, `model_metrics.json`.
- Training and retraining scripts included under `AI-Model/`.

## Quick Start

1. Backend API

```powershell
cd Demand-Forecasting-System\Backend\backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

2. AI Model API

```powershell
cd Demand-Forecasting-System\AI-Model
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn main:app --reload --port 8001
```

3. Frontend

```powershell
cd Demand-Forecasting-System\Frontend\frontend
npm install
npm run dev
```

> Note: Use separate virtual environments for backend and AI model to avoid dependency conflicts.

## Important Security Notes
- `Backend/backend/serviceAccountKey.json` is intentionally excluded from Git and listed in `.gitignore`.
- Configure Firebase/service account credentials and environment variables locally before running the backend.
- Do NOT add secrets (API keys, service account JSON) to the repository.

## Files of Interest
- Frontend UIs: `Frontend/frontend/src/pages/` (AddProduct, Inventory, Reports, Dashboard, UserManagement)
- Frontend services: `Frontend/frontend/src/services/api.js`
- Backend app: `Backend/backend/main.py` and `Backend/backend/routers/`
- AI model: `AI-Model/main.py`, `AI-Model/forecast_model_v3.pkl`, `AI-Model/label_encoder_v3.json`

## Contributing & Next Steps
- If you modify credentials or environment configs, update `.env.example` (do not include secrets).
- To run tests or CI checks, see project-specific test scripts under `Backend/` and `AI-Model/`.
- For code review or to push further changes to this branch, commit and push to `origin/Abesundara`.

---

If you want this content merged into the repository `README.md`, or shown as the main project's README, let me know and I will update it accordingly and push the change to `Abesundara`.