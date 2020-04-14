const { db , admin} = require('../util/admin');
const firebase = require('firebase');
const config = require('../util/config');
const { validateSignupData , validateLoginData , reduceUserDetails} = require('../util/validators');

firebase.initializeApp(config);

exports.signup = (req,res)=>{
    const newUser ={
        email: req.body.email,
        password : req.body.password,
        confirmPassword : req.body.confirmPassword,
        handle : req.body.handle
    };

    //destructoring
    const { valid , errors} = validateSignupData(newUser);

    if(!valid) return res.status(400).json(errors);

    const noImg = 'no-img.png';

    let token , userId;
    db.doc(`/users/${newUser.handle}`)
      .get()
      .then(doc=>{
          if(doc.exists){
              return res.status(400).json({ handle : 'this handle is already taken'});
          }else{
              firebase.auth()
                      .createUserWithEmailAndPassword(newUser.email, newUser.password)
                      .then(data=>{
                        //   getting the auth token
                        userId = data.user.uid;
                        return data.user.getIdToken();
                      })
                      .then(tokenResponse=>{
                          token = tokenResponse;
                          console.log("@@ THE TOKEN @@ ", token);

                          const userCredentials= {
                              handle: newUser.handle,
                              email : newUser.email,
                              createdAt : new Date().toISOString(),
                              imageUrl : `https://firebasestorage.googleapis.com/v0/b/${config.storageBucket}/o/${noImg}?alt=media`,
                              userId
                          }
                        return db.doc(`/users/${newUser.handle}`).set(userCredentials);
                      })
                      .then(()=>{
                          return res.status(200).json({ token })
                      })
                      .catch(error=>{
                        console.log("Error in user handle",error);
                        if(error.code ===  "auth/email-already-in-use"){
                            //400 means a problem from the client (Bad Request)
                            return res.status(400).json({ email : 'email already in use'})
                        }else{
                            return res.status(500).json({error: error.code})
                        }
                      })
          }
      })

}

exports.login = (req,res)=>{
    let user = {
        email : req.body.email,
        password : req.body.password
    }
    //destructoring
    const { valid , errors} = validateLoginData(user);

    if(!valid) return res.status(400).json(errors);

    firebase.auth()
            .signInWithEmailAndPassword(user.email,user.password)
            .then(data=>{
                return data.user.getIdToken();
            })
            .then(token=>{
                return res.json({token})
            })
            .catch(error=>{
                console.error(error);
                if(error.code ==  "auth/wrong-password" || error.code ==  "auth/user-not-found"){
                    //403 unathorized request
                    return res.status(403).json({ general : "wrong credentials, please try again"})
                }else{
                    return res.status(500).json({error: error.code});
                }
            })


}

exports.addUserDetails= (req,res)=>{
    let userDetails = reduceUserDetails(req.body);

    if(!Object.keys(userDetails).length) return res.status(400).json({ error : "Fields must not be empty"});

    db.doc(`/users/${req.user.handle}`).update(userDetails)
        .then(()=>{
            return res.json({ message : 'Details added successfully '})
        })
        .catch(error=>{
            console.log("Error at adding user details",error);
            return res.status(500).json({erorr: error.code});
        })
}

exports.getAuthenticatedUser = (req, res)=>{
    let userData = {};
    db.doc(`/users/${req.user.handle}`).get()
        .then((doc)=>{
            if(doc.exists){
                userData.credentials = doc.data();
                return db.collection('likes').where('userHandle', '==', req.user.handle)
                        .get()
                        .then(data=>{
                            userData.likes = [];
                            data.forEach(doc=>{
                                userData.likes.push(doc.data());
                            });
                            return res.json(userData);
                        })
                        .catch(error=>{
                            console.log(error);
                            res.status(500).json({error : error.code});
                        })
            }
        })
}

exports.uploadImage = (req,res)=>{
    const BusBoy = require('busboy');
    const path = require('path');
    const os = require('os');
    const fs = require('fs');

    const busBoy = new BusBoy({ headers : req.headers });

    let imageFileName;
    let imageToBeUploaded = {};
    //file event
    busBoy.on('file',(fieldname , file ,filename , encoding, mimetype)=>{
        if(mimetype !== 'image/jpeg' && mimetype !==  'image/png'){
            return res.status(400).json({error : 'Wrong file type submitted.'})
        }

        console.log("****fieldname****",fieldname);
        console.log("****filename****",filename);
        console.log("****mimetype****",mimetype);
        //cuz we could have a file name called my.image.png
        const imageExtension = filename.split('.')[filename.split('.').length -1];
        //34234234.png
        imageFileName = `${Math.round(Math.random()*10000000000)}.${imageExtension}`;

        //tmpdir cuz it's not actual server but a cloud function
        const filePath = path.join(os.tmpdir(),imageFileName);
        imageToBeUploaded = { filePath , mimetype};
        //to creat the file
        file.pipe(fs.createWriteStream(filePath));
    });

    busBoy.on('finish',()=>{
        admin.storage()
             .bucket()
             .upload(imageToBeUploaded.filePath,{
                 resumable: false,
                 metadata:{
                     metadata:{
                         contentType: imageToBeUploaded.mimetype
                     }
                 }
             })
             .then(()=>{
                //get the image url to add it to the user
                // Adding alt=media will show the imaeg in the browser, and without it it will download the imagee to our computer
                const imageUrl = `https://firebasestorage.googleapis.com/v0/b/${config.storageBucket}/o/${imageFileName}?alt=media`;
                return db.doc(`/users/${req.user.handle}`).update({ imageUrl });
             })
             .then(()=>{
                 return res.json({message : 'Image uploaded successfully'});
             })
             .catch((error)=>{
                 console.log("Error in uploading the image",error);
                //  500 server error
                 return res.status(500).json({ error : error.code });
             })
    });
    busBoy.end(req.rawBody);
}