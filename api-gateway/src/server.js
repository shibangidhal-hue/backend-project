
const express = require("express");
const dotenv = require("dotenv");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

app.use(express.json());

app.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "API Gateway is running successfully",
    service: "api-gateway"
  });
});

app.listen(PORT, () => {
  console.log(`API Gateway running on port ${PORT}`);
});
