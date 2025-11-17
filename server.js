const express = require('express');
const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files (the existing HTML/CSS/JS)
app.use(express.static(path.join(__dirname)));

// Ensure data directory exists
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir);
}

// SQLite DB (file)
const dbPath = path.join(dataDir, 'app.db');
const db = new sqlite3.Database(dbPath);

// Initialize DB tables
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS registrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    address TEXT,
    contact TEXT NOT NULL,
    receivedAt TEXT NOT NULL
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS contacts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    message TEXT NOT NULL,
    receivedAt TEXT NOT NULL
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS scores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    score REAL NOT NULL,
    details TEXT,
    receivedAt TEXT NOT NULL
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS mails (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    recipients TEXT,
    subject TEXT,
    body TEXT,
    status TEXT,
    sentAt TEXT,
    error TEXT
  )`);
});

// ============== VALIDATION FUNCTIONS ==============

/**
 * Validates email format using simplified RFC 5322 pattern
 */
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Trims and validates string field lengths
 */
function validateStringField(value, fieldName, minLength = 1, maxLength = 255) {
  if (typeof value !== 'string') {
    return { valid: false, error: `${fieldName} must be a string.` };
  }
  const trimmed = value.trim();
  if (trimmed.length < minLength) {
    return { valid: false, error: `${fieldName} is required (minimum ${minLength} character).` };
  }
  if (trimmed.length > maxLength) {
    return { valid: false, error: `${fieldName} exceeds maximum length of ${maxLength} characters.` };
  }
  return { valid: true, value: trimmed };
}

/**
 * Sanitizes HTML to prevent XSS attacks
 */
function sanitizeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

/**
 * Validates registration form input
 */
function validateRegistration(data) {
  const errors = [];

  // Validate name
  const nameValidation = validateStringField(data.name, 'Name', 1, 100);
  if (!nameValidation.valid) errors.push(nameValidation.error);

  // Validate email
  if (!data.email || typeof data.email !== 'string') {
    errors.push('Email is required.');
  } else if (!isValidEmail(data.email.trim())) {
    errors.push('Email format is invalid.');
  } else if (data.email.trim().length > 255) {
    errors.push('Email exceeds maximum length of 255 characters.');
  }

  // Validate contact (phone number or similar)
  const contactValidation = validateStringField(data.contact, 'Contact', 1, 20);
  if (!contactValidation.valid) errors.push(contactValidation.error);

  // Validate address (optional)
  if (data.address && typeof data.address === 'string' && data.address.trim().length > 500) {
    errors.push('Address exceeds maximum length of 500 characters.');
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    data: {
      name: nameValidation.value,
      email: data.email.trim(),
      address: data.address ? data.address.trim() : '',
      contact: contactValidation.value
    }
  };
}

/**
 * Validates contact form input
 */
function validateContact(data) {
  const errors = [];

  // Validate name
  const nameValidation = validateStringField(data.name, 'Name', 1, 100);
  if (!nameValidation.valid) errors.push(nameValidation.error);

  // Validate email
  if (!data.email || typeof data.email !== 'string') {
    errors.push('Email is required.');
  } else if (!isValidEmail(data.email.trim())) {
    errors.push('Email format is invalid.');
  } else if (data.email.trim().length > 255) {
    errors.push('Email exceeds maximum length of 255 characters.');
  }

  // Validate message
  const messageValidation = validateStringField(data.message, 'Message', 10, 5000);
  if (!messageValidation.valid) errors.push(messageValidation.error);

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    data: {
      name: nameValidation.value,
      email: data.email.trim(),
      message: messageValidation.value
    }
  };
}

/**
 * Validates assessment score input
 */
function validateScore(data) {
  const errors = [];

  if (typeof data.score === 'undefined' || data.score === null) {
    errors.push('Score is required.');
  } else if (typeof data.score !== 'number') {
    errors.push('Score must be a number.');
  } else if (data.score < 0 || data.score > 4) {
    errors.push('Score must be between 0 and 4.');
  }

  // Validate optional details field
  if (data.details && typeof data.details === 'string' && data.details.trim().length > 1000) {
    errors.push('Details exceed maximum length of 1000 characters.');
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    data: {
      score: data.score,
      details: data.details ? data.details.trim() : null
    }
  };
}

/**
 * Validates mail sending input
 */
function validateMail(data) {
  const errors = [];

  // Validate recipient
  if (!data.to) {
    errors.push('Recipient email is required.');
  } else if (Array.isArray(data.to)) {
    for (let email of data.to) {
      if (!isValidEmail(email.trim())) {
        errors.push(`Invalid email format: ${email}`);
      }
    }
  } else if (typeof data.to === 'string') {
    if (!isValidEmail(data.to.trim())) {
      errors.push('Recipient email format is invalid.');
    }
  } else {
    errors.push('Recipient must be a string or array of strings.');
  }

  // Validate subject
  const subjectValidation = validateStringField(data.subject, 'Subject', 1, 255);
  if (!subjectValidation.valid) errors.push(subjectValidation.error);

  // Validate body
  const bodyValidation = validateStringField(data.body, 'Message body', 1, 10000);
  if (!bodyValidation.valid) errors.push(bodyValidation.error);

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    data: {
      to: Array.isArray(data.to) ? data.to.map(e => e.trim()) : [data.to.trim()],
      subject: subjectValidation.value,
      body: bodyValidation.value
    }
  };
}

function insertRegistration(entry) {
  return new Promise((resolve, reject) => {
    const stmt = `INSERT INTO registrations (name,email,address,contact,receivedAt) VALUES (?,?,?,?,?)`;
    db.run(stmt, [entry.name, entry.email, entry.address || '', entry.contact, entry.receivedAt], function(err) {
      if (err) return reject(err);
      resolve(this.lastID);
    });
  });
}

function insertContact(entry) {
  return new Promise((resolve, reject) => {
    const stmt = `INSERT INTO contacts (name,email,message,receivedAt) VALUES (?,?,?,?)`;
    db.run(stmt, [entry.name, entry.email, entry.message, entry.receivedAt], function(err) {
      if (err) return reject(err);
      resolve(this.lastID);
    });
  });
}

function insertScore(entry) {
  return new Promise((resolve, reject) => {
    const stmt = `INSERT INTO scores (score,details,receivedAt) VALUES (?,?,?)`;
    db.run(stmt, [entry.score, entry.details || null, entry.receivedAt], function(err) {
      if (err) return reject(err);
      resolve(this.lastID);
    });
  });
}

function insertMail(record) {
  return new Promise((resolve, reject) => {
    const stmt = `INSERT INTO mails (recipients,subject,body,status,sentAt,error) VALUES (?,?,?,?,?,?)`;
    db.run(stmt, [record.recipients, record.subject, record.body, record.status, record.sentAt || null, record.error || null], function(err) {
      if (err) return reject(err);
      resolve(this.lastID);
    });
  });
}

// Generic query helper
function queryAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

app.post('/api/register', async (req, res) => {
  const validation = validateRegistration(req.body);
  if (!validation.valid) {
    return res.status(400).json({ success: false, errors: validation.errors });
  }

  const { name, email, address, contact } = validation.data;
  const entry = {
    name: sanitizeHtml(name),
    email,
    address: sanitizeHtml(address),
    contact,
    receivedAt: new Date().toISOString()
  };
  try {
    const id = await insertRegistration(entry);
    res.json({ success: true, id, message: 'Registration successful.' });
  } catch (err) {
    console.error('DB Error saving registration', err);
    res.status(500).json({ success: false, message: 'Could not save registration.' });
  }
});

app.post('/api/contact', async (req, res) => {
  const validation = validateContact(req.body);
  if (!validation.valid) {
    return res.status(400).json({ success: false, errors: validation.errors });
  }

  const { name, email, message } = validation.data;
  const entry = {
    name: sanitizeHtml(name),
    email,
    message: sanitizeHtml(message),
    receivedAt: new Date().toISOString()
  };
  try {
    const id = await insertContact(entry);
    res.json({ success: true, id, message: 'Contact form submitted successfully.' });
  } catch (err) {
    console.error('DB Error saving contact', err);
    res.status(500).json({ success: false, message: 'Could not save contact.' });
  }
});

app.post('/api/score', async (req, res) => {
  const validation = validateScore(req.body);
  if (!validation.valid) {
    return res.status(400).json({ success: false, errors: validation.errors });
  }

  const { score, details } = validation.data;
  const entry = {
    score,
    details,
    receivedAt: new Date().toISOString()
  };
  try {
    const id = await insertScore(entry);
    res.json({ success: true, id, message: 'Score recorded successfully.' });
  } catch (err) {
    console.error('DB Error saving score', err);
    res.status(500).json({ success: false, message: 'Could not save score.' });
  }
});

// Mail sending endpoint: logs mail to DB and attempts to send via SMTP if configured
app.post('/api/send-mail', async (req, res) => {
  const validation = validateMail(req.body);
  if (!validation.valid) {
    return res.status(400).json({ success: false, errors: validation.errors });
  }

  const { to, subject, body } = validation.data;
  const recipients = to.join(',');
  const record = {
    recipients,
    subject: sanitizeHtml(subject),
    body: sanitizeHtml(body),
    status: 'pending',
    sentAt: null,
    error: null
  };

  try {
    const mailId = await insertMail(record);

    // If SMTP config provided, try to send
    const smtpHost = process.env.SMTP_HOST;
    if (smtpHost) {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT) : 587,
        secure: process.env.SMTP_SECURE === 'true',
        auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined
      });

      try {
        await transporter.sendMail({ from: process.env.SMTP_FROM || 'noreply@example.com', to: recipients, subject, text: body });
        const now = new Date().toISOString();
        db.run(`UPDATE mails SET status = ?, sentAt = ? WHERE id = ?`, ['sent', now, mailId]);
        return res.json({ success: true, id: mailId, sent: true, message: 'Email sent successfully.' });
      } catch (sendErr) {
        console.error('Mail send error', sendErr);
        db.run(`UPDATE mails SET status = ?, error = ? WHERE id = ?`, ['failed', String(sendErr.message || sendErr), mailId]);
        return res.status(500).json({ success: false, id: mailId, sent: false, message: 'Mail send failed, logged.' });
      }
    }

    // No SMTP configured — we keep the record as 'mocked'
    db.run(`UPDATE mails SET status = ? WHERE id = ?`, ['mocked', mailId]);
    res.json({ success: true, id: mailId, sent: false, message: 'No SMTP configured; mail recorded.' });
  } catch (err) {
    console.error('DB Error saving mail', err);
    res.status(500).json({ success: false, message: 'Could not record mail.' });
  }
});

// Serve main page at root for convenience
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'Project_home.html'));
});

// ---------------- Admin (Basic HTTP Auth) ----------------
// Simple password-protected admin page to view recent submissions.
function parseBasicAuth(req) {
  const h = req.headers.authorization;
  if (!h || !h.startsWith('Basic ')) return null;
  const parts = Buffer.from(h.split(' ')[1], 'base64').toString().split(':');
  return { user: parts[0] || '', pass: parts.slice(1).join(':') || '' };
}

function requireAdmin(req, res, next) {
  const adminUser = process.env.ADMIN_USER || 'admin';
  const adminPass = process.env.ADMIN_PASS || 'admin123';
  const creds = parseBasicAuth(req);
  if (!creds) {
    res.setHeader('WWW-Authenticate', 'Basic realm="Admin Area"');
    return res.status(401).send('Authentication required');
  }
  if (creds.user === adminUser && creds.pass === adminPass) {
    return next();
  }
  res.setHeader('WWW-Authenticate', 'Basic realm="Admin Area"');
  return res.status(401).send('Invalid credentials');
}

function htmlEscape(s) {
  if (s === null || typeof s === 'undefined') return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;');
}

app.get('/admin', requireAdmin, async (req, res) => {
  try {
    const regs = await queryAll('SELECT id,name,email,contact,receivedAt FROM registrations ORDER BY receivedAt DESC LIMIT 50');
    const contacts = await queryAll("SELECT id,name,email,message,receivedAt FROM contacts ORDER BY receivedAt DESC LIMIT 50");
    const scores = await queryAll('SELECT id,score,details,receivedAt FROM scores ORDER BY receivedAt DESC LIMIT 50');
    const mails = await queryAll('SELECT id,recipients,subject,status,sentAt FROM mails ORDER BY id DESC LIMIT 50');

    let html = `<!doctype html><html><head><meta charset="utf-8"><title>Admin - Submissions</title><style>body{font-family:Arial,Helvetica,sans-serif;padding:20px}table{border-collapse:collapse;width:100%;margin-bottom:24px}th,td{border:1px solid #ddd;padding:8px;text-align:left}th{background:#f4f4f4}</style></head><body>`;
    html += '<h1>Admin - Recent Submissions</h1>';
    html += '<h2>Registrations</h2>';
    html += '<table><tr><th>id</th><th>name</th><th>email</th><th>contact</th><th>receivedAt</th></tr>';
    regs.forEach(r => {
      html += `<tr><td>${htmlEscape(r.id)}</td><td>${htmlEscape(r.name)}</td><td>${htmlEscape(r.email)}</td><td>${htmlEscape(r.contact)}</td><td>${htmlEscape(r.receivedAt)}</td></tr>`;
    });
    html += '</table>';

    html += '<h2>Contacts</h2>';
    html += '<table><tr><th>id</th><th>name</th><th>email</th><th>message</th><th>receivedAt</th></tr>';
    contacts.forEach(c => {
      html += `<tr><td>${htmlEscape(c.id)}</td><td>${htmlEscape(c.name)}</td><td>${htmlEscape(c.email)}</td><td>${htmlEscape(c.message)}</td><td>${htmlEscape(c.receivedAt)}</td></tr>`;
    });
    html += '</table>';

    html += '<h2>Scores</h2>';
    html += '<table><tr><th>id</th><th>score</th><th>details</th><th>receivedAt</th></tr>';
    scores.forEach(s => {
      html += `<tr><td>${htmlEscape(s.id)}</td><td>${htmlEscape(s.score)}</td><td>${htmlEscape(s.details)}</td><td>${htmlEscape(s.receivedAt)}</td></tr>`;
    });
    html += '</table>';

    html += '<h2>Mails</h2>';
    html += '<table><tr><th>id</th><th>recipients</th><th>subject</th><th>status</th><th>sentAt</th></tr>';
    mails.forEach(m => {
      html += `<tr><td>${htmlEscape(m.id)}</td><td>${htmlEscape(m.recipients)}</td><td>${htmlEscape(m.subject)}</td><td>${htmlEscape(m.status)}</td><td>${htmlEscape(m.sentAt)}</td></tr>`;
    });
    html += '</table>';

    html += '</body></html>';
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (err) {
    console.error('Admin page error', err);
    res.status(500).send('Could not load admin page');
  }
});

// Listen on localhost only (127.0.0.1) to restrict access to the local machine
const HOST = '127.0.0.1';
app.listen(PORT, HOST, () => {
  console.log(`Server running on http://${HOST}:${PORT}`);
});
