const request = require("supertest");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const app = require("../index"); // Import the app

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();

  // Disconnect if already connected (e.g. from index.js)
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  await mongoose.connect(uri);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

afterEach(async () => {
  // Clean up database between tests
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    const collection = collections[key];
    await collection.deleteMany();
  }
});

describe("User API", () => {
  describe("POST /api/users/register", () => {
    it("should register a new user successfully", async () => {
      const res = await request(app).post("/api/users/register").send({
        username: "testuser",
        email: "test@example.com",
        password: "password123",
      });

      expect(res.statusCode).toEqual(201);
      expect(res.body).toHaveProperty("token");
      expect(res.body.message).toBe("User registered successfully");
    });

    it("should not register a user with an existing email", async () => {
      // First registration
      await request(app).post("/api/users/register").send({
        username: "user1",
        email: "duplicate@example.com",
        password: "password123",
      });

      // Second registration with same email
      const res = await request(app).post("/api/users/register").send({
        username: "user2",
        email: "duplicate@example.com",
        password: "password456",
      });

      expect(res.statusCode).toEqual(400);
      expect(res.body.error).toBe("Email already in use");
    });

    it("should fail registration without required fields", async () => {
      const res = await request(app).post("/api/users/register").send({
        username: "testuser",
        // Missing email and password
      });
      // Expect 400 or 500 depending on validation
      // Based on code reading, mongoose validation or express-validator will catch it
      expect(res.statusCode).not.toEqual(201);
    });
  });

  describe("POST /api/users/login", () => {
    beforeEach(async () => {
      // Create a user for login tests
      await request(app).post("/api/users/register").send({
        username: "loginuser",
        email: "login@example.com",
        password: "password123",
      });
    });

    it("should login with valid credentials", async () => {
      const res = await request(app).post("/api/users/login").send({
        email: "login@example.com",
        password: "password123",
      });

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty("token");
    });

    it("should not login with invalid password", async () => {
      const res = await request(app).post("/api/users/login").send({
        email: "login@example.com",
        password: "wrongpassword",
      });

      expect(res.statusCode).toEqual(401);
      expect(res.body.error).toBe("Invalid email or password");
    });

    it("should not login with non-existent email", async () => {
      const res = await request(app).post("/api/users/login").send({
        email: "nonexistent@example.com",
        password: "password123",
      });

      expect(res.statusCode).toEqual(401);
      expect(res.body.error).toBe("Invalid email or password");
    });
  });
});
