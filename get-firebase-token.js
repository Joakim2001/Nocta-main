const { GoogleAuth } = require('google-auth-library');

async function getAccessToken() {
  const auth = new GoogleAuth({
    keyFile: 'serviceAccountKey.json', // Path to your downloaded JSON
    scopes: 'https://www.googleapis.com/auth/datastore', // Firestore scope
  });

  const client = await auth.getClient();
  const accessToken = await client.getAccessToken();
  console.log('Your access token:\n', accessToken.token || accessToken);
}

getAccessToken().catch(console.error);