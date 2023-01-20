import * as dotenv from "dotenv";
dotenv.config();
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const express = require("express");
const puppeteer = require("puppeteer");
import { ChatGPTAPIBrowser } from "chatgpt";
const cors = require("cors");
const app = express();
const PORT = process.env.SERVER_PORT;
//middleware that is used to parse incoming request bodies that are sent
//in the x-www-form-urlencoded format and is used to extract the data from
//the request body and make it available on the request object (req.body)
//for further processing. When set to true, it will use the qs library to
//parse the data, which allows for more advanced features such as nested
//objects. x-www-form-urlencoded is a format for encoding key-value pairs
//in an HTTP request body. It is often used in web forms as a way to transmit
//data to a server. name=John&age=25&gender=male and would be sent in the body
//of an HTTP request with the Content-Type header set to
//application/x-www-form-urlencoded.
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cors());

app.get("/", (req, res) => {
  res.json({
    message: "Hello world",
  });
});

const database = [];
const generateID = () => Math.random().toString(36).substring(2, 10);

async function chatgptFunction(content) {
  // use puppeteer to bypass cloudflare (headful because of captchas)
  const api = new ChatGPTAPIBrowser({
    email: process.env.CHAT_GPT_EMAIL,
    password: process.env.CHAT_GPT_PASSWORD,
    isGoogleLogin: true,
  });
  await api.initSession();

  const getBrandName = await api.sendMessage(
    `I have a raw text of a website, what is the brand name in a single word? ${content}`
  );

  const getBrandDescription = await api.sendMessage(
    `I have a raw text of a website, can you extract the description of the website from the raw text. I need only the description and nothing else. ${content}`
  );

  return {
    brandName: getBrandName.response,
    brandDescription: getBrandDescription.response,
  };
}

app.post("/url", (req, res) => {
  const { url } = req.body;

  (async () => {
    //launch a new instance of a web browser, typically Google Chrome.
    //It returns an object that can be used to control the browser and
    //interact with web pages
    const browser = await puppeteer.launch({
      executablePath:
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      headless: false,
    });
    //creates a new tab or page in the browser instance that was launched
    //This allows the developer to interact with and manipulate the
    //contents of that new page.
    const page = await browser.newPage();
    //navigates the web page that the "page" variable is pointing to, to
    //the specified url. Typically used in web scraping or web crawling
    //projects to navigate to different pages on a website in order to
    //extract data or perform other actions
    await page.goto(url);
    //evaluate method to execute a function within the context of the
    //currently loaded page. The function returns the text content of the
    //entire website, including all text within the HTML elements.
    const websiteContent = await page.evaluate(() => {
      return document.documentElement.innerText.trim();
    });
    //to extract the "og:image" meta tag from the website's HTML. The
    //"og:image" meta tag is commonly used to specify a preview image for
    //a website when it is shared on social media platforms. The code loops
    //through all of the meta tags on the page, and when it finds the
    //"og:image" meta tag, it extracts its "content" attribute and assigns
    //it to the variable "websiteOgImage"
    const websiteOgImage = await page.evaluate(() => {
      const metas = document.getElementsByTagName("meta");
      for (let i = 0; i < metas.length; i++) {
        if (metas[i].getAttribute("property") === "og:image") {
          return metas[i].getAttribute("content");
        }
      }
    });

    let result = await chatgptFunction(websiteContent);
    result.brandImage = websiteOgImage;
    result.id = generateID();
    database.push(result);
    await browser.close();
    //Send back a JSON response to the client
    return res.json({
      message: "Request successful!",
      database,
    });
  })();
});

app.listen(PORT, () => {
  console.log(`Server listening on ${PORT}`);
});

module.exports = app;
