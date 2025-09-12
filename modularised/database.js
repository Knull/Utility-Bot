// database.js
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
    host: 'i would give you my IP but...',
    user: 'he he he ha (clash royale)',
    password: 'wow did you really think i would hard code?',
    database: 'PRBW',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  });;

module.exports = { pool };
