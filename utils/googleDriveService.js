// utils/googleDriveService.js
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

// Configure Google Drive API
const SCOPES = ['https://www.googleapis.com/auth/drive'];

// Create credentials object from environment variables
const createCredentials = () => {
  return {
    type: "service_account",
    project_id: process.env.GOOGLE_CLOUD_PROJECT_ID,
    private_key_id: process.env.GOOGLE_CLOUD_PRIVATE_KEY_ID,
    private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
    client_id: process.env.GOOGLE_CLOUD_CLIENT_ID,
    auth_uri: process.env.GOOGLE_CLOUD_AUTH_URI || "https://accounts.google.com/o/oauth2/auth",
    token_uri: process.env.GOOGLE_CLOUD_TOKEN_URI || "https://oauth2.googleapis.com/token",
    auth_provider_x509_cert_url: process.env.GOOGLE_CLOUD_AUTH_PROVIDER_X509_CERT_URL || "https://www.googleapis.com/oauth2/v1/certs",
    client_x509_cert_url: process.env.GOOGLE_CLOUD_CLIENT_X509_CERT_URL,
    universe_domain: process.env.GOOGLE_CLOUD_UNIVERSE_DOMAIN || "googleapis.com"
  };
};

// Initialize auth client (using service account from environment variables)
const initializeGoogleDrive = () => {
  try {
    // Validate required environment variables
    const requiredEnvVars = [
      'GOOGLE_CLOUD_PROJECT_ID',
      'GOOGLE_CLOUD_PRIVATE_KEY',
      'GOOGLE_CLOUD_CLIENT_EMAIL'
    ];

    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length > 0) {
      throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
    }

    const credentials = createCredentials();
    
    const auth = new google.auth.GoogleAuth({
      credentials: credentials,
      scopes: SCOPES,
    });

    // Initialize drive
    const drive = google.drive({
      version: 'v3',
      auth
    });

    return { auth, drive };
  } catch (error) {
    console.error('Error initializing Google Drive:', error);
    throw error;
  }
};

// Upload file to Google Drive
const uploadFileToDrive = async (fileObject, folderName = 'JobSubmissions') => {
  const { drive } = initializeGoogleDrive();
  
  try {
    // Check if the folder exists or create it
    const folderId = await getOrCreateFolder(drive, folderName);

    // Create file metadata
    const fileMetadata = {
      name: fileObject.originalname || path.basename(fileObject.path),
      parents: [folderId], // Add to folder
    };

    // Create media object
    const media = {
      mimeType: fileObject.mimetype,
      body: fs.createReadStream(fileObject.path)
    };

    // Upload file
    const response = await drive.files.create({
      resource: fileMetadata,
      media: media,
      fields: 'id, webViewLink, webContentLink',
    });

    // Make file viewable by anyone with the link
    await drive.permissions.create({
      fileId: response.data.id,
      requestBody: {
        role: 'reader',
        type: 'anyone',
      },
    });

    // Get updated file with links
    const file = await drive.files.get({
      fileId: response.data.id,
      fields: 'id, webViewLink, webContentLink',
    });

    // Delete local temp file after upload
    if (fs.existsSync(fileObject.path)) {
      fs.unlinkSync(fileObject.path);
    }

    return {
      id: file.data.id,
      name: fileObject.originalname || path.basename(fileObject.path),
      mimeType: fileObject.mimetype,
      size: fileObject.size,
      viewUrl: file.data.webViewLink,
      downloadUrl: file.data.webContentLink,
    };
  } catch (error) {
    console.error('Error uploading to Google Drive:', error);
    
    // Clean up temp file on error
    if (fileObject.path && fs.existsSync(fileObject.path)) {
      try {
        fs.unlinkSync(fileObject.path);
      } catch (unlinkError) {
        console.error('Error cleaning up temp file:', unlinkError);
      }
    }
    
    throw error;
  }
};

// Get or create folder on Google Drive
const getOrCreateFolder = async (drive, folderName) => {
  try {
    // Check if folder already exists
    const response = await drive.files.list({
      q: `mimeType='application/vnd.google-apps.folder' and name='${folderName}' and trashed=false`,
      fields: 'files(id, name)',
    });

    // Return existing folder id if it exists
    if (response.data.files.length > 0) {
      return response.data.files[0].id;
    }

    // Create folder if it doesn't exist
    const fileMetadata = {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
    };

    const folder = await drive.files.create({
      resource: fileMetadata,
      fields: 'id',
    });

    return folder.data.id;
  } catch (error) {
    console.error('Error with Google Drive folder:', error);
    throw error;
  }
};

module.exports = {
  initializeGoogleDrive,
  uploadFileToDrive,
  getOrCreateFolder
};