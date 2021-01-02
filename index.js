const express = require('express');
const request = require('request')
const app = express();
const path = require('path');
const port = process.env.PORT || "3000";

require('dotenv').config();

const {observerSetup, insertData} = require('./utils/dataScraper.js');


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

  setInterval(function () {
    connection.query('SELECT 1');
  }, 5000);
}

handleDisconnect()

// get time from Teamup and then schedule run


// let closestTime = 0;
// setInterval( closestTime = fetch closest live time , 3600000)
// if(currentTime is 10m before live )
// fetch live ID
//    if cant fetch 3 times, query teamup for event today and update database


const getVideoId = (channelId) => {

  let authOptions = {
    url: `https://youtube.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&eventType=upcoming&type=video&key=${process.env.youtube_key}`,
    json: true
  };

  let list = []

  // maybe check for stream for closest time
  request.get(authOptions, function(error, response, body) {
    body.items.forEach(e => {
      list.push(e.id.videoId)
    })

    getVideoData(list)
  });
  // observerSetup(videoId)
}

const getVideoData = (list) => {
  let authOptions = {
    url: `https://youtube.googleapis.com/youtube/v3/videos?part=snippet%2CliveStreamingDetails&id=${list}&key=${process.env.youtube_key}`,
    json: true
  };

  // maybe check for stream for closest time
  request.get(authOptions, function(error, response, body) {

    console.log(body)
    
    body.items.forEach( (e) => {
        console.log(e)

        let startTime = new Date(e.liveStreamingDetails.scheduledStartTime).getTime();
        if(startTime - Date.now() < 600000) {
            observerSetup(e.id, e.snippet.title);
            //insertData(e.snippet.channelTitle, e.snippet.title)
            insertData('Kanata', e.snippet.title)
        }
    })
  });
}







//observerSetup('pvpDeZeR9vs', '頂いたスパチャを読みながら雑談！Talk while reading Super Chat!10Q')
//insertData('Kiara', '頂いたスパチャを読みながら雑談！Talk while reading Super Chat!10Q');


const scheduleObservers = () => {
  var sql = `SELECT * FROM schedules where start_time > NOW() ORDER BY start_time;`;
  connection.query(sql, function (err, result) {
    if (err) throw err; // try catch
    result.forEach( (e) => {

        let timeUntilLive = new Date(e.start_time).getTime() - Date.now() - 300000;
        console.log(timeUntilLive)

        setTimeout( () => {
            getVideoId(e.channelId);
        }, timeUntilLive)
    });
  });
}


//scheduleObservers();

getVideoId('UCZlDXzGoo7d44bwdNObFacg')



const getSchedules = () => {
  let authOptions = {
    url: `http://api.teamup.com/ksgvawzp4akez27rf1/events?startDate=2020-12-27&endDate=2021-01-03`,
    headers: {
        'Teamup-Token': process.env.teamup_token
    },
    json: true
  };


  request.get(authOptions, function(error, response, body) {
    body.events.forEach(event => {

      let streamer = getStreamer(event.subcalendar_id);
      let channelId = getChannelId(event.subcalendar_id);

      var sql = `INSERT IGNORE INTO Schedules (streamer, event_title, start_time, channel_id) VALUES ("${streamer}", "${event.title}", "${event.start_dt}", "${channelId}")`;
      connection.query(sql, function (err, result) {
        if (err) throw err; // try catch
        console.log(sql);
      });
    })
  });
}

const getStreamer = (id) => {
  switch(id) {
    case 8787603:
      return "Amelia Watson";

    case 8787602:
      return "Calliope Mori";

    case 8787597:
      return "Gawr Gura";

    case 8968019:
      return "Haachama";

    case 8787611:
      return "Ninomae Ina'nis";

    case 8787598:
      return "Takanashi Kiara";
  }
}

const getChannelId = (id) => {
  switch(id) {
    case 8787603:
      return "UCyl1z3jo3XHR1riLFKG5UAg";

    case 8787602:
      return "UCL_qhgtOy0dy1Agp8vkySQg";

    case 8787597:
      return "UCoSrY_IQQVpmIRZ9Xf-y93g";

    case 8968019:
      return "UC1CfXB_kRs3C-zaeTG3oGyg";

    case 8787611:
      return "UCMwGHR0BTZuLsmjY_NT5Pwg";

    case 8787598:
      return "UCHsx4Hqa-1ORjQTh9TYDhww";
  }
}




//scheduleObservers();







// redirect to HTML homepage
app.get('/', function(req, res, next) {

  res.sendFile(path.join(__dirname + '/public/index.html'));



});

app.listen(port, () => console.log(`Listening on port ${port}!`));
