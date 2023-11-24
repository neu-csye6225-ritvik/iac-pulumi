const AWS = require('aws-sdk');
const mailgun = require('mailgun-js')({
    apiKey: "e8500bfb35a6d00230540dada439281e-5d2b1caa-884ab131",
    domain: "demo.ritvikparamkusham.me",
  });
 
 
exports.handler = async (event, context) => {
  try {
    const fetch = await import('node-fetch'); // Dynamic import for node-fetch
 
    console.log(event);
    const snsMessage = JSON.parse(event.Records[0].Sns.Message);
    console.log(snsMessage);
    const fileUrl = snsMessage.submission_url;
    console.log(fileUrl);

    const emailData = {
        from: "noreply@demo.ritvikparamkusham.me",
        to: "ritvik.param@gmail.com",
        subject: 'File Uploaded Notification',
        text: `sns mail ${snsMessage.email} and file url ${fileUrl}`
      };
 
    console.log("Sending Email");
    await sendEmail(mailgun, emailData);
 
    return ;
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
};
 
async function sendEmail(mailgun, data) {
    return new Promise((resolve, reject) => {
      mailgun.messages().send(data, (error, body) => {
        if (error) {
          reject(error);
        } else {
          resolve(body);
        }
      });
    });
}