const { warmUp } = require('./src/services/faceVerification.service');

warmUp()
  .then(() => console.log('✅ Face API ready'))
  .catch(err => console.error('❌ Error:', err.message));