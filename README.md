# QuickSplit — Minimalist Expense Splitter

**QuickSplit** features dynamic participant badge entry, 1-tap participant chips, Cashfree Sandbox payment gateway checkout with automatic pairwise debt cancellation, and a unified root project structure.

---

## ⚡ Project Structure

```text
quick-split/
├── package.json              # Single root package.json for entire project
├── package-lock.json
├── node_modules/             # Single root node_modules
├── .env                      # Environment variables & Cashfree credentials
├── .env.example              # Environment variables template
├── .gitignore
├── README.md
│
├── frontend/                 # Frontend assets only
│   ├── index.html
│   ├── styles.css
│   └── app.js
│
└── backend/                  # Backend application only
    └── server.js
```

---

## 🚀 How to Run

From the project root (`quick-split`):

```bash
# 1. Install all dependencies at root (one time)
npm install

# 2. Run both Backend (Port 5000) and Frontend (Port 3000) with a single command
npm run dev
```

* Backend API: `http://localhost:5000`
* Frontend App: `http://localhost:3000`
