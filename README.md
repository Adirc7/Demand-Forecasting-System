# AI‑Based Demand Forecasting System for Dropshipping Inventory Optimization

Client: Dropex.lk – Sri Lanka's first dropshipping company.

## Overview
AI-powered demand forecasting and inventory optimization system that predicts sales using Random Forest / Linear Regression, sets dynamic reorder thresholds, and provides explainable low‑stock alerts.

## Team Members
| Registration | Name | Web Module | Pipeline Task |
|--------------|------|------------|---------------|
| IT24103517 | Abesundara N.S. | Product | Data Preprocessing & Cleaning |
| IT24102722 | Abesekera A.W.A.D. | Sales | Feature Engineering |
| IT24103675 | Bandara H.M.T.A. | Inventory | Model Development & Evaluation (Random Forest) |
| IT24300329 | Jayamuni J.T.S.J. | Forecast Dashboard | Model Development & Evaluation (Linear Regression) |
| IT24101454 | Perera W.A.M.V. | Report | Backend Integration API |
| IT24101316 | B.H.K.G. Udawattha | User & System | Frontend Explainable AI |

## Tech Stack
- Backend: FastAPI (Python)
- Database: Firebase Firestore
- ML: Scikit‑learn, Pandas, NumPy, Joblib
- Frontend: HTML, CSS, JavaScript, Chart.js
- Deployment: Render (backend), Vercel / Firebase Hosting (frontend)

## Setup
1. Clone the repository.
2. Install backend dependencies from `requirements.txt`.
3. Configure Firebase credentials.
4. Run `uvicorn backend.main:app --reload`.

For more details, see the documentation.
