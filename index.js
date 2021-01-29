const express = require('express');
const request = require('request')
const app = express();
const path = require('path');
const port = process.env.PORT || "3000";

require('dotenv').config();

const SuperchatScraper = require('./utils/dataScraper.js');


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


const parseDate = (date) => {
  return date.getFullYear() + '-' + ('0' + (date.getMonth()+1)).slice(-2) + '-' + ('0' + date.getDate()).slice(-2);
}


const getVideoId = (channelId, eventType) => {

  let authOptions = {
    url: `https://youtube.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&eventType=${eventType}&type=video&key=${process.env.youtube_key}`,
    json: true
  };

  let list = []

  // maybe check for stream for closest time
  request.get(authOptions, function(error, response, body) {

    console.log(body)

    if(!body.items) return;

    body.items.forEach(e => {
      list.push(e.id.videoId)
    })

    console.log(list)

    getVideoData(list)
  });
}

const getVideoData = (list) => {
  let authOptions = {
    url: `https://youtube.googleapis.com/youtube/v3/videos?part=snippet%2CliveStreamingDetails&id=${list}&key=${process.env.youtube_key}`,
    json: true
  };

  request.get(authOptions, function(error, response, body) {

    if(!body.items) return;
    
    body.items.forEach( (e) => {

        // just in case it gets rescheduled
        let startTime = new Date(e.liveStreamingDetails.scheduledStartTime) - Date.now();
        console.log('startTime ' + startTime)

        // if event is listed and stream isn't starting in less than an hour, update. Probably rescheduled.
        if(startTime > 1800000) {
            var sql = `UPDATE schedules SET start_time="${e.liveStreamingDetails.scheduledStartTime}" WHERE event_title = "${e.snippet.title}";`;
            connection.query(sql);
        } else {
            new SuperchatScraper(e.id, getNameFromChannelId(e.snippet.channelId), e.snippet.title);
            console.log(e.snippet.title + " start!")
        }
    })
  });
}


const scheduleObservers = () => {
  var sql = `SELECT * FROM schedules where not exists(select * from waiting_room) and start_time > NOW() ORDER BY start_time;`;
  connection.query(sql, function (err, result) {
    if (err) throw err; // try catch

    // only schedule the ones that are happening within ten minutes
    result.forEach( (e) => {
      let timeUntilLive = new Date(e.start_time) - Date.now() - 600000; // start procedures 10 minutes before scheduled time
      console.log('time until ' + e.event_title + ' starts : ' + timeUntilLive)
      console.log(e.start_time)

      let sendToWaitingRoom = `INSERT IGNORE INTO waiting_room (streamer, event_title, start_time, channel_id) VALUES ("${e.streamer}", "${e.event_title}", "${e.start_time}", "${e.channel_id}")`
      connection.query(sendToWaitingRoom);

      setTimeout( () => {
        getVideoId(e.channel_id, 'upcoming');
      }, timeUntilLive);
    });
  });
}


const updateSchedules = async () => {
  let today = new Date();
  let todayString = parseDate(today);
  let nextDay = new Date(new Date().setDate(new Date().getDate() + 1));
  let nextDayString = parseDate(nextDay);

  let authOptions = {
    url: `http://api.teamup.com/ksgvawzp4akez27rf1/events?startDate=${todayString}&endDate=${nextDayString}&tz=UTC`,
    headers: {
        'Teamup-Token': process.env.teamup_token
    },
    json: true
  };


  await request.get(authOptions, function(error, response, body) {
    body.events.forEach(event => {
      event.subcalendar_ids.forEach(id => {
        let streamer = getStreamer(id);
        let channelId = getChannelId(id);

        var sql = `INSERT IGNORE INTO schedules (streamer, event_title, start_time, channel_id) VALUES ("${streamer}", "${event.title}", "${event.start_dt}", "${channelId}")`;
        connection.query(sql, function (err, result) {
          if (err) throw err; // try catch
          console.log(sql);
        });
      })
    })
  });
}

const observeCurrent = () => {
  var sql = `SELECT DISTINCT channel_id FROM schedules where start_time > NOW() - interval 1 day ORDER BY start_time;`;
  connection.query(sql, function (err, result) {
    if (err) throw err; // try catch

    result.forEach( (e) => {
      getVideoId(e.channel_id, 'live');
    });
  });
}



observeCurrent()
updateSchedules();
setTimeout(scheduleObservers, 5000);

//new SuperchatScraper('YRKZnRale5g', 'test', "mori")


process.on('unhandledRejection', (reason, promise) => {
    console.warn('Unhandled promise rejection:', promise, 'reason:', reason.stack || reason);
});



// update every 3 hours to account for changes
setInterval( () => {
    updateSchedules();
}, 10800000);

// run every hour
setInterval( () => {
    scheduleObservers();
}, 3600000)


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

const getNameFromChannelId = (id) => {
    switch(id) {
    case "UCyl1z3jo3XHR1riLFKG5UAg":
      return "ame";

    case "UCL_qhgtOy0dy1Agp8vkySQg":
      return "mori";

    case "UCoSrY_IQQVpmIRZ9Xf-y93g":
      return "gura";

    case "UC1CfXB_kRs3C-zaeTG3oGyg":
      return "haachama";

    case "UCMwGHR0BTZuLsmjY_NT5Pwg":
      return "ina";

    case "UCHsx4Hqa-1ORjQTh9TYDhww":
      return "kiara";
  }
}

/*
const YouTube = require('youtube-live-chat');

const yt = new YouTube('UCK9V2B22uJYu3N7eR_BT9QA', `${process.env.youtube_key}`);

yt.on('ready', () => {
  console.log('ready!')
  yt.listen(1000)
})

yt.on('message', data => {
  console.log(data)
})

yt.on('error', error => {
  console.error(error)
})*/


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
