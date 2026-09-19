// ======================================================
// LIVE LOCATION TRACKER
// Firebase + Firestore + GPS + Leaflet
// ======================================================

import { db } from "./firebase-config.js";

import {
    collection,
    doc,
    setDoc,
    deleteDoc,
    onSnapshot,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";


// ======================================================
// SETTINGS
// ======================================================

const LOCATION_COLLECTION = "liveLocations";

const PROXIMITY_RADIUS = 1000; // 1 KM

const DEFAULT_LOCATION = [
    17.4065,
    78.4772
]; // Hyderabad


// ======================================================
// USER DATA
// ======================================================

let userId =
    localStorage.getItem("liveTrackerUserId");

if (!userId) {

    userId =
        "user_" +
        Date.now() +
        "_" +
        Math.random()
            .toString(36)
            .substring(2, 9);

    localStorage.setItem(
        "liveTrackerUserId",
        userId
    );
}


let userName =
    localStorage.getItem("liveTrackerUserName") || "";


// ======================================================
// STATE
// ======================================================

let watchId = null;

let isSharing = false;

let currentLocation = null;

let map;

let ownMarker = null;

let markers = {};

let peopleData = {};

let proximityPairs = {};


// ======================================================
// ELEMENTS
// ======================================================

const startSharing =
    document.getElementById("startSharing");

const stopSharing =
    document.getElementById("stopSharing");

const userNameInput =
    document.getElementById("userName");

const saveName =
    document.getElementById("saveName");

const sidebarUserName =
    document.getElementById("sidebarUserName");

const userAvatar =
    document.getElementById("userAvatar");

const statusDot =
    document.getElementById("statusDot");

const statusText =
    document.getElementById("statusText");

const headerStatusDot =
    document.getElementById("headerStatusDot");

const headerStatus =
    document.getElementById("headerStatus");

const onlineCount =
    document.getElementById("onlineCount");

const peopleList =
    document.getElementById("peopleList");

const mapPeopleCount =
    document.getElementById("mapPeopleCount");

const latitudeElement =
    document.getElementById("latitude");

const longitudeElement =
    document.getElementById("longitude");

const accuracyElement =
    document.getElementById("accuracy");

const lastUpdatedElement =
    document.getElementById("lastUpdated");

const gpsStatus =
    document.getElementById("gpsStatus");

const mapLocationText =
    document.getElementById("mapLocationText");

const recenterBtn =
    document.getElementById("recenterBtn");

const fullscreenBtn =
    document.getElementById("fullscreenBtn");

const alertPanel =
    document.getElementById("alertPanel");

const alertTitle =
    document.getElementById("alertTitle");

const alertMessage =
    document.getElementById("alertMessage");

const mobileMenu =
    document.getElementById("mobileMenu");

const sidebar =
    document.querySelector(".sidebar");

const sidebarOverlay =
    document.getElementById("sidebarOverlay");


// ======================================================
// INITIAL PROFILE
// ======================================================

if (userNameInput) {
    userNameInput.value = userName;
}

updateProfileUI();


// ======================================================
// INITIALIZE MAP
// ======================================================

map = L.map("map", {
    zoomControl: false
}).setView(
    DEFAULT_LOCATION,
    13
);


L.tileLayer(
    "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    {
        maxZoom: 19,
        attribution:
            '&copy; OpenStreetMap contributors'
    }
).addTo(map);


// ======================================================
// CUSTOM MARKER ICONS
// ======================================================

function createMarkerIcon(
    isOwn,
    name = ""
) {

    const firstLetter =
        escapeHtml(
            name
                ? name.charAt(0).toUpperCase()
                : "?"
        );

    const className =
        isOwn
            ? "user-marker"
            : "other-marker";

    return L.divIcon({

        className: "",

        html: `
            <div class="${className}">
                ${firstLetter}
            </div>
        `,

        iconSize: [40, 40],

        iconAnchor: [20, 20],

        popupAnchor: [0, -22]
    });
}


// ======================================================
// SAVE NAME
// ======================================================

saveName.addEventListener(
    "click",
    saveUserName
);


userNameInput.addEventListener(
    "keydown",
    function (event) {

        if (event.key === "Enter") {
            saveUserName();
        }

    }
);


function saveUserName() {

    const name =
        userNameInput.value.trim();

    if (!name) {

        alert(
            "Please enter your name first."
        );

        userNameInput.focus();

        return;
    }

    userName = name;

    localStorage.setItem(
        "liveTrackerUserName",
        userName
    );

    updateProfileUI();

    if (isSharing && currentLocation) {

        updateOwnLocation(
            currentLocation.latitude,
            currentLocation.longitude,
            currentLocation.accuracy
        );

    }

    showToast(
        "Profile name saved"
    );
}


// ======================================================
// PROFILE UI
// ======================================================

function updateProfileUI() {

    const displayName =
        userName || "Your Location";

    sidebarUserName.textContent =
        displayName;

    const firstLetter =
        displayName
            .charAt(0)
            .toUpperCase();

    userAvatar.textContent =
        firstLetter;
}


// ======================================================
// START SHARING
// ======================================================

startSharing.addEventListener(
    "click",
    startLocationSharing
);


function startLocationSharing() {

    if (!navigator.geolocation) {

        alert(
            "Your browser does not support GPS location."
        );

        return;
    }


    if (!userName) {

        alert(
            "Please enter your name before starting location sharing."
        );

        userNameInput.focus();

        return;
    }


    if (isSharing) {
        return;
    }


    setSharingUI(true);

    setGPSStatus(
        "Locating..."
    );


    navigator.geolocation.getCurrentPosition(

        function (position) {

            const {
                latitude,
                longitude,
                accuracy
            } = position.coords;


            currentLocation = {
                latitude,
                longitude,
                accuracy
            };


            updateOwnLocation(
                latitude,
                longitude,
                accuracy
            );


            centerMap(
                latitude,
                longitude,
                15
            );


            watchId =
                navigator.geolocation.watchPosition(

                    function (newPosition) {

                        const {
                            latitude,
                            longitude,
                            accuracy
                        } =
                            newPosition.coords;


                        currentLocation = {
                            latitude,
                            longitude,
                            accuracy
                        };


                        updateOwnLocation(
                            latitude,
                            longitude,
                            accuracy
                        );

                    },

                    handleLocationError,

                    {
                        enableHighAccuracy: true,

                        maximumAge: 3000,

                        timeout: 15000
                    }
                );

        },

        handleLocationError,

        {
            enableHighAccuracy: true,

            maximumAge: 0,

            timeout: 15000
        }
    );
}


// ======================================================
// UPDATE OWN LOCATION
// ======================================================

async function updateOwnLocation(
    latitude,
    longitude,
    accuracy
) {

    if (!isSharing) {
        return;
    }


    currentLocation = {
        latitude,
        longitude,
        accuracy
    };


    updateOwnUI(
        latitude,
        longitude,
        accuracy
    );


    updateOwnMarker(
        latitude,
        longitude
    );


    try {

        await setDoc(

            doc(
                db,
                LOCATION_COLLECTION,
                userId
            ),

            {

                userId: userId,

                name: userName,

                latitude: latitude,

                longitude: longitude,

                accuracy: accuracy,

                sharing: true,

                updatedAt:
                    serverTimestamp()

            },

            {
                merge: true
            }

        );

        setGPSStatus("Active");

    }

    catch (error) {

        console.error(
            "Firebase location error:",
            error
        );

        setGPSStatus(
            "Firebase error"
        );

        showToast(
            "Could not update Firebase"
        );

    }
}


// ======================================================
// UPDATE OWN UI
// ======================================================

function updateOwnUI(
    latitude,
    longitude,
    accuracy
) {

    latitudeElement.textContent =
        latitude.toFixed(6);

    longitudeElement.textContent =
        longitude.toFixed(6);

    accuracyElement.textContent =
        Math.round(accuracy);

    lastUpdatedElement.textContent =
        formatTime(
            new Date()
        );

    mapLocationText.textContent =
        `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
}


// ======================================================
// UPDATE OWN MARKER
// ======================================================

function updateOwnMarker(
    latitude,
    longitude
) {

    const position = [
        latitude,
        longitude
    ];


    if (!ownMarker) {

        ownMarker =
            L.marker(
                position,
                {
                    icon:
                        createMarkerIcon(
                            true,
                            userName
                        )
                }
            ).addTo(map);


        ownMarker.bindPopup(
            `
            <strong>
                ${escapeHtml(userName)}
            </strong>
            <br>
            <span>
                Your live location
            </span>
            `
        );

    }

    else {

        ownMarker.setLatLng(
            position
        );

        ownMarker.setIcon(
            createMarkerIcon(
                true,
                userName
            )
        );

    }
}


// ======================================================
// STOP SHARING
// ======================================================

stopSharing.addEventListener(
    "click",
    stopLocationSharing
);


async function stopLocationSharing() {

    if (!isSharing) {
        return;
    }


    isSharing = false;


    if (watchId !== null) {

        navigator.geolocation.clearWatch(
            watchId
        );

        watchId = null;
    }


    try {

        await deleteDoc(
            doc(
                db,
                LOCATION_COLLECTION,
                userId
            )
        );

    }

    catch (error) {

        console.error(
            "Error removing location:",
            error
        );

    }


    if (ownMarker) {

        map.removeLayer(
            ownMarker
        );

        ownMarker = null;
    }


    setSharingUI(false);

    setGPSStatus(
        "Stopped"
    );

    latitudeElement.textContent = "—";

    longitudeElement.textContent = "—";

    accuracyElement.textContent = "—";

    lastUpdatedElement.textContent = "—";

    mapLocationText.textContent =
        "Location sharing stopped";

    showToast(
        "Location sharing stopped"
    );
}


// ======================================================
// SHARING UI
// ======================================================

function setSharingUI(active) {

    isSharing = active;


    if (active) {

        startSharing.style.display =
            "none";

        stopSharing.style.display =
            "block";

        statusDot.classList.add(
            "active"
        );

        statusText.textContent =
            "Sharing live";

        headerStatusDot.classList.add(
            "active"
        );

        headerStatus.textContent =
            "Live";

    }

    else {

        startSharing.style.display =
            "block";

        stopSharing.style.display =
            "none";

        statusDot.classList.remove(
            "active"
        );

        statusText.textContent =
            "Not sharing";

        headerStatusDot.classList.remove(
            "active"
        );

        headerStatus.textContent =
            "Offline";
    }
}


// ======================================================
// GPS STATUS
// ======================================================

function setGPSStatus(status) {

    gpsStatus.textContent =
        status;
}


// ======================================================
// FIRESTORE REAL-TIME LISTENER
// ======================================================

const locationsRef =
    collection(
        db,
        LOCATION_COLLECTION
    );


onSnapshot(

    locationsRef,

    function (snapshot) {

        peopleData = {};


        snapshot.forEach(
            function (docSnapshot) {

                const data =
                    docSnapshot.data();


                if (
                    data.sharing !== true
                ) {
                    return;
                }


                peopleData[
                    docSnapshot.id
                ] = data;

            }
        );


        displayUsers();

        updateMarkers();

        checkProximity();

    },

    function (error) {

        console.error(
            "Firestore listener error:",
            error
        );

        headerStatus.textContent =
            "Connection error";

        showToast(
            "Could not connect to Firebase"
        );
    }
);


// ======================================================
// DISPLAY USERS
// ======================================================

function displayUsers() {

    const users =
        Object.values(
            peopleData
        );


    onlineCount.textContent =
        `${users.length} online`;


    mapPeopleCount.textContent =
        `${users.length} ${
            users.length === 1
                ? "person"
                : "people"
        }`;


    if (users.length === 0) {

        peopleList.innerHTML = `

            <div class="empty-people">

                <div class="empty-icon">
                    👥
                </div>

                <strong>
                    No one is sharing
                </strong>

                <span>
                    Start sharing your location
                </span>

            </div>

        `;

        return;
    }


    const sortedUsers =
        [...users].sort(
            function (a, b) {

                if (
                    a.userId === userId
                ) return -1;

                if (
                    b.userId === userId
                ) return 1;

                return 0;
            }
        );


    peopleList.innerHTML =
        sortedUsers
            .map(
                createPersonHTML
            )
            .join("");
}


// ======================================================
// CREATE PERSON HTML
// ======================================================

function createPersonHTML(
    person
) {

    const isOwn =
        person.userId === userId;


    let distanceText =
        "You";


    if (
        !isOwn &&
        currentLocation &&
        isValidCoordinates(person)
    ) {

        const distance =
            calculateDistance(

                currentLocation.latitude,

                currentLocation.longitude,

                person.latitude,

                person.longitude

            );


        distanceText =
            formatDistance(
                distance
            );
    }


    const name =
        person.name ||
        "Unknown";


    const letter =
        name
            .charAt(0)
            .toUpperCase();


    return `

        <div class="person-item">

            <div class="person-avatar">
                ${escapeHtml(letter)}
            </div>

            <div class="person-info">

                <span class="person-name">

                    ${escapeHtml(name)}

                    ${
                        isOwn
                            ? " (You)"
                            : ""
                    }

                </span>

                <div class="person-meta">

                    <i class="person-dot"></i>

                    <span>
                        ${
                            isOwn
                                ? "Sharing your location"
                                : "Live location"
                        }
                    </span>

                </div>

            </div>

            <div class="person-distance">
                ${distanceText}
            </div>

        </div>

    `;
}


// ======================================================
// UPDATE MAP MARKERS
// ======================================================

function updateMarkers() {

    const activeIds =
        new Set(
            Object.keys(
                peopleData
            )
        );


    // Remove old markers

    Object.keys(markers)
        .forEach(
            function (id) {

                if (
                    !activeIds.has(id)
                ) {

                    map.removeLayer(
                        markers[id]
                    );

                    delete markers[id];
                }

            }
        );


    // Create/update markers

    Object.entries(
        peopleData
    )
    .forEach(
        function ([id, person]) {

            if (
                id === userId
            ) {
                return;
            }


            if (
                !isValidCoordinates(person)
            ) {
                return;
            }


            const position = [

                person.latitude,

                person.longitude

            ];


            if (!markers[id]) {

                markers[id] =
                    L.marker(

                        position,

                        {
                            icon:
                                createMarkerIcon(
                                    false,
                                    person.name
                                )
                        }

                    ).addTo(map);


                markers[id].bindPopup(
                    createPopupHTML(
                        person
                    )
                );

            }

            else {

                markers[id].setLatLng(
                    position
                );

                markers[id].setIcon(
                    createMarkerIcon(
                        false,
                        person.name
                    )
                );

                markers[id].setPopupContent(
                    createPopupHTML(
                        person
                    )
                );

            }

        }
    );
}


// ======================================================
// POPUP
// ======================================================

function createPopupHTML(
    person
) {

    const name =
        escapeHtml(
            person.name ||
            "Unknown"
        );


    let distanceHTML = "";


    if (
        currentLocation &&
        isValidCoordinates(person)
    ) {

        const distance =
            calculateDistance(

                currentLocation.latitude,

                currentLocation.longitude,

                person.latitude,

                person.longitude

            );


        distanceHTML = `
            <br>
            <strong>
                Distance:
            </strong>
            ${formatDistance(distance)}
        `;
    }


    return `

        <div style="
            min-width:160px;
            line-height:1.5;
        ">

            <strong>
                ${name}
            </strong>

            <br>

            <span>
                ● Live location
            </span>

            ${distanceHTML}

        </div>

    `;
}


// ======================================================
// PROXIMITY CHECK
// ======================================================

function checkProximity() {

    if (!currentLocation) {
        return;
    }


    const users =
        Object.values(
            peopleData
        );


    let nearbyPeople = [];


    users.forEach(
        function (person) {

            if (
                person.userId === userId
            ) {
                return;
            }


            if (
                !isValidCoordinates(person)
            ) {
                return;
            }


            const distance =
                calculateDistance(

                    currentLocation.latitude,

                    currentLocation.longitude,

                    person.latitude,

                    person.longitude

                );


            const pairKey =
                createPairKey(
                    userId,
                    person.userId
                );


            if (
                distance <=
                PROXIMITY_RADIUS
            ) {

                nearbyPeople.push({
                    name:
                        person.name ||
                        "Someone",

                    distance:
                        distance
                });


                if (
                    !proximityPairs[pairKey]
                ) {

                    proximityPairs[pairKey] =
                        true;


                    triggerProximityAlert(

                        person.name ||
                        "Someone",

                        distance
                    );
                }

            }

            else {

                // Reset the alert once
                // the person moves outside 1 km

                delete proximityPairs[
                    pairKey
                ];
            }

        }
    );


    if (
        nearbyPeople.length > 0
    ) {

        showNearbyPanel(
            nearbyPeople
        );

    }

    else {

        showNormalAlertPanel();
    }
}


// ======================================================
// PROXIMITY ALERT
// ======================================================

function triggerProximityAlert(
    name,
    distance
) {

    const formatted =
        formatDistance(
            distance
        );


    alertTitle.textContent =
        `${name} is nearby`;


    alertMessage.textContent =
        `${name} is approximately ${formatted} away from you.`;


    alertPanel.classList.add(
        "warning"
    );


    // Browser alert

    alert(
        `⚠ PROXIMITY ALERT\n\n` +
        `${name} is ${formatted} away from you.\n\n` +
        `They are within 1 km.`
    );


    // Optional vibration

    if (
        navigator.vibrate
    ) {

        navigator.vibrate([
            250,
            100,
            250
        ]);
    }
}


// ======================================================
// NEARBY PANEL
// ======================================================

function showNearbyPanel(
    nearbyPeople
) {

    alertPanel.classList.add(
        "warning"
    );


    if (
        nearbyPeople.length === 1
    ) {

        const person =
            nearbyPeople[0];


        alertTitle.textContent =
            `${person.name} is within 1 km`;


        alertMessage.textContent =
            `${person.name} is ${formatDistance(
                person.distance
            )} away from you.`;

    }

    else {

        alertTitle.textContent =
            `${nearbyPeople.length} people are within 1 km`;


        alertMessage.textContent =
            nearbyPeople
                .map(
                    person =>
                        `${person.name}: ${formatDistance(
                            person.distance
                        )}`
                )
                .join(" • ");

    }
}


// ======================================================
// NORMAL ALERT PANEL
// ======================================================

function showNormalAlertPanel() {

    alertPanel.classList.remove(
        "warning"
    );


    alertTitle.textContent =
        "Proximity monitoring active";


    alertMessage.textContent =
        "You will receive an alert when another person comes within 1 km.";
}


// ======================================================
// DISTANCE CALCULATION
// ======================================================

function calculateDistance(
    lat1,
    lon1,
    lat2,
    lon2
) {

    const earthRadius =
        6371000;


    const latitudeDifference =
        toRadians(
            lat2 - lat1
        );


    const longitudeDifference =
        toRadians(
            lon2 - lon1
        );


    const a =
        Math.sin(
            latitudeDifference / 2
        ) ** 2 +

        Math.cos(
            toRadians(lat1)
        ) *

        Math.cos(
            toRadians(lat2)
        ) *

        Math.sin(
            longitudeDifference / 2
        ) ** 2;


    const c =
        2 *
        Math.atan2(
            Math.sqrt(a),
            Math.sqrt(1 - a)
        );


    return earthRadius * c;
}


function toRadians(
    degrees
) {

    return degrees *
        Math.PI /
        180;
}


// ======================================================
// FORMAT DISTANCE
// ======================================================

function formatDistance(
    meters
) {

    if (
        meters < 1000
    ) {

        return `${Math.round(meters)} m`;

    }


    return `${(
        meters / 1000
    ).toFixed(2)} km`;
}


// ======================================================
// VALIDATE COORDINATES
// ======================================================

function isValidCoordinates(
    person
) {

    return (

        typeof person.latitude ===
        "number"

        &&

        typeof person.longitude ===
        "number"

        &&

        Number.isFinite(
            person.latitude
        )

        &&

        Number.isFinite(
            person.longitude
        )

    );
}


// ======================================================
// CENTER MAP
// ======================================================

function centerMap(
    latitude,
    longitude,
    zoom = 15
) {

    map.setView(
        [
            latitude,
            longitude
        ],
        zoom,
        {
            animate: true
        }
    );
}


// ======================================================
// RECENTER BUTTON
// ======================================================

recenterBtn.addEventListener(
    "click",
    function () {

        if (
            currentLocation
        ) {

            centerMap(

                currentLocation.latitude,

                currentLocation.longitude,

                16

            );

        }

        else {

            showToast(
                "Your location is not available yet."
            );
        }

    }
);


// ======================================================
// FULLSCREEN MAP
// ======================================================

fullscreenBtn.addEventListener(
    "click",
    function () {

        const mapContainer =
            document.querySelector(
                ".map-container"
            );


        if (
            !document.fullscreenElement
        ) {

            if (
                mapContainer.requestFullscreen
            ) {

                mapContainer.requestFullscreen();

            }

        }

        else {

            document.exitFullscreen();

        }

    }
);


// ======================================================
// MOBILE MENU
// ======================================================

mobileMenu.addEventListener(
    "click",
    function () {

        sidebar.classList.add(
            "open"
        );

        sidebarOverlay.classList.add(
            "open"
        );

    }
);


sidebarOverlay.addEventListener(
    "click",
    closeMobileSidebar
);


function closeMobileSidebar() {

    sidebar.classList.remove(
        "open"
    );

    sidebarOverlay.classList.remove(
        "open"
    );
}


// ======================================================
// GEOLOCATION ERROR
// ======================================================

function handleLocationError(
    error
) {

    console.error(
        "GPS error:",
        error
    );


    setGPSStatus(
        "GPS error"
    );


    if (
        error.code ===
        error.PERMISSION_DENIED
    ) {

        showToast(
            "Location permission was denied. Please allow location access in your browser."
        );

    }

    else if (
        error.code ===
        error.POSITION_UNAVAILABLE
    ) {

        showToast(
            "GPS location is currently unavailable."
        );

    }

    else if (
        error.code ===
        error.TIMEOUT
    ) {

        showToast(
            "GPS request timed out. Trying again..."
        );

    }

    else {

        showToast(
            "Unable to get your location."
        );

    }


    setSharingUI(false);
}


// ======================================================
// TIME FORMAT
// ======================================================

function formatTime(
    date
) {

    return date.toLocaleTimeString(
        [],
        {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit"
        }
    );
}


// ======================================================
// PAIR KEY
// ======================================================

function createPairKey(
    id1,
    id2
) {

    return [
        id1,
        id2
    ]
        .sort()
        .join("_");
}


// ======================================================
// HTML ESCAPE
// ======================================================

function escapeHtml(
    value
) {

    return String(value)
        .replace(
            /&/g,
            "&amp;"
        )
        .replace(
            /</g,
            "&lt;"
        )
        .replace(
            />/g,
            "&gt;"
        )
        .replace(
            /"/g,
            "&quot;"
        )
        .replace(
            /'/g,
            "&#039;"
        );
}


// ======================================================
// TOAST
// ======================================================

function showToast(
    message
) {

    let toast =
        document.getElementById(
            "liveTrackerToast"
        );


    if (!toast) {

        toast =
            document.createElement(
                "div"
            );

        toast.id =
            "liveTrackerToast";


        toast.style.position =
            "fixed";

        toast.style.left =
            "50%";

        toast.style.bottom =
            "25px";

        toast.style.transform =
            "translateX(-50%)";

        toast.style.background =
            "#111827";

        toast.style.color =
            "white";

        toast.style.padding =
            "11px 16px";

        toast.style.borderRadius =
            "10px";

        toast.style.fontSize =
            "12px";

        toast.style.fontWeight =
            "600";

        toast.style.zIndex =
            "9999";

        toast.style.boxShadow =
            "0 8px 25px rgba(0,0,0,.2)";

        toast.style.maxWidth =
            "calc(100% - 30px)";

        toast.style.textAlign =
            "center";


        document.body.appendChild(
            toast
        );
    }


    toast.textContent =
        message;


    clearTimeout(
        toast._timer
    );


    toast.style.opacity =
        "1";


    toast._timer =
        setTimeout(
            function () {

                toast.style.opacity =
                    "0";

            },
            3000
        );
}


// ======================================================
// INITIAL FIREBASE STATUS
// ======================================================

headerStatus.textContent =
    "Connected";


// ======================================================
// END
// ======================================================