import Redis from 'ioredis';
import mysql from 'mysql2/promise';
import formidable from 'formidable';
import { v1 as uuidv1 } from 'uuid';
//import { S3Client } from '@aws-sdk/client-s3';
//import { SQSClient } from '@aws-sdk/client-sqs';

// Create clients for S3 and SQS
//const s3 = new S3Client({ region: 'us-east-1' });
//const sqs = new SQSClient({ region: 'us-east-1' });

let connection;
const connectToDatabase = async () => {
    if (!connection) {
        connection = await mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME
        });
    }
    return connection;
};

// Create the Redis connection outside the handler
const redis = new Redis({
    host: process.env.REDIS_HOST, // Replace with your Redis host
    port: process.env.REDIS_PORT, // Default Redis port
    password: process.env.REDIS_PASSWORD, // Uncomment if your Redis requires authentication
});


export const handler = async (event) => {
    const authHeader = event.headers && event.headers.Authorization; // Assuming the token is passed in the Authorization header
    /*
    Implment as API Gateway validation rule
    if (!authHeader) {
        return {
            statusCode: 401,
            body: JSON.stringify({ message: 'Authorization is missing' }),
        };
    }
    */

    // Extract Bearer token (if Bearer token is used)
    const tokenParts = authHeader.split(' ')[1]; // Assuming format is "Bearer <token>"
    if (tokenParts.length !== 2 || tokenParts[0] !== "Bearer") {
        return {
          statusCode: 401,
          body: JSON.stringify({ error: "Invalid authorization header format. Expected 'Bearer <token>'." }),
        };
    }

    // Retrieve orgId from custom header
    const orgId = event.headers && event.headers.orgId;
    /**
     * Implement check for orgId as API Gateway validation rule
     */

    const jobId = event.pathParameters ? event.pathParameters.jobid : null;
    if (jobId && event.httpMethod !== 'GET') {
        return {
            statusCode: 400,
            body: JSON.stringify({
                message: 'Invalid request: jobId should only be provided for GET requests.',
            }),
        };
    }

    // If jobId is not present, it must be a POST request
    if (!jobId && event.httpMethod !== 'POST') {
        return {
            statusCode: 400,
            body: JSON.stringify({
                message: 'Invalid request: POST request is required if jobId is not provided.',
            }),
        };
    }

    const path = event.path; // Get the full request path
    let type = '';
    if (path.includes('content')) {
        type = 'content';
    } else if (path.includes('product')) {
        type = 'product';
    }
    /*
    * Implement as ALB listener rule 
    else {
        return {
            statusCode: 400,
            body: JSON.stringify({ message: 'Invalid path: must contain either "content" or "product".' })
        };
    }
    */

    const accessToken = tokenParts[1];
    // Read a key from Redis
    const key = orgId+':tok';
    const redisToken = await redis.get(key);
    if (redisToken === null || redisToken != accessToken) {
        return {
            statusCode: 400,
            body: JSON.stringify({ message: 'Invalid token' })
        };
    }

    if (jobId) {
        const db = await connectToDatabase();
        const [rows] = await db.query("SELECT t.name FROM tenant t left join client c on t.id=c.tenant_id where c.organization_id='"+orgId+"'");
        if (rows.length > 0) {
            const tenantdbName = "xcl_" + rows[0].name;
            const [rowsD] = await db.query("SELECT process_state FROM "+tenantdbName+"."+type+" where job_id='"+jobID+"' limit 1");
            if (rowsD.length > 0) {
                return {
                    statusCode: 200,
                    body: JSON.stringify({ status: rowsD[0].process_state })
                };
            } else {
                return {
                    statusCode: 400,
                    body: JSON.stringify({ message: 'Invalid JobID' })
                };
            }
        } else {
            return {
                statusCode: 400,
                body: JSON.stringify({ message: 'Invalid Organization' })
            };
        }
    } else {
        const contentType = event.headers['Content-Type'];
        if (contentType.includes('multipart/form-data')) {
            const form = new formidable.IncomingForm();
            form.parse(event, (err, fields, files) => {
                if (err) {
                    callback(null, {
                      statusCode: 500,
                      body: JSON.stringify({ message: 'Error parsing form data' })
                    });
                    return;
                  }
                
                const body = files.file[0];  // Assuming file field is named 'file'
                const ctype = body.type;
            });
        } else {
            const body = event.body;
            const cType = 'application/json';
        }
        const jobId = uuidv1(); // Generate a job ID
        // Upload the JSON data to S3
        const s3Params = {
            Bucket: process.env.BUCKET_NAME, // Your S3 bucket name , configure as Lamda Environment Variables
            Key: `${orgId}/data/${jobId}_${type}.json`, // Unique key for the file
            Body: body,
            ContentType: cType
        };
        const s3Response = await S3.putObject(s3Params).promise();

        // Enqueue the job in SQS with the S3 URL and save jobId in db,  use orgId in sqs consumer to find db
        const params = {
            MessageBody: JSON.stringify({ "jobId" : jobId, "type": `${type}`, "s3Path": `${orgId}/data/${jobId}_${type}.json`, "orgId": orgId }),
            QueueUrl: process.env.QUEUE_URL, // configure as Lamda Environment Variables
        };

        await SQS.sendMessage(params).promise();
    }

};

process.on('exit', () => {
    redis.disconnect();
});
