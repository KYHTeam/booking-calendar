require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const nodemailer = require("nodemailer");
const ical = require("node-ical");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(bodyParser.json());

let airbnbEvents = [];

async function loadCalendar() {
  const data = await ical.async.fromURL(process.env.ICAL_URL);
  airbnbEvents = Object.values(data).map(event => ({
    start: new Date(event.start),
    end: new Date(event.end)
  }));
}

function isAvailable(startDate, endDate) {
  const oneDay = 86400000;
  for (let ev of airbnbEvents) {
    const bufferStart = new Date(ev.start.getTime() - oneDay);
    const bufferEnd = new Date(ev.end.getTime() + oneDay);
    if (
      (startDate >= bufferStart && startDate < bufferEnd) ||
      (endDate > bufferStart && endDate <= bufferEnd)
    ) {
      return false;
    }
  }
  return true;
}

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

app.post("/book", async (req, res) => {
  const { name, email, startDate, endDate } = req.body;
  const sDate = new Date(startDate);
  const eDate = new Date(endDate);

  const nights = (eDate - sDate) / (1000 * 60 * 60 * 24);
  if (nights < 2) {
    return res.status(400).send({ message: "Minimum stay is 2 nights." });
  }

  await loadCalendar();

  if (!isAvailable(sDate, eDate)) {
    return res.status(400).send({ message: "Selected dates are not available." });
  }

  const message = `
    New Booking Request:
    Name: ${name}
    Email: ${email}
    From: ${startDate}
    To: ${endDate}
    Nights: ${nights}
  `;

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: `${email}, ${process.env.EMAIL_USER}`,
    subject: "New Booking Confirmation",
    text: message
  };

  transporter.sendMail(mailOptions, function(error, info){
    if (error) {
      console.error(error);
      res.status(500).send({ message: "Failed to send email." });
    } else {
      res.send({ message: "Booking successful and email sent!" });
    }
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});