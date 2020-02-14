/**
 * Created by ogeva on 7/1/2017.
 */

const SMTPServer = require("smtp-server").SMTPServer;
const simpleParser = require("mailparser").simpleParser;
const logger = require("./logger");
const axios = require("axios");
let mailserver;

function startSTMPServer(properties, db) {
  const smtpPort = properties.smtpPort;
  logger.info("starting smtp on " + properties.smtpPort);
  mailserver = new SMTPServer({
    logger: false,
    authOptional: true,
    disabledCommands: ["AUTH"],
    disableReverseLookup: true,
    maxClients: 5,
    onConnect(session, callback) {
      logger.info("SMTP Connect from " + session.remoteAddress);
      return callback(); // Accept the connection
    },
    onMailFrom(address, session, callback) {
      logger.info("SMTP MAIL FROM: " + address.address);
      return callback();
    },
    onRcptTo(address, session, callback) {
      logger.info("SMTP RCPT TO: " + address.address);
      if (!validateAddress(address, properties.allowedDomains)) {
        logger.error(address + " is not allowed!");
        return callback(
          new Error(
            "Only the domains " +
              [JSON.stringify(properties.allowedDomains)] +
              " are allowed to receive mail"
          )
        );
      }
      return callback(); // Accept the address
    },
    onData(stream, session, callback) {
      logger.info("SMTP DATA start");
      let mailDataString = "";

      stream.on("data", function(chunk) {
        mailDataString += chunk;
      });

      stream.on("end", function() {
        logger.info("SMTP DATA end");
        simpleParser(mailDataString, (err, mail) => {
          mail.timestamp = new Date().getTime();

          console.log(mail.from);

          let fromText = mail.from && mail.from.text;
          let apiUrl = properties.newKdmidBackendUrl;

          if (fromText.includes("@cic.gc.ca")) {
            apiUrl = properties.canadaETABackendUrl;
          }

          axios
            .put(
              apiUrl + `/ds-160/forwardEmail/`,
              {
                to: mail.to,
                subject: mail.subject,
                textAsHtml: mail.textAsHtml,
                attachments: mail.attachments
              },
              { headers: { "Content-Type": "application/json" } }
            )
            .then(() => console.log("Axios Success"))
            .catch(err => console.log(err));

          // replace header map with one in which  . in the header keys are changed to _ due to insertion probelm
          mail.headers.forEach(function(value, key) {
            if (key.includes(".")) {
              const newkey = key.replace(/\./g, "_");
              mail.headers.set(newkey, mail.headers.get(key));
              mail.headers.delete(key);
            }
          });

          db.collection("emails").insertOne(mail, function(err1, result) {
            if (err1) {
              logger.error("Error in writing email to db!", err1);
              return;
            }

            // count email
            db.collection("emailCount").updateOne(
              {},
              {
                $inc: { count: 1 },
                $setOnInsert: { since: new Date().getTime() }
              },
              { upsert: true }
            );

            mail.to.value.forEach(recipient => {
              const nameAndDomain = recipient.address.split("@");
              if (
                properties.allowedDomains.indexOf(
                  nameAndDomain[1].toLowerCase()
                ) > -1
              ) {
                db.collection("mailboxes").updateOne(
                  { name: nameAndDomain[0].toLowerCase() },
                  {
                    $push: {
                      emails: {
                        emailId: mail._id,
                        sender: mail.from.value[0],
                        subject: mail.subject,
                        timestamp: mail.timestamp,
                        isRead: false
                      }
                    }
                  },
                  { upsert: true },
                  function(err2, res) {
                    if (err2) {
                      logger.error("Error in writing to mailbox db", err2);
                      return;
                    }
                    logger.info("updated email content in db.");
                  }
                );
              }
            });
          });
        });
        return callback();
      });
    }
  });

  mailserver.on("error", err => {
    logger.error(err);
  });

  mailserver.listen(smtpPort);

  return mailserver;
}

function validateAddress(address, allowedDomains) {
  // return true always if: a) allowedDomains is empty or b) null or c) properties.json only has my.domain.com
  if (
    !allowedDomains ||
    (allowedDomains && allowedDomains.length) ||
    (allowedDomains &&
      allowedDomains.length === 1 &&
      allowedDomains[0] === "my.domain.com")
  ) {
    return true;
  }

  let allowed = false;

  allowedDomains.forEach(domain => {
    // console.log(JSON.stringify(address.address.split('@')[1].toLowerCase()));
    // console.log(JSON.stringify(domain));
    if (
      address.address
        .split("@")[1]
        .toLowerCase()
        .endsWith(domain.toLowerCase())
    ) {
      allowed = true;
    }
  });
  return allowed;
}

module.exports = startSTMPServer;
module.exports.close = () => {
  mailserver.close(callback);
};
