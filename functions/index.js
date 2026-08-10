/* ============================================================
   OPTIONAL Cloud Function.
   A static site can create new Firebase Auth accounts from the
   browser, but it can NOT change the password of an ALREADY
   EXISTING account — only the signed-in owner of an account can
   do that with the client SDK. Changing someone else's password
   needs the Admin SDK, which only runs in a trusted server
   environment like this function.

   Deploying this is optional. If you skip it, the "Edit Member"
   password field will show a friendly error, and the supported
   fallback is: remove the member and re-add them with the new
   password. See README.md Step 5.
   ============================================================ */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

exports.changeMemberPassword = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'You must be signed in.');
  }

  // Confirm the caller is the admin according to Firestore.
  const callerDoc = await admin.firestore().collection('users').doc(context.auth.uid).get();
  if (!callerDoc.exists || callerDoc.data().isAdmin !== true) {
    throw new functions.https.HttpsError('permission-denied', 'Only the admin can change member passwords.');
  }

  const { uid, newPassword } = data;
  if (!uid || !newPassword || newPassword.length < 6) {
    throw new functions.https.HttpsError('invalid-argument', 'A target member and a password of at least 6 characters are required.');
  }

  await admin.auth().updateUser(uid, { password: newPassword });
  return { success: true };
});
