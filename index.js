const express = require('express');
const request = require('request')
const app = express();
const path = require('path');
const port = process.env.PORT || "3000";

require('dotenv').config();

var mysql = require('mysql');
var db_config = {
  host: process.env.host,
  user: process.env.db_user,
  password: process.env.password,
  database: process.env.database,
  timezone: process.env.timezone,
  charset : 'utf8mb4'
};

console.log(db_config)

function handleDisconnect() {
  connection = mysql.createConnection(db_config); 

  connection.connect(function(err) {              
    if(err) {                                     
      console.log('error when connecting to db:', err);
      setTimeout(handleDisconnect, 2000); 
    }                                     
  });                                     

  connection.on('error', function(err) {
    console.log('db error', err);
    if(err.code === 'PROTOCOL_CONNECTION_LOST') { 
      handleDisconnect();                         
    } else {                                      
      throw err;                                  
    }
  });

  connection.query('DELETE FROM waiting_room');

  setInterval(function () {
    connection.query('SELECT 1');
  }, 5000);
}

handleDisconnect()

// redirect to HTML homepage
app.get('/', function(req, res, next) {

  res.sendFile(path.join(__dirname + '/public/index.html'));

});

app.get('/getAme', function(req, res, next) {
  var sql = `SELECT * FROM ame;`;
  connection.query(sql, function (err, rows) {
    if (err) throw err; // try catch
    res.send(rows)
  });
});

app.listen(port, () => console.log(`Listening on port ${port}!`));
