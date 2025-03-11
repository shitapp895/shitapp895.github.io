// Friend Removal Test Function
// Copy and paste this into your browser console to test friendship removal

const testFriendRemoval = async (yourUid, friendUid) => {
  try {
    console.log('========= FRIENDSHIP TEST STARTED =========');
    console.log(`Testing removal of friendship between ${yourUid} and ${friendUid}`);

    // Get Firestore instance
    const firestore = firebase.firestore();

    // Get user documents
    const yourUserDoc = await firestore.collection('users').doc(yourUid).get();
    const friendUserDoc = await firestore.collection('users').doc(friendUid).get();

    if (!yourUserDoc.exists) {
      console.error(`❌ Your user document (${yourUid}) not found!`);
      return;
    }

    if (!friendUserDoc.exists) {
      console.error(`❌ Friend's user document (${friendUid}) not found!`);
      return;
    }

    // Check current friendship status
    const yourData = yourUserDoc.data();
    const friendData = friendUserDoc.data();

    const yourFriends = yourData.friends || [];
    const friendFriends = friendData.friends || [];

    console.log('Current friendship status:');
    console.log(`- You have friend in your list: ${yourFriends.includes(friendUid)}`);
    console.log(`- Friend has you in their list: ${friendFriends.includes(yourUid)}`);

    // Check for inconsistency
    if (yourFriends.includes(friendUid) !== friendFriends.includes(yourUid)) {
      console.warn('⚠️ INCONSISTENT FRIENDSHIP DETECTED!');
      console.warn('One user has the other as a friend, but not vice versa.');
    }

    // Test the security rules by trying to update both documents
    console.log('\nTesting security rules...');

    try {
      // Try to update your document
      await firestore
        .collection('users')
        .doc(yourUid)
        .update({
          friends: firebase.firestore.FieldValue.arrayRemove(friendUid),
        });
      console.log('✅ Successfully updated your document');
    } catch (error) {
      console.error('❌ Failed to update your document:', error);
    }

    try {
      // Try to update friend's document
      await firestore
        .collection('users')
        .doc(friendUid)
        .update({
          friends: firebase.firestore.FieldValue.arrayRemove(yourUid),
        });
      console.log("✅ Successfully updated friend's document");
    } catch (error) {
      console.error("❌ Failed to update friend's document:", error);
      console.error('Error details:', error.code, error.message);
    }

    // Check friendship status after updates
    console.log('\nChecking friendship status after attempted updates...');

    const yourUserDocAfter = await firestore.collection('users').doc(yourUid).get();
    const friendUserDocAfter = await firestore.collection('users').doc(friendUid).get();

    const yourDataAfter = yourUserDocAfter.data();
    const friendDataAfter = friendUserDocAfter.data();

    const yourFriendsAfter = yourDataAfter.friends || [];
    const friendFriendsAfter = friendDataAfter.friends || [];

    console.log('Updated friendship status:');
    console.log(`- You have friend in your list: ${yourFriendsAfter.includes(friendUid)}`);
    console.log(`- Friend has you in their list: ${friendFriendsAfter.includes(yourUid)}`);

    // Final verdict
    if (!yourFriendsAfter.includes(friendUid) && !friendFriendsAfter.includes(yourUid)) {
      console.log('✅ TEST PASSED: Friendship successfully removed on both sides');
    } else if (!yourFriendsAfter.includes(friendUid) && friendFriendsAfter.includes(yourUid)) {
      console.log(
        '❌ TEST FAILED: Friend was removed from your list but you are still in their list'
      );
    } else if (yourFriendsAfter.includes(friendUid) && !friendFriendsAfter.includes(yourUid)) {
      console.log(
        "❌ TEST FAILED: You still have friend in your list but they don't have you in their list"
      );
    } else {
      console.log("❌ TEST FAILED: Friendship wasn't removed on either side");
    }

    console.log('========= FRIENDSHIP TEST COMPLETED =========');
  } catch (error) {
    console.error('Error running test:', error);
  }
};

// Usage:
// testFriendRemoval('yourUserID', 'friendUserID');
// Example: testFriendRemoval('abc123', 'xyz789');
