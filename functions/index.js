const functions = require('firebase-functions');

const app = require('express')();

const FBAuth = require('./util/fbAuth');

const { db } = require('./util/admin');

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

// you have to deploy them for the triggers to work
exports.createNotificationOnLike = 
functions.firestore
.document('likes/{id}')
.onCreate((snapshot)=>{
    console.log("*** NeW LIKE CREATED ******");
    return db.doc(`/screams/${snapshot.data().screamId}`).get()
        .then(doc=>{
            // dont notify if the user is liking him self
            if(doc.exists && doc.data().userHandle !== snapshot.data().userHandle){
                //give the notification the same id as the like 
                return db.doc(`notifications/${snapshot.id}`).set({
                    createdAt: new Date().toISOString(),
                    recipient : doc.data().userHandle,
                    sender : snapshot.data().userHandle,
                    type : 'like',
                    read : false, //cuz i has not been read when it was created,
                    screamId : doc.id
                })
            }
            // we dont need to send back any response, because this is database triger 
            // and it's not an api endpoint 
        })
        .catch(error=>{
            console.log(error);
            return;
        })
});

exports.deleteNotificationOnUnlike = 
functions.firestore
.document('likes/{id}')
.onDelete(snapshot=>{
    console.log("**** LIKE DELETED *****");
    
    return db.doc(`/notifications/${snapshot.id}`)
    .delete()
    .catch(error=>{console.log(error); return;})
})

exports.createNotificationOnComment = 
functions.firestore
.document('comments/{id}')
.onCreate((snapshot)=>{
    return db.doc(`/screams/${snapshot.data().screamId}`).get()
        .then(doc=>{
            console.log("*** NEW COMMENT CREATED *******", doc);
            
            if(doc.exists && doc.data().userHandle !== snapshot.data().userHandle ){
                //give the notification the same id as the like 
                return db.doc(`notifications/${snapshot.id}`).set({
                    createdAt: new Date().toISOString(),
                    recipient : doc.data().userHandle,
                    sender : snapshot.data().userHandle,
                    type : 'comment',
                    read : false, //cuz i has not been read when it was created,
                    screamId : doc.id
                })
            }
        })
        .catch(error=>{
            console.log(error);
            return;
        })
});

exports.onUserImageChange = 
functions.firestore
.document('users/{userId}')
.onUpdate(change=>{
    console.log(change.before.data());
    console.log(change.after.data());
    if(change.before.data().imageUrl !== change.after.data().imageUrl ){
        console.log('image has changed');
        
        let batch = db.batch();
        return db.collection('screams').where('userHandle','==',  change.before.data().handle ).get()
            .then((data)=>{
                data.forEach(doc=>{
                    const scream = db.doc(`/screams/${doc.id}`)
                    batch.update(scream, { userImage : change.after.data().imageUrl });
                })
                return batch.commit();
            })
    }else return true;

})

exports.onScreamDelete = 
functions.firestore
.document('screams/{screamId}')
.onDelete((snapshot,context)=>{
    const screamId = context.params.screamId;
    const batch = db.batch();
    return db.collection('comments').where('screamId','==',screamId).get()
            .then(data=>{
                data.forEach(doc=>{
                    batch.delete(db.doc(`/comments/${doc.id}`))
                })
                return db.collection('likes').where('screamId','==',screamId).get();
            })
            .then(data=>{
                data.forEach(doc=>{
                    batch.delete(db.doc(`/likes/${doc.id}`))
                })
                return db.collection('notifications').where('screamId','==',screamId).get();
            })
            .then(data=>{
                data.forEach(doc=>{
                    batch.delete(db.doc(`/notifications/${doc.id}`))
                })
                return batch.commit();
            })
            .catch(error=>console.error(error));
})
