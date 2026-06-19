const express = require('express');
const router = express.Router();
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');

const s3 = new S3Client({
  region: 'auto',
  endpoint: process.env.BUCKET_ENDPOINT,
  credentials: {
    accessKeyId: process.env.BUCKET_ACCESS_KEY_ID,
    secretAccessKey: process.env.BUCKET_SECRET_ACCESS_KEY
  },
  forcePathStyle: true
});

const BUCKET = process.env.BUCKET_NAME;

router.get('/:filename', async (req, res) => {
  try {
    const { filename } = req.params;
    const allowed = ['titulo.png', 'BANNER1_1-2.png', 'CAPA2_3.png', 'all_2.png'];

    if (!allowed.includes(filename)) {
      return res.status(404).send('Not found');
    }

    const command = new GetObjectCommand({ Bucket: BUCKET, Key: filename });
    const response = await s3.send(command);

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    response.Body.pipe(res);
  } catch (err) {
    console.error('Image proxy error:', err.message);
    res.status(500).send('Error');
  }
});

module.exports = router;
