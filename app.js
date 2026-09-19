// ==========================================
// LIVETRACK
// ==========================================

import {
    db
} from "./firebase-config.js";

import {
    collection,
    doc,
    setDoc,
    deleteDoc,
    onSnapshot,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";


console.log("LiveTrack Firebase app loaded");


// ==========================================
// ELEMENTS
// ==========================================

const startBtn =
    document.getElementById("startBtn");

const stopBtn =
    document.getElementById("stopBtn");

const statusDot =
    document.getElementById("statusDot");

const statusText =
    document.getElementById("statusText");

const latitudeElement =
    document.getElementById("latitude");

const longitudeElement =
    document.getElementById("longitude");

const accuracyElement =
    document.getElementById("accuracy");

const lastUpdatedElement =
    document.getElementById("lastUpdated");

const nameInput =
    document.getElementById("nameInput");

const saveNameBtn =
    document.getElementById("saveNameBtn");

const userNameElement =
    document.getElementById("userName");

const avatarElement =
    document.getElementById("avatar");

const peopleList =
    document.getElementById("peopleList");

const peopleCount =
    document.getElementById("peopleCount");


// ==========================================
// USER ID
// ==========================================

let userId =
    localStorage.getItem("liveTrackUserId");


if (!userId) {

    userId =
        "user_" +
        Date.now() +
        "_" +
        Math.random()
            .toString(36)
            .substring(2, 8);

    localStorage.setItem(
        "liveTrackUserId",
        userId
    );

}


// ==========================================
// USER NAME
// ==========================================

let userName =
    localStorage.getItem(
        "liveTrackUserName"
    );


if (!userName) {

    userName = "User";

}


userNameElement.textContent =
    userName;

nameInput.value =
    userName;

avatarElement.textContent =
    userName
        .charAt(0)
        .toUpperCase();


// ==========================================
// MAP
// ==========================================

const map =
    L.map("map").setView(
        [17.4065, 78.4772],
        13
    );


L.tileLayer(
    "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    {
        maxZoom: 19,

        attribution:
            "&copy; OpenStreetMap contributors"
    }
).addTo(map);


setTimeout(function () {

    map.invalidateSize();

}, 500);


// ==========================================
// MARKERS
// ==========================================

const markers = {};


// ==========================================
// SAVE NAME
// ==========================================

saveNameBtn.addEventListener(
    "click",
    saveName
);


function saveName() {

    const newName =
        nameInput.value.trim();


    if (!newName) {

        alert(
            "Please enter your name."
        );

        return;

    }


    userName =
        newName;


    localStorage.setItem(
        "liveTrackUserName",
        userName
    );


    userNameElement.textContent =
        userName;


    avatarElement.textContent =
        userName
            .charAt(0)
            .toUpperCase();


    alert(
        "Name saved successfully."
    );

}


// ==========================================
// START SHARING
// ==========================================

startBtn.addEventListener(
    "click",
    startSharing
);


function startSharing() {

    if (!navigator.geolocation) {

        alert(
            "Geolocation is not supported by this browser."
        );

        return;

    }


    startBtn.disabled = true;

    stopBtn.disabled = false;


    statusText.textContent =
        "Requesting location...";

    statusDot.style.background =
        "orange";


    navigator.geolocation.getCurrentPosition(

        function (position) {

            updateOwnLocation(
                position
            );


            startWatching();

        },


        function (error) {

            handleLocationError(
                error
            );

        },

        {

            enableHighAccuracy: true,

            timeout: 30000,

            maximumAge: 0

        }

    );

}


// ==========================================
// CONTINUOUS GPS
// ==========================================

function startWatching() {

    if (window.liveTrackWatchId) {

        return;

    }


    window.liveTrackWatchId =
        navigator.geolocation.watchPosition(

            function (position) {

                updateOwnLocation(
                    position
                );

            },


            function (error) {

                handleLocationError(
                    error
                );

            },


            {

                enableHighAccuracy: true,

                timeout: 30000,

                maximumAge: 5000

            }

        );

}


// ==========================================
// UPDATE OWN LOCATION
// ==========================================

async function updateOwnLocation(
    position
) {

    const latitude =
        position.coords.latitude;

    const longitude =
        position.coords.longitude;

    const accuracy =
        position.coords.accuracy;


    latitudeElement.textContent =
        latitude.toFixed(6);

    longitudeElement.textContent =
        longitude.toFixed(6);

    accuracyElement.textContent =
        Math.round(accuracy) + " m";

    lastUpdatedElement.textContent =
        new Date().toLocaleTimeString();


    statusText.textContent =
        "Location sharing active";

    statusDot.style.background =
        "green";


    // ======================================
    // FIRESTORE
    // ======================================

    try {

        await setDoc(

            doc(
                db,
                "liveLocations",
                userId
            ),

            {

                userId:
                    userId,

                name:
                    userName,

                latitude:
                    latitude,

                longitude:
                    longitude,

                accuracy:
                    accuracy,

                sharing:
                    true,

                updatedAt:
                    serverTimestamp()

            },

            {
                merge: true
            }

        );


        console.log(
            "Location uploaded to Firebase"
        );

    }

    catch (error) {

        console.error(
            "Firebase error:",
            error
        );

        statusText.textContent =
            "Firebase error";

    }

}


// ==========================================
// STOP SHARING
// ==========================================

stopBtn.addEventListener(
    "click",
    stopSharing
);


async function stopSharing() {

    if (
        window.liveTrackWatchId
    ) {

        navigator.geolocation.clearWatch(
            window.liveTrackWatchId
        );

        window.liveTrackWatchId =
            null;

    }


    startBtn.disabled = false;

    stopBtn.disabled = true;


    statusText.textContent =
        "Location sharing stopped";

    statusDot.style.background =
        "gray";


    // Remove own location

    try {

        await deleteDoc(

            doc(
                db,
                "liveLocations",
                userId
            )

        );

        console.log(
            "Location removed from Firebase"
        );

    }

    catch (error) {

        console.error(
            error
        );

    }

}


// ==========================================
// LISTEN TO ALL USERS
// ==========================================

const locationsRef =
    collection(
        db,
        "liveLocations"
    );


onSnapshot(

    locationsRef,

    function (snapshot) {

        const users = [];


        snapshot.forEach(
            function (docSnapshot) {

                const data =
                    docSnapshot.data();

                users.push(data);

            }
        );


        displayUsers(users);

        updateMarkers(users);

    },


    function (error) {

        console.error(
            "Firestore listener error:",
            error
        );

        peopleList.innerHTML =
            "<div class='empty-message'>" +
            "Unable to load live users." +
            "</div>";

    }

);


// ==========================================
// DISPLAY USERS
// ==========================================

function displayUsers(users) {

    if (users.length === 0) {

        peopleList.innerHTML =
            "<div class='empty-message'>" +
            "No one is sharing their location." +
            "</div>";

        peopleCount.textContent =
            "0 online";

        return;

    }


    peopleList.innerHTML = "";


    let onlineCount = 0;


    users.forEach(
        function (user) {

            onlineCount++;


            const item =
                document.createElement(
                    "div"
                );


            item.className =
                "person-item";


            const initial =
                user.name
                    ? user.name
                        .charAt(0)
                        .toUpperCase()
                    : "U";


            item.innerHTML =

                "<div class='person-avatar'>" +

                    initial +

                "</div>" +

                "<div class='person-info'>" +

                    "<strong>" +

                        escapeHtml(
                            user.name || "User"
                        ) +

                    "</strong>" +

                    "<span>" +

                        "● Sharing location" +

                    "</span>" +

                "</div>";


            peopleList.appendChild(
                item
            );

        }
    );


    peopleCount.textContent =
        onlineCount + " online";

}


// ==========================================
// UPDATE MAP MARKERS
// ==========================================

function updateMarkers(users) {

    const activeIds = {};


    users.forEach(
        function (user) {

            if (
                !user.latitude ||
                !user.longitude
            ) {

                return;

            }


            activeIds[user.userId] =
                true;


            const position = [

                user.latitude,

                user.longitude

            ];


            // Create marker

            if (
                !markers[user.userId]
            ) {

                markers[user.userId] =
                    L.marker(
                        position
                    )
                    .addTo(map);

            }


            // Move marker

            markers[user.userId]
                .setLatLng(position);


            // Popup

            markers[user.userId]
                .bindPopup(

                    "<strong>" +

                    escapeHtml(
                        user.name || "User"
                    ) +

                    "</strong><br>" +

                    "📍 Live location"

                );

        }
    );


    // ======================================
    // REMOVE OLD MARKERS
    // ======================================

    Object.keys(markers)
        .forEach(
            function (id) {

                if (!activeIds[id]) {

                    map.removeLayer(
                        markers[id]
                    );

                    delete markers[id];

                }

            }
        );

}


// ==========================================
// ERROR HANDLING
// ==========================================

function handleLocationError(error) {

    startBtn.disabled = false;

    stopBtn.disabled = true;


    statusDot.style.background =
        "red";


    if (error.code === 1) {

        statusText.textContent =
            "Location permission denied";

        alert(
            "Please allow location access in your browser."
        );

    }

    else if (error.code === 2) {

        statusText.textContent =
            "Location unavailable";

        alert(
            "Your device could not determine your location."
        );

    }

    else if (error.code === 3) {

        statusText.textContent =
            "GPS timeout";

        alert(
            "GPS request timed out. Please try again."
        );

    }

    else {

        statusText.textContent =
            "GPS error";

    }

}


// ==========================================
// ESCAPE HTML
// ==========================================

function escapeHtml(text) {

    const div =
        document.createElement(
            "div"
        );

    div.textContent =
        text;

    return div.innerHTML;

}
