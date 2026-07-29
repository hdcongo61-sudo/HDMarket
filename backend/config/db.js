import mongoose from 'mongoose';

const connectDB = async () => {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    throw new Error('MONGO_URI is undefined. Set it in .env or platform env vars.');
  }

  // Connection options to handle DNS and network issues
  const options = {
    serverSelectionTimeoutMS: 10000, // 10 seconds timeout
    socketTimeoutMS: 45000, // 45 seconds socket timeout
    connectTimeoutMS: 10000, // 10 seconds connection timeout
    maxPoolSize: 25, // Up to 25 concurrent DB operations
    minPoolSize: 4,  // Keep at least 4 warm connections
    retryWrites: true,
    retryReads: true,
    // Force direct connection if DNS issues persist
    directConnection: false,
    // Use IPv4 if DNS resolution fails
    family: 4
  };

  try {
    console.log('Attempting to connect to MongoDB...');
    const conn = await mongoose.connect(uri, options);
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    console.log(`   Database: ${conn.connection.name}`);
    
    // Handle connection events
    mongoose.connection.on('error', (err) => {
      console.error('❌ MongoDB connection error:', err.message);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('⚠️  MongoDB disconnected');
    });

    mongoose.connection.on('reconnected', () => {
      console.log('✅ MongoDB reconnected');
    });

    return conn;
  } catch (error) {
    console.error('❌ MongoDB connection failed:');
    console.error('   Error:', error.message);
    console.error('   Code:', error.code);
    
    // Provide helpful error messages
    if (error.code === 'EREFUSED' || error.message.includes('EREFUSED')) {
      console.error('\n💡 Troubleshooting tips:');
      console.error('   1. Check your internet connection');
      console.error('   2. Verify MongoDB Atlas IP whitelist includes your IP (0.0.0.0/0 for all)');
      console.error('   3. Check if your firewall/network blocks MongoDB connections');
      console.error('   4. Try using the standard connection string format:');
      console.error('      mongodb+srv://username:password@cluster.mongodb.net/dbname?retryWrites=true&w=majority');
      console.error('   5. If using VPN, try disconnecting or using a different network');
    } else if (error.message.includes('authentication')) {
      console.error('\n💡 Authentication error:');
      console.error('   1. Verify your MongoDB username and password are correct');
      console.error('   2. Check if the database user has proper permissions');
    } else if (error.message.includes('ENOTFOUND') || error.message.includes('getaddrinfo')) {
      console.error('\n💡 DNS resolution error:');
      console.error('   1. Check your DNS settings');
      console.error('   2. Try using 8.8.8.8 or 1.1.1.1 as DNS server');
      console.error('   3. Verify the MongoDB connection string is correct');
    }
    
    throw error;
  }
};

export default connectDB;
