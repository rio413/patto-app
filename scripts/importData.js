// 必要なツールをインポート
const admin = require('firebase-admin');
// ↓ あなたのファイル名に書き換えました！
const serviceAccount = require('../patto-gym-firebase-adminsdk-fbsvc-3d88e2514c.json');
const questions = require('../data/questions.json');

// Firebaseの初期化
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const questionsCollection = db.collection('questions');

// データを一括で登録
const importData = async () => {
  console.log('データのインポートを開始します...');
  for (const question of questions) {
    // 各質問のIDをドキュメントIDとして設定
    await questionsCollection.doc(question.id).set(question);
    console.log(`${question.id} をインポートしました。`);
  }
  console.log('データのインポートが完了しました。');
};

importData().catch(error => console.error(error));