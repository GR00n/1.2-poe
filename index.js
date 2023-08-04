import express, { json, urlencoded } from "express";
import { sagedriverCompletion } from "./driverroutes.js";
import { corsMiddleware, rateLimitMiddleware } from "./middlewares.js";
import chalk from "chalk";

import {
 
  SERVER_PORT, 
  SERVER_IP

} from "./config.js";

let app = express();

// Middlewares      
app.use(corsMiddleware);
app.use(rateLimitMiddleware);
app.use(json());
app.use(urlencoded({ extended: true }));

// Register routes
app.all("/", async function (req, res) {
  res.set("Content-Type", "application/json");
  return res.status(200).send({
    status: true,
  });
});


app.post("/v2/driver/sage/chat/completions", sagedriverCompletion);

app.get("/v2/driver/sage/", async function (req, res) {
  res.set("Content-Type", "application/json");
  return res.status(200).send({
    status: true,
    port: SERVER_PORT,
  });
});

app.get("/v2/driver/sage/models", async function (req, res) {
  res.set("Content-Type", "application/json");
  return res.status(200).send({
    "object": "list",
    "data": [
        {
            "id": "ChatGbt",
            "object": "model",
            "created": 1649358449,
            "owned_by": "openai",
            "permission": [
                {
                    "id": "modelperm-49FUp5v084tBB49tC4z8LPH5",
                    "object": "model_permission",
                    "created": 1669085501,
                    "allow_create_engine": false,
                    "allow_sampling": true,
                    "allow_logprobs": true,
                    "allow_search_indices": false,
                    "allow_view": true,
                    "allow_fine_tuning": false,
                    "organization": "*",
                    "group": null,
                    "is_blocking": false
                }
            ],
            "root": "ChatGbt",
            "parent": null
        }

    ]
});

});

app.get("/api/completions", async function (req, res) {
  res.set("Content-Type", "application/json");
  return res.status(200).send({
    "data": [
      {"id": 3},
      {"id": 1},
      {"id": 5},
      {"id": 2},
      {"id": 4}
    ]
  });
});

// Start server
app.listen(SERVER_PORT, () => {
  console.log(`> ${chalk.greenBright(`http://${SERVER_IP}:${SERVER_PORT}/v2/driver/sage \n\n`)}`);
  console.log(`> Waiting for Request...`)
});
