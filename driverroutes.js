import parser from "node-html-parser";
import puppeteer from "puppeteer-extra";
import stealth from "puppeteer-extra-plugin-stealth"
import chalk from "chalk";
import dotenv from "dotenv";
import fs from "fs"
dotenv.config();


// CONFIG
import { 

  COOKIE, 
  MAXPROMPT,
  RULES, 
  BAD

} from "./config.js";
let systemmsgs = [];
let result = [];

let charname;
let page;
let browser;

async function initializeDriver() {
  puppeteer.use(stealth())

  browser = await puppeteer.launch({headless: false})
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

    // name text field
    const [name] = await page.$x(`//*[@id="__next"]/div[1]/div/section/div[2]/div/form/div[2]/input`)

    const botname = `${RandomString(8)}_Custom`;
    
    await page.evaluate((element, value) => 
    element.value = 
      value,  
      name, 
      botname
    );
    await name.press("Enter")
    setBotName(botname)

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
async function editBot(){ 
  try {
    let BotName = process.env.BOT_NAME;

    await page.goto(`https://poe.com/edit_bot?bot=${BotName}`)
    await page.setCookie({name: 'p-b',value: COOKIE});

    // Selectors
    const [prompt_textfield] = await page.$x(`//*[@id="__next"]/div[1]/div/section/div[2]/div/form/div[5]/textarea`);
    const [button] = await page.$x(`//*[@id="__next"]/div[1]/div/section/div[2]/div/form/div[10]/button`);

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
    // await button.click()
    console.log("> Bot Edited")

  } catch (error) {
    if (await page.$x(`//*[@id="__next"]/div[1]/div/section/div[2]/div/div`)){
      console.log("> Bot got Flagged, Recreating")
      setBotName("")
      await createBot()
    }else{
      console.log("> Failed To Edit Bot, Retrying")
      await editBot()
    }
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
  dotenv.config({override: true});

  let BotName = process.env.BOT_NAME;

  if (BotName != "")
  {
    page.goto(`https://poe.com/${BotName}`)
  }

  let messages = input
  try {
    let textfield = await page.waitForXPath(`//*[@id="__next"]/div[1]/div/section/div[2]/div/div/footer/div/div/div[1]/textarea`)
    let i = 0
    let html;
    while (messages.length >= i) {
      let message = messages[i]
      console.log('> Sending Message')
      
      await page.evaluate((element, value) => element.value = value,  textfield, message)
      await textfield.type(" ")
      await textfield.press('Enter');

      console.log('> Send Message')
      i++
      if (i == messages.length){
        break
      }

      const selector = '//*[@id="__next"]/div[1]/div/section/div[2]/div/div/button';
      await page.waitForXPath(selector);    
      const [element] = await page.$x(selector);    
      await page.waitForFunction(elem => elem.parentNode === null, {}, element);
    }
  } catch (error) {
    if (await page.$x(`//*[@id="__next"]/div[1]/div/section/div[2]/div/div`)){
      console.log("> Bot got Flagged, Recreating")
      await createBot()
      await sendMessages(input)
    }else{
      console.log("> Failed to Send Message, Retrying")
      await sendMessages(input)
    }
  }
}


async function messageContructor(messages){
  // let systemsplit = messages[0].content.split("'s");
  // for (let sentence of systemsplit) {
  //   if (sentence.includes("Write ")) {
  //     charname = sentence.substring(6);
  //     break;
  //   }
  // }
  let res_message;

  systemmsgs = []
  let send = [];

  for (let message of messages) {
    if (message.role === "system") {
      systemmsgs.push(message.content);
    } else if (message.role === "assistant") {
      res_message += `you're response: ${message.content}`+ "\n";
    } else if (message.role === "user") {
      res_message += `user: ${message.content}`+ "\n";
    }
  }
  if (String(res_message).length >= 5000){
    result = split(res_message,MAXPROMPT,".")
  }else{
    result.push(res_message)
  }

  result.forEach(mes => {
    send.push(
    `
    Generate a Response according to 
    these chat messages in character \n

    \n
    Chat [\n ${mes}\n]
    `)
  });
  return (send)
}

async function sagedriverCompletion(req, res) {
  dotenv.config({override: true});

  if (req.body.stream == true) {
    console.log("> Streaming isnt Supported yet")
  } else {
    await initializeDriver();
    let send = await messageContructor(req.body.messages);
    if (process.env.BOT_NAME != ""){
      await editBot()
    }else{
      await createBot()
    }
    await sendMessages(send)

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
function RandomString(length) {
  let result = '';
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const charactersLength = characters.length;

  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }

  return result;
}
function setBotName(input){
      fs.readFile('.env', 'utf8', (err, data) => {
      if (err) {
          console.error(err);
          return;
        }
        const updatedData = data.replace(/^BOT_NAME=.*/m, `BOT_NAME=${input}`);

        fs.writeFile('.env', updatedData, 'utf8', (err) => {
          if (err) {
            console.error(err);
            return;
          }
          console.log('> Value in .env file updated successfully.');
        });
      });
}
function split(str, length, backChar) {
  const result = [];
  let index = 0;

  let Message = 
  `
  if you understand this only Respont with "Understood." 
  and nothing else wait for the message without this under it than respont appropriately according to the senario 
  `

  while (index < str.length) {
    let substring = str.substring(index, index + length);

    if (substring.includes(backChar)) {
      const backCharIndex = substring.lastIndexOf(backChar);
      substring = substring.substring(0, backCharIndex + 1);
      index += backCharIndex + 1;
    } else {
      index += length;
    }

    result.push(substring + (index < str.length ? Message : ''));
  }

  return result;
}
export { sagedriverCompletion };