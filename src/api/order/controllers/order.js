"use strict";

/**
 * order controller
 */

const { createCoreController } = require("@strapi/strapi").factories;
// @ts-ignore
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
module.exports = createCoreController("api::order.order", ({ strapi }) => ({
  // Method 1: Creating an entirely custom action
  async customOrderController(ctx) {
    // console.log("hello");
    try {
      const bodyData = ctx.body;
      const entries = await strapi.entityService.findMany(
        `api::product.product`,
        {
          fields: ["title"],
          limit: 2,
        }
      );
      return { data: entries };
    } catch (err) {
      console.log(err);
    }
  },
  async create(ctx) {
    try {
      // console.log(ctx);
      const { products } = ctx.request.body;
      // console.log(products);
      const lineItems = await Promise.all(
        products.map(async (product) => {
          const productEntities = await strapi.entityService.findMany(
            "api::product.product",
            {
              filters: {
                key: product.key,
              },
            }
          );
          const realProduct = productEntities[0];
          const image = product.image;
          return {
            price_data: {
              currency: "inr",
              product_data: {
                name: product.title,
                images: [image],
              },
              unit_amount: realProduct.price * 100,
            },
            quantity: product.quantity,
          };
        })
      );
      console.log(process.env.CLIENT_BASE_URL);
      const session = await stripe.checkout.sessions.create({
        shipping_address_collection: {
          allowed_countries: ["IN"],
        },
        line_items: lineItems,

        mode: "payment",
        success_url: `${process.env.CLIENT_BASE_URL}/#/payments/success`,
        cancel_url: `${process.env.CLIENT_BASE_URL}/#/payments/failed`,
      });

      await strapi.entityService.create(`api::order.order`, {
        data: {
          products,
          strapiId: session.id,
        },
      });
      return { stripeId: session.id };
    } catch (e) {
      console.log(e);
      ctx.response.status = 500;
      return e;
    }
  },
}));
