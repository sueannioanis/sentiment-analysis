'use strict';
const express = require('express');
const bodyParser = require('body-parser');
const request = require('request');
const app = express();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const server = app.listen(4000, () => {
  console.log('Express server listening on port %d in %s mode', server.address().port, app.settings.env);});

const watson = require('watson-developer-cloud');
let tone_analyzer = watson.tone_analyzer({
  url: 'https://gateway.watsonplatform.net/tone-analyzer/api',
  username: "USER_NAME_GOES_HERE",
  password: "PASSWORD_GOES_HERE",
  version: 'v3',
  version_date: '2016-05-19'
});

let latestTimestamp = + new Date()/1000;

app.post('/event', (req, res) => {
  switch(req.body.type) {
    case 'url_verification':
      res.send(req.body.challenge);
      break;
    case 'event_callback':
      if (req.body.event.ts > latestTimestamp && !req.body.event.bot_id) {
        const text = req.body.event.text;
        if (text && text.includes('<@BOT_ID_GOES_HERE>') && !req.body.event.text.replace('<@BOT_ID_GOES_HERE>','')) {
          postMessage(req.body.event.channel, 'Hi! My name is Watson. Tag me if you\'d like to analyze your text.')
        } else if (text && text.includes('<@BOT_ID_GOES_HERE>')) {
          analyzeTone(req.body.event.channel, req.body.event.text.replace('<@BOT_ID_GOES_HERE>',''))
        }
        latestTimestamp = req.body.event.ts;
      }
      break;
  }
});

const emotions = {
  anger : '😠',
  disgust : '🤢',
  fear : '😱',
  joy : '😄',
  sadness : '😞'
}

const confidencethreshold = 0.55;

function analyzeTone(channel, text) {
  tone_analyzer.tone({text}, (err, tone) => {
    let emotes = '';
    let emotionString = 'Tone Analysis:\n';
    tone.document_tone.tone_categories.forEach((tonecategory) => {
      if(tonecategory.category_id === 'emotion_tone') {
        tonecategory.tones.forEach((emotion) => {
          if(emotion.score >= confidencethreshold && emotes.indexOf(emotions[emotion.tone_id])) {
            emotes += emotions[emotion.tone_id]
          }
          emotionString += emotion.tone_name + ': ' + emotion.score*100 + '%\n'
        })
      } else {
        tonecategory.tones.forEach((emotion) => {
          emotionString += emotion.tone_name + ': ' + emotion.score*100 + '%\n'
        })
      }
    })
    console.log(emotionString)
    console.log(emotes)
    postMessage(channel, 'Emoting ... ' + (emotes || '😐') + '\n\n' + emotionString)
  });
}

function getMessages(channel) {
  const token = 'SLACK_OAUTH_TOKEN_GOES_HERE'
  let options = {
    method: 'GET',
    url: 'https://slack.com/api/channels.history?token=+'+token+'&channel='+channel
  };
  request(options, (error, response, body) => {
    if (response.statusCode == 200) {
      const textToAnalyze = JSON.parse(body).messages.filter(res => res.username !== 'ToneAnalyzer').map(res => res.text).toString();
      analyzeTone(channel, textToAnalyze);
    }
  });
}

function postMessage(channel, message) {
  let options = {
    method: 'POST',
    url: 'https://slack.com/api/chat.postMessage',
    form: {
      token: 'SLACK_OAUTH_TOKEN_GOES_HERE', // Your Slack OAuth token
      channel,
      text: message
    }
  };
  request(options, (error, response, body) => {
    console.log(response.body)
  })
}
