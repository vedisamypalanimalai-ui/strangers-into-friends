/**
 * End-to-End System Integration Test Suite
 */
const axios = require('axios');
const http = require('http');

async function runTestSuite() {
  // Set mock mode for local test
  process.env.USE_LOCAL_MOCK_DB = 'true';
  process.env.PORT = '3001';

  const { server } = require('../server.js');
  const BASE_URL = 'http://localhost:3001';

  console.log('\n🧪 --- STARTING STRANGERS INTO FRIENDS AUTOMATED TEST SUITE --- 🧪\n');

  try {
    // Wait for server to bind
    await new Promise(r => setTimeout(r, 1000));

    // 1. Health check
    console.log('1. Testing Health Endpoint: GET /api/health');
    const healthRes = await axios.get(`${BASE_URL}/api/health`);
    console.log('   Status:', healthRes.data.status, '| Platform:', healthRes.data.platform);
    if (healthRes.data.status !== 'healthy') throw new Error('Health check failed');

    const suffix = Date.now().toString().slice(-4);
    const aliceUser = `alice_${suffix}`;
    const bobUser = `bob_${suffix}`;
    const aliceEmail = `alice_${suffix}@example.com`;
    const bobEmail = `bob_${suffix}@example.com`;

    // 2. Register Alice (18+)
    console.log('2. Registering Alice: POST /api/auth/register');
    const aliceRes = await axios.post(`${BASE_URL}/api/auth/register`, {
      fullName: 'Alice Walker',
      username: aliceUser,
      mobile: '+15551112222',
      email: aliceEmail,
      password: 'AlicePassword123!',
      dateOfBirth: '2000-05-15',
      gender: 'Female',
      bio: 'Loves music and making new friends.'
    });
    console.log('   Alice registered! ID:', aliceRes.data.user.UserID);
    const aliceToken = aliceRes.data.token;
    const aliceId = aliceRes.data.user.UserID;

    // 3. Register Bob (18+)
    console.log('3. Registering Bob: POST /api/auth/register');
    const bobRes = await axios.post(`${BASE_URL}/api/auth/register`, {
      fullName: 'Bob Dylan',
      username: bobUser,
      mobile: '+15553334444',
      email: bobEmail,
      password: 'BobPassword123!',
      dateOfBirth: '1998-10-20',
      gender: 'Male',
      bio: 'Guitar player and stranger explorer.'
    });
    console.log('   Bob registered! ID:', bobRes.data.user.UserID);
    const bobToken = bobRes.data.token;
    const bobId = bobRes.data.user.UserID;

    // 4. Test Login with Alice
    console.log('4. Logging in Alice: POST /api/auth/login');
    const loginRes = await axios.post(`${BASE_URL}/api/auth/login`, {
      identifier: aliceUser,
      password: 'AlicePassword123!'
    });
    console.log('   Alice login successful! Role:', loginRes.data.user.Role);

    // 5. User Search (Alice searches for bob)
    console.log(`5. Searching Users: GET /api/users/search?q=${bobUser}`);
    const searchRes = await axios.get(`${BASE_URL}/api/users/search?q=${bobUser}`, {
      headers: { Authorization: `Bearer ${aliceToken}` }
    });
    console.log('   Users found:', searchRes.data.users.length);

    // 6. Alice sends friend request to Bob
    console.log('6. Alice sends friend request to Bob: POST /api/friends/requests');
    const reqRes = await axios.post(`${BASE_URL}/api/friends/requests`, 
      { receiverId: bobId },
      { headers: { Authorization: `Bearer ${aliceToken}` } }
    );
    console.log('   Friend request sent! RequestID:', reqRes.data.request.RequestID);
    const requestId = reqRes.data.request.RequestID;

    // 7. Bob checks incoming requests
    console.log('7. Bob checks incoming friend requests: GET /api/friends/requests');
    const bobReqs = await axios.get(`${BASE_URL}/api/friends/requests`, {
      headers: { Authorization: `Bearer ${bobToken}` }
    });
    console.log('   Bob incoming requests:', bobReqs.data.received.length);

    // 8. Bob accepts Alice's request
    console.log('8. Bob accepts friend request: POST /api/friends/requests/respond');
    const acceptRes = await axios.post(`${BASE_URL}/api/friends/requests/respond`,
      { requestId: requestId, action: 'accept' },
      { headers: { Authorization: `Bearer ${bobToken}` } }
    );
    console.log('   Request accepted:', acceptRes.data.message);

    // 9. Alice checks friends list
    console.log('9. Alice retrieves friends list: GET /api/friends');
    const friendsRes = await axios.get(`${BASE_URL}/api/friends`, {
      headers: { Authorization: `Bearer ${aliceToken}` }
    });
    console.log('   Alice has', friendsRes.data.friends.length, 'friends. Friend name:', friendsRes.data.friends[0].FullName);

    // 10. Alice sends a message to Bob
    console.log('10. Alice sends chat message to Bob: POST /api/chat/messages');
    const msgRes = await axios.post(`${BASE_URL}/api/chat/messages`,
      {
        receiverId: bobId,
        content: 'Hey Bob! Nice to turn from strangers into friends! 😊',
        messageType: 'text'
      },
      { headers: { Authorization: `Bearer ${aliceToken}` } }
    );
    console.log('   Message sent! MessageID:', msgRes.data.message.MessageID);
    const convId = msgRes.data.message.ConversationID;

    // 11. Bob reads messages in conversation
    console.log('11. Bob reads messages in conversation: GET /api/chat/conversations/:id/messages');
    const convMsgs = await axios.get(`${BASE_URL}/api/chat/conversations/${convId}/messages`, {
      headers: { Authorization: `Bearer ${bobToken}` }
    });
    console.log('   Retrieved messages:', convMsgs.data.messages.length, '| Content:', convMsgs.data.messages[0].Content);

    // 12. Admin checks platform stats
    console.log('12. Admin logs in and checks stats: POST /api/auth/login');
    const adminLoginRes = await axios.post(`${BASE_URL}/api/auth/login`, {
      identifier: 'admin@strangersintofriends.com',
      password: 'AdminSecurePass2026!'
    });
    const adminToken = adminLoginRes.data.token;

    console.log('13. Admin fetches stats: GET /api/admin/stats');
    const adminStats = await axios.get(`${BASE_URL}/api/admin/stats`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    console.log('   Admin stats:', adminStats.data.stats);

    // 14. Verify all HTML pages are served correctly
    console.log('14. Checking HTML pages availability...');
    const pages = ['index.html', 'signup.html', 'login.html', 'dashboard.html', 'chat.html', 'profile.html', 'friends.html', 'settings.html', 'admin.html'];
    for (const page of pages) {
      const pageRes = await axios.get(`${BASE_URL}/${page}`);
      if (pageRes.status !== 200) throw new Error(`Failed to load ${page}`);
    }
    console.log('   All 9 HTML pages verified successfully (200 OK)!');

    console.log('\n🎉 ========================================================= 🎉');
    console.log('🎉 ALL INTEGRATION TESTS PASSED WITH 100% SUCCESS!           🎉');
    console.log('🎉 ========================================================= 🎉\n');

  } catch (err) {
    console.error('❌ Test suite failed:', err.response ? err.response.data : err.message);
    process.exit(1);
  } finally {
    server.close();
    process.exit(0);
  }
}

runTestSuite();
