# Smart Inventory AI – Demand Forecasting System for Dropshipping

An AI-powered **demand forecasting and inventory optimisation** web application built for
**Dropex.lk**, Sri Lanka's first dropshipping company. It predicts how many units of each product
(SKU) will sell, works out when stock needs reordering, and warns the team before items run out,
with plain-language explanations of every alert.

> SLIIT · Year 2 · Group project · Client: Dropex.lk
>
> 💻 **Source code:** [Adirc7/Demand-Forecasting-System_](https://github.com/Adirc7/Demand-Forecasting-System_)

---

## The problem

Dropshipping stores lose money in two directions: **stock-outs** (lost sales and unhappy customers)
and **over-stocking** (cash tied up in slow-moving products). Inventory decisions at Dropex were
made manually, with no forward view of demand. This system replaces guesswork with data-driven
forecasts and automatic reorder alerts.

## What it does

| Feature | Description |
|---|---|
| 📈 **Demand forecasting** | A Gradient Boosting model predicts daily demand for every SKU from recent sales history and calendar patterns |
| 🔔 **Smart reorder alerts** | Calculates a reorder point per product from forecast demand, supplier lead time and a safety-stock factor, then ranks items as **Emergency → Critical → Urgent → Reorder → OK** |
| 💬 **Explainable AI** | Google Gemini turns each alert into a plain-English explanation of *why* an item needs attention |
| 📊 **Interactive dashboard** | KPI cards plus drag-and-drop chart cards for sales, stock and forecasts |
| 🧾 **Custom report builder** | Build reports from chosen data and chart types, then export them to **PDF** |
| 🔁 **Model retraining** | Retrain the forecasting model on new monthly sales data straight from the app |
| 👥 **Role-based access** | Separate Admin and Standard User permissions, plus user management |
| ✉️ **Email reminders** | Automated email notifications to administrators |

---

## How it works

```
 React + Vite frontend  ──HTTP/REST──▶  FastAPI backend  ──▶  Firebase Firestore
 (dashboard, inventory,                 (routers: products,       (products, sales,
  sales, forecasts,                      sales, inventory,          inventory, users,
  reports, users)                        forecast, reports,         categories, forecasts)
                                         auth, admin)
                                            │
                                            ├──▶ ML forecasting service (scikit-learn model)
                                            ├──▶ Alert service (reorder point & urgency)
                                            ├──▶ Gemini service (alert explanations)
                                            └──▶ Email & report services
```

### Forecasting model

| | |
|---|---|
| **Algorithm** | Gradient Boosting Regressor, compared against Random Forest during development |
| **Level** | Daily demand per SKU |
| **Training data** | 6 months of sales (Aug 2025 – Jan 2026) · 22,206 rows · 206 SKUs |
| **Features (16)** | Lags (7, 14, 30 days); rolling mean (7, 14, 30 days); rolling std and max (7 days); month, day, day of week, weekend flag, week of year; Black Friday flag; product category; trend index |
| **Test error** | MAE ≈ **1.07 units/day** · RMSE ≈ **2.05** per SKU |
| **Cold start** | New products with no history get a category- and calendar-based baseline forecast |

### Reorder logic

For each product, the alert service combines:

- **forecast demand** over the supplier's **lead time**
- a **safety stock** buffer = *Z × demand variability*, where Z is a safety factor each
  category's admin can tune (default 1.645, about 95% service level)
- the **current stock level**

From these it calculates the **reorder point** and **days of stock remaining**, then assigns an
urgency level so the most critical items appear first.

---

## Tech stack

| Layer | Technologies |
|---|---|
| **Frontend** | React, Vite, React Router, Tailwind CSS, Chart.js, Recharts, dnd-kit, jsPDF, html2canvas |
| **Backend** | Python, FastAPI |
| **Machine learning** | scikit-learn (Gradient Boosting, Random Forest), pandas, NumPy, joblib |
| **AI explanations** | Google Gemini API |
| **Database & auth** | Firebase Firestore, Firebase Authentication |

---

## Getting started

```bash
# 1. Get the code
git clone https://github.com/Adirc7/Demand-Forecasting-System_.git
cd Demand-Forecasting-System_

# 2. Backend
cd Backend/backend
pip install -r requirements.txt
# create a .env file with your own GEMINI_API_KEY and add your Firebase service-account credentials
uvicorn main:app --reload

# 3. Frontend (in a new terminal)
cd Frontend/frontend
npm install
npm run dev
```

Then open the local URL that Vite prints (usually `http://localhost:5173`).

---

## Team

| Registration | Name | Web module | ML pipeline task |
|---|---|---|---|
| IT24103675 | **Bandara H.M.T.A.** (Lead Developer & Architect) | Inventory | Model development & evaluation; full-stack integration |
| IT24103517 | Abesundara N.S. | Product | Data preprocessing & cleaning |
| IT24102722 | Abesekera A.W.A.D. | Sales | Feature engineering |
| IT24300329 | Jayamuni J.T.S.J. | Forecast Dashboard | Model development & evaluation |
| IT24101454 | Perera W.A.M.V. | Report | Backend integration API |
| IT24101316 | Udawattha B.H.K.G. | User & System | Frontend explainable AI |

---

**Adithya Bandara**: [Portfolio](https://adirc7.github.io) · [LinkedIn](https://www.linkedin.com/in/adithya-bandara-3808192b2) · [GitHub](https://github.com/Adirc7)
