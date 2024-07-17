const cron = require("node-cron");
const axios = require("axios");

// Define your backend server URL
const backendUrl = "https://zoom-links-slack-message.onrender.com";

// Schedule the task to run every 14 minutes
const scheduleCronJob = () => {
  cron.schedule("*/14 * * * *", () => {
    console.log("Calling backend server...");

    axios
      .get(backendUrl)
      .then((response) => {
        console.log("Backend response:", response.data);
      })
      .catch((error) => {
        console.error("Error calling backend:", error);
      });
  });

  console.log("Cron job scheduled to run every 14 minutes.");
};

module.exports = scheduleCronJob;
