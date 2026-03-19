const { Readable } = require('stream');
const { google } = require('googleapis');

const getDriveClient = () => {
  const keyFile = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE;

  if (!keyFile) {
    throw new Error('Defina GOOGLE_SERVICE_ACCOUNT_KEY_FILE para habilitar upload no Google Drive.');
  }

  const auth = new google.auth.GoogleAuth({
    keyFile,
    scopes: ['https://www.googleapis.com/auth/drive'],
  });

  return google.drive({ version: 'v3', auth });
};

const uploadFileToDrive = async (file, pastaId, empresaId) => {
  if (!file) {
    return null;
  }

  const drive = getDriveClient();
  const response = await drive.files.create({
    requestBody: {
      name: `${empresaId}-${Date.now()}-${file.originalname}`,
      parents: pastaId ? [pastaId] : undefined,
    },
    media: {
      mimeType: file.mimetype,
      body: Readable.from(file.buffer),
    },
    fields: 'id, webViewLink, webContentLink',
  });

  await drive.permissions.create({
    fileId: response.data.id,
    requestBody: {
      role: 'reader',
      type: 'anyone',
    },
  });

  return {
    fileId: response.data.id,
    webViewLink: response.data.webViewLink,
    webContentLink: response.data.webContentLink,
    publicUrl: `https://drive.google.com/uc?id=${response.data.id}`,
  };
};

module.exports = {
  uploadFileToDrive,
};
