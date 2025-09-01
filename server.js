/*
File: server.js
Purpose: Photobooth app storing uploads on Cloudinary (works on Render).
*/

const express = require('express');
const multer = require('multer');
const session = require('express-session');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'ICTESS';

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUD_NAME || 'dqq1yhtgv',
  api_key: process.env.CLOUD_API_KEY || '444688418873568',
  api_secret: process.env.CLOUD_API_SECRET || 'd6EeoIKOLCyPzWlL2f7vgmoR9yM',
});

// Multer + Cloudinary storage
const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'photobooth_uploads',
    allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
  },
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(session({
  secret: 'photobooth-secret-key-please-change',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 3600 * 1000 }
}));

// In-memory image metadata (replace with DB later if needed)
let imageStore = [];

function listImages() {
  return imageStore.sort((a, b) => b.uploadedAt - a.uploadedAt);
}

function pageHTML({ title, body, extraHead = '' }) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${title}</title>
  <style>
    :root{--bg:#ffffff;--card:#fdfdfd;--accent:#800000;--accent2:#d4af37;--muted:#6b7280}
    body{font-family:Inter,Segoe UI,Roboto,Arial;background:var(--bg);color:#333;margin:0;padding:24px}
    .container{max-width:1200px;margin:0 auto}
    header{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:24px;border-bottom:3px solid var(--accent);padding-bottom:10px}
    h1{margin:0;font-size:28px;color:var(--accent)}
    .card{background:var(--card);padding:16px;border-radius:14px;box-shadow:0 6px 20px rgba(0,0,0,0.1);transition:transform 0.2s ease-in-out}
    .card:hover{transform:scale(1.02)}
    .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:16px}
    .thumb{border-radius:12px;overflow:hidden;background:#fff;display:flex;flex-direction:column;border:2px solid var(--accent2)}
    .thumb img{width:100%;height:200px;object-fit:cover;display:block}
    .meta{padding:12px;display:flex;justify-content:center;align-items:center;background:var(--accent);}
    .btn{background:var(--accent2);color:#fff;padding:8px 12px;border-radius:8px;text-decoration:none;font-weight:600;transition:background 0.2s}
    .btn:hover{background:#b8860b}
    .muted{color:var(--muted);font-size:13px}
    form{display:flex;flex-direction:column;gap:12px}
    input[type=file], input[type=password]{padding:8px;border:1px solid var(--accent2);border-radius:6px}
    button.btn{border:none;cursor:pointer}
    .notice{font-size:14px;color:var(--muted)}
    .toplinks a{color:var(--accent);text-decoration:none;margin-left:12px;font-weight:600}
    .login{max-width:380px;margin:auto}
    @media (max-width:520px){.thumb img{height:150px}}
  </style>
  ${extraHead}
</head>
<body>
  <div class="container">
    <header>
      <h1>BEC Photobooth Gallery</h1>
      <nav class="toplinks">
        <a href="/">Gallery</a>
        <a href="/admin">Admin</a>
      </nav>
    </header>
    ${body}
  </div>
</body>
</html>`;
}

app.get('/', (req, res) => {
  const images = listImages();
  const body = `
  <div class="card">
    <p class="notice">Public gallery — all uploaded photobooth pictures are visible here. Click any image to open in full size, or use the download button.</p>
    <div style="height:12px"></div>
    <div class="grid">
      ${images.map(img => `
        <div class="thumb card">
          <a href="${img.url}" target="_blank"><img src="${img.url}" alt="${img.filename}"></a>
          <div class="meta">
            <a class="btn" href="${img.url}" download>Download</a>
          </div>
        </div>
      `).join('\n')}
    </div>
  </div>
  `;
  res.send(pageHTML({ title: 'BEC Photobooth Gallery', body }));
});

app.get('/admin', (req, res) => {
  if (!req.session.isAdmin) {
    const body = `
      <div class="card login">
        <h2>Admin login</h2>
        <form method="POST" action="/admin/login">
          <input name="password" type="password" placeholder="Admin password" required />
          <button class="btn" type="submit">Sign in</button>
        </form>
      </div>
    `;
    return res.send(pageHTML({ title: 'Admin login', body }));
  }

  const images = listImages();
  const body = `
    <div class="card">
      <h2>Upload photobooth pictures</h2>
      <p class="notice">Choose one or more image files (jpg, png, gif, webp). Max 10MB each.</p>
      <form method="POST" action="/admin/upload" enctype="multipart/form-data">
        <input type="file" name="photos" accept="image/*" multiple required />
        <button class="btn" type="submit">Upload</button>
      </form>
      <div style="height:14px"></div>
      <a href="/admin/logout" class="muted">Sign out</a>
    </div>

    <div style="height:20px"></div>
    <div class="card">
      <h3>Recently uploaded</h3>
      <div class="grid">
        ${images.map(img => `
          <div class="thumb card">
            <a href="${img.url}" target="_blank"><img src="${img.url}" alt="${img.filename}"></a>
            <div class="meta">
              <a class="btn" href="${img.url}" download>Download</a>
            </div>
          </div>
        `).join('\n')}
      </div>
    </div>
  `;
  res.send(pageHTML({ title: 'Admin', body }));
});

app.post('/admin/login', (req, res) => {
  const { password } = req.body;
  if (password === ADMIN_PASSWORD) {
    req.session.isAdmin = true;
    return res.redirect('/admin');
  }
  res.send(pageHTML({ title: 'Login failed', body: `<div class="card"><p>Wrong password. <a href="/admin">Try again</a></p></div>` }));
});

app.get('/admin/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

app.post('/admin/upload', (req, res, next) => {
  if (!req.session.isAdmin) return res.status(403).send('Forbidden');
  next();
}, upload.array('photos', 20), (req, res) => {
  if (req.files) {
    req.files.forEach(file => {
      imageStore.push({
        filename: file.originalname,
        url: file.path,
        uploadedAt: new Date(),
      });
    });
  }
  res.redirect('/admin');
});

app.use((err, req, res, next) => {
  console.error(err && err.stack ? err.stack : err);
  const body = `<div class="card"><h3>Error</h3><p class="muted">${String(err.message || err)}</p><p><a href="/">Back to gallery</a></p></div>`;
  res.status(400).send(pageHTML({ title: 'Error', body }));
});

app.listen(PORT, () => console.log(`Photobooth app running on port ${PORT} (Cloudinary storage)`));
