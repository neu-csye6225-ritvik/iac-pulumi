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


     // Download the file using node-fetch
    const response = await fetch(fileUrl);
    const fileBuffer = await response.buffer(); // Get the file content as a buffer

    // Set up Google Cloud Storage
    const storage = new Storage({
      projectId: 'prime-cosmos-405923', // Replace with your GCP project ID
      keyFilename: '/Users/ritvikparamkusham/Downloads/fileName.json', // Replace with the path to your GCP service account key file
    });

    const bucketName = 'my-bucket-check-751d6cb'; // Replace with your GCS bucket name
    const fileName = '/Users/ritvikparamkusham/Downloads/fileName.json'; // Replace with the desired file name in GCS

    // Upload the file to GCS bucket
    const bucket = storage.bucket(bucketName);
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