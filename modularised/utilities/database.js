// database.js
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
    host: '216.225.202.122',
    user: 'user_phpmyadmin',
    password: 'SepHup9ePRap@lch2tRO',
    database: 'PRBW',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  });;

module.exports = { pool };
