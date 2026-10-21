import { S3Client, HeadBucketCommand, CreateBucketCommand, PutBucketCorsCommand } from '@aws-sdk/client-s3';

const client = new S3Client({
  endpoint: process.env.S3_INTERNAL_ENDPOINT,
  region: process.env.S3_REGION || 'us-east-1',
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY,
    secretAccessKey: process.env.S3_SECRET_KEY,
  },
});
const Bucket = process.env.S3_BUCKET || 'qchat-private';
for (let attempt = 0; attempt < 30; attempt++) {
  try {
    try {
      await client.send(new HeadBucketCommand({ Bucket }));
    } catch (error) {
      if (error.$metadata?.httpStatusCode !== 404) throw error;
      await client.send(new CreateBucketCommand({ Bucket }));
    }
    // New buckets are private; no public read/write policy is installed.
    await client.send(new PutBucketCorsCommand({
      Bucket,
      CORSConfiguration: { CORSRules: [{
        AllowedOrigins: [process.env.WEB_ORIGIN],
        AllowedMethods: ['GET', 'PUT', 'HEAD'],
        AllowedHeaders: ['*'],
        ExposeHeaders: ['ETag'],
        MaxAgeSeconds: 3600,
      }] },
    }));
    console.log('Private media bucket is ready');
    break;
  } catch (error) {
    if (attempt === 29) throw error;
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
}
client.destroy();
