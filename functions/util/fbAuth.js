const {admin , db} = require('./admin');

module.exports= (req, res, next)=>{
    //it's a good convension to use bearer
    let idToken;
    if(req.headers.authorization && req.headers.authorization.startsWith('Bearer ')){
        idToken = req.headers.authorization.split('Bearer ')[1];
    }else{
        console.error('No token found');
        // unathorized error
        res.status(403).json({ error : "Unauthorized"});
    }

    //make sure that this token is issued by our application
    admin.auth()
         .verifyIdToken(idToken)
         .then(decodedToken=>{  
            //this will add more info to the request of the route that will add this middleware too
            req.user =  decodedToken;
            return db.collection('users')
                     .where('userId','==',req.user.uid)
                     .limit(1)
                     .get()
         })
         .then(data=>{
             req.user.handle = data.docs[0].data().handle;
             req.user.imageUrl = data.docs[0].data().imageUrl;
             return next(); // will allow the request to proceed towards the function
         })
         .catch(error=>{
             // if the token is expired or black listed, or from other issuer
             console.error('Error while verifying token',error);
             res.status(403).json({ error : "Error in verifying token"});
         });
}