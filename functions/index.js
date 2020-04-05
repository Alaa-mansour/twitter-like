const functions = require('firebase-functions');

const app = require('express')();

const FBAuth = require('./util/fbAuth');

const { 
    getScreams,
    getScream, 
    createScream,
    commentOnScream,
    likeScream,
    unlikeScream,
    deleteScream
} = require('./handlers/screams');

const { 
    signup, 
    login, 
    uploadImage,
    addUserDetails,
    getAuthenticatedUser
} = require('./handlers/users');

// Scream routes
app.get('/screams',getScreams);     
app.post('/scream', FBAuth , createScream);
app.get('/scream/:screamId', getScream);
app.delete('/scream/:screamId', FBAuth , deleteScream);
app.post('/scream/:screamId/comment', FBAuth , commentOnScream);
app.get('/scream/:screamId/like',FBAuth , likeScream);
app.get('/scream/:screamId/unlike',FBAuth , unlikeScream);


// users routes 
app.post('/signup',signup);
app.post('/login',login);
app.post('/user/image', FBAuth , uploadImage);
app.post('/user', FBAuth , addUserDetails);
app.get('/user', FBAuth , getAuthenticatedUser);

// it's good convension to use http://baseurl.com/api/getScream and not http://baseurl.com/getScream
exports.api = functions.https.onRequest(app);

