const AWS = require('aws-sdk');
const { Storage } = require('@google-cloud/storage');
const fs = require('fs');
const mailgun = require('mailgun-js')({
    apiKey: "e8500bfb35a6d00230540dada439281e-5d2b1caa-884ab131",
    domain: "demo.ritvikparamkusham.me",
  });
 
const dynamoDB = new AWS.DynamoDB.DocumentClient();
 
exports.handler = async (event, context) => {
  try {
    const fetch = await require('node-fetch'); // Dynamic import for node-fetch
 
    console.log(event);
    const snsMessage = JSON.parse(event.Records[0].Sns.Message);
    console.log(snsMessage);
    const fileUrl = snsMessage.submission_url;
    const recipient  = snsMessage.email;
    console.log(fileUrl);


      // Download the file using node-fetch
      const response = await fetch(fileUrl);
      const fileBuffer = await response.buffer(); // Get the file content as a buffer

      // get the private key stored in env variables when google service account is created 
      const decodedPrivateKey = Buffer.from(process.env.GCP_SERVICE_ACCOUNT_KEY, 'base64').toString('utf-8');
  
      const keyFileJson = JSON.parse(decodedPrivateKey);
      
      const storage = new Storage({
          projectId: 'prime-cosmos-405923',
          credentials: keyFileJson, // Pass the parsed JSON content as credentials
      });
  
      // const bucketName = 'my-bucket-check-751d6cb'; // Replace with your GCS bucket name
      const fileName = 'submision.zip'; // Replace with the desired file name in GCS
  
      // Upload the file to GCS bucket
      const bucket = storage.bucket(process.env.GOOGLE_STORAGE_BUCKET_NAME);
      const file = bucket.file(fileName);
      await file.save(fileBuffer);
  
      console.log('File uploaded to GCS successfully.');
  
      
    const emailData = {
        from: "noreply@demo.ritvikparamkusham.me",
        to: "ritvik.param@gmail.com",
        subject: 'File Uploaded Notification',
        text: `sns mail ${snsMessage.email} and file url ${fileUrl}`
      };
 
    console.log("Sending Email");
    await sendEmail(mailgun, emailData,recipient);
 
    return ;
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
};
 
async function sendEmail(mailgun, data,recipient) {
    return new Promise((resolve, reject) => {
      mailgun.messages().send(data, (error, body) => {
        if (error) {
          console.log("Unsuccessful email sending")
          recordEmailEvent("Unsuccessful",recipient);
          reject(error);
        } else {
          console.log("Successful email sending")
          recordEmailEvent("Successful",recipient);
          resolve(body);
        }
      });
    });
}

async function recordEmailEvent(status, email) {
  const params = {
    TableName: process.env.DYNAMODB_TABLE_NAME,
    Item: {
      email: email,
      status: status,
      timestamp: new Date().toISOString(),
    },
  };
  console.log(params);
  await dynamoDB.put(params).promise();
  return;
}