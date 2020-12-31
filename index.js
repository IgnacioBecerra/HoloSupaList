const express = require('express');
const app = express();
const path = require('path');
const port = 3000;

require('dotenv').config();

const webdriver = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const chromedriver = require('chromedriver');

chrome.setDefaultService(new chrome.ServiceBuilder(chromedriver.path).build());

var driver = new webdriver.Builder()
                 .withCapabilities(webdriver.Capabilities.chrome())
                 .build();

var mysql = require('mysql');
var db_config = {
  host: process.env.host,
  user: process.env.db_user,
  password: process.env.password,
  database: process.env.database,
  timezone: process.env.timezone
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
}

handleDisconnect()



  driver.get('https://www.youtube.com/live_chat?v=LVmhc1vsDEs');
  //let x = driver.findElement(webdriver.By.id('items.yt-live-chat-item-list-renderer'))


  let obs = `
    let chatWindow  = document.querySelector('#items.yt-live-chat-item-list-renderer');

    let obs = new MutationObserver(mutations => {
      mutations.forEach(mutation => {
        const nodes = Array.from(mutation.addedNodes)
        nodes.forEach(node => {
          if (node instanceof HTMLElement && node.tagName == 'YT-LIVE-CHAT-PAID-MESSAGE-RENDERER') {

            let old = window.localStorage.getItem('chat');

            let superChat = {
              author: node.querySelector('#author-name').innerText,
              amount: node.querySelector('#purchase-amount-column').innerText,
              message: node.querySelector('#message').innerText,
              timestamp: node.querySelector('#timestamp').innerText
            }

            if(old) {

              let list = JSON.parse(old)
              list.push(superChat)

              window.localStorage.setItem('chat', JSON.stringify(list))
              console.log(node.querySelector('#content > #message').innerText)

            } else {
              window.localStorage.setItem('chat', JSON.stringify([superChat]));
              console.log(node.querySelector('#content > #message').innerText)
            }
          }
        })
      })
    })
  obs.observe(chatWindow, { childList: true })
  `

  driver.executeScript(obs);


  setInterval( () => {
    driver.executeScript(`return window.localStorage.getItem('chat')`).then( list => {
      let supas = JSON.parse(list);

      if(!supas) return;

      supas.forEach((s) => {
          var sql = `INSERT INTO Gura (author, amount, message, timestamp) VALUES ("${s.author}", "${s.amount}", "${s.message}", "${s.timestamp}")`;
          connection.query(sql, function (err, result) {
            if (err) throw err;
            console.log("1 record inserted");
          });
      })

      driver.executeScript(`window.localStorage.removeItem('chat')`);
    })

  }, 20000)


  /** 

  TODO LIST:

  1. Store User + timestamp
  2. set up the EN's tables
  3. make it run forever on heroku
  */



// redirect to HTML homepage
app.get('/', function(req, res, next) {

/*
  let query = "SELECT refresh_token FROM tokens WHERE refresh_token='" + req.cookies['refresh_token'] +"';";
  connection.query(query, function(err, result, fields) {
    if(result.length > 0) {
      return res.redirect('/hub');
    }

  });/*/

  
  res.sendFile(path.join(__dirname + '/public/index.html'));



});

app.listen(port, () => console.log(`url-shortener listening on port ${port}!`));