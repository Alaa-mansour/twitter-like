const {db} = require('../util/admin');

exports.getScreams = (req,res)=>{
    db.collection('screams')
    .orderBy('createdAt','desc')
    .get()
    .then(data=>{
        let screams = [];
        data.forEach(doc=>{
            screams.push({
                screamId: doc.id,
                // ...doc.data() // cant use it in this node version
                body : doc.data().body,
                userHandle : doc.data().userHandle,
                createdAt :doc.data().createdAt,
                commentCount : doc.data().commentCount,
                likeCount : doc.data().likeCount
            });
        })
        return res.json(screams);
    })
    .catch(err=> {
        console.log("error in getScreams",err);
        return res.status(500).json({error : err.code});
    });
} 

exports.getScream = (req,res)=>{
    let screamData = {}; 
    db.doc(`/screams/${req.params.screamId}`).get()
        .then(doc=>{
            if(!doc.exists){
                return res.status(400).json({error : "Scream not found"});
            }
            screamData = doc.data();
            screamData.screamId = doc.id;
            return db.collection('comments')
                      .where('screamId','==',req.params.screamId)
                      .get();
        })
        .then(data=>{
             screamData.comments =[];
             data.forEach(doc=>{
                screamData.comments.push(doc.data());
             })
             return res.json(screamData);
        })
        .catch(error=>{
            console.log(erorr);
            res.status(500).json({error : error.code });
        })
}

exports.createScream = (req,res)=>{
    if(req.body.body.trim() ===  ''){
        return res.status(400).json({ body: "Body must not be empty"})
    }

    const newScream = {
        body : req.body.body,
        userHandle : req.user.handle,
        userImage : req.user.imageUrl,
        createdAt : new Date().toISOString(),
        likeCount : 0,
        commentCount : 0
    };
    
    db.collection('screams')
        .add(newScream)
        .then(doc=>{
            const resScream = newScream; 
            resScream.screamId = doc.id;
            return res.json(resScream);
        })
        .catch(err=>{
            res.status(500).json({error:'something went wrong'});
            console.log("error with creating scream",err)
        })
}

exports.commentOnScream = (req, res)=>{
    if(req.body.body.trim() == '' ) return res.status(400).json({error : 'must not be empty'});
    
    const newComment = {
        body : req.body.body,
        createdAt : new Date().toISOString(),
        screamId : req.params.screamId,
        userHandle : req.user.handle,
        userImage : req.user.imageUrl
    };

    // confirm if the scream still there to comment on it 
    db.doc(`/screams/${req.params.screamId}`).get()
        .then(doc=>{
            // 404  indicate that the browser was able to communicate with a given server, but the server could not find what was requested
            if(!doc.exists) return res.status(404).json({ error : 'Scream not found'});
            return doc.ref.update({ commentCount : doc.data().commentCount + 1 });
        })
        .then(()=>{
            return db.collection('comments').add(newComment)
        })
        .then(()=>{
            res.json(newComment);
        })
        .catch(error=>{
            console.log(error);
            res.status(500).json({error : 'Something went wrong'});   
        })

}

exports.likeScream = (req,res)=>{
    // check if the scream already exist so the user can like it 
    // check if he already liked it or not 

    const likeDocument = db.collection('likes')
                            .where('userHandle','==',req.user.handle)
                            .where('screamId', '==', req.params.screamId).limit(1);

    const screamDocument = db.doc(`/screams/${req.params.screamId}`);

    let screamData = {};

    screamDocument
    .get()
    .then(doc=>{
        if(doc.exists){
            screamData = doc.data();
            screamData.screamId = doc.id;
            return likeDocument.get();
        }else{
            return res.status(404).json({ error :  'Scream not found'});
        }
    })
    .then(data=>{
        if(data.empty){
            return db.collection('likes').add({
                screamId : req.params.screamId,
                userHandle : req.user.handle
            })
            .then(()=>{
                screamData.likeCount++;
                return screamDocument.update({likeCount : screamData.likeCount});
            })
            .then(()=>{
                res.json(screamData); 
            })
        }else{
            return res.status(400).json({ error :'Scream already liked'});
        }
    })
    .catch(error=>{
        console.log(error);
        res.status(500).json({ error : error.code });
        
    })
                    
}

exports.unlikeScream = (req , res)=>{
    const likeDocument = db.collection('likes')
                            .where('userHandle','==',req.user.handle)
                            .where('screamId', '==', req.params.screamId).limit(1);

    const screamDocument = db.doc(`/screams/${req.params.screamId}`);

    let screamData = {};

    screamDocument
    .get()
    .then(doc=>{
        if(doc.exists){
            screamData = doc.data();
            screamData.screamId = doc.id;
            return likeDocument.get();
        }else{
            return res.status(404).json({ error :  'Scream not found'});
        }
    })
    .then(data=>{
        if(data.empty){
            return res.status(400).json({ error :'Scream not liked'});
        }else{
            return db.doc(`/likes/${data.docs[0].data().id}`).delete()
                        .then(()=>{
                            screamData.likeCount--;
                            return screamDocument.update({ likeCount : screamData.likeCount }); 
                        })
                        .then(()=>{
                            res.json(screamData);
                        })
                        
        }
    })
    .catch(error=>{
        console.log(error);
        res.status(500).json({ error : error.code });
        
    })
}

exports.deleteScream = (req, res)=>{
    const document = db.doc(`/screams/${req.params.screamId}`);

    document.get()
        .then(doc=>{
            if(!doc.exists){
                // no scream to delete 
                return res.status(404).json({error : 'Scream not found'});
            }
            // just the owner of the scream can delete it 
            if(doc.data().userHandle !== req.user.handle){
                return res.status(403).json({ error : 'Unauthorized' });
            }else{
                return document.delete();
            }
        })
        .then(()=>{
            res.json({message : 'Scream deleted succefully'});
        })
        .catch(error=>{
            console.log(error);
            return res.status(500).json({ error : error.code });
        })
}