import express from "express";
import crypto from "crypto";
import nodemailer from "nodemailer";

import auth from "../../middleware/auth.js";
import { db, admin } from "../../config/firebase.js";

const router = express.Router();

/* =========================
   HELPERS
========================= */

async function deleteUserData(uid){

  /* USERS */

  await db
    .collection("users")
    .doc(uid)
    .delete();

  /* HISTORY */

  const collections = [

    "falHistory",
    "tarotHistory",
    "dreamHistory",
    "melekHistory",
    "elFalHistory",
    "uyumHistory",
    "sessions"

  ];

  for(const name of collections){

    const snap = await db
      .collection(name)
      .where(
        "uid",
        "==",
        uid
      )
      .get();

    const batch = db.batch();

    snap.docs.forEach(doc=>{

      batch.delete(
        doc.ref
      );

    });

    await batch.commit();

  }

  /* AUTH */

  await admin
    .auth()
    .deleteUser(uid);

}

/* =========================
   APP DELETE
   POST /user/delete
========================= */

router.post(
"/delete",
auth,
async(req,res)=>{

try{

const uid =
req.user?.uid;

if(!uid){

return res
.status(401)
.json({

error:
"Token gerekli"

});

}

await deleteUserData(
uid
);

return res.json({

success:true,

message:
"Hesap silindi"

});

}
catch(e){

console.error(e);

return res
.status(500)
.json({

error:
"Hesap silinemedi"

});

}

});

/* =========================
   WEB REQUEST
   POST /user/request-delete
========================= */

router.post(
"/request-delete",
async(req,res)=>{

try{

const { email } =
req.body;

if(!email){

return res
.status(400)
.json({

error:
"Mail gerekli"

});

}

const user =
await admin
.auth()
.getUserByEmail(
email
);

const token =
crypto
.randomBytes(32)
.toString("hex");

await db
.collection(
"deleteRequests"
)
.doc(token)
.set({

uid:user.uid,

email,

used:false,

createdAt:
Date.now()

});

const transporter =
nodemailer
.createTransport({

host:
"srvc38.trwww.com",

port:465,

secure:true,

auth:{

user:
"support@arapbaci.com",

pass:
process.env.MAIL_PASS

}

});

const link =

`https://arapbaci.com/confirm-delete.html?token=${token}`;

await transporter.sendMail({

from:
'"Arap Bacı" <support@arapbaci.com>',

to:email,

subject:
"Arap Bacı Hesap Silme",

html:

`

<h2>

Arap Bacı

</h2>

<p>

Hesabınızı silmek için:

</p>

<p>

<a href="${link}">

Hesabı Sil

</a>

</p>

`

});

return res.json({

success:true,

message:
"Silme bağlantısı gönderildi"

});

}
catch(e){

console.error(e);

return res
.status(500)
.json({

error:
"Mail gönderilemedi"

});

}

});

/* =========================
   WEB CONFIRM
   POST /user/confirm-delete
========================= */

router.post(
"/confirm-delete",
async(req,res)=>{

try{

const { token } =
req.body;

if(!token){

return res
.status(400)
.json({

error:
"Token gerekli"

});

}

const ref =
db
.collection(
"deleteRequests"
)
.doc(token);

const snap =
await ref.get();

if(
!snap.exists
){

return res
.status(400)
.json({

error:
"Geçersiz token"

});

}

const data =
snap.data();

await deleteUserData(
data.uid
);

await ref.delete();

return res.json({

success:true,

message:
"Hesap silindi"

});

}
catch(e){

console.error(e);

return res
.status(500)
.json({

error:
"Silinemedi"

});

}

});

export default router;