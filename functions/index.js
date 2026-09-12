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
