# Argya Health — frontend

React + Vite + Tailwind. Deploy on Vercel.

1. In Vercel → Settings → Environment Variables add
   `VITE_API_URL = https://your-backend.onrender.com` (no slash at the end)
2. Build command `npm run build`, output folder `dist`.
3. For a custom domain, change the site address in `index.html`, `public/robots.txt` and `public/sitemap.xml`.
