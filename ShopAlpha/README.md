# ShopAlpha — Full Stack E-Commerce Store
### CodeAlpha Full Stack Internship — Task 1

A complete full-stack e-commerce application built with Node.js, Express.js, and SQLite. Deployable to Render.com for free.

---

## Features

- **Product listings** with category filtering
- **Product detail** pages with quantity selection
- **Shopping cart** (per-user, persisted in database)
- **User authentication** — register & login with hashed passwords (bcrypt) + JWT sessions
- **Order processing** — checkout saves order to database, clears cart
- **Order history** — users can view all past orders
- **Free shipping** on orders over R1,000

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Node.js + Express.js |
| Database | SQLite (via better-sqlite3) |
| Auth | bcryptjs + JSON Web Tokens + HTTP-only cookies |
| Frontend | HTML, CSS, Vanilla JavaScript |
| Deploy | Render.com (free tier) |

---

## Local Setup

```bash
# 1. Clone the repo
git clone https://github.com/STARBOYRSA7/CodeAlpha_ShopAlpha
cd CodeAlpha_ShopAlpha

# 2. Install dependencies
npm install

# 3. Start the server
npm start
# Server runs at http://localhost:3000
```

No database setup needed — SQLite file is created automatically on first run and products are seeded.

---

## Deploy to Render.com

1. Push this repo to GitHub
2. Go to [render.com](https://render.com) → **New Web Service**
3. Connect your GitHub repo
4. Render auto-detects settings from `render.yaml`:
   - **Build command:** `npm install`
   - **Start command:** `node server.js`
5. Add environment variable: `JWT_SECRET` (use Render's "Generate" button)
6. Click **Deploy**

> **Note:** Render's free tier uses ephemeral storage — the SQLite `.db` file resets on each deploy. For persistent storage on free tier, the data still works fine during a session. For permanent persistence, upgrade to a paid plan or use [Render's PostgreSQL](https://render.com/docs/databases) with the `pg` package.

---

## API Endpoints

| Method | Route | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/register` | No | Create account |
| POST | `/api/auth/login` | No | Sign in |
| POST | `/api/auth/logout` | No | Sign out |
| GET | `/api/auth/me` | Yes | Get current user |
| GET | `/api/products` | No | List all products |
| GET | `/api/products?category=X` | No | Filter by category |
| GET | `/api/products/:id` | No | Single product |
| GET | `/api/cart` | Yes | View cart |
| POST | `/api/cart` | Yes | Add item to cart |
| PUT | `/api/cart/:product_id` | Yes | Update item qty |
| DELETE | `/api/cart/:product_id` | Yes | Remove item |
| DELETE | `/api/cart` | Yes | Clear cart |
| POST | `/api/orders` | Yes | Place order (checkout) |
| GET | `/api/orders` | Yes | Order history |

---

## Project Structure

```
CodeAlpha_ShopAlpha/
├── server.js          # Express server + all API routes
├── public/
│   └── index.html     # Full frontend (HTML/CSS/JS)
├── package.json
├── render.yaml        # Render.com deployment config
├── .gitignore
└── README.md
```

---

*Built by Sizwe Sigubudu for the CodeAlpha Full Stack Development Internship.*
