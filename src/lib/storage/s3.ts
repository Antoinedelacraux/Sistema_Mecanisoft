import { optionalCjsImport } from '../utils/optional-import'

// Minimal S3 helper that lazily loads the AWS SDK to avoid forcing the dependency for every install.
type LoadedS3Sdk = {
  client: any
  PutObjectCommand: any
  GetObjectCommand: any
  DeleteObjectCommand: any
  getSignedUrl: (...args: any[]) => Promise<string>
}

let cachedSdk: LoadedS3Sdk | null = null

async function getS3Client() {
  if (cachedSdk) return cachedSdk

  const s3Module = await optionalCjsImport<any>('@aws-sdk/client-s3')
  const presignerModule = await optionalCjsImport<any>('@aws-sdk/s3-request-presigner')
  if (!s3Module || !presignerModule) {
    throw new Error('Using S3 helpers requires installing @aws-sdk/client-s3 and @aws-sdk/s3-request-presigner')
  }

  const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = s3Module
  const { getSignedUrl } = presignerModule
  const client = new S3Client({
    region: process.env.S3_REGION,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY || '',
      secretAccessKey: process.env.S3_SECRET_KEY || '',
    },
  })

  cachedSdk = { client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, getSignedUrl }
  return cachedSdk
}

export async function uploadFileToS3(key: string, body: Uint8Array | Buffer | string, contentType = 'application/octet-stream') {
  if (!process.env.S3_BUCKET) throw new Error('S3_BUCKET not configured')
  const { client, PutObjectCommand } = await getS3Client()
  const cmd = new PutObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key, Body: body, ContentType: contentType })
  const res = await client.send(cmd)
  return res
}

export async function getPresignedUrlForKey(key: string, expiresInSeconds = 60 * 60) {
  if (!process.env.S3_BUCKET) throw new Error('S3_BUCKET not configured')
  const { client, GetObjectCommand, getSignedUrl } = await getS3Client()
  const cmd = new GetObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key })
  const url = await getSignedUrl(client, cmd, { expiresIn: expiresInSeconds })
  return url
}

export async function deleteFileFromS3(key: string) {
  if (!process.env.S3_BUCKET) throw new Error('S3_BUCKET not configured')
  const { client, DeleteObjectCommand } = await getS3Client()
  const cmd = new DeleteObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key })
  const res = await client.send(cmd)
  return res
}

export default { uploadFileToS3, getPresignedUrlForKey }
