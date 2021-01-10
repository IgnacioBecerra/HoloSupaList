const path = require('path');
require('dotenv').config();

const webdriver = require('selenium-webdriver');
const {until, By} = require('selenium-webdriver')
const chrome = require('selenium-webdriver/chrome');
const chromedriver = require('chromedriver');

let options = new chrome.Options();
//Below arguments are critical for Heroku deployment
options.addArguments("--window-size=1920,1080")
options.addArguments("--disable-extensions")
options.addArguments("--proxy-server='direct://'")
options.addArguments("--proxy-bypass-list=*")
options.addArguments("--start-maximized")


options.addArguments('--headless')

options.addArguments([`user-agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.88 Safari/537.36"`]);

options.addArguments('--disable-gpu')
options.addArguments('--disable-dev-shm-usage')
options.addArguments('--no-sandbox')
options.addArguments('--ignore-certificate-errors')

let chromeCapabilities = webdriver.Capabilities.chrome();
chromeCapabilities.set("acceptInsecureCerts", true);
chromeCapabilities.set("acceptSslCerts", true);

const {sanitizeObject, sanitizeString } = require('./sanitizers.js');

chrome.setDefaultService(new chrome.ServiceBuilder(chromedriver.path).build());

var mysql = require('mysql');
var db_config = {
  host: process.env.host,
  user: process.env.db_user,
  password: process.env.password,
  database: process.env.database,
  timezone: process.env.timezone,
  charset : 'utf8mb4'
};

class SuperchatScraper {

  constructor(videoId, channelName, videoTitle) {
    this.driver = new webdriver.Builder()
               .withCapabilities(webdriver.Capabilities.chrome())
               .setChromeOptions(options)
               .build();
    this.videoId = videoId;
    this.channelName = channelName;
    this.videoTitle = videoTitle;
    this.waitForChat(this.driver)
  }

  async waitForChat() {
    this.driver.get(`https://www.youtube.com/live_chat?v=${this.videoId}`);

    await new Promise((resolve) => {
      let x = setInterval( () => {

        this.driver.executeScript(`return document.querySelector('#items.yt-live-chat-item-list-renderer')`).then(e => {
          if(e) {
            clearInterval(x)
            resolve();
          } else {
            this.driver.navigate().refresh();
          }
        })
      }, 10000)
    });
    this.setupObserver();
  }
  
  setupObserver() {

    let obs = `
      let chatWindow = document.querySelector('#items.yt-live-chat-item-list-renderer');
      window.localStorage.setItem('stopped', 'false');
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
    let interval = setInterval( checkMessages, 60000);


    function checkMessages() {
      chatStopped = true;

      // Wait to see if observer still has messages appearing
      setTimeout( () => {
        if(chatStopped) {
          obs.disconnect();
          clearInterval(interval);
          console.log('disconnect');
          window.localStorage.setItem('stopped', true);
        }
      }, 10000)}
    `

    this.driver.executeScript(obs);
    this.insertData()
  }

  insertData() {

    let dataInsertion = setInterval( async () => {
      await this.driver.executeScript(`return window.localStorage.getItem('chat')`).then( async (list) => {
        let supas = JSON.parse(list);

        if(!supas) return;

        if(supas) {
          supas.forEach((s) => {
            sanitizeObject(s);

            let channelName = this.channelName;

            var sql = `INSERT INTO ${channelName} (author, amount, message, timestamp, color, video) VALUES ("${s.author}", "${s.amount}", "${s.message}", "${s.timestamp}", "${s.color}", "${sanitizeString(this.videoTitle)}")`;
            connection.query(sql, function (err, result) {
              if (err) throw err; // try catch
              console.log(s, channelName);
            });
          })
          await this.driver.executeScript(`window.localStorage.removeItem('chat')`);
        }
        return;
      })

      await this.driver.executeScript(`return window.localStorage.getItem('stopped')`).then( chatStopped => {
        if(chatStopped === 'true') {
          console.log(this.videoTitle + " CHAT STOPPED")
          clearInterval(dataInsertion);
          this.driver.quit()
          return;
        }
      });
    }, 20000)
  }
}

module.exports = SuperchatScraper