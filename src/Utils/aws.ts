import AWS from 'aws-sdk';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  region: process.env.AWS_REGION!,
});

/** Prefixes S3 keys when AWS_S3_PREFIX is set (e.g. "local-dev" for local work). */
export const getS3KeyPrefix = (): string => {
  const prefix = process.env.AWS_S3_PREFIX?.trim();
  return prefix ? `${prefix}/` : '';
};

export const uploadToS3 = async (file: Express.Multer.File, folder = 'uploads'): Promise<string> => {
  const fileKey = `${getS3KeyPrefix()}${folder}/${uuidv4()}${path.extname(file.originalname)}`;

  // Upload directly from buffer to S3
  const params = {
    Bucket: process.env.AWS_BUCKET_NAME!,
    Key: fileKey,
    Body: file.buffer, // Use buffer instead of file stream
    ContentType: file.mimetype,
  };

  await s3.upload(params).promise();

  // Return the S3 URL
  return `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileKey}`;
};

// Generate a signed URL for viewing files inline (e.g. images) from S3
export const getSignedViewUrl = (fileUrl: string, expiresIn = 3600): string => {
  const bucketName = process.env.AWS_BUCKET_NAME!;
  const region = process.env.AWS_REGION!;
  const baseUrl = `https://${bucketName}.s3.${region}.amazonaws.com/`;
  const key = fileUrl.replace(baseUrl, '');

  return s3.getSignedUrl('getObject', {
    Bucket: bucketName,
    Key: key,
    Expires: expiresIn,
  });
};

// Generate a signed URL for downloading files from S3
export const getSignedDownloadUrl = (fileUrl: string, fileName: string, expiresIn = 3600): string => {
  // Extract the key from the full S3 URL
  const bucketName = process.env.AWS_BUCKET_NAME!;
  const region = process.env.AWS_REGION!;
  const baseUrl = `https://${bucketName}.s3.${region}.amazonaws.com/`;
  
  const key = fileUrl.replace(baseUrl, '');

  const params = {
    Bucket: bucketName,
    Key: key,
    Expires: expiresIn, // URL expires in 1 hour by default
    ResponseContentDisposition: `attachment; filename="${fileName}"`,
  };

  return s3.getSignedUrl('getObject', params);
};
