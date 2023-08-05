import parser from "node-html-parser";
import puppeteer from "puppeteer";
import chalk from "chalk";
import dotenv from "dotenv";
dotenv.config();


// CONFIG
import { 

  COOKIE, 
  MAXPROMPT,
  RULES, 
  PRIOD, 
  BAD


} from "./config.js";

let systemmsgs = [];
let result = [];

// let charname;
let page;
let browser;

async function initializeDriver() {
  browser = await puppeteer.launch({headless: "new"})
  page = await browser.newPage()
  await page.setViewport({ width: 1366, height: 768});
  await page.goto("https://poe.com/")
  await page.setCookie({name: 'p-b',value: COOKIE});
}
async function convertPOEtoOAI(messages, maxTokens) {
  let messageout = messages;
  let newresponse = {
    id: "chatcmpl-7ep1aerr8frmSjQSfrNnv69uVY0xM",
    object: "chat.completion",
    created: Date.now(),
    model: "gpt-3.5-turbo-0613",
    choices: [
      {
        index: 0,
        message: {
          role: "assistant",
          content: `${messageout}`,
        },
        finish_reason: "stop",
      },
    ],
    usage: {
      prompt_tokens: 724,
      completion_tokens: 75,
      total_tokens: 799,
    },
  };
  return newresponse;
}
// TODO: make this faster
async function createBot(){
  try {
    await page.goto("https://poe.com/create_bot")
    await page.setCookie({name: 'p-b',value: COOKIE});

    // Selectors
    const [prompt_textfield] = await page.$x(`//*[@id="__next"]/div[1]/div/section/div[2]/div/form/div[6]/textarea`);
    const [model_select] = await page.$x(`//*[@id="__next"]/div[1]/div/section/div[2]/div/form/div[5]/div[2]/select`);
    const [button] = await page.$x(`//*[@id="__next"]/div[1]/div/section/div[2]/div/form/div[11]/button`);


    let prompt_message;
    systemmsgs.forEach(system => {
      prompt_message += system
    });
    RULES.forEach(rule => {
      prompt_message += rule
    });

    await prompt_textfield.type(" ")
    await page.evaluate(
      (element, value) => element.value = value,  
      prompt_textfield, 
      prompt_message
    );
    await model_select.select('chinchilla');

    await button.click()
    console.log("> Bot Created")

  } catch (error) {
    console.log("> Failed To Create Bot, Retrying")
    await createBot()
  }
}
// TODO: clean up the code abit
async function getResult(){
  try {
    console.log("> Waiting for Response")
    const selector = '//*[@id="__next"]/div[1]/div/section/div[2]/div/div/button';

    await page.waitForXPath(selector);    
    const [element] = await page.$x(selector);    
    await page.waitForFunction(elem => elem.parentNode === null, {}, element);
    console.log("> Getting Response")

    let lastmsg = "";
    let root = parser.parse(await page.content());
    let out = root.querySelectorAll(".Markdown_markdownContainer__UyYrv");
    let lastbubble = out[out.length - 1].querySelectorAll("p");
    
    for (let bubble of lastbubble) {
      lastmsg += bubble.innerHTML;
      lastmsg += "\n";
    }

    return lastmsg

    .replace(/<em>/g, "*")
    .replace(/<\/em>/g, "*")
    .replace(/<br>/g, "")
    .replace(/<p>/g, "")
    .replace(/<\/p>/g, "")
    .replace('<a node="[object Object]" class="MarkdownLink_linkifiedLink__KxC9G">',"")
    .replace(/<\/a>/g, "")
    .replace('<code node="[object Object]">', "")
    .replace(/<\/code>/g, "")
    .replace("You:","");
    
  } catch (error) {
    console.log("> Failed to get Result, Retrying")
    await getResult()
  }
}
async function sendMessages(input) {
  let messages = []
  messages.push(input);
  try {
    let textfield = await page.waitForXPath(`//*[@id="__next"]/div[1]/div/section/div[2]/div/div/footer/div/div/div[1]/textarea`)
    let i = 0
    let html;
    while (messages.length >= i) {
      let message = messages[i]
      if (html == await page.content()){
        console.log('> Sending Message')
        await page.evaluate((element, value) => element.value = value,  textfield, message)
        await textfield.type(" ")

        await textfield.press('Enter');
        console.log('> Send Message')
        i++
        if (i == messages.length){
          break
        }
      }else{
        html = await page.content()
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }
  } catch (error) {
    console.log("> Failed to Send Message, Retrying")
    await sendMessages(input)
  }
}

//TODO: Add some Code that splits messages at the MAXPROMPT limit
async function messageContructor(messages){
  // let systemsplit = messages[0].content.split("'s");

  // for (let sentence of systemsplit) {
  //   if (sentence.includes("Write ")) {
  //     charname = sentence.substring(6);
  //     break;
  //   }
  // }
  result = ["The message history, respond to the last message accordingly do not at any point include 'You:' or 'User:' in you're responses"];
  systemmsgs = []

  for (let message of messages) {

    if (message.role === "system") {
      systemmsgs.push(message.content);
    } else if (message.role === "assistant") {
      result += `You: ${message.content}`+ "\n";
    } else if (message.role === "user") {
      result += `User: ${message.content}`+ "\n";
    }
  }
  return (result)
}

async function sagedriverCompletion(req, res) {
  if (req.body.stream == true) {
    console.log("> Streaming isnt Supported yet")
  } else {
    await initializeDriver();
    await messageContructor(req.body.messages);
    await createBot()
    await sendMessages(result)

    let maxtoken = req.body.max_tokens;
    let lastmsg = await getResult();
    let newres = await convertPOEtoOAI(lastmsg, maxtoken);
    if (typeof newres == "object") newres = JSON.parse(JSON.stringify(newres));

    // message selector
    let message = newres.choices[0].message.content;

    browser.close();
    if (BAD.some(str => message.startsWith(str)) || message.includes("User:")){
      console.log("> Bad Response, Retrying")
      await sagedriverCompletion(req, res)
    }else{
      res.status(200).json(newres);   
      console.log("> Got Message, Waiting for Another Request..." )
    }
  }
}

export { sagedriverCompletion };