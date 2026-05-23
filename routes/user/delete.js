import express from "express";
import crypto from "crypto";
import nodemailer from "nodemailer";

import auth from "../../middleware/auth.js";
import { db, admin } from "../../config/firebase.js";

const router = express.Router();

/* =========================
   HELPERS
========================= */

async function deleteUserData(uid) {

  await db
    .collection("users")
    .doc(uid)
    .delete();

  const collections = [
    "falHistory",
    "tarotHistory",
    "dreamHistory",
    "melekHistory",
    "elFalHistory",
    "uyumHistory",
    "sessions",
  ];

  for (const name of collections) {

    const snap = await db
      .collection(name)
      .where(
        "uid",
        "==",
        uid
      )
      .get();

    if (snap.empty) {
      continue;
    }

    const batch = db.batch();

    snap.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });

    await batch.commit();
  }

  await admin
    .auth()
    .deleteUser(uid);
}

/* =========================
   APP DELETE
========================= */

router.post(
"/delete",
auth,

async(
req,
res
)=>{

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

console.error(
"APP DELETE ERROR:",
e
);

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
========================= */

router.post(
"/request-delete",

async(
req,
res
)=>{

try{

const email =
String(
req.body?.email
||""
)

.trim()

.toLowerCase();

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

.randomBytes(
32
)

.toString(
"hex"
);

await db

.collection(
"deleteRequests"
)

.doc(
token
)

.set({

uid:
user.uid,

email,

used:false,

createdAt:
Date.now()

});

const link =

`https://arapbaci.com/confirm-delete.html?token=${token}`;

console.log(
"MAIL USER:",
process.env
.MAIL_USER
);

console.log(
"MAIL PASS EXISTS:",
!!process.env
.MAIL_PASS
);

const transporter =

nodemailer
.createTransport({

host:
"smtp-relay.brevo.com",

port:587,

secure:false,

requireTLS:true,

auth:{

user:
process.env
.MAIL_USER,

pass:
process.env
.MAIL_PASS

},

tls:{

rejectUnauthorized:
false

},

logger:true,

debug:true,

connectionTimeout:
30000,

greetingTimeout:
30000,

socketTimeout:
30000

});

try{

await transporter
.verify();

console.log(
"BREVO OK"
);

}
catch(e){

console.error(
"VERIFY ERROR:",
e
);

throw e;

}

await transporter
.sendMail({

from:

`"Arap Bacı Destek" <${process.env.MAIL_USER}>`,

to:
email,

subject:
"Arap Bacı Hesap Silme",

html:`

<h2>

Arap Bacı

</h2>

<p>

Hesabınızı silmek için
aşağıdaki bağlantıya
tıklayın:

</p>

<p>

<a href="${link}">

HESABI SİL

</a>

</p>

<p>

Bu işlem geri
alınamaz.

</p>

`

});

return res.json({

success:true,

message:
"Silme maili gönderildi"

});

}
catch(e){

console.error(
"DELETE MAIL ERROR:",
e
);

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
========================= */

router.post(
"/confirm-delete",

async(
req,
res
)=>{

try{

const token =

String(
req.body?.token
||""
)

.trim();

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

.doc(
token
);

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

if(
!data?.uid
){

return res
.status(400)
.json({

error:
"Geçersiz istek"

});

}

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

console.error(
"CONFIRM DELETE ERROR:",
e
);

return res
.status(500)
.json({

error:
"Silinemedi"

});

}

});

export default router;