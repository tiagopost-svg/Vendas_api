const multer = require('multer');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});

module.exports = {
  uploadVisitas: upload.fields([
    { name: 'imagem_desenho', maxCount: 1 },
    { name: 'imagem_local', maxCount: 1 },
  ]),
};
