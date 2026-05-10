const { google } = require('googleapis');
const readline = require('readline');

// IMPORTANT: Replace these with your OAuth Client ID and Secret momentarily
// OR you can set them as ENVs before running node scripts/generate-google-token.js
const CLIENT_ID = process.argv[2];
const CLIENT_SECRET = process.argv[3];

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.log('Usage: node scripts/generate-google-token.js <CLIENT_ID> <CLIENT_SECRET>');
  process.exit(1);
}

const REDIRECT_URI = 'http://localhost:3000'; // Must match the authorized redirect URI in Google Cloud Console

const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline', // CRITICAL: Request a Refresh Token
  prompt: 'consent',     // Forces the consent screen to ensure refresh token is provided
  scope: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
});

console.log('\n==================================================================');
console.log('1. Mở đường dẫn sau trong trình duyệt để đăng nhập bằng Gmail của bạn:');
console.log('==================================================================\n');
console.log(authUrl);
console.log('\n==================================================================');
console.log('2. Sau khi đăng nhập và chấp nhận quyền, trình duyệt sẽ chuyển hướng tới URL localhost.');
console.log('   Nó sẽ hiện trang lỗi (ví dụ: localhost từ chối kết nối). KỆ NÓ.');
console.log('3. Hãy COPY đoạn mã ở phía sau chữ "?code=" trên thanh địa chỉ.');
console.log('==================================================================\n');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

rl.question('Dán đoạn mã "code" vào đây và bấm Enter: ', async (code) => {
  rl.close();
  try {
    const { tokens } = await oauth2Client.getToken(code);
    console.log('\n🎉 THÀNH CÔNG! Sao chép các thông tin này vào file .env.local:\n');
    console.log(`GOOGLE_CLIENT_ID=${CLIENT_ID}`);
    console.log(`GOOGLE_CLIENT_SECRET=${CLIENT_SECRET}`);
    console.log(`GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}`);
    console.log('\nLưu ý: Đừng tiết lộ REFRESH_TOKEN cho người khác.');
  } catch (error) {
    console.error('\n❌ Có lỗi xảy ra khi lấy Token:', error.message);
  }
});
