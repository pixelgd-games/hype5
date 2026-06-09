const express = require("express");

function createHealthRoutes() {
  const router = express.Router();

  router.get("/health", (req, res) => {
    res.send("ok");
  });

  router.get("/status", (req, res) => {
    res.send("Hype5 Server Running");
  });

  return router;
}

module.exports = {
  createHealthRoutes
};
