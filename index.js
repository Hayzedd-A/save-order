const dotenv = require("dotenv");
dotenv.config();

const { App } = require("@slack/bolt");
const cron = require("node-cron");
const SystemProducts = require("./systemProducts");
const openaiService = require("./openaiService");

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  socketMode: true,
  appToken: process.env.SLACK_APP_TOKEN,
});

async function syncProductsWithAI() {
  try {
    console.log("Fetching system products...");
    const products = await SystemProducts.fetchProducts();

    if (products && products.length > 0) {
      console.log(`Syncing ${products.length} products with AI memory...`);
      const assistantId = await openaiService.syncProducts(products);
      console.log(`AI memory synced. Assistant ID: ${assistantId}`);
    } else {
      console.warn("No products found to sync.");
    }
  } catch (error) {
    console.error("Error during product sync:", error);
  }
}

// Listen for mentions
app.event("app_mention", async ({ event, say }) => {
  try {
    const messageText = event.text.replace(/<@.*?>/, "").trim();
    if (!messageText) {
      await say("How can I help you today? Please provide your order.");
      return;
    }

    if (messageText.toLowerCase() === "bot -version") {
      await say("1.0.0");
      return;
    }

    await say("Processing your order... ⏳");

    const result = await openaiService.parseOrder(messageText);

    if (result.status === "success") {
      const orderPayload = result.data;
      const response = await SystemProducts.createOrder(orderPayload);

      if (response && response.status !== "error") {
        await say(
          `✅ Order successfully posted to Zupa!\nCustomer: ${orderPayload.customer.name}\nTotal: ${orderPayload.order.amount}`,
        );
      } else {
        await say(
          `❌ Failed to post order to Zupa: ${response?.message || "Unknown error"}`,
        );
      }
    } else {
      await say(`⚠️ ${result.message}`);
    }
  } catch (error) {
    console.error("Error handling app_mention:", error);
    await say(
      "An error occurred while processing your order. Please try again later.",
    );
  }
});

(async () => {
  try {
    // Initial sync on startup
    await syncProductsWithAI();

    // Schedule daily sync at midnight
    cron.schedule("0 0 * * *", async () => {
      console.log("Running scheduled daily product sync...");
      await syncProductsWithAI();
    });

    await app.start();
    console.log("⚡️ Slack bot is running!");
  } catch (error) {
    console.error("Error starting app:", error);
  }
})();
