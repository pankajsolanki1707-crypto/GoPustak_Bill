const https = require("https");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const KEY_ID = process.env.RAZORPAY_KEY_ID;
  const KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;

  if (!KEY_ID || !KEY_SECRET) {
    return res.status(500).json({ error: "Razorpay credentials not configured." });
  }

  const { amount, currency = "INR", receipt } = req.body || {};

  if (!amount || isNaN(Number(amount))) {
    return res.status(400).json({ error: "Invalid amount." });
  }

  const amountInPaise = Math.round(Number(amount) * 100);

  const postData = JSON.stringify({
    amount: amountInPaise,
    currency,
    receipt: receipt || `receipt_${Date.now()}`,
  });

  const auth = Buffer.from(`${KEY_ID}:${KEY_SECRET}`).toString("base64");

  try {
    const order = await new Promise((resolve, reject) => {
      const reqRzp = https.request(
        {
          hostname: "api.razorpay.com",
          path: "/v1/orders",
          method: "POST",
          headers: {
            Authorization: `Basic ${auth}`,
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(postData),
          },
        },
        (response) => {
          let data = "";
          response.on("data", (chunk) => (data += chunk));
          response.on("end", () => {
            try {
              const parsed = JSON.parse(data);
              if (response.statusCode >= 200 && response.statusCode < 300) {
                resolve(parsed);
              } else {
                reject(new Error(parsed.error?.description || "Razorpay order creation failed."));
              }
            } catch {
              reject(new Error("Invalid response from Razorpay."));
            }
          });
        }
      );
      reqRzp.on("error", reject);
      reqRzp.write(postData);
      reqRzp.end();
    });

    return res.status(200).json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: KEY_ID,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message || "Failed to create order." });
  }
};
