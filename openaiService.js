const OpenAI = require("openai");
const fs = require("fs");
const path = require("path");

class OpenAIService {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    this.assistantId = process.env.OPENAI_ASSISTANT_ID;
  }

  async syncProducts(products) {
    // Save products to a temporary JSON file
    const filePath = path.join(__dirname, "products.json");
    fs.writeFileSync(filePath, JSON.stringify(products, null, 2));

    // Upload file to OpenAI
    const file = await this.openai.files.create({
      file: fs.createReadStream(filePath),
      purpose: "assistants",
    });

    // Create or update Assistant
    if (!this.assistantId) {
      const assistant = await this.openai.beta.assistants.create({
        name: "Order Parser Bot",
        instructions: `You are an order parsing assistant for a bakery. Your primary goal is to extract order details from Slack messages and map them to the correct system products.

        System Products Data: You have access to a 'products.json' file via file_search. This file contains a list of products, each with multiple sizes, IDs, and prices.

        Parsing Rules:
        1. **Customer Info**: Extract name and phone number.
        2. **Address**: Identify if it's a "Pickup" or "Delivery". 
           - If Pickup, identify the store (Lekki or Opebi). 
           - If Delivery, extract the full address.
        3. **Items**: Identify each product, its size (Mini, Midi, Regular, Maxi, Extra Large), and quantity.
        4. **Matching & Ambiguity**:
           - You MUST find an exact or very close match for both the Product Name AND the Size in the system products.
           - If a product name is mentioned but the size is missing, it is AMBIGUOUS.
           - If a product name is mentioned but doesn't exist in the system, it is NOT FOUND.
           - If there is any doubt or multiple potential matches, it is AMBIGUOUS.
        5. **Calculations**:
           - Total Amount: Sum of all items + Delivery fee (if mentioned).
           - Line Item Price: quantity * unit_price (from system).

        Output Format:
        Return ONLY a JSON object. No conversational text.
        
        Successful Match:
        {
          "status": "success",
          "data": {
            "customer": { "name": "...", "phoneNumber": "..." },
            "order": {
              "amount": total_number,
              "specialNote": "...",
              "items": [
                { "productId": "uuid", "quantity": number, "price": total_line_item_price }
              ]
            },
            "address": {
              "deliveryAddress": "...",
              "isPickup": boolean,
              "pickupStore": "Lekki/Opebi/null"
            }
          }
        }

        Ambiguity or Missing Product:
        {
          "status": "error",
          "message": "One or more products in the order were not found in the system. [Specify which product/size is missing or ambiguous]"
        }
        `,
        model: "gpt-4o-mini",
        tools: [{ type: "file_search" }],
      });
      this.assistantId = assistant.id;
      console.log(`Created new assistant: ${this.assistantId}`);
    }

    // Create a new vector store for the updated products
    const vectorStore = await this.openai.vectorStores.create({
      name: "System Products",
      file_ids: [file.id],
    });

    // Update assistant to use the new vector store
    await this.openai.beta.assistants.update(this.assistantId, {
      tool_resources: { file_search: { vector_store_ids: [vectorStore.id] } },
    });

    // Optional: Delete old vector stores if you want to keep it clean.
    // For now, we'll just log the new one.
    console.log(`Updated AI memory with new vector store: ${vectorStore.id}`);

    return this.assistantId;
  }

  async parseOrder(message) {
    const thread = await this.openai.beta.threads.create();
    await this.openai.beta.threads.messages.create(thread.id, {
      role: "user",
      content: message,
    });

    const run = await this.openai.beta.threads.runs.createAndPoll(thread.id, {
      assistant_id: this.assistantId,
    });

    if (run.status === "completed") {
      const messages = await this.openai.beta.threads.messages.list(thread.id);
      const lastMessage = messages.data[0].content[0].text.value;

      // Extract JSON from the response (Assistant might wrap it in code blocks)
      const jsonMatch = lastMessage.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    }

    return { status: "error", message: "Failed to parse order" };
  }
}

module.exports = new OpenAIService();
