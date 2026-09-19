import {
    initializeApp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import {
    getFirestore
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";


const firebaseConfig = {

    apiKey:
        "AIzaSyBTLPq7rWF60oojU4EKfVAHlxYf2kfFHi0",

    authDomain:
        "location-d10dc.firebaseapp.com",

    projectId:
        "location-d10dc",

    storageBucket:
        "location-d10dc.firebasestorage.app",

    messagingSenderId:
        "983150887307",

    appId:
        "1:983150887307:web:3938378fcd3720d14d2f8e",

    measurementId:
        "G-N64EPY5N0S"
};


const app =
    initializeApp(
        firebaseConfig
    );


const db =
    getFirestore(app);


export {
    db
};