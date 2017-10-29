const functions = require('firebase-functions');
const admin = require('firebase-admin');
const cors = require('cors')({origin: true});
const auth0 = require('auth0-js');

const auth0Web = new auth0.WebAuth({
    domain:       'open-data-health.auth0.com',
    clientID:     'BHs90OetX1d9B6GsGLzG9u5DxgocuhUz'
 });

var serviceAccount = require("./service-account.json");
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://open-data-health.firebaseio.com"
});

exports.delegateToken = functions.https.onRequest((req, res) => {
  cors(req, res, () => {
    console.log(req.body);
    let userId = req.body.email;
    const accessToken = req.headers.authorization.split('Bearer ')[1];

    if (!userId || !accessToken) return res.status(403).send('Unauthorized');

    admin.auth().createCustomToken(userId)
      .then(customToken => res.send(customToken))
      .catch(console.error);
  });
});
