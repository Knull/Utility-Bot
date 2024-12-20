const mysql = require('mysql2/promise');
const config = require('../config/config');

const pool = mysql.createPool({
    host: '216.225.202.122', // Or use config variables
    user: 'user_phpmyadmin',
    password: 'SepHup9ePRap@lch2tRO',
    database: 'PRBW',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

module.exports = { pool };
