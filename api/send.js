// /api/send.js
// Vercel serverless function — receives contact/sample form data as JSON
// and emails it to you via Gmail SMTP using Nodemailer.
//
// Required environment variables (set these in the Vercel dashboard,
// never commit them to the repo):
//   GMAIL_USER          the Gmail address that will SEND the email
//   GMAIL_APP_PASSWORD   a 16-character Gmail "App Password" (not your login password)
//   TO_EMAIL             the address that should RECEIVE submissions (alexforamazon79@gmail.com)

const nodemailer = require('nodemailer');

// Simple in-memory rate limiter (per serverless instance — good enough
// to blunt basic abuse; resets whenever Vercel spins up a new instance).
const recentHits = new Map();
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX = 5;

function isRateLimited(ip) {
  const now = Date.now();
  const hits = (recentHits.get(ip) || []).filter(t => now - t < RATE_LIMIT_WINDOW_MS);
  hits.push(now);
  recentHits.set(ip, hits);
  return hits.length > RATE_LIMIT_MAX;
}

function escapeHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildContactEmail(fields) {
  const { name, phone, interest, message } = fields;
  const subject = `Website contact — ${name || 'Unknown'}`;
  const text =
    `CONTACT REQUEST\n` +
    `===============\n\n` +
    `Name: ${name || ''}\n` +
    `Phone: ${phone || ''}\n` +
    `Interested in: ${interest || ''}\n\n` +
    `Message:\n${message || ''}\n`;
  const html = `
    <h2>New contact request</h2>
    <p><strong>Name:</strong> ${escapeHtml(name)}</p>
    <p><strong>Phone:</strong> ${escapeHtml(phone)}</p>
    <p><strong>Interested in:</strong> ${escapeHtml(interest)}</p>
    <p><strong>Message:</strong><br>${escapeHtml(message).replace(/\n/g, '<br>')}</p>
  `;
  return { subject, text, html };
}

function buildSampleEmail(fields) {
  const { name, email, phone, projectType, notes, address, city, postalCode, sampleCodes } = fields;
  const subject = `Sample request — ${name || 'Unknown'}`;
  const text =
    `SAMPLE REQUEST\n` +
    `==============\n\n` +
    `Name: ${name || ''}\n` +
    `Email: ${email || ''}\n` +
    `Phone: ${phone || ''}\n` +
    `Project Type: ${projectType || ''}\n\n` +
    `Requested Samples: ${sampleCodes || ''}\n\n` +
    `Project Notes: ${notes || ''}\n\n` +
    `Delivery Address:\n${address || ''}\n${city || ''}${postalCode ? ', ' + postalCode : ''}\n`;
  const html = `
    <h2>New sample request</h2>
    <p><strong>Name:</strong> ${escapeHtml(name)}</p>
    <p><strong>Email:</strong> ${escapeHtml(email)}</p>
    <p><strong>Phone:</strong> ${escapeHtml(phone)}</p>
    <p><strong>Project type:</strong> ${escapeHtml(projectType)}</p>
    <p><strong>Requested samples:</strong> ${escapeHtml(sampleCodes)}</p>
    <p><strong>Notes:</strong><br>${escapeHtml(notes).replace(/\n/g, '<br>')}</p>
    <p><strong>Delivery address:</strong><br>${escapeHtml(address)}<br>${escapeHtml(city)}${postalCode ? ', ' + escapeHtml(postalCode) : ''}</p>
  `;
  return { subject, text, html };
}

module.exports = async function handler(req, res) {
  // CORS — allow the site to call this endpoint. Tighten to your real
  // domain once it's live, e.g. res.setHeader('Access-Control-Allow-Origin', 'https://stoneplast.ir')
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const ip = (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();
  if (isRateLimited(ip)) {
    return res.status(429).json({ ok: false, error: 'Too many requests. Please try again in a minute.' });
  }

  const { type, fields } = req.body || {};

  if (!type || !fields || typeof fields !== 'object') {
    return res.status(400).json({ ok: false, error: 'Missing form type or fields.' });
  }

  // Basic honeypot check — the frontend includes a hidden field named
  // "company" that real visitors never fill in. If it's populated, it's
  // almost certainly a bot; pretend success without sending an email.
  if (fields.company) {
    return res.status(200).json({ ok: true });
  }

  let emailContent;
  if (type === 'contact') {
    if (!fields.name || !fields.phone || !fields.message) {
      return res.status(400).json({ ok: false, error: 'Missing required fields.' });
    }
    emailContent = buildContactEmail(fields);
  } else if (type === 'sample') {
    if (!fields.name || !fields.email || !fields.phone || !fields.address || !fields.city) {
      return res.status(400).json({ ok: false, error: 'Missing required fields.' });
    }
    emailContent = buildSampleEmail(fields);
  } else {
    return res.status(400).json({ ok: false, error: 'Unknown form type.' });
  }

  const { GMAIL_USER, GMAIL_APP_PASSWORD, TO_EMAIL } = process.env;
  if (!GMAIL_USER || !GMAIL_APP_PASSWORD || !TO_EMAIL) {
    console.error('Missing GMAIL_USER / GMAIL_APP_PASSWORD / TO_EMAIL environment variables.');
    return res.status(500).json({ ok: false, error: 'Server email configuration is incomplete.' });
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: GMAIL_USER,
      pass: GMAIL_APP_PASSWORD,
    },
  });

  try {
    await transporter.sendMail({
      from: `"Stone Plast Website" <${GMAIL_USER}>`,
      to: TO_EMAIL,
      replyTo: fields.email || undefined,
      subject: emailContent.subject,
      text: emailContent.text,
      html: emailContent.html,
    });
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Email send failed:', err);
    return res.status(500).json({ ok: false, error: 'Failed to send email. Please try again or call us directly.' });
  }
};
