const express = require("express");
const axios = require("axios");
const qs = require("querystring");
const bodyParser = require("body-parser");

const app = express();
app.use(bodyParser.json());

const clientId = process.env.CLIENT_ID;
const clientSecret = process.env.CLIENT_SECRET;
const redirectUri = "http://localhost:3000/oauth/callback";
const slackChannel = "#general";
const slackToken = process.env.SLACK_TOKEN;

// Function to get Zoom Access Token
async function getZoomAccessToken(code) {
  const url = "https://zoom.us/oauth/token";
  const params = qs.stringify({
    grant_type: "authorization_code",
    code: code,
    redirect_uri: redirectUri,
  });

  const response = await axios.post(url, params, {
    auth: {
      username: clientId,
      password: clientSecret,
    },
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
  });

  return response.data.access_token;
}

// Function to download Zoom chat file
async function downloadZoomChatFile(meetingId, accessToken) {
  const url = `https://api.zoom.us/v2/meetings/${meetingId}/recordings`;
  const headers = {
    Authorization: `Bearer ${accessToken}`,
  };

  const response = await axios.get(url, { headers });
  if (response.status === 200) {
    const recordings = response.data.recording_files;
    let chatFileUrl = null;
    for (const recording of recordings) {
      if (recording.file_extension === "TXT") {
        chatFileUrl = recording.download_url;
        break;
      }
    }

    if (chatFileUrl) {
      const chatResponse = await axios.get(chatFileUrl, { headers });
      return chatResponse.data;
    }
  }
  return null;
}

// Function to send a message to Slack
async function sendMessageToSlack(channel, text, token) {
  const url = "https://slack.com/api/chat.postMessage";
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
  const payload = {
    channel: channel,
    text: text,
  };

  const response = await axios.post(url, payload, { headers });
  return response.data;
}

// Function to extract links from Zoom chat content
function extractLinksFromZoomChat(chatFileContent) {
  const urlPattern = /https?:\/\/\S+/g;
  return chatFileContent.match(urlPattern);
}

// Main function to handle the process
async function main(meetingId, accessToken) {
  const chatFileContent = await downloadZoomChatFile(meetingId, accessToken);

  if (chatFileContent) {
    const links = extractLinksFromZoomChat(chatFileContent);
    if (links && links.length > 0) {
      const messageText =
        "Here are the links shared during the Zoom meeting:\n" +
        links.join("\n");
      const response = await sendMessageToSlack(
        slackChannel,
        messageText,
        slackToken
      );

      if (response.ok) {
        console.log("Message sent successfully!");
      } else {
        console.log(`Failed to send message: ${response.error}`);
      }
    } else {
      console.log("No links found in the chat file.");
    }
  } else {
    console.log("Failed to retrieve the chat file.");
  }
}

// Webhook endpoint to handle Zoom meeting ended event
app.post("/webhook", async (req, res) => {
  const event = req.body.event;
  if (event === "meeting.ended") {
    const meetingId = req.body.payload.object.id;
    const authorizationCode = req.body.payload.object.authorization_code;

    try {
      const accessToken = await getZoomAccessToken(authorizationCode);
      await main(meetingId, accessToken);
    } catch (error) {
      console.error("Error processing Zoom webhook:", error);
    }
  }

  res.status(200).send("OK");
});

// Start the server
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
