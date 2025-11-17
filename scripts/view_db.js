const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'data', 'app.db');
const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
  if (err) {
    console.error('Could not open database at', dbPath, '\n', err.message);
    process.exit(1);
  }
});

function allAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

(async () => {
  try {
    const regCountRow = await allAsync('SELECT COUNT(*) AS count FROM registrations');
    const contactCountRow = await allAsync('SELECT COUNT(*) AS count FROM contacts');
    const scoreCountRow = await allAsync('SELECT COUNT(*) AS count FROM scores');
    const mailCountRow = await allAsync('SELECT COUNT(*) AS count FROM mails');

    console.log('Database:', dbPath);
    console.log('Counts:');
    console.log('  registrations:', regCountRow[0] ? regCountRow[0].count : 0);
    console.log('  contacts:     ', contactCountRow[0] ? contactCountRow[0].count : 0);
    console.log('  scores:       ', scoreCountRow[0] ? scoreCountRow[0].count : 0);
    console.log('  mails:        ', mailCountRow[0] ? mailCountRow[0].count : 0);
    console.log('\nRecent registrations (latest 10):');
    const regs = await allAsync('SELECT id, name, email, contact, receivedAt FROM registrations ORDER BY receivedAt DESC LIMIT 10');
    console.table(regs);

    console.log('\nRecent contacts (latest 10):');
    const contacts = await allAsync('SELECT id, name, email, substr(message,1,120) AS message_preview, receivedAt FROM contacts ORDER BY receivedAt DESC LIMIT 10');
    console.table(contacts);

    console.log('\nRecent scores (latest 10):');
    const scores = await allAsync('SELECT id, score, details, receivedAt FROM scores ORDER BY receivedAt DESC LIMIT 10');
    console.table(scores);

    console.log('\nRecent mails (latest 10):');
    // Inspect columns in mails table and adapt the SELECT accordingly
    const mailColsInfo = await allAsync("PRAGMA table_info('mails')");
    const mailCols = mailColsInfo.map(r => r.name);
    const selectCols = ['id', 'recipients', 'subject', 'status'];
    if (mailCols.includes('sentAt')) selectCols.push('sentAt');
    if (mailCols.includes('receivedAt')) selectCols.push('receivedAt');
    if (mailCols.includes('error')) selectCols.push('error');
    const orderBy = mailCols.includes('receivedAt') ? 'receivedAt' : 'id';
    const sqlMails = `SELECT ${selectCols.join(', ')} FROM mails ORDER BY ${orderBy} DESC LIMIT 10`;
    const mails = await allAsync(sqlMails);
    console.table(mails);

  } catch (err) {
    console.error('Query error:', err.message || err);
  } finally {
    db.close();
  }
})();
