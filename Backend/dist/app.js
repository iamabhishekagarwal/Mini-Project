"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const zod_1 = __importDefault(require("zod"));
const client_1 = require("@prisma/client");
const cors_1 = __importDefault(require("cors"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const bcrypt_1 = __importDefault(require("bcrypt"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const dotenv_1 = __importDefault(require("dotenv"));
const Auth_1 = __importDefault(require("./Middlewares/Auth"));
const Dataset_1 = require("./Dataset");
const userRoute = (0, express_1.default)();
const prisma = new client_1.PrismaClient();
const userSchema = zod_1.default.object({
    username: zod_1.default.string().optional(),
    email: zod_1.default.string().email(),
    password: zod_1.default.string().min(8, "Password must be of min 8 letters"),
});
dotenv_1.default.config();
const jwt_secret_key = process.env.JWT_SECRET_KEY;
userRoute.use(express_1.default.json());
userRoute.use((0, cookie_parser_1.default)());
userRoute.use((0, cors_1.default)({
    credentials: true,
    origin: "http://localhost:5173",
    methods: ["POST", "PUT", "GET", "OPTIONS", "HEAD"],
}));
userRoute.use(express_1.default.urlencoded({ extended: true }));
userRoute.get("/", Auth_1.default, (req, res) => {
    res.send("Hello world");
});
userRoute.post("/api/signin", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { email, password } = req.body;
    // Validate input using Zod schema
    const inputValidation = userSchema.safeParse({ email, password });
    console.log(inputValidation);
    if (!inputValidation.success) {
        res.status(400).send("Invalid email or password " + inputValidation);
    }
    else {
        try {
            // Find the user by email
            const user = yield prisma.user.findUnique({
                where: {
                    email: email,
                },
            });
            if (!user) {
                res.status(404).send("User not found");
            }
            else {
                // Validate password
                const isPasswordValid = yield bcrypt_1.default.compare(password, user.password);
                if (!isPasswordValid) {
                    res.status(400).send("Invalid Password");
                }
                else {
                    // Generate JWT token
                    const token = jsonwebtoken_1.default.sign({
                        id: user.id,
                    }, jwt_secret_key, { expiresIn: "1h" });
                    // Set token as a cookie
                    res.cookie("token", token, {
                        maxAge: 60 * 60 * 1000,
                        httpOnly: true,
                        path: "/",
                        sameSite: "lax",
                    });
                    res.status(200).send("logged in");
                }
            }
        }
        catch (error) {
            console.log(error);
            res.status(500).send("Error signing in");
        }
    }
}));
userRoute.post("/api/signup", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { username, email, password } = req.body;
    const inputValidation = userSchema.safeParse({ username, email, password });
    if (!inputValidation.success) {
        res.status(400).send("Invalid username,email or password");
    }
    else {
        try {
            const user = yield prisma.user.findUnique({
                where: {
                    email,
                },
            });
            if (user) {
                res.status(409).send("Already have an account");
            }
            else {
                const hashPassword = yield bcrypt_1.default.hash(password, 10);
                const response = yield prisma.user.create({
                    data: {
                        username,
                        email,
                        password: hashPassword,
                    },
                });
                const token = jsonwebtoken_1.default.sign({ id: response.id }, jwt_secret_key, {
                    expiresIn: "1h",
                });
                res.cookie("token", token, {
                    maxAge: 60 * 60 * 1000,
                    httpOnly: true,
                    sameSite: "lax",
                    path: "/",
                });
                res.status(201).send("User created successfully");
            }
        }
        catch (e) {
            res.status(500).send("Error creating a new user");
        }
    }
}));
userRoute.post("/api/logout", (req, res) => {
    res.clearCookie("token");
    res.status(200).send("Logged out");
});
userRoute.get("/api/verifyToken", (req, res) => {
    const token = req.cookies.token;
    if (!token) {
        res.status(401).send("No token provided");
    }
    else {
        try {
            const decode = jsonwebtoken_1.default.verify(token, jwt_secret_key);
            console.log(decode);
            res.status(200).json(decode);
        }
        catch (e) {
            res.status(403).send("Invalid Token");
        }
    }
});
userRoute.get("/api/getUser", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.query; // Use req.query to get the id from query parameters
    // Check if ID is provided
    if (!id) {
        res.status(400).json({ message: "ID is required" });
    }
    else {
        try {
            const user = yield prisma.user.findUnique({
                where: {
                    id: Number(id), // Convert id to number
                },
            });
            if (!user) {
                res.status(404).json({ message: "User not found" });
            }
            else {
                res.json(user);
            }
        }
        catch (e) {
            console.error("Error fetching user:", e);
            res.status(500).json({ message: "Error fetching user" });
        }
    }
}));
userRoute.post("/api/dataset", Auth_1.default, (req, res) => {
    const { subject, topic } = req.body;
    let questions = [];
    let topicFound = false;
    console.log(subject + "\t" + topic);
    if (subject === "physics") {
        const keys = Object.keys(Dataset_1.jeeQuestions.Physics);
        keys.forEach((key) => {
            if (key == topic) {
                topicFound = true;
                const topicKeys = Object.keys(Dataset_1.jeeQuestions.Physics[topic]);
                topicKeys.forEach((element) => {
                    const topicKey = topic;
                    const data = Dataset_1.jeeQuestions.Physics[topicKey];
                    const value = data[element];
                    questions = questions.concat(value);
                });
            }
        });
    }
    else if (subject == "chemistry") {
        const keys = Object.keys(Dataset_1.jeeQuestions.Chemistry);
        keys.forEach((key) => {
            if (key == topic) {
                topicFound = true;
                const getKeys = Object.keys(Dataset_1.jeeQuestions.Chemistry[topic]);
                getKeys.forEach((item) => {
                    const topicKey = topic;
                    const data = Dataset_1.jeeQuestions.Chemistry[topicKey];
                    const value = data[item];
                    questions = questions.concat(value);
                });
            }
        });
    }
    else if (subject === "maths") {
    }
    else if (subject === "JEE") {
        const subjects = Object.keys(Dataset_1.jeeQuestions);
        subjects.forEach((subjectKey) => {
            const subjectName = Dataset_1.jeeQuestions[subjectKey];
            const topics = Object.keys(subjectName);
            topics.forEach((topicKey) => {
                const topicData = subjectName[topicKey];
                const yearKeys = Object.keys(topicData);
                yearKeys.forEach((year) => {
                    if (year === "JEE2024" && topic === "2024") {
                        topicFound = true;
                        const data = topicData[year];
                        questions = questions.concat(data);
                    }
                    else if (year === "JEE2023" && topic === "2023") {
                        topicFound = true;
                        const data = topicData[year];
                        questions = questions.concat(data);
                    }
                });
            });
        });
    }
    if (!topicFound) {
        res.json({ msg: "Topic not found" });
    }
    else {
        questions = questions.map((question, index) => (Object.assign(Object.assign({}, question), { id: index + 1 })));
        res.json(questions);
    }
});
// userRoute.use(AuthTokenCheck);
userRoute.listen(3000, () => {
    console.log("app listening to port ", 3000);
});
