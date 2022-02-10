const mysql = require("mysql");

var pool = mysql.createPool({
  host: "127.0.0.1",
  port: process.env.DATABASES_PORT,
  user: process.env.DATABASES_USER,
  password: process.env.DATABASES_PASSWORD,
  database: process.env.DATABASES,
  timezone: "08:00",
});

function query(sql) {
  return new Promise((resolve, reject) => {
    pool.getConnection(function (err, connection) {
      if (err) {
        reject();
        throw err;
      }
      connection.query(sql, (error, results) => {
        if (error) {
          reject();
          throw error;
        }
        // console.log(res123ults);
        resolve(results);
        connection.release();
        return;
      });
    });
  });
}

module.exports = query;
