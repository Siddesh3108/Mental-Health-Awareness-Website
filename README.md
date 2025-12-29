# Mental Health Awareness Website

A comprehensive mental health awareness platform with a responsive frontend and secure backend API for managing user registrations, contact inquiries, and mental health assessments.

## 🎯 Quick Start

```powershell
cd "c:\Users\username\Downloads\Mental-Health-Awareness-Website-main\Mental-Health-Awareness-Website-main"
npm install
npm start
# Open browser: http://127.0.0.1:3000
```

## 🔐 Admin interface

An admin page is available at `/admin`. It is protected with HTTP Basic Authentication.

- Default credentials (for local testing):
	- user: `admin`
	- pass: `admin123`

Set secure credentials in your environment before running the server:

```powershell
$env:ADMIN_USER='youradmin'
$env:ADMIN_PASS='strongpassword'
npm start
```

This is locally hosted platform.

If credentials are not provided by the browser, the page will prompt for them.

The admin page shows recent entries from `registrations`, `contacts`, `scores`, and `mails`.

