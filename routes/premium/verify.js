import express from "express";
import auth from "../../middleware/auth.js";
import { google } from "googleapis";
import { db } from "../../config/firebase.js";

const router = express.Router();

const authClient = new google.auth.GoogleAuth({
  keyFile: "google-play-service.json",
  scopes: [
    "https://www.googleapis.com/auth/androidpublisher"
  ]
});

router.post(
  "/verify",
  auth,
  async (req, res) => {

    try {

      const uid = req.user.uid;

      const {
        purchaseToken,
        subscriptionId,
        basePlanId,
        productId
      } = req.body;

      /* =========================
         COIN SATIN ALMA
      ========================= */

      if (
        productId === "coin_25" ||
        productId === "coin_50" ||
        productId === "coin_100"
      ) {

        let addCoin = 0;

        if(productId === "coin_25"){
          addCoin = 25;
        }

        if(productId === "coin_50"){
          addCoin = 50;
        }

        if(productId === "coin_100"){
          addCoin = 100;
        }

        const userRef =
          db.collection("users")
          .doc(uid);

        await db.runTransaction(
          async tx => {

            const snap =
              await tx.get(userRef);

            const data =
              snap.data() || {};

            const currentCoin =
              data.abCoin || 0;

            tx.update(
              userRef,
              {
                abCoin:
                  currentCoin + addCoin
              }
            );

          }
        );

        return res.json({

          success:true,
          type:"coin",
          added:addCoin

        });

      }

      /* =========================
         PREMIUM
      ========================= */

      const androidpublisher =
        google.androidpublisher({
          version: "v3",
          auth: authClient
        });

      const result =
        await androidpublisher
          .purchases
          .subscriptionsv2
          .get({

          packageName:
            "com.arapbaci.app",

          token:
            purchaseToken

        });

      const sub =
        result.data;

      const active =
        sub.subscriptionState ===
        "SUBSCRIPTION_STATE_ACTIVE";

      if(!active){

        return res.status(400)
        .json({
          error:
          "Abonelik aktif değil"
        });

      }

      await db
        .collection("users")
        .doc(uid)
        .update({

          isPremium: true,

          premiumType:
            basePlanId,

          premiumSubscriptionId:
            subscriptionId,

          premiumPurchaseToken:
            purchaseToken,

          premiumUpdatedAt:
            new Date()
              .toISOString()

        });

      return res.json({

        success:true,
        type:"premium"

      });

    } catch(err){

      console.error(err);

      return res.status(500)
      .json({

        error:
        err.message

      });

    }

  }
);

export default router;