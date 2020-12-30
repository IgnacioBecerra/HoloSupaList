const express = require("express");
const path = require("path");
var cors = require('cors');
var cookies = require('cookie-parser');
var bodyParser = require('body-parser');
const url = require('url');
var request = require('request'); 
var querystring = require('querystring');
require('dotenv').config();

const app = express();
const port = process.env.PORT || "3000";
app.use(cookies());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

var mysql = require('mysql');
var db_config = {
  host:'us-cdbr-east-02.cleardb.com',
  user:'b55688767fab7d',
  password: '90e2d647',
  database: 'heroku_94bafae312cc599',
  timezone: 'UTC'
};

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
}

handleDisconnect();

var code = '';

// redirect to HTML homepage
app.get('/', function(req, res, next) {

  let query = "SELECT refresh_token FROM tokens WHERE refresh_token='" + req.cookies['refresh_token'] +"';";
  connection.query(query, function(err, result, fields) {
    if(result.length > 0) {
      return res.redirect('/hub');
    }

    res.sendFile(path.join(__dirname + '/public/index.html'));
  });
  
});
