const path = require('path');
require('dotenv').config();

const webdriver = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const chromedriver = require('chromedriver');

let options = new chrome.Options();
//Below arguments are critical for Heroku deployment
options.addArguments("--window-size=1920,1080")
options.addArguments("--disable-extensions")
options.addArguments("--proxy-server='direct://'")
options.addArguments("--proxy-bypass-list=*")
options.addArguments("--start-maximized")
//options.addArguments('--headless')
options.addArguments('--disable-gpu')
options.addArguments('--disable-dev-shm-usage')
options.addArguments('--no-sandbox')
options.addArguments('--ignore-certificate-errors')


const {sanitizeObject, sanitizeString } = require('./sanitizers.js');

chrome.setDefaultService(new chrome.ServiceBuilder(chromedriver.path).build());

var driver;

var mysql = require('mysql');
var db_config = {
  host: process.env.host,
  user: process.env.db_user,
  password: process.env.password,
  database: process.env.database,
  timezone: process.env.timezone,
  charset : 'utf8mb4'
};

const observerSetup = (videoId, videoTitle) => {

   driver = new webdriver.Builder()
             .withCapabilities(webdriver.Capabilities.chrome())
             .setChromeOptions(options)
             .build();

  driver.get(`https://www.youtube.com/live_chat?v=${videoId}`);

  // check if chat exists, if not keep refreshing every 30 seconds

  let obs = `
    let chatWindow = document.querySelector('#items.yt-live-chat-item-list-renderer');
    let chatStopped = false;

    let obs = new MutationObserver(mutations => {
      mutations.forEach(mutation => {

        // this running means messages are still appearing
        chatStopped = false;

        const nodes = Array.from(mutation.addedNodes)
        nodes.forEach(node => {
          if (node instanceof HTMLElement && node.tagName == 'YT-LIVE-CHAT-PAID-MESSAGE-RENDERER') {

            let currentList = window.localStorage.getItem('chat');

            let superChat = {
              author: node.querySelector('#author-name').innerText,
              amount: node.querySelector('#purchase-amount-column').innerText,
              message: node.querySelector('#message').innerText,
              timestamp: node.querySelector('#timestamp').innerText,
              color: node.style.cssText.split(/[:;]/)[1],
            }

            console.log(superChat)

            if(currentList) {

              let list = JSON.parse(currentList);
              list.push(superChat);

              window.localStorage.setItem('chat', JSON.stringify(list));
              console.log(node.querySelector('#content > #message').innerText);

            } else {
              window.localStorage.setItem('chat', JSON.stringify([superChat]));
              console.log(node.querySelector('#content > #message').innerText);
            }
          }
        })
      })
    })
  obs.observe(chatWindow, { childList: true });

  // Check every minute if chat has stopped. If so, disconnect.
  setInterval( () => {
    chatStopped = true;

    // Wait to see if observer still has messages appearing
    setTimeout( () => {
      if(chatStopped) {
        obs.disconnect();
        console.log('disconnect');
        window.localStorage.setItem('stopped', true);
      }
    }, 10000)
  }, 60000);
  `

  driver.executeScript(obs);
}


const insertData = (channel, videoTitle) => {

  setInterval( () => {
    driver.executeScript(`return window.localStorage.getItem('chat')`).then( list => {
      let supas = JSON.parse(list);

      if(!supas) return;

      supas.forEach((s) => {
        
        videoTitle = sanitizeString(videoTitle);
        sanitizeObject(s);

        var sql = `INSERT INTO ${channel} (author, amount, message, timestamp, color, video) VALUES ("${s.author}", "${s.amount}", "${s.message}", "${s.timestamp}", "${s.color}", "${videoTitle}")`;
        connection.query(sql, function (err, result) {
          if (err) throw err; // try catch
          console.log(s);
        });
      })

      driver.executeScript(`window.localStorage.removeItem('chat')`);
    })

    driver.executeScript(`return window.localStorage.getItem('stopped')`).then( chatStopped => {
      if(chatStopped) {
        driver.quit();
      }
    })

  }, 20000)
}

module.exports = {
  observerSetup,
  insertData
}