const jwt = require('jsonwebtoken');
const mysql = require('mysql2/promise');
const Redis = require('ioredis');

const TOKEN_EXPIRY = 172800; // Token expiry time (48 hour)

let connection;
const connectToDatabase = async () => {
    if (!connection) {
        connection = await mysql.createConnection({
            host: 'your-database-host',
            user: 'your-database-user',
            password: 'your-database-password',
            database: 'your-database-name'
        });
    }
    return connection;
};

const formatDate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');

    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

// Initialize Redis client
const redis = new Redis({
    host: 'your_redis_host', // Replace with your Redis host
    port: 6379, // Default Redis port
    password: 'your_redis_password', // Uncomment if your Redis requires authentication
});

// Initialize MySQL connection
const mysqlConfig = {
    host: 'your_mysql_host', // Replace with your MySQL host
    user: 'your_mysql_user', // Replace with your MySQL user
    password: 'your_mysql_password', // Replace with your MySQL password
    database: 'your_database', // Replace with your database name
};

exports.handler = async (event) => {
    //implement API Gateway validation rules
    const { clientId, clientSecret, organizationId } = JSON.parse(event.body);

    // Connect to MySQL
    const db = await connectToDatabase();

    try {
        // Validate client ID and secret in the database
        const [rows] = await db.execute('SELECT t.name FROM client c join tenant t on \
                                        c.tenant_id=t.id WHERE c.client_id = ? AND c.client_secret = ? AND c.organization_id = ?', [clientId, clientSecret, organizationId]);

        if (rows.length === 0) {
            return {
                statusCode: 401,
                body: JSON.stringify({ message: 'Invalid client credentials' }),
            };
        }

        // Generate JWT token
        const token = jwt.sign({ clientId }, clientSecret, {
            expiresIn: TOKEN_EXPIRY,
        });

        // Store the token in the database
        const tenantdbName = "xcl_" + rows[0].name;
        await db.execute('INSERT INTO '+tenantdbName+'.tokens (access_token, expiry) VALUES (?, ?)', [token, formatDate(new Date(Date.now() + TOKEN_EXPIRY * 1000))]);

        // Store the token in Redis with an expiration time
        await redis.setex(`jwt:${clientId}`, TOKEN_EXPIRY, token); // Set to expire in 3600 seconds (1 hour)

        return {
            statusCode: 200,
            body: JSON.stringify({
                accessToken: token,
                expiresIn: TOKEN_EXPIRY,
            }),
        };
    } catch (error) {
        console.error(error);
        return {
            statusCode: 500,
            body: JSON.stringify({ message: 'Internal server error' }),
        };
    } finally {
        await db.end(); // Ensure the database connection is closed
    }
};
