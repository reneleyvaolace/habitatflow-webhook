{
  "functions": {
    "api/webhook.js": { "runtime": "nodejs18.x" }
  },
  "rewrites": [
    {
      "source": "/api/webhook",
      "destination": "/api/webhook.js"
    }
  ]
}
