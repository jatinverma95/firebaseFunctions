/**
 * Copyright 2017 Google Inc. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// Import the Firebase SDK for Google Cloud Functions.
const functions = require('firebase-functions');
// Import and initialize the Firebase Admin SDK.
const admin = require('firebase-admin');

admin.initializeApp(functions.config().firebase);

exports.addWelcomeMessages = functions.auth.user().onCreate(event => {
    const user = event.data;
    console.log("A new user signedIn");
    const fullName = user.displayName || 'Anonymous';

    return admin.database().ref('messages').push({
        name: 'Firebase Bot',
        photoUrl: '/images/firebase-logo.png',
        text: `${fullName} signed in for the first time! Welcome!`
    }).then(() => console.log('Welcome message written to DB'));

});

// TODO(DEVELOPER): Write the blurOffensiveImages Function here.

exports.sendNotfications = functions.database.ref('/messages/{messageId}')
    .onCreate(event => {
        const snapshot = event.data;

        const text = snapshot.val().text;
        const payload = {
            notifications: {
                title: `${snapshot.val().name} posted ${text ? 'a message' : 'an image'}`,
                body: text ? (text.length <= 100 ? text : text.substring(0, 97) + '...') : '',
                icon: snapshot.val().photoUrl || '/images/profile_placeholder.png',
                click_action: `https://${functions.config().firebase.authDomain}`
            }
        };
        return admin.database().ref('fcmTokens').once('value').then(allTokens => {
            if (allTokens.val()) {
                const tokens = Object.keys(allTokens.val());

                return admin.messaging().sendToDevice(tokens, payload)
                    .then(response => {
                        const tokensToRemove = [];
                        response.results.forEach((result, index) => {
                            const error = result.error;
                            if (error) {
                                console.error('Failure sending notif to', tokens[index], error);

                                if (error.code === 'messaging/invalid-registration-token' ||
                                    error.code === 'messaging/registration-token-not-registered') {
                                    tokensToRemove.push(allTokens.ref.child(tokens[index]).remove());

                                }
                            }
                        });
                        return Promise.all(tokensToRemove);

                    });
            }
        });
    });
