"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const dotenv_1 = __importDefault(require("dotenv"));
const db_1 = __importDefault(require("./config/db"));
// .env ෆයිල් එකේ දත්ත කෝඩ් එකට කියවන්න ඉඩ දීම
dotenv_1.default.config();
// Database එකට සම්බන්ධ වීම (අපි කලින් හදපු ෆයිල් එක හරහා)
(0, db_1.default)();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 5000;
// JSON දත්ත කියවන්න ඉඩ දීම
app.use(express_1.default.json());
// මූලික API Route එකක් (පරීක්ෂා කිරීම සඳහා)
app.get('/', (req, res) => {
    res.send('Food Ordering API is running...');
});
// Server එක Start කිරීම
app.listen(PORT, () => {
    console.log(`🚀 Server is running on port ${PORT}`);
});
